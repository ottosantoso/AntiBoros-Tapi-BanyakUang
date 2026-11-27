-- Dashboard admin: satu RPC untuk kartu KPI, tren harian, kategori, fitur, pengguna teraktif,
-- aktivitas, dan log admin. Hanya agregat. Nama/email hanya untuk super_admin, admin, dan support;
-- analyst hanya melihat ID singkat. Setiap pembukaan dicatat di admin_audit.

create or replace function public.admin_dashboard(p_mulai date, p_selesai date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := (select auth.uid());
  v_lihat_nama boolean;
  v_total_pengguna bigint;
  v_aktif bigint;
  v_awal timestamptz;
  v_akhir timestamptz;
  v_hasil jsonb;
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak.';
  end if;
  if p_mulai is null or p_selesai is null or p_selesai < p_mulai then
    raise exception 'Periode tidak valid.';
  end if;
  if p_selesai - p_mulai > 366 then
    raise exception 'Periode maksimal 366 hari.';
  end if;

  v_awal  := (p_mulai::timestamp at time zone 'Asia/Jakarta');
  v_akhir := ((p_selesai + 1)::timestamp at time zone 'Asia/Jakarta');
  v_lihat_nama := public.has_role('super_admin') or public.has_role('admin') or public.has_role('support');

  select count(*) into v_total_pengguna from auth.users;
  select count(*) into v_aktif from auth.users
    where last_sign_in_at >= v_awal and last_sign_in_at < v_akhir;

  with tx as (
    select t.id, t.user_id, t.tanggal, t.tipe, t.nominal,
           coalesce(nullif(btrim(s.kategori), ''), nullif(btrim(t.kategori), ''), 'Tanpa kategori') as kat
    from public.transactions t
    left join public.subkategori s on s.id = t.subkategori_id
    where t.deleted_at is null
      and coalesce(s.kategori, t.kategori, '') is distinct from 'Penyesuaian Saldo'
      and coalesce(s.kategori, t.kategori, '') not in ('Utang', 'Pembayaran Utang', 'Piutang', 'Pelunasan Piutang')
      and not (t.transfer_id is not null and coalesce(s.kategori, t.kategori, '') is distinct from 'Biaya Admin')
  ),
  per as (
    select * from tx where tanggal between p_mulai and p_selesai
  ),
  tot as (
    select
      count(*) as jumlah,
      coalesce(sum(nominal) filter (where tipe = 'Pemasukan'), 0)   as masuk,
      coalesce(sum(nominal) filter (where tipe = 'Pengeluaran'), 0) as keluar
    from per
  )
  select jsonb_build_object(
    'periode', jsonb_build_object('dari', p_mulai, 'sampai', p_selesai),
    'kpi', jsonb_build_object(
      'total_pengguna', v_total_pengguna,
      'pengguna_aktif', v_aktif,
      'total_transaksi', (select jumlah from tot),
      'pemasukan', (select masuk from tot),
      'pengeluaran', (select keluar from tot)
    ),
    'tren_harian', coalesce((
      select jsonb_agg(jsonb_build_object('tanggal', h.tgl, 'transaksi', h.n, 'pengguna', h.u) order by h.tgl)
      from (
        select d::date as tgl, coalesce(c.n, 0) as n, coalesce(c.u, 0) as u
        from generate_series(p_mulai::timestamp, p_selesai::timestamp, interval '1 day') d
        left join (
          select (created_at at time zone 'Asia/Jakarta')::date as tgl,
                 count(*) as n,
                 count(distinct user_id) as u
          from public.transactions
          where deleted_at is null and created_at >= v_awal and created_at < v_akhir
          group by 1
        ) c on c.tgl = d::date
      ) h
    ), '[]'::jsonb),
    'kategori', coalesce((
      select jsonb_agg(jsonb_build_object('kategori', k.kat, 'total', k.total) order by k.total desc)
      from (
        select kat, sum(nominal) as total
        from per where tipe = 'Pengeluaran'
        group by kat
        order by sum(nominal) desc
        limit 8
      ) k
    ), '[]'::jsonb),
    'fitur', jsonb_build_array(
      jsonb_build_object('fitur', 'Pencatatan transaksi', 'pengguna',
        (select count(distinct user_id) from public.transactions where deleted_at is null)),
      jsonb_build_object('fitur', 'Budget', 'pengguna',
        (select count(distinct user_id) from public.budgets)),
      jsonb_build_object('fitur', 'Rencana bulanan', 'pengguna',
        (select count(distinct user_id) from public.rencana_bulanan)),
      jsonb_build_object('fitur', 'Asisten AI', 'pengguna',
        (select count(distinct user_id) from public.ai_chat_usage)),
      jsonb_build_object('fitur', 'Scan struk & mutasi', 'pengguna',
        (select count(distinct user_id) from public.scan_batches)),
      jsonb_build_object('fitur', 'Utang & cicilan', 'pengguna',
        (select count(distinct user_id) from public.debts))
    ),
    'pengguna_teraktif', coalesce((
      select jsonb_agg(jsonb_build_object('id_singkat', left(r.user_id::text, 8), 'nama', r.nama, 'jumlah', r.jumlah) order by r.jumlah desc)
      from (
        select p.user_id, p.jumlah,
               case when v_lihat_nama
                    then coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
               end as nama
        from (
          select user_id, count(*) as jumlah from per group by user_id order by count(*) desc limit 5
        ) p
        left join auth.users u on u.id = p.user_id
      ) r
    ), '[]'::jsonb),
    'aktivitas_terbaru', coalesce((
      select jsonb_agg(jsonb_build_object('waktu', a.created_at, 'aksi', a.aksi, 'id_singkat', left(a.user_id::text, 8), 'nama', a.nama, 'email', a.email) order by a.created_at desc)
      from (
        select l.created_at, l.aksi, l.user_id,
               case when v_lihat_nama then coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1)) end as nama,
               case when v_lihat_nama then u.email end as email
        from public.transaksi_log l
        left join auth.users u on u.id = l.user_id
        where l.created_at >= v_awal and l.created_at < v_akhir
        order by l.created_at desc
        limit 20
      ) a
    ), '[]'::jsonb),
    'log_admin', coalesce((
      select jsonb_agg(jsonb_build_object('waktu', g.created_at, 'aksi', g.aksi, 'admin', g.admin_label, 'target', left(g.target_user_id::text, 8)) order by g.created_at desc)
      from (
        select x.created_at, x.aksi, x.target_user_id,
               case when v_lihat_nama
                    then coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
                    else left(x.admin_id::text, 8)
               end as admin_label
        from public.admin_audit x
        left join auth.users u on u.id = x.admin_id
        where x.created_at >= v_awal and x.created_at < v_akhir
        order by x.created_at desc
        limit 20
      ) g
    ), '[]'::jsonb)
  ) into v_hasil
  from tot;

  insert into public.admin_audit (admin_id, aksi) values (v_admin, 'lihat_dashboard');

  return v_hasil;
end;
$$;

revoke execute on function public.admin_dashboard(date, date) from public, anon;
grant execute on function public.admin_dashboard(date, date) to authenticated;
