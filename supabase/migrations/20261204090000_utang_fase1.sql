-- Utang dan piutang, fase 1 (tanpa bunga dan tanpa jadwal cicilan).
-- Aturan hitung (Keputusan 1): kategori sistem Utang, Pembayaran Utang, Piutang, dan Pelunasan Piutang
-- bukan pemasukan atau pengeluaran riil. Saldo dompet tetap berubah lewat transaksi biasa.
--
-- 1. report_summary: definisi dari 20261201090000, ditambah filter kategori kewajiban.
-- 2. catat_utang: membuat baris debts dan transaksi pencatatan dalam satu transaksi database.
-- 3. bayar_utang: membuat angsuran (debt_payments) dan transaksi pembayaran dalam satu transaksi database.

-- ============================================================
-- 1. Analisa: kategori kewajiban dikecualikan dari pemasukan/pengeluaran riil
-- ============================================================
create or replace function public.report_summary(p_from date, p_to date)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with tx as (
    select t.id, t.tanggal, t.deskripsi, t.tipe, t.nominal,
           coalesce(nullif(btrim(s.kategori), ''), nullif(btrim(t.kategori), ''), 'Tanpa kategori') as kat
    from public.transactions t
    left join public.subkategori s on s.id = t.subkategori_id
    where t.user_id = auth.uid()
      and t.deleted_at is null
      and coalesce(s.kategori, t.kategori, '') is distinct from 'Penyesuaian Saldo'
      and coalesce(s.kategori, t.kategori, '') not in ('Utang', 'Pembayaran Utang', 'Piutang', 'Pelunasan Piutang')
      and not (t.transfer_id is not null and coalesce(s.kategori, t.kategori, '') is distinct from 'Biaya Admin')
  ),
  per as (
    select * from tx where tanggal between p_from and p_to
  ),
  tot as (
    select
      coalesce(sum(nominal) filter (where tipe = 'Pemasukan'), 0)   as masuk,
      coalesce(sum(nominal) filter (where tipe = 'Pengeluaran'), 0) as keluar
    from per
  ),
  kat_keluar as (
    select kat, sum(nominal) as total
    from per where tipe = 'Pengeluaran'
    group by kat
  ),
  kat_masuk as (
    select kat, sum(nominal) as total
    from per where tipe = 'Pemasukan'
    group by kat
  ),
  bulan as (
    select generate_series(
      (date_trunc('month', p_to)::date - interval '5 months')::date,
      date_trunc('month', p_to)::date,
      interval '1 month'
    )::date as awal
  ),
  tren as (
    select b.awal,
      coalesce(sum(x.nominal) filter (where x.tipe = 'Pemasukan'), 0)   as masuk,
      coalesce(sum(x.nominal) filter (where x.tipe = 'Pengeluaran'), 0) as keluar
    from bulan b
    left join tx x on date_trunc('month', x.tanggal)::date = b.awal
    group by b.awal
  )
  select jsonb_build_object(
    'periode', jsonb_build_object('dari', p_from, 'sampai', p_to),
    'pemasukan', (select masuk from tot),
    'pengeluaran', (select keluar from tot),
    'sisa_bersih', (select masuk - keluar from tot),
    'rasio_tabungan', (select case when masuk > 0 then round((masuk - keluar) * 100.0 / masuk, 1) end from tot),
    'per_kategori', coalesce((
      select jsonb_agg(jsonb_build_object(
        'kategori', k.kat,
        'total', k.total,
        'persen', case when (select keluar from tot) > 0 then round(k.total * 100.0 / (select keluar from tot), 1) else 0 end
      ) order by k.total desc)
      from kat_keluar k
    ), '[]'::jsonb),
    'top_pengeluaran', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id, 'tanggal', r.tanggal, 'deskripsi', r.deskripsi, 'nominal', r.nominal, 'kategori', r.kat
      ) order by r.nominal desc)
      from (select * from per where tipe = 'Pengeluaran' order by nominal desc limit 5) r
    ), '[]'::jsonb),
    'tren_6_bulan', coalesce((
      select jsonb_agg(jsonb_build_object(
        'bulan', to_char(t.awal, 'YYYY-MM'), 'pemasukan', t.masuk, 'pengeluaran', t.keluar
      ) order by t.awal)
      from tren t
    ), '[]'::jsonb),
    'aliran_dana', jsonb_build_object(
      'sumber_pemasukan', coalesce((
        select jsonb_agg(jsonb_build_object('kategori', m.kat, 'total', m.total) order by m.total desc)
        from kat_masuk m
      ), '[]'::jsonb),
      'tujuan_pengeluaran', coalesce((
        select jsonb_agg(jsonb_build_object('kategori', k.kat, 'total', k.total) order by k.total desc)
        from kat_keluar k
      ), '[]'::jsonb),
      'transfer', (
        select jsonb_build_object(
          'jumlah', count(*),
          'total', coalesce(sum(w.nominal), 0),
          'biaya_admin', coalesce(sum(w.biaya_admin), 0)
        )
        from public.wallet_transfers w
        where w.user_id = auth.uid() and w.tanggal between p_from and p_to
      )
    )
  );
