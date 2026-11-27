-- Log aktivitas: filter tanggal, aksi, modul, dan pencarian, plus ringkasan untuk KPI dan grafik.
-- Semua angka dihitung dari admin_audit. Tidak ada data yang dikarang.

-- Modul diturunkan dari jenis aksi. Dipakai untuk filter dan badge.
create or replace function public.admin_modul_aksi(p_aksi text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_aksi in ('lihat_daftar_pengguna','nonaktifkan_pengguna','aktifkan_pengguna','ubah_password_pengguna','kirim_reset_password','hapus_pengguna') then 'Pengguna'
    when p_aksi like '%dukungan%' then 'Dukungan'
    when p_aksi like '%transaksi%' then 'Transaksi'
    when p_aksi like '%_ai' then 'AI'
    when p_aksi = 'lihat_log_aktivitas' then 'Log'
    when p_aksi in ('lihat_dashboard','lihat_ringkasan') then 'Dashboard'
    else 'Lainnya'
  end
$$;

drop function if exists public.admin_log_aktivitas(text, int, int);

create or replace function public.admin_log_aktivitas(
  p_mulai date default null,
  p_selesai date default null,
  p_aksi text default null,
  p_modul text default null,
  p_cari text default null,
  p_limit int default 25,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
  v_lihat boolean;
  v_hasil jsonb;
  v_cari text := nullif(btrim(coalesce(p_cari, '')), '');
  v_hari_ini date := (now() at time zone 'Asia/Jakarta')::date;
  v_awal timestamptz;
  v_akhir timestamptz;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  v_lihat := public.has_role('super_admin') or public.has_role('admin') or public.has_role('support');
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);
  v_awal := (coalesce(p_mulai, v_hari_ini - 29))::timestamp at time zone 'Asia/Jakarta';
  v_akhir := ((coalesce(p_selesai, v_hari_ini)) + 1)::timestamp at time zone 'Asia/Jakarta';

  with f as (
    select g.created_at, g.aksi, public.admin_modul_aksi(g.aksi) as modul,
           g.admin_id, g.target_user_id,
           coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) as nama,
           u.email
    from public.admin_audit g
    left join auth.users u on u.id = g.admin_id
    where g.created_at >= v_awal and g.created_at < v_akhir
      and (nullif(btrim(coalesce(p_aksi, '')), '') is null or g.aksi = p_aksi)
      and (nullif(btrim(coalesce(p_modul, '')), '') is null or public.admin_modul_aksi(g.aksi) = p_modul)
      and (v_cari is null
           or g.aksi ilike '%' || v_cari || '%'
           or left(g.admin_id::text, 8) = lower(v_cari)
           or left(g.target_user_id::text, 8) = lower(v_cari)
           or (v_lihat and (u.email ilike '%' || v_cari || '%' or (u.raw_user_meta_data->>'name') ilike '%' || v_cari || '%')))
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'items', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.waktu desc)
      from (
        select created_at as waktu, aksi, modul,
               case when v_lihat then nama end as admin,
               left(admin_id::text, 8) as admin_id_singkat,
               left(target_user_id::text, 8) as target_id_singkat
        from f
        order by created_at desc
        limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb)
  ) into v_hasil;

  insert into public.admin_audit (admin_id, aksi) values (v_admin, 'lihat_log_aktivitas');
  return v_hasil;
end;
$$;

create or replace function public.admin_log_ringkasan(p_mulai date default null, p_selesai date default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hari_ini date := (now() at time zone 'Asia/Jakarta')::date;
  v_mulai date := coalesce(p_mulai, v_hari_ini - 29);
  v_selesai date := coalesce(p_selesai, v_hari_ini);
  v_awal timestamptz := v_mulai::timestamp at time zone 'Asia/Jakarta';
  v_akhir timestamptz := (v_selesai + 1)::timestamp at time zone 'Asia/Jakarta';
  v_panjang int := v_selesai - v_mulai + 1;
  v_awal_lalu timestamptz := v_awal - (v_panjang || ' days')::interval;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;

  return jsonb_build_object(
    'total', (select count(*) from public.admin_audit where created_at >= v_awal and created_at < v_akhir),
    'total_sebelumnya', (select count(*) from public.admin_audit where created_at >= v_awal_lalu and created_at < v_awal),
    'admin_aktif', (select count(distinct admin_id) from public.admin_audit where created_at >= v_awal and created_at < v_akhir),
    'akun_disentuh', (select count(distinct target_user_id) from public.admin_audit
                       where created_at >= v_awal and created_at < v_akhir and target_user_id is not null),
    'per_hari', coalesce((
      select jsonb_agg(jsonb_build_object('tanggal', d, 'total', t, 'akun', a) order by d)
      from (
        select (created_at at time zone 'Asia/Jakarta')::date as d,
               count(*) as t,
               count(*) filter (where target_user_id is not null) as a
        from public.admin_audit
        where created_at >= v_awal and created_at < v_akhir
        group by 1
      ) s
    ), '[]'::jsonb),
    'aksi_terbanyak', coalesce((
      select jsonb_agg(jsonb_build_object('aksi', aksi, 'jumlah', n) order by n desc)
      from (
        select aksi, count(*) as n
        from public.admin_audit
        where created_at >= v_awal and created_at < v_akhir
        group by aksi
        order by n desc
        limit 5
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.admin_modul_aksi(text) from public, anon;
revoke execute on function public.admin_log_aktivitas(date, date, text, text, text, int, int) from public, anon;
revoke execute on function public.admin_log_ringkasan(date, date) from public, anon;
grant execute on function public.admin_log_aktivitas(date, date, text, text, text, int, int) to authenticated;
grant execute on function public.admin_log_ringkasan(date, date) to authenticated;
