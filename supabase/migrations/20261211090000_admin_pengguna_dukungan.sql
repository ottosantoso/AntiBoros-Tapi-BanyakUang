-- Akses dukungan: tabel grant (tanpa akses langsung dari klien), dan RPC yang membatasi peran,
-- batas waktu, dan audit. Hanya super_admin dan support yang boleh meminta akses ke data pribadi.

create table if not exists public.support_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diberikan_kepada uuid not null references auth.users(id) on delete cascade,
  alasan text not null check (char_length(btrim(alasan)) between 5 and 500),
  berlaku_sampai timestamptz not null,
  dicabut_pada timestamptz,
  created_at timestamptz not null default now(),
  check (berlaku_sampai > created_at)
);

create index if not exists support_access_grants_aktif_idx
  on public.support_access_grants (diberikan_kepada, user_id, berlaku_sampai)
  where dicabut_pada is null;

alter table public.support_access_grants enable row level security;
revoke all on public.support_access_grants from anon, authenticated;

-- Peran admin yang sedang masuk (untuk ditampilkan di aplikasi).
create or replace function public.admin_peran_saya()
returns text[]
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  return (select coalesce(array_agg(role order by role), '{}') from public.user_roles where user_id = auth.uid());
end;
$$;

-- Daftar pengguna. Nama dan email hanya untuk super_admin, admin, support. Analyst hanya ID singkat.
create or replace function public.admin_list_pengguna(p_cari text default null, p_limit int default 25, p_offset int default 0)
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
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  v_lihat := public.has_role('super_admin') or public.has_role('admin') or public.has_role('support');
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.dibuat desc), '[]'::jsonb) into v_hasil
  from (
    select
      case when v_lihat then u.id end as id,
      left(u.id::text, 8) as id_singkat,
      case when v_lihat then coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) end as nama,
      case when v_lihat then u.email end as email,
      u.created_at as dibuat,
      u.last_sign_in_at as terakhir_masuk,
      (select count(*) from public.transactions t where t.user_id = u.id and t.deleted_at is null) as jumlah_transaksi
    from auth.users u
    where v_cari is null
       or left(u.id::text, 8) = lower(v_cari)
       or (v_lihat and (u.email ilike '%' || v_cari || '%' or (u.raw_user_meta_data->>'name') ilike '%' || v_cari || '%'))
    order by u.created_at desc
    limit p_limit offset p_offset
  ) x;

  insert into public.admin_audit (admin_id, aksi) values (v_admin, 'lihat_daftar_pengguna');
  return v_hasil;
end;
$$;

-- Minta akses dukungan ke data satu pengguna. Batas 1 sampai 24 jam. Persetujuan pengguna diasumsikan
-- sudah diberikan lewat syarat dan ketentuan saat mendaftar (keputusan owner).
create or replace function public.admin_minta_akses_dukungan(p_user uuid, p_alasan text, p_jam int default 24)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
  v_id uuid;
begin
  if not (public.has_role('super_admin') or public.has_role('support')) then
    raise exception 'Hanya super_admin dan support yang bisa meminta akses dukungan.';
  end if;
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'Pengguna tidak ditemukan.';
  end if;
  if p_user = v_admin then
    raise exception 'Tidak bisa meminta akses ke akun sendiri.';
  end if;
  if char_length(btrim(coalesce(p_alasan, ''))) < 5 then
    raise exception 'Alasan minimal 5 karakter.';
  end if;
  p_jam := least(greatest(coalesce(p_jam, 24), 1), 24);

  insert into public.support_access_grants (user_id, diberikan_kepada, alasan, berlaku_sampai)
  values (p_user, v_admin, btrim(p_alasan), now() + make_interval(hours => p_jam))
  returning id into v_id;

  insert into public.admin_audit (admin_id, aksi, target_user_id)
  values (v_admin, 'minta_akses_dukungan', p_user);
  return v_id;
end;
$$;

-- Batas waktu akses dukungan yang masih aktif untuk admin ini (null kalau tidak ada).
create or replace function public.admin_status_dukungan(p_user uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hasil timestamptz;
begin
  if not (public.has_role('super_admin') or public.has_role('support')) then
    return null;
  end if;
  select max(g.berlaku_sampai) into v_hasil
  from public.support_access_grants g
  where g.user_id = p_user
    and g.diberikan_kepada = (select auth.uid())
    and g.dicabut_pada is null
    and g.berlaku_sampai > now();
  return v_hasil;
end;
$$;

-- Data transaksi pribadi. Hanya untuk akses dukungan yang masih aktif, dan setiap pembacaan dicatat.
create or replace function public.admin_transaksi_dukungan(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
  v_hasil jsonb;
begin
  if not (public.has_role('super_admin') or public.has_role('support')) then
    raise exception 'Akses ditolak.';
  end if;
  if not exists (
    select 1 from public.support_access_grants g
    where g.user_id = p_user and g.diberikan_kepada = v_admin
      and g.dicabut_pada is null and g.berlaku_sampai > now()
  ) then
    raise exception 'Tidak ada akses dukungan yang aktif untuk pengguna ini.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.tanggal desc, x.dibuat desc), '[]'::jsonb) into v_hasil
  from (
    select t.tanggal, t.deskripsi, t.tipe, t.nominal,
           coalesce(nullif(btrim(s.kategori), ''), nullif(btrim(t.kategori), ''), 'Tanpa kategori') as kategori,
           t.created_at as dibuat
    from public.transactions t
    left join public.subkategori s on s.id = t.subkategori_id
    where t.user_id = p_user and t.deleted_at is null
    order by t.tanggal desc, t.created_at desc
    limit 100
  ) x;

  insert into public.admin_audit (admin_id, aksi, target_user_id) values (v_admin, 'akses_dukungan_data', p_user);
  return v_hasil;
end;
$$;

-- Cabut akses dukungan lebih awal (hanya pemberinya).
create or replace function public.admin_cabut_akses_dukungan(p_grant uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
  v_user uuid;
begin
  update public.support_access_grants
     set dicabut_pada = now()
   where id = p_grant and diberikan_kepada = v_admin and dicabut_pada is null
  returning user_id into v_user;

  if v_user is null then
    return false;
  end if;
  insert into public.admin_audit (admin_id, aksi, target_user_id) values (v_admin, 'cabut_akses_dukungan', v_user);
  return true;
end;
$$;

revoke execute on function public.admin_peran_saya() from public, anon;
revoke execute on function public.admin_list_pengguna(text, int, int) from public, anon;
revoke execute on function public.admin_minta_akses_dukungan(uuid, text, int) from public, anon;
revoke execute on function public.admin_status_dukungan(uuid) from public, anon;
revoke execute on function public.admin_transaksi_dukungan(uuid) from public, anon;
revoke execute on function public.admin_cabut_akses_dukungan(uuid) from public, anon;
grant execute on function public.admin_peran_saya() to authenticated;
grant execute on function public.admin_list_pengguna(text, int, int) to authenticated;
grant execute on function public.admin_minta_akses_dukungan(uuid, text, int) to authenticated;
grant execute on function public.admin_status_dukungan(uuid) to authenticated;
grant execute on function public.admin_transaksi_dukungan(uuid) to authenticated;
grant execute on function public.admin_cabut_akses_dukungan(uuid) to authenticated;
