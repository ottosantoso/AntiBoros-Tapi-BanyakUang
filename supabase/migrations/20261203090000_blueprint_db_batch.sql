-- Batch database dari Blueprint Fitur Lanjutan (27 Nov 2026).
-- Isi:
--   A. Perbaikan temuan advisor keamanan (RLS auth.uid() per baris, search_path, EXECUTE trigger).
--   B. Utang, piutang, dan cicilan: debts, debt_payments.
--   C. Notifikasi: notifications, notification_settings (default mati).
--   D. Admin: user_roles, is_admin(), admin_summary() yang hanya mengembalikan agregat, admin_audit.
-- Tidak termasuk: mode keluarga (perlu uji dua akun dulu), aturan hitung utang di report_summary
-- dan kategori sistem Utang/Piutang (ikut fitur utang, saat transaksi utang mulai dibuat),
-- dan pg_cron untuk pembersihan draf chat 30 hari.

begin;

-- ============================================================
-- A. Perbaikan advisor keamanan
-- ============================================================

-- A1. RLS: bungkus auth.uid() dengan (select ...) supaya tidak dievaluasi per baris.
drop policy if exists "pemakaian ai milik sendiri" on public.ai_chat_usage;
create policy "pemakaian ai milik sendiri" on public.ai_chat_usage
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "rencana milik sendiri" on public.rencana_bulanan;
create policy "rencana milik sendiri" on public.rencana_bulanan
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "item rencana milik sendiri" on public.rencana_item;
create policy "item rencana milik sendiri" on public.rencana_item
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "riwayat pindai milik sendiri" on public.scan_batches;
create policy "riwayat pindai milik sendiri" on public.scan_batches
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "log transaksi milik sendiri" on public.transaksi_log;
create policy "log transaksi milik sendiri" on public.transaksi_log
  for select
  using (user_id = (select auth.uid()));

-- A2. search_path tetap untuk fungsi trigger yang disebut advisor.
-- Dipilih 'public' (bukan kosong) karena isi fungsinya memakai nama tabel tanpa skema.
alter function public.tg_rencana_item_owner() set search_path = public;
alter function public.tg_rencana_model_lock() set search_path = public;

-- A3. Fungsi log hanya dijalankan oleh trigger. Trigger tidak butuh EXECUTE untuk role pengguna.
revoke execute on function public.catat_transaksi_log() from public, anon, authenticated;

-- ============================================================
-- B. Utang, piutang, dan cicilan
-- ============================================================

create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jenis text not null check (jenis in ('utang', 'piutang', 'cicilan')),
  pihak text not null check (char_length(btrim(pihak)) between 1 and 80),
  pokok numeric not null check (pokok > 0),
  bunga_persen numeric not null default 0 check (bunga_persen >= 0),
  metode_bunga text not null default 'flat' check (metode_bunga in ('flat', 'anuitas', 'tanpa_bunga')),
  tenor_bulan integer null check (tenor_bulan between 1 and 360),
  tanggal_mulai date not null,
  hari_jatuh_tempo integer null check (hari_jatuh_tempo between 1 and 28),
  wallet_id uuid null references public.wallets(id) on delete set null,
  status text not null default 'aktif' check (status in ('aktif', 'lunas', 'dibatalkan')),
  catatan text null,
  created_at timestamptz not null default now()
);

create index if not exists debts_user_idx on public.debts (user_id);
create index if not exists debts_wallet_idx on public.debts (wallet_id);

create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nomor integer not null check (nomor >= 1),
  jatuh_tempo date not null,
  jumlah_pokok numeric not null check (jumlah_pokok >= 0),
  jumlah_bunga numeric not null default 0 check (jumlah_bunga >= 0),
  status text not null default 'belum' check (status in ('belum', 'lunas', 'terlambat')),
  dibayar_pada date null,
  transaction_id uuid null references public.transactions(id) on delete set null,
  unique (debt_id, nomor)
);

create index if not exists debt_payments_user_idx on public.debt_payments (user_id);
create index if not exists debt_payments_transaction_idx on public.debt_payments (transaction_id);

alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;

