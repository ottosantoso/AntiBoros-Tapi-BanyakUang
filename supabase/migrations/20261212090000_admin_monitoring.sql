-- Log Aktivitas, Monitoring Transaksi, Monitoring AI, dan pencabutan akses dukungan per pengguna.
-- Hanya agregat, kecuali log admin (tanpa data pribadi). Nama hanya untuk super_admin, admin, support.

create or replace function public.admin_log_aktivitas(p_aksi text default null, p_limit int default 25, p_offset int default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
  v_lihat boolean;
  v_hasil jsonb;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  v_lihat := public.has_role('super_admin') or public.has_role('admin') or public.has_role('support');
  p_limit := least(greatest(coalesce(p_limit, 25), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  select coalesce(jsonb_agg(to_jsonb(x) order by x.waktu desc), '[]'::jsonb) into v_hasil
  from (
    select g.created_at as waktu, g.aksi,
           case when v_lihat then coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) end as admin,
           left(g.admin_id::text, 8) as admin_id_singkat,
           left(g.target_user_id::text, 8) as target_id_singkat
    from public.admin_audit g
    left join auth.users u on u.id = g.admin_id
    where nullif(btrim(coalesce(p_aksi, '')), '') is null or g.aksi = p_aksi
    order by g.created_at desc
    limit p_limit offset p_offset
  ) x;

  insert into public.admin_audit (admin_id, aksi) values (v_admin, 'lihat_log_aktivitas');
  return v_hasil;
end;
$$;

create or replace function public.admin_monitor_transaksi(p_mulai date, p_selesai date)
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

  select jsonb_build_object(
    'dicatat', (select count(*) from public.transactions where created_at >= v_awal and created_at < v_akhir),
    'dihapus', (select count(*) from public.transactions where deleted_at >= v_awal and deleted_at < v_akhir),
    'transfer', (select count(*) from public.wallet_transfers where created_at >= v_awal and created_at < v_akhir),
    'berulang', (select count(*) from public.transactions where deleted_at is null and berulang = true and created_at >= v_awal and created_at < v_akhir),
    'per_tipe', coalesce((
      select jsonb_agg(jsonb_build_object('tipe', x.tipe, 'jumlah', x.n, 'rata_rata', x.rata) order by x.n desc)
      from (
        select tipe, count(*) as n, round(avg(nominal)) as rata
        from public.transactions
        where deleted_at is null and created_at >= v_awal and created_at < v_akhir
        group by tipe
      ) x
    ), '[]'::jsonb),
    'per_hari', coalesce((
      select jsonb_agg(jsonb_build_object('tanggal', h.tgl, 'jumlah', h.n) order by h.tgl)
      from (
        select d::date as tgl, coalesce(c.n, 0) as n
        from generate_series(p_mulai::timestamp, p_selesai::timestamp, interval '1 day') d
        left join (
          select (created_at at time zone 'Asia/Jakarta')::date as tgl, count(*) as n
          from public.transactions
          where deleted_at is null and created_at >= v_awal and created_at < v_akhir
          group by 1
        ) c on c.tgl = d::date
      ) h
    ), '[]'::jsonb),
    'tanpa_kategori', (
      select count(*) from public.transactions t
      where t.deleted_at is null and t.created_at >= v_awal and t.created_at < v_akhir
        and t.subkategori_id is null and coalesce(nullif(btrim(t.kategori), ''), '') = ''
    )
  ) into v_hasil;

  insert into public.admin_audit (admin_id, aksi) values ((select auth.uid()), 'lihat_monitor_transaksi');
  return v_hasil;
end;
$$;

create or replace function public.admin_monitor_ai(p_mulai date, p_selesai date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lihat boolean;
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
  v_lihat := public.has_role('super_admin') or public.has_role('admin') or public.has_role('support');

  select jsonb_build_object(
    'total_permintaan', (select coalesce(sum(jumlah), 0) from public.ai_chat_usage where tanggal between p_mulai and p_selesai),
    'pengguna_asisten', (select count(distinct user_id) from public.ai_chat_usage where tanggal between p_mulai and p_selesai),
    'per_hari', coalesce((
      select jsonb_agg(jsonb_build_object('tanggal', h.tgl, 'jumlah', h.n) order by h.tgl)
      from (
        select d::date as tgl, coalesce(c.n, 0) as n
        from generate_series(p_mulai::timestamp, p_selesai::timestamp, interval '1 day') d
        left join (
          select tanggal as tgl, sum(jumlah) as n from public.ai_chat_usage
          where tanggal between p_mulai and p_selesai group by tanggal
        ) c on c.tgl = d::date
      ) h
    ), '[]'::jsonb),
    'teraktif', coalesce((
      select jsonb_agg(jsonb_build_object('id_singkat', left(r.user_id::text, 8), 'nama', r.nama, 'jumlah', r.jumlah) order by r.jumlah desc)
      from (
        select p.user_id, p.jumlah,
               case when v_lihat then coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) end as nama
        from (
          select user_id, sum(jumlah) as jumlah from public.ai_chat_usage
          where tanggal between p_mulai and p_selesai group by user_id order by sum(jumlah) desc limit 5
        ) p
        left join auth.users u on u.id = p.user_id
      ) r
    ), '[]'::jsonb),
    'scan', coalesce((
      select jsonb_agg(jsonb_build_object('jenis', s.kind, 'status', s.status, 'jumlah', s.n, 'item', s.item) order by s.n desc)
      from (
        select kind, status, count(*) as n, coalesce(sum(jumlah_item), 0) as item
        from public.scan_batches
        where created_at >= v_awal and created_at < v_akhir
        group by kind, status
      ) s
    ), '[]'::jsonb)
  ) into v_hasil;

  insert into public.admin_audit (admin_id, aksi) values ((select auth.uid()), 'lihat_monitor_ai');
  return v_hasil;
end;
$$;

create or replace function public.admin_cabut_akses_pengguna(p_user uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
  v_n integer;
begin
  if not (public.has_role('super_admin') or public.has_role('support')) then
    raise exception 'Akses ditolak.';
  end if;
  update public.support_access_grants
     set dicabut_pada = now()
   where user_id = p_user and diberikan_kepada = v_admin
     and dicabut_pada is null and berlaku_sampai > now();
  get diagnostics v_n = row_count;
  if v_n > 0 then
    insert into public.admin_audit (admin_id, aksi, target_user_id) values (v_admin, 'cabut_akses_dukungan', p_user);
  end if;
  return v_n;
end;
$$;

revoke execute on function public.admin_log_aktivitas(text, int, int) from public, anon;
revoke execute on function public.admin_monitor_transaksi(date, date) from public, anon;
revoke execute on function public.admin_monitor_ai(date, date) from public, anon;
revoke execute on function public.admin_cabut_akses_pengguna(uuid) from public, anon;
grant execute on function public.admin_log_aktivitas(text, int, int) to authenticated;
grant execute on function public.admin_monitor_transaksi(date, date) to authenticated;
grant execute on function public.admin_monitor_ai(date, date) to authenticated;
grant execute on function public.admin_cabut_akses_pengguna(uuid) to authenticated;