$$;

revoke all on function public.report_summary(date, date) from public, anon;
grant execute on function public.report_summary(date, date) to authenticated;

-- ============================================================
-- 2. Catat utang atau piutang baru
--    utang   : uang masuk ke dompet  -> transaksi Pemasukan, kategori 'Utang'
--    piutang : uang keluar dari dompet -> transaksi Pengeluaran, kategori 'Piutang'
-- ============================================================
create or replace function public.catat_utang(
  p_jenis text,
  p_pihak text,
  p_pokok numeric,
  p_tanggal date,
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
  v_id uuid;
begin
  if p_jenis not in ('utang', 'piutang') then
    raise exception 'Jenis tidak valid.';
  end if;
  if char_length(v_pihak) < 1 or char_length(v_pihak) > 80 then
    raise exception 'Nama pihak harus 1 sampai 80 karakter.';
  end if;
  if p_pokok is null or p_pokok <= 0 then
    raise exception 'Jumlah harus lebih dari nol.';
  end if;
  if p_tanggal is null then
    raise exception 'Tanggal wajib diisi.';
  end if;
  if p_wallet is null then
    raise exception 'Dompet wajib dipilih.';
  end if;

  insert into public.debts (jenis, pihak, pokok, tanggal_mulai, wallet_id, catatan)
  values (p_jenis, v_pihak, p_pokok, p_tanggal, p_wallet, nullif(btrim(coalesce(p_catatan, '')), ''))
  returning id into v_id;

  if p_jenis = 'utang' then
    insert into public.transactions (tanggal, deskripsi, tipe, nominal, wallet_id, kategori, berulang)
    values (p_tanggal, 'Utang dari ' || v_pihak, 'Pemasukan', p_pokok, p_wallet, 'Utang', false);
  else
    insert into public.transactions (tanggal, deskripsi, tipe, nominal, wallet_id, kategori, berulang)
    values (p_tanggal, 'Piutang ke ' || v_pihak, 'Pengeluaran', p_pokok, p_wallet, 'Piutang', false);
  end if;

  return v_id;
end;
$$;

revoke execute on function public.catat_utang(text, text, numeric, date, uuid, text) from public, anon;
grant execute on function public.catat_utang(text, text, numeric, date, uuid, text) to authenticated;

-- ============================================================
-- 3. Bayar angsuran utang, atau terima pelunasan piutang
--    utang   : uang keluar dari dompet -> transaksi Pengeluaran, kategori 'Pembayaran Utang'
--    piutang : uang masuk ke dompet    -> transaksi Pemasukan,   kategori 'Pelunasan Piutang'
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
  if v_debt.status <> 'aktif' then
    raise exception 'Catatan ini sudah lunas atau dibatalkan.';
  end if;
  if p_jumlah is null or p_jumlah <= 0 then
    raise exception 'Jumlah pembayaran harus lebih dari nol.';
  end if;
  if p_tanggal is null or p_wallet is null then
    raise exception 'Tanggal dan dompet wajib diisi.';
  end if;

  select coalesce(sum(jumlah_pokok), 0), coalesce(max(nomor), 0)
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
