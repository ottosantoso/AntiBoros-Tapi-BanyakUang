-- Kelola pengguna: daftar pengguna sekarang menampilkan status nonaktif (banned_until).
-- Aksi nonaktifkan, aktifkan, kirim reset password, dan hapus dilakukan lewat Edge Function
-- admin-kelola-pengguna (butuh service role), bukan dari klien.

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
      (u.banned_until is not null and u.banned_until > now()) as dinonaktifkan,
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

revoke execute on function public.admin_list_pengguna(text, int, int) from public, anon;
grant execute on function public.admin_list_pengguna(text, int, int) to authenticated;
