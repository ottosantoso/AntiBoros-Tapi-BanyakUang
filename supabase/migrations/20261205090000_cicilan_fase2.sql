-- Cicilan, fase 2: jadwal angsuran dengan metode flat, anuitas, atau tanpa bunga.
-- Aturan hitung (Keputusan 1 dan 2):
--   pokok angsuran  -> transaksi Pengeluaran kategori 'Pembayaran Utang' (bukan pemasukan/pengeluaran riil)
--   bunga angsuran  -> transaksi Pengeluaran kategori 'Bunga & Biaya Cicilan' (pengeluaran riil)
-- Bunga_persen adalah bunga per tahun (p.a.). Flat: bunga = pokok x bunga% x tenor/12, dibagi rata.
-- Anuitas: angsuran tetap, bunga dihitung dari sisa pokok tiap bulan.
--
-- 1. Kolom transaction_bunga_id di debt_payments (transaksi bunga, terpisah dari pokok).
-- 2. bayar_utang: menolak cicilan, dan hanya menjumlahkan angsuran yang sudah lunas.
-- 3. buat_cicilan: membuat catatan debts dan seluruh jadwal debt_payments dalam satu transaksi database.
-- 4. bayar_angsuran: membayar satu angsuran (pokok dan bunga) sesuai urutan jadwal.

-- ============================================================
-- 1. Kolom transaksi bunga
-- ============================================================
alter table public.debt_payments
  add column if not exists transaction_bunga_id uuid references public.transactions(id) on delete set null;