drop policy if exists "utang milik sendiri" on public.debts;
create policy "utang milik sendiri" on public.debts
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Angsuran hanya boleh menempel ke utang milik pengguna yang sama.
drop policy if exists "angsuran milik sendiri" on public.debt_payments;
create policy "angsuran milik sendiri" on public.debt_payments
  for all
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.debts d
      where d.id = debt_id and d.user_id = (select auth.uid())
    )
  );

revoke all on public.debts from anon;
revoke all on public.debt_payments from anon;

-- ============================================================
-- C. Notifikasi
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jenis text not null check (jenis in (
    'pengingat_harian', 'ringkasan_mingguan', 'cek_tengah_bulan',
    'saldo_minus', 'budget_80', 'budget_100', 'jatuh_tempo_utang'
  )),
  judul text not null check (char_length(btrim(judul)) between 1 and 120),
  isi text not null default '' check (char_length(isi) <= 500),
  dibaca_pada timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create table if not exists public.notification_settings (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jenis text not null check (jenis in (
    'pengingat_harian', 'ringkasan_mingguan', 'cek_tengah_bulan',
    'saldo_minus', 'budget_80', 'budget_100', 'jatuh_tempo_utang'
  )),
  aktif boolean not null default false,
  primary key (user_id, jenis)
);

alter table public.notifications enable row level security;
alter table public.notification_settings enable row level security;

-- Pengguna hanya bisa membaca dan menandai notifikasinya sendiri. Pembuatan dilakukan server (service role).
drop policy if exists "notifikasi milik sendiri" on public.notifications;
create policy "notifikasi milik sendiri" on public.notifications
  for select
  using (user_id = (select auth.uid()));

drop policy if exists "tandai notifikasi dibaca" on public.notifications;
create policy "tandai notifikasi dibaca" on public.notifications
  for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "hapus notifikasi sendiri" on public.notifications;
create policy "hapus notifikasi sendiri" on public.notifications
  for delete
  using (user_id = (select auth.uid()));

drop policy if exists "pengaturan notifikasi milik sendiri" on public.notification_settings;
create policy "pengaturan notifikasi milik sendiri" on public.notification_settings
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.notifications from anon;
revoke all on public.notification_settings from anon;

-- ============================================================
-- D. Admin (hanya agregat, tanpa melihat isi transaksi pengguna)
-- ============================================================

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin')),
  created_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

drop policy if exists "lihat peran sendiri" on public.user_roles;
create policy "lihat peran sendiri" on public.user_roles
  for select
  using (user_id = (select auth.uid()));
-- Tidak ada policy insert, update, atau delete untuk pengguna biasa. Peran diatur dari SQL editor.

revoke all on public.user_roles from anon;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = 'admin'
  )
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid null references auth.users(id) on delete set null,
  aksi text not null check (char_length(btrim(aksi)) between 1 and 80),
  target_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.admin_audit enable row level security;

drop policy if exists "admin baca audit" on public.admin_audit;
create policy "admin baca audit" on public.admin_audit
  for select
  using (public.is_admin());

revoke all on public.admin_audit from anon;

-- Ringkasan untuk halaman admin. Hanya angka total, tidak ada nama, email, atau isi transaksi.
create or replace function public.admin_summary()
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

  select jsonb_build_object(
    'total_pengguna', (select count(*) from auth.users),
    'pengguna_aktif_30_hari', (
      select count(*) from auth.users where last_sign_in_at >= now() - interval '30 days'
    ),
    'total_transaksi', (select count(*) from public.transactions where deleted_at is null),
    'pemakaian_ai_hari_ini', (
      select coalesce(sum(jumlah), 0) from public.ai_chat_usage
      where tanggal = (now() at time zone 'Asia/Jakarta')::date
    ),
    'pengguna_pakai_utang', (select count(distinct user_id) from public.debts)
  ) into v_hasil;

  insert into public.admin_audit (admin_id, aksi) values ((select auth.uid()), 'lihat_ringkasan');

  return v_hasil;
end;
$$;

revoke execute on function public.admin_summary() from public, anon;
grant execute on function public.admin_summary() to authenticated;

commit;
