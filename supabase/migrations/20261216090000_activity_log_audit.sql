-- Audit trail lengkap: aktivitas pengguna biasa dan admin, dengan IP, status, dan detail.
-- Yang TIDAK dicatat: nilai transaksi, deskripsi, isi password, dan isi kolom bebas.
-- Hanya: tabel, jenis operasi, id baris, pemilik baris, dan NAMA kolom yang berubah.
-- IP dan detail hanya ditampilkan ke super_admin (dicek di RPC, bukan di klien).

-- 1) Kolom baru di admin_audit
alter table public.admin_audit
  add column if not exists status text not null default 'berhasil' check (status in ('berhasil', 'gagal')),
  add column if not exists ip text,
  add column if not exists user_agent text,
  add column if not exists detail jsonb;

-- 2) Konteks request dari header PostgREST. Kosong kalau dipanggil di luar request HTTP.
create or replace function public.log_ip_permintaan()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  h json;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;
  return left(nullif(btrim(split_part(coalesce(h->>'x-forwarded-for', h->>'x-real-ip', ''), ',', 1)), ''), 64);
end $$;

create or replace function public.log_user_agent()
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  h json;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;
  return left(nullif(h->>'user-agent', ''), 300);
end $$;

alter table public.admin_audit
  alter column ip set default public.log_ip_permintaan(),
  alter column user_agent set default public.log_user_agent();

-- 3) Tabel aktivitas pengguna. Tanpa foreign key supaya log tetap ada walau akun dihapus.
create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_peran text not null check (char_length(actor_peran) <= 20),
  modul text not null check (char_length(modul) <= 30),
  aksi text not null check (char_length(aksi) <= 40),
  status text not null default 'berhasil' check (status in ('berhasil', 'gagal')),
  tabel text not null check (char_length(tabel) <= 60),
  target_id text check (target_id is null or char_length(target_id) <= 64),
  target_user_id uuid,
  ip text,
  user_agent text,
  detail jsonb
);
create index if not exists activity_logs_created_idx on public.activity_logs (created_at desc);
create index if not exists activity_logs_actor_idx on public.activity_logs (actor_id, created_at desc);
create index if not exists activity_logs_tabel_idx on public.activity_logs (tabel, created_at desc);
create index if not exists activity_logs_gagal_idx on public.activity_logs (created_at desc) where status = 'gagal';

alter table public.activity_logs enable row level security;
revoke all on public.activity_logs from public, anon, authenticated;

-- 4) Modul dari nama tabel. Dipakai untuk filter dan badge.
create or replace function public.admin_modul_tabel(p_tabel text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when p_tabel in ('transactions','wallet_transfers','wallets','transaksi_berulang','scan_batches','debts','debt_payments') then 'Transaksi'
    when p_tabel in ('budgets','goals','rencana_bulanan','rencana_item') then 'Anggaran'
    when p_tabel in ('kategori','subkategori') then 'Kategori'
    when p_tabel in ('notifications','notification_settings') then 'Notifikasi'
    when p_tabel in ('ai_reports','chat_actions') then 'AI'
    when p_tabel in ('user_roles','support_access_grants') then 'Akses'
    else 'Lainnya'
  end
$$;

-- 5) Trigger: catat setiap tambah, ubah (hanya kalau ada kolom nyata yang berubah), dan hapus.
create or replace function public.catat_aktivitas_data()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := (select auth.uid());
  v_peran text;
  v_baris jsonb;
  v_owner uuid;
  v_kolom text[];
