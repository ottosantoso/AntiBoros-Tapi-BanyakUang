-- Sampah transaksi (hapus sementara) dan log perubahan transaksi.
--
-- 1. transactions.deleted_at: NULL = aktif. Hapus sementara hanya mengisi kolom ini; baris tidak dihapus.
-- 2. transaksi_log: mencatat setiap insert, update, hapus sementara, pulihkan, dan hapus permanen.
--    Hanya dibaca oleh pemilik. Penulisan dilakukan trigger, tidak dari browser.
-- 3. Saldo dompet mengabaikan baris yang sudah hapus sementara.
-- 4. Analisa (report_summary) mengabaikan baris yang sudah hapus sementara.
--
-- Perilaku yang ada tidak berubah: semua baris yang ada masih aktif (deleted_at NULL).

-- 1. Kolom hapus sementara
alter table public.transactions
  add column if not exists deleted_at timestamptz;

create index if not exists transactions_aktif_idx
  on public.transactions (user_id, tanggal desc)
  where deleted_at is null;

-- 2. Tabel log
create table if not exists public.transaksi_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  transaksi_id uuid not null,
  aksi text not null check (aksi in ('insert', 'update', 'hapus_sementara', 'pulihkan', 'hapus_permanen')),
  data_lama jsonb,
  data_baru jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transaksi_log_user_idx on public.transaksi_log (user_id, created_at desc);

alter table public.transaksi_log enable row level security;

drop policy if exists "log transaksi milik sendiri" on public.transaksi_log;
create policy "log transaksi milik sendiri" on public.transaksi_log
  for select using (user_id = auth.uid());

revoke insert, update, delete on public.transaksi_log from anon, authenticated;

create or replace function public.catat_transaksi_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aksi text;
  v_user uuid;
  v_id uuid;
begin
  if TG_OP = 'INSERT' then
    v_aksi := 'insert';
    v_user := NEW.user_id;
    v_id := NEW.id;
    insert into public.transaksi_log (user_id, transaksi_id, aksi, data_lama, data_baru)
    values (v_user, v_id, v_aksi, null, to_jsonb(NEW));
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into public.transaksi_log (user_id, transaksi_id, aksi, data_lama, data_baru)
    values (OLD.user_id, OLD.id, 'hapus_permanen', to_jsonb(OLD), null);
    return OLD;
  else
    if OLD.deleted_at is null and NEW.deleted_at is not null then
      v_aksi := 'hapus_sementara';
    elsif OLD.deleted_at is not null and NEW.deleted_at is null then
      v_aksi := 'pulihkan';
    else
      v_aksi := 'update';
    end if;
    insert into public.transaksi_log (user_id, transaksi_id, aksi, data_lama, data_baru)
    values (NEW.user_id, NEW.id, v_aksi, to_jsonb(OLD), to_jsonb(NEW));
    return NEW;
  end if;
end;
$$;

drop trigger if exists transactions_log on public.transactions;
create trigger transactions_log
  after insert or update or delete on public.transactions
  for each row execute function public.catat_transaksi_log();

-- 3. Saldo: baris yang sudah hapus sementara tidak ikut dihitung
create or replace function public.apply_transaction_wallet_delta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP in ('UPDATE', 'DELETE') and OLD.wallet_id is not null and OLD.deleted_at is null then
    update public.wallets
    set saldo = saldo - case when OLD.tipe = 'Pemasukan' then OLD.nominal else -OLD.nominal end
    where id = OLD.wallet_id;
  end if;

  if TG_OP in ('INSERT', 'UPDATE') and NEW.wallet_id is not null and NEW.deleted_at is null then
    update public.wallets
    set saldo = saldo + case when NEW.tipe = 'Pemasukan' then NEW.nominal else -NEW.nominal end
    where id = NEW.wallet_id;
  end if;

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

-- 4. Analisa: definisi terbaru (migrasi 20261126090000_transfer_pihak_luar), ditambah filter hapus sementara.
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
