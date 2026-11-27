-- Pencatatan latensi dan error AI, kesehatan AI untuk admin, notifikasi sistem, backup manual,
-- status sistem (ukuran database vs paket free), dan master kategori (hanya baca).

-- 1. Log AI -------------------------------------------------------------------
create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  fitur text not null check (char_length(fitur) between 1 and 40),
  latensi_ms integer not null check (latensi_ms >= 0),
  status text not null check (status in ('ok', 'error')),
  kode_error text check (kode_error is null or char_length(kode_error) <= 80),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_logs_created_idx on public.ai_usage_logs (created_at desc);
alter table public.ai_usage_logs enable row level security;
revoke all on public.ai_usage_logs from anon, authenticated;

create or replace function public.catat_ai_log(p_fitur text, p_latensi integer, p_status text, p_kode text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Belum masuk.';
  end if;
  if p_status not in ('ok', 'error') then
    raise exception 'Status tidak valid.';
  end if;
  insert into public.ai_usage_logs (user_id, fitur, latensi_ms, status, kode_error)
  values ((select auth.uid()), left(coalesce(p_fitur, 'lainnya'), 40), greatest(0, least(coalesce(p_latensi, 0), 600000)), p_status, left(p_kode, 80));
end;
$$;

create or replace function public.admin_ai_kesehatan(p_mulai date, p_selesai date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_awal timestamptz := (p_mulai::timestamp at time zone 'Asia/Jakarta');
  v_akhir timestamptz := ((p_selesai + 1)::timestamp at time zone 'Asia/Jakarta');
  v_hasil jsonb;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  if p_mulai is null or p_selesai is null or p_selesai < p_mulai or p_selesai - p_mulai > 366 then
    raise exception 'Periode tidak valid.';
  end if;

  with l as (
    select * from public.ai_usage_logs where created_at >= v_awal and created_at < v_akhir
  ),
  tot as (
    select count(*) as total,
           count(*) filter (where status = 'error') as error,
           round(avg(latensi_ms)) as rata,
           round(percentile_cont(0.95) within group (order by latensi_ms)) as p95
    from l
  )
  select jsonb_build_object(
    'total', (select total from tot),
    'error', (select error from tot),
    'rata_latensi', (select rata from tot),
    'p95_latensi', (select p95 from tot),
    'per_fitur', coalesce((
      select jsonb_agg(jsonb_build_object('fitur', f.fitur, 'jumlah', f.n, 'error', f.err, 'rata_latensi', f.rata, 'p95', f.p95) order by f.n desc)
      from (
        select fitur, count(*) as n, count(*) filter (where status = 'error') as err,
               round(avg(latensi_ms)) as rata,
               round(percentile_cont(0.95) within group (order by latensi_ms)) as p95
        from l group by fitur
      ) f
    ), '[]'::jsonb),
    'kode_error', coalesce((
      select jsonb_agg(jsonb_build_object('kode', k.kode, 'jumlah', k.n) order by k.n desc)
      from (
        select coalesce(kode_error, '-') as kode, count(*) as n from l where status = 'error' group by 1 order by count(*) desc limit 10
      ) k
    ), '[]'::jsonb)
  ) into v_hasil
  from tot;

  insert into public.admin_audit (admin_id, aksi) values ((select auth.uid()), 'lihat_kesehatan_ai');
  return v_hasil;
end;
$$;

-- 2. Notifikasi sistem --------------------------------------------------------
create table if not exists public.system_notifications (
  id uuid primary key default gen_random_uuid(),
  judul text not null check (char_length(btrim(judul)) between 3 and 120),
  isi text not null check (char_length(btrim(isi)) between 3 and 1000),
  level text not null default 'info' check (level in ('info', 'peringatan', 'penting')),
  aktif_sampai timestamptz,
  nonaktif_pada timestamptz,
  dibuat_oleh uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.system_notifications enable row level security;
revoke all on public.system_notifications from anon, authenticated;

create or replace function public.admin_daftar_notifikasi_sistem()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lihat boolean;
  v_hasil jsonb;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  v_lihat := public.has_role('super_admin') or public.has_role('admin') or public.has_role('support');
  select coalesce(jsonb_agg(to_jsonb(x) order by x.dibuat desc), '[]'::jsonb) into v_hasil
  from (
    select n.id, n.judul, n.isi, n.level, n.aktif_sampai, n.nonaktif_pada, n.created_at as dibuat,
           case when v_lihat then coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) else left(n.dibuat_oleh::text, 8) end as pembuat,
           (n.nonaktif_pada is null and (n.aktif_sampai is null or n.aktif_sampai > now())) as aktif
    from public.system_notifications n
    left join auth.users u on u.id = n.dibuat_oleh
    order by n.created_at desc
    limit 50
  ) x;
  return v_hasil;
end;
$$;

create or replace function public.admin_buat_notifikasi_sistem(p_judul text, p_isi text, p_level text default 'info', p_jam int default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_role('super_admin') then
    raise exception 'Hanya super_admin yang bisa membuat notifikasi sistem.';
  end if;
  if p_level not in ('info', 'peringatan', 'penting') then
    raise exception 'Level tidak valid.';
  end if;
  insert into public.system_notifications (judul, isi, level, aktif_sampai, dibuat_oleh)
  values (btrim(p_judul), btrim(p_isi), p_level,
          case when p_jam is null then null else now() + make_interval(hours => least(greatest(p_jam, 1), 720)) end,
          (select auth.uid()))
  returning id into v_id;

  insert into public.admin_audit (admin_id, aksi) values ((select auth.uid()), 'buat_notifikasi_sistem');
  return v_id;
end;
$$;

create or replace function public.admin_nonaktifkan_notifikasi_sistem(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not public.has_role('super_admin') then
    raise exception 'Hanya super_admin yang bisa menonaktifkan notifikasi sistem.';
  end if;
  update public.system_notifications set nonaktif_pada = now()
   where id = p_id and nonaktif_pada is null;
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.admin_audit (admin_id, aksi) values ((select auth.uid()), 'nonaktifkan_notifikasi_sistem');
  end if;
  return v_n > 0;
end;
$$;

create or replace function public.notifikasi_sistem_aktif()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select auth.uid()) is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.dibuat desc)
    from (
      select n.id, n.judul, n.isi, n.level, n.created_at as dibuat
      from public.system_notifications n
      where n.nonaktif_pada is null and (n.aktif_sampai is null or n.aktif_sampai > now())
      order by n.created_at desc
      limit 5
    ) x
  ), '[]'::jsonb);