begin
  if v_actor is null then
    v_peran := 'Sistem';
  else
    select ur.role into v_peran
    from public.user_roles ur
    where ur.user_id = v_actor
    order by array_position(array['super_admin','admin','support','analyst'], ur.role) nulls last
    limit 1;
    v_peran := coalesce(v_peran, 'User');
  end if;

  v_baris := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  v_owner := nullif(v_baris->>'user_id', '')::uuid;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(n.k order by n.k), '{}') into v_kolom
    from jsonb_each(to_jsonb(new)) as n(k, v)
    where n.k <> 'updated_at' and (to_jsonb(old) -> n.k) is distinct from n.v;
    if cardinality(v_kolom) = 0 then return null; end if;
  end if;

  insert into public.activity_logs
    (actor_id, actor_peran, modul, aksi, status, tabel, target_id, target_user_id, ip, user_agent, detail)
  values (
    v_actor, v_peran, public.admin_modul_tabel(tg_table_name),
    case tg_op when 'INSERT' then 'tambah' when 'UPDATE' then 'ubah' else 'hapus' end,
    'berhasil', tg_table_name, left(coalesce(v_baris->>'id', ''), 64), v_owner,
    public.log_ip_permintaan(), public.log_user_agent(),
    case when tg_op = 'UPDATE' then jsonb_build_object('kolom', to_jsonb(v_kolom)) end
  );
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'transactions','wallets','wallet_transfers','transaksi_berulang','scan_batches','debts','debt_payments',
    'budgets','goals','rencana_bulanan','rencana_item','kategori','subkategori',
    'notifications','notification_settings','ai_reports','chat_actions','support_access_grants','user_roles'
  ] loop
    execute format('drop trigger if exists aktivitas_audit on public.%I', t);
    execute format(
      'create trigger aktivitas_audit after insert or update or delete on public.%I for each row execute function public.catat_aktivitas_data()',
      t);
  end loop;
end $$;

-- 6) Gabungan admin_audit dan activity_logs untuk dibaca RPC. Tidak boleh diakses langsung dari klien.
create or replace view public.log_gabungan as
select
  a.created_at as waktu,
  'admin'::text as sumber,
  a.admin_id as actor_id,
  coalesce((select ur.role from public.user_roles ur where ur.user_id = a.admin_id
            order by array_position(array['super_admin','admin','support','analyst'], ur.role) nulls last limit 1), '-') as actor_peran,
  public.admin_modul_aksi(a.aksi) as modul,
  a.aksi,
  a.status,
  null::text as tabel,
  a.target_user_id::text as target_id,
  a.target_user_id,
  a.ip,
  a.user_agent,
  a.detail
from public.admin_audit a
union all
select l.created_at, 'pengguna', l.actor_id, l.actor_peran, l.modul, l.aksi, l.status, l.tabel,
       l.target_id, l.target_user_id, l.ip, l.user_agent, l.detail
from public.activity_logs l;

revoke all on public.log_gabungan from public, anon, authenticated;

-- 7) RPC daftar log: filter, pagination, dan ekspor. IP, user-agent, dan detail hanya untuk super_admin.
drop function if exists public.admin_log_aktivitas(date, date, text, text, text, int, int);

create or replace function public.admin_log_aktivitas(
  p_mulai date default null,
  p_selesai date default null,
  p_aksi text default null,
  p_modul text default null,
  p_status text default null,
  p_cari text default null,
  p_limit int default 25,
  p_offset int default 0,
  p_ekspor boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
  v_super boolean;
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
  v_super := public.has_role('super_admin');
  v_lihat := v_super or public.has_role('admin') or public.has_role('support');

  if coalesce(p_ekspor, false) then
    p_limit := 5000;
    p_offset := 0;
  else
    p_limit := least(greatest(coalesce(p_limit, 25), 1), 100);
    p_offset := greatest(coalesce(p_offset, 0), 0);
  end if;
  v_awal := (coalesce(p_mulai, v_hari_ini - 29))::timestamp at time zone 'Asia/Jakarta';
  v_akhir := ((coalesce(p_selesai, v_hari_ini)) + 1)::timestamp at time zone 'Asia/Jakarta';

  with f as (
    select g.*,
           coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) as nama_admin,
           u.email as email_admin
    from public.log_gabungan g
    left join auth.users u on u.id = g.actor_id and g.sumber = 'admin'
    where g.waktu >= v_awal and g.waktu < v_akhir
      and (nullif(btrim(coalesce(p_aksi, '')), '') is null or g.aksi = p_aksi)
      and (nullif(btrim(coalesce(p_modul, '')), '') is null or g.modul = p_modul)
      and (nullif(btrim(coalesce(p_status, '')), '') is null or g.status = p_status)
      and (v_cari is null
           or g.aksi ilike '%' || v_cari || '%'
           or left(g.actor_id::text, 8) = lower(v_cari)
           or left(g.target_user_id::text, 8) = lower(v_cari)
           or (v_super and g.ip ilike '%' || v_cari || '%')
           or (v_lihat and (u.email ilike '%' || v_cari || '%' or (u.raw_user_meta_data->>'name') ilike '%' || v_cari || '%')))
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'items', coalesce((
      select jsonb_agg(to_jsonb(x) order by x.waktu desc)
      from (
        select f.waktu,
               f.sumber,
               case when f.sumber = 'admin'
                    then case when v_lihat then f.nama_admin else 'Admin' end
                    else coalesce(f.actor_peran, 'User') end as aktor,
               left(f.actor_id::text, 8) as aktor_id_singkat,
               f.actor_peran as peran,
               f.modul,
               f.aksi,
               f.status,
               f.tabel,
               left(f.target_user_id::text, 8) as target_id_singkat,
               case when v_super then f.ip end as ip,
               case when v_super then f.user_agent end as user_agent,
               case when v_super then f.detail end as detail
        from f
        order by f.waktu desc
        limit p_limit offset p_offset
      ) x
    ), '[]'::jsonb)
  ) into v_hasil;

  insert into public.admin_audit (admin_id, aksi, detail)
  values (
    v_admin,
    case when coalesce(p_ekspor, false) then 'ekspor_log_aktivitas' else 'lihat_log_aktivitas' end,
    jsonb_strip_nulls(jsonb_build_object(
      'aksi', nullif(p_aksi, ''),
      'modul', nullif(p_modul, ''),
      'status', nullif(p_status, ''),
      'cari_dipakai', v_cari is not null,
      'jumlah', (v_hasil->>'total')::int,
      'ip_terlihat', v_super
    ))
  );
  return v_hasil;
