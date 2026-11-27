-- Notifikasi dasar (kotak masuk di aplikasi).
-- Jenis mengikuti constraint yang sudah ada: pengingat_harian, saldo_minus, budget_80, budget_100, jatuh_tempo_utang.
-- Setiap jenis default mati dan hanya dibuat kalau pengguna mengaktifkannya di notification_settings.
-- sinkronkan_notifikasi() dipanggil dari aplikasi. Notifikasi yang sama tidak dibuat dua kali (kolom referensi dicek dulu).
--
-- Isi:
--   jatuh_tempo_utang : angsuran jatuh tempo dalam 3 hari ke depan, dan angsuran yang terlambat (sekali per bulan)
--   budget_80         : pemakaian budget bulan ini mencapai 80% tapi belum 100%
--   budget_100        : pemakaian budget bulan ini mencapai atau melewati 100%
--   saldo_minus       : saldo dompet aktif di bawah nol (sekali per hari)
--   pengingat_harian  : belum ada catatan hari ini, dicek mulai pukul 20.00 WIB

create or replace function public.notifikasi_aktif(p_jenis text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select ns.aktif from public.notification_settings ns
     where ns.user_id = (select auth.uid()) and ns.jenis = p_jenis),
    false
  )
$$;

revoke execute on function public.notifikasi_aktif(text) from public, anon;
grant execute on function public.notifikasi_aktif(text) to authenticated;

create or replace function public.sinkronkan_notifikasi()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := (select auth.uid());
  v_hari date := (now() at time zone 'Asia/Jakarta')::date;
  v_bulan text := to_char(v_hari, 'YYYY-MM');
  v_jam integer := extract(hour from (now() at time zone 'Asia/Jakarta'))::integer;
  v_n integer;
  v_total integer := 0;
begin
  if v_uid is null then
    raise exception 'Belum masuk.';
  end if;

  -- 1. Angsuran jatuh tempo dalam 3 hari
  if public.notifikasi_aktif('jatuh_tempo_utang') then
    insert into public.notifications (user_id, jenis, judul, isi, referensi)
    select v_uid, 'jatuh_tempo_utang', 'Angsuran segera jatuh tempo',
           'Angsuran #' || p.nomor || ' ' || d.pihak || ' Rp ' || replace(to_char(p.jumlah_pokok + p.jumlah_bunga, 'FM999,999,999,990'), ',', '.')
             || ' jatuh tempo ' || to_char(p.jatuh_tempo, 'DD/MM/YYYY') || '.',
           'jt:' || p.id || ':' || p.jatuh_tempo
    from public.debt_payments p
    join public.debts d on d.id = p.debt_id
    where d.user_id = v_uid and d.status = 'aktif' and p.status <> 'lunas'
      and p.jatuh_tempo between v_hari and v_hari + 3
      and not exists (
        select 1 from public.notifications n
        where n.user_id = v_uid and n.referensi = 'jt:' || p.id || ':' || p.jatuh_tempo
      );
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;

    -- 2. Angsuran terlambat (sekali per bulan)
    insert into public.notifications (user_id, jenis, judul, isi, referensi)
    select v_uid, 'jatuh_tempo_utang', 'Angsuran terlambat',
           'Angsuran #' || p.nomor || ' ' || d.pihak || ' belum dibayar sejak ' || to_char(p.jatuh_tempo, 'DD/MM/YYYY') || '.',
           'telat:' || p.id || ':' || v_bulan
    from public.debt_payments p
    join public.debts d on d.id = p.debt_id
    where d.user_id = v_uid and d.status = 'aktif' and p.status <> 'lunas'
      and p.jatuh_tempo < v_hari
      and not exists (
        select 1 from public.notifications n
        where n.user_id = v_uid and n.referensi = 'telat:' || p.id || ':' || v_bulan
      );
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end if;

  -- 3. Budget 80% dan 100% (pengeluaran bulan ini, tanpa transfer antar dompet)
  with pemakaian as (
    select t.subkategori_id, sum(t.nominal) as terpakai
    from public.transactions t
    where t.user_id = v_uid and t.deleted_at is null and t.tipe = 'Pengeluaran'
      and t.transfer_id is null and t.subkategori_id is not null
      and t.tanggal >= date_trunc('month', v_hari)::date and t.tanggal <= v_hari
    group by t.subkategori_id
  ),
  kandidat as (
    select b.subkategori_id, b.limit_amount, p.terpakai, s.nama,
           case when p.terpakai >= b.limit_amount then 'budget_100' else 'budget_80' end as jenis
    from public.budgets b
    join pemakaian p on p.subkategori_id = b.subkategori_id
    join public.subkategori s on s.id = b.subkategori_id
    where b.user_id = v_uid and b.limit_amount > 0 and p.terpakai >= b.limit_amount * 0.8
  )
  insert into public.notifications (user_id, jenis, judul, isi, referensi)
  select v_uid, k.jenis,
         case when k.jenis = 'budget_100' then 'Budget terlampaui' else 'Budget hampir habis' end,
         k.nama || ' sudah terpakai ' || round(k.terpakai * 100 / k.limit_amount)::integer || '% dari batas bulan ini.',
         'bud:' || k.subkategori_id || ':' || v_bulan || ':' || k.jenis
  from kandidat k
  where public.notifikasi_aktif(k.jenis)
    and not exists (
      select 1 from public.notifications n
      where n.user_id = v_uid and n.referensi = 'bud:' || k.subkategori_id || ':' || v_bulan || ':' || k.jenis
    );
  get diagnostics v_n = row_count;
  v_total := v_total + v_n;

  -- 4. Saldo dompet minus (sekali per hari)
  if public.notifikasi_aktif('saldo_minus') then
    insert into public.notifications (user_id, jenis, judul, isi, referensi)
    select v_uid, 'saldo_minus', 'Saldo minus',
           w.nama || ' minus Rp ' || replace(to_char(abs(w.saldo), 'FM999,999,999,990'), ',', '.') || '. Segera top up atau pindahkan dana.',
           'saldo:' || w.id || ':' || v_hari
    from public.wallets w
    where w.user_id = v_uid and w.is_archived = false and w.saldo < 0
      and not exists (
        select 1 from public.notifications n
        where n.user_id = v_uid and n.referensi = 'saldo:' || w.id || ':' || v_hari
      );
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
  end if;

  -- 5. Pengingat harian (mulai 20.00 WIB, kalau belum ada catatan hari ini)
  if public.notifikasi_aktif('pengingat_harian') and v_jam >= 20 then
    if not exists (
      select 1 from public.transactions t
      where t.user_id = v_uid and t.deleted_at is null and t.tanggal = v_hari
    ) and not exists (
      select 1 from public.notifications n
      where n.user_id = v_uid and n.referensi = 'harian:' || v_hari
    ) then
      insert into public.notifications (user_id, jenis, judul, isi, referensi)
      values (v_uid, 'pengingat_harian', 'Belum ada catatan hari ini',
              'Jangan lupa catat pemasukan dan pengeluaran hari ini.', 'harian:' || v_hari);
      v_total := v_total + 1;
    end if;
  end if;

  return v_total;
end;
$$;

revoke execute on function public.sinkronkan_notifikasi() from public, anon;
grant execute on function public.sinkronkan_notifikasi() to authenticated;