end;
$$;

-- 3. Backup manual ------------------------------------------------------------
create table if not exists public.backup_logs (
  id uuid primary key default gen_random_uuid(),
  dicatat_oleh uuid references auth.users(id) on delete set null,
  catatan text not null check (char_length(btrim(catatan)) between 3 and 300),
  created_at timestamptz not null default now()
);
alter table public.backup_logs enable row level security;
revoke all on public.backup_logs from anon, authenticated;

create or replace function public.admin_catat_backup(p_catatan text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  insert into public.backup_logs (dicatat_oleh, catatan) values ((select auth.uid()), btrim(p_catatan))
  returning id into v_id;
  insert into public.admin_audit (admin_id, aksi) values ((select auth.uid()), 'catat_backup_manual');
  return v_id;
end;
$$;

create or replace function public.admin_daftar_backup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lihat boolean;
  v_hasil jsonb;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  v_lihat := public.has_role('super_admin') or public.has_role('admin') or public.has_role('support');
  select coalesce(jsonb_agg(to_jsonb(x) order by x.dibuat desc), '[]'::jsonb) into v_hasil
  from (
    select b.catatan, b.created_at as dibuat,
           case when v_lihat then coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) else left(b.dicatat_oleh::text, 8) end as pencatat
    from public.backup_logs b
    left join auth.users u on u.id = b.dicatat_oleh
    order by b.created_at desc
    limit 20
  ) x;
  return v_hasil;
end;
$$;

-- 4. Status sistem ------------------------------------------------------------
create or replace function public.admin_status_sistem()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  return jsonb_build_object(
    'database_mb', round(pg_database_size(current_database()) / 1048576.0, 1),
    'batas_free_mb', 500,
    'versi_postgres', current_setting('server_version'),
    'waktu_server', now(),
    'jumlah_tabel', (select count(*) from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE')
  );
end;
$$;

-- 5. Master kategori (hanya baca) ---------------------------------------------
create or replace function public.admin_kategori_master()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hasil jsonb;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(k) order by k.kategori), '[]'::jsonb) into v_hasil
  from (
    select s.kategori,
           count(*) as jumlah_sub,
           count(*) filter (where s.aktif) as jumlah_aktif,
           string_agg(distinct s.budgeting, ', ') as budgeting,
           coalesce(sum(p.n), 0) as pemakaian
    from public.subkategori s
    left join (
      select subkategori_id, count(*) as n from public.transactions where deleted_at is null group by subkategori_id
    ) p on p.subkategori_id = s.id
    where s.is_system = true
    group by s.kategori
  ) k;
  return v_hasil;
end;
$$;

-- Grants --------------------------------------------------------------------
revoke execute on function public.catat_ai_log(text, integer, text, text) from public, anon;
revoke execute on function public.admin_ai_kesehatan(date, date) from public, anon;
revoke execute on function public.admin_daftar_notifikasi_sistem() from public, anon;
revoke execute on function public.admin_buat_notifikasi_sistem(text, text, text, int) from public, anon;
revoke execute on function public.admin_nonaktifkan_notifikasi_sistem(uuid) from public, anon;
revoke execute on function public.notifikasi_sistem_aktif() from public, anon;
revoke execute on function public.admin_catat_backup(text) from public, anon;
revoke execute on function public.admin_daftar_backup() from public, anon;
revoke execute on function public.admin_status_sistem() from public, anon;
revoke execute on function public.admin_kategori_master() from public, anon;
grant execute on function public.catat_ai_log(text, integer, text, text) to authenticated;
grant execute on function public.admin_ai_kesehatan(date, date) to authenticated;
grant execute on function public.admin_daftar_notifikasi_sistem() to authenticated;
grant execute on function public.admin_buat_notifikasi_sistem(text, text, text, int) to authenticated;
grant execute on function public.admin_nonaktifkan_notifikasi_sistem(uuid) to authenticated;
grant execute on function public.notifikasi_sistem_aktif() to authenticated;
grant execute on function public.admin_catat_backup(text) to authenticated;
grant execute on function public.admin_daftar_backup() to authenticated;
grant execute on function public.admin_status_sistem() to authenticated;
grant execute on function public.admin_kategori_master() to authenticated;