end;
$$;

-- 8) Ringkasan untuk KPI, grafik tren, dan insight otomatis.
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
    'total', (select count(*) from public.log_gabungan where waktu >= v_awal and waktu < v_akhir),
    'total_sebelumnya', (select count(*) from public.log_gabungan where waktu >= v_awal_lalu and waktu < v_awal),
    'gagal', (select count(*) from public.log_gabungan where waktu >= v_awal and waktu < v_akhir and status = 'gagal'),
    'gagal_sebelumnya', (select count(*) from public.log_gabungan where waktu >= v_awal_lalu and waktu < v_awal and status = 'gagal'),
    'pelaku_aktif', (select count(distinct actor_id) from public.log_gabungan
                      where waktu >= v_awal and waktu < v_akhir and actor_id is not null),
    'pengguna_aktivitas', (select count(*) from public.log_gabungan
                            where waktu >= v_awal and waktu < v_akhir and sumber = 'pengguna'),
    'admin_aktivitas', (select count(*) from public.log_gabungan
                         where waktu >= v_awal and waktu < v_akhir and sumber = 'admin'),
    'ip_gagal_unik', case when public.has_role('super_admin') then (
        select count(distinct ip) from public.log_gabungan
        where waktu >= v_awal and waktu < v_akhir and status = 'gagal' and ip is not null) end,
    'per_hari', coalesce((
      select jsonb_agg(jsonb_build_object('tanggal', d, 'total', t, 'gagal', g) order by d)
      from (
        select (waktu at time zone 'Asia/Jakarta')::date as d,
               count(*) as t,
               count(*) filter (where status = 'gagal') as g
        from public.log_gabungan
        where waktu >= v_awal and waktu < v_akhir
        group by 1
      ) s
    ), '[]'::jsonb),
    'per_modul', coalesce((
      select jsonb_agg(jsonb_build_object('modul', modul, 'jumlah', n) order by n desc)
      from (
        select modul, count(*) as n
        from public.log_gabungan
        where waktu >= v_awal and waktu < v_akhir
        group by modul
      ) s
    ), '[]'::jsonb),
    'aksi_terbanyak', coalesce((
      select jsonb_agg(jsonb_build_object('aksi', aksi, 'jumlah', n) order by n desc)
      from (
        select aksi, count(*) as n
        from public.log_gabungan
        where waktu >= v_awal and waktu < v_akhir
        group by aksi
        order by n desc
        limit 5
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.log_ip_permintaan() from public, anon;
revoke execute on function public.log_user_agent() from public, anon;
revoke execute on function public.admin_modul_tabel(text) from public, anon;
revoke execute on function public.catat_aktivitas_data() from public, anon, authenticated;
revoke execute on function public.admin_log_aktivitas(date, date, text, text, text, text, int, int, boolean) from public, anon;
revoke execute on function public.admin_log_ringkasan(date, date) from public, anon;
grant execute on function public.admin_log_aktivitas(date, date, text, text, text, text, int, int, boolean) to authenticated;
grant execute on function public.admin_log_ringkasan(date, date) to authenticated;