-- ============================================================
-- 2. bayar_utang: tolak cicilan, hitung hanya angsuran lunas
-- ============================================================
create or replace function public.bayar_utang(
  p_debt uuid,
  p_jumlah numeric,
  p_tanggal date,
  p_wallet uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_debt public.debts%rowtype;
  v_terbayar numeric;
  v_sisa numeric;
  v_nomor integer;
  v_tx uuid;
begin
  select * into v_debt
  from public.debts
  where id = p_debt and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Catatan utang tidak ditemukan.';
  end if;
  if v_debt.jenis = 'cicilan' then
    raise exception 'Cicilan dibayar per angsuran dari jadwalnya.';
  end if;
  if v_debt.status <> 'aktif' then
    raise exception 'Catatan ini sudah lunas atau dibatalkan.';
  end if;
  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'Jumlah pembayaran harus lebih dari nol.';
  end if;
  if p_tanggal is null or p_wallet is null then
    raise exception 'Tanggal dan dompet wajib diisi.';
  end if;

  select coalesce(sum(jumlah_pokok) filter (where status = 'lunas'), 0), coalesce(max(nomor), 0)
  into v_terbayar, v_nomor
  from public.debt_payments
  where debt_id = p_debt;

  v_sisa := v_debt.pokok - v_terbayar;
  if p_jumlah > v_sisa then
    raise exception 'Jumlah melebihi sisa utang (sisa %).', v_sisa;
  end if;

  if v_debt.jenis = 'utang' then
    insert into public.transactions (tanggal, deskripsi, tipe, nominal, wallet_id, kategori, berulang)
    values (p_tanggal, 'Bayar utang ke ' || v_debt.pihak, 'Pengeluaran', p_jumlah, p_wallet, 'Pembayaran Utang', false)
    returning id into v_tx;
  else
    insert into public.transactions (tanggal, deskripsi, tipe, nominal, wallet_id, kategori, berulang)
    values (p_tanggal, 'Terima pelunasan dari ' || v_debt.pihak, 'Pemasukan', p_jumlah, p_wallet, 'Pelunasan Piutang', false)
    returning id into v_tx;
  end if;

  insert into public.debt_payments (debt_id, nomor, jatuh_tempo, jumlah_pokok, status, dibayar_pada, transaction_id)
  values (p_debt, v_nomor + 1, p_tanggal, p_jumlah, 'lunas', p_tanggal, v_tx);

  if v_sisa - p_jumlah = 0 then
    update public.debts set status = 'lunas' where id = p_debt;
  end if;

  return v_tx;
end;
$$;

revoke execute on function public.bayar_utang(uuid, numeric, date, uuid) from public, anon;
grant execute on function public.bayar_utang(uuid, numeric, date, uuid) to authenticated;

-- ============================================================
-- 3. Buat cicilan beserta jadwal angsuran
--    Pembelian yang dicicil tidak membuat transaksi. Pokok dan bunga dicatat saat angsuran dibayar.
-- ============================================================
create or replace function public.buat_cicilan(
  p_pihak text,
  p_pokok numeric,
  p_bunga_persen numeric,
  p_metode text,
  p_tenor integer,
  p_tanggal_mulai date,
  p_hari_jatuh_tempo integer,
  p_wallet uuid,
  p_catatan text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pihak text := btrim(coalesce(p_pihak, ''));
  v_bunga numeric := coalesce(p_bunga_persen, 0);
  v_r numeric;
  v_sisa numeric;
  v_total_bunga numeric := 0;
  v_pmt numeric := 0;
  v_pokok_i numeric;
  v_bunga_i numeric;
  v_jt date;
  v_first date;
  v_id uuid;
begin
  if char_length(v_pihak) < 1 or char_length(v_pihak) > 80 then
    raise exception 'Nama pihak harus 1 sampai 80 karakter.';
  end if;
  if p_pokok is null or p_pokok <= 0 then
    raise exception 'Harga pokok harus lebih dari nol.';
  end if;
  if p_metode not in ('flat', 'anuitas', 'tanpa_bunga') then
    raise exception 'Metode bunga tidak valid.';
  end if;
  if p_metode = 'tanpa_bunga' then
    v_bunga := 0;
  end if;
  if v_bunga < 0 or v_bunga > 100 then
    raise exception 'Bunga per tahun harus 0 sampai 100 persen.';
  end if;
  if p_tenor is null or p_tenor < 1 or p_tenor > 360 then
    raise exception 'Jumlah angsuran harus 1 sampai 360 bulan.';
  end if;
  if p_hari_jatuh_tempo is null or p_hari_jatuh_tempo < 1 or p_hari_jatuh_tempo > 28 then
    raise exception 'Tanggal jatuh tempo harus 1 sampai 28.';
  end if;
  if p_tanggal_mulai is null or p_wallet is null then
    raise exception 'Tanggal mulai dan dompet wajib diisi.';
  end if;

  insert into public.debts (jenis, pihak, pokok, bunga_persen, metode_bunga, tenor_bulan,
                            tanggal_mulai, hari_jatuh_tempo, wallet_id, catatan)
  values ('cicilan', v_pihak, p_pokok, v_bunga, p_metode, p_tenor,
          p_tanggal_mulai, p_hari_jatuh_tempo, p_wallet, nullif(btrim(coalesce(p_catatan, '')), ''))
  returning id into v_id;

  v_r := v_bunga / 100 / 12;
  if p_metode = 'anuitas' then
    if v_r > 0 then
      v_pmt := round(p_pokok * v_r / (1 - power(1 + v_r, -p_tenor)));
    else
      v_pmt := round(p_pokok / p_tenor);
    end if;
  elsif p_metode = 'flat' then
    v_total_bunga := round(p_pokok * v_bunga / 100 * p_tenor / 12);
  end if;

  -- Angsuran pertama jatuh di hari yang dipilih pada bulan mulai, atau bulan berikutnya kalau sudah lewat.
  v_first := make_date(extract(year from p_tanggal_mulai)::int, extract(month from p_tanggal_mulai)::int, p_hari_jatuh_tempo);
  if v_first < p_tanggal_mulai then
    v_first := (v_first + interval '1 month')::date;
  end if;

  v_sisa := p_pokok;
  for n in 1..p_tenor loop
    v_jt := (v_first + make_interval(months => n - 1))::date;

    if p_metode = 'anuitas' then
      v_bunga_i := round(v_sisa * v_r);
      v_pokok_i := v_pmt - v_bunga_i;
    else
      v_pokok_i := floor(p_pokok / p_tenor);
      v_bunga_i := floor(v_total_bunga / p_tenor);
    end if;

    -- Angsuran terakhir menutup sisa pembulatan supaya total tepat sama dengan pokok dan bunga.
    if n = p_tenor then
      v_pokok_i := v_sisa;
      if p_metode <> 'anuitas' then
        v_bunga_i := v_total_bunga - floor(v_total_bunga / p_tenor) * (p_tenor - 1);
      else
        v_bunga_i := round(v_sisa * v_r);
      end if;
    end if;

    insert into public.debt_payments (debt_id, nomor, jatuh_tempo, jumlah_pokok, jumlah_bunga, status)
    values (v_id, n, v_jt, v_pokok_i, v_bunga_i, 'belum');

    v_sisa := v_sisa - v_pokok_i;
  end loop;

  return v_id;
end;
$$;

revoke execute on function public.buat_cicilan(text, numeric, numeric, text, integer, date, integer, uuid, text) from public, anon;
grant execute on function public.buat_cicilan(text, numeric, numeric, text, integer, date, integer, uuid, text) to authenticated;

-- ============================================================
-- 4. Bayar satu angsuran cicilan
--    Pokok dan bunga masing-masing menjadi transaksi terpisah. Angsuran harus berurutan.
-- ============================================================
create or replace function public.bayar_angsuran(
  p_payment uuid,
  p_wallet uuid,
  p_tanggal date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_pay public.debt_payments%rowtype;
  v_debt public.debts%rowtype;
  v_tx_pokok uuid;
  v_tx_bunga uuid;
  v_belum_sebelumnya integer;
begin
  select * into v_pay
  from public.debt_payments
  where id = p_payment
  for update;

  if not found then
    raise exception 'Angsuran tidak ditemukan.';
  end if;

  select * into v_debt
  from public.debts
  where id = v_pay.debt_id and user_id = (select auth.uid());

  if not found then
    raise exception 'Catatan cicilan tidak ditemukan.';
  end if;
  if v_debt.jenis <> 'cicilan' then
    raise exception 'Angsuran hanya untuk cicilan.';
  end if;
  if v_debt.status <> 'aktif' then
    raise exception 'Cicilan ini sudah lunas atau dibatalkan.';
  end if;
  if v_pay.status = 'lunas' then
    raise exception 'Angsuran ini sudah dibayar.';
  end if;
  if p_wallet is null or p_tanggal is null then
    raise exception 'Tanggal dan dompet wajib diisi.';
  end if;

  select count(*) into v_belum_sebelumnya
  from public.debt_payments
  where debt_id = v_debt.id and nomor < v_pay.nomor and status <> 'lunas';
  if v_belum_sebelumnya > 0 then
    raise exception 'Bayar angsuran sebelumnya dulu.';
  end if;

  if v_pay.jumlah_pokok > 0 then
    insert into public.transactions (tanggal, deskripsi, tipe, nominal, wallet_id, kategori, berulang)
    values (p_tanggal, 'Angsuran ke-' || v_pay.nomor || ' ' || v_debt.pihak, 'Pengeluaran',
            v_pay.jumlah_pokok, p_wallet, 'Pembayaran Utang', false)
    returning id into v_tx_pokok;
  end if;

  if v_pay.jumlah_bunga > 0 then
    insert into public.transactions (tanggal, deskripsi, tipe, nominal, wallet_id, kategori, berulang)
    values (p_tanggal, 'Bunga angsuran ke-' || v_pay.nomor || ' ' || v_debt.pihak, 'Pengeluaran',
            v_pay.jumlah_bunga, p_wallet, 'Bunga & Biaya Cicilan', false)
    returning id into v_tx_bunga;
  end if;

  update public.debt_payments
  set status = 'lunas',
      dibayar_pada = p_tanggal,
      transaction_id = v_tx_pokok,
      transaction_bunga_id = v_tx_bunga
  where id = p_payment;

  if not exists (
    select 1 from public.debt_payments where debt_id = v_debt.id and status <> 'lunas'
  ) then
    update public.debts set status = 'lunas' where id = v_debt.id;
  end if;

  return coalesce(v_tx_pokok, v_tx_bunga);
end;
$$;

revoke execute on function public.bayar_angsuran(uuid, uuid, date) from public, anon;
grant execute on function public.bayar_angsuran(uuid, uuid, date) to authenticated;
