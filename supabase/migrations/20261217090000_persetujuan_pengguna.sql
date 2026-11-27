-- Persetujuan Syarat & Ketentuan serta Kebijakan Privasi saat pendaftaran.
-- Klien mengirim persetujuan di raw_user_meta_data.persetujuan saat signUp.
-- Trigger di auth.users menyalin persetujuan itu ke tabel ini dan mencatatnya di activity_logs.
-- Berlaku untuk pendaftaran baru. Akun lama yang dibuat sebelum migrasi ini tidak punya catatan.

create table if not exists public.persetujuan_pengguna (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  versi_dokumen text not null check (char_length(versi_dokumen) <= 40),
  sumber text not null default 'daftar' check (sumber in ('daftar')),
  disetujui_at timestamptz not null default now(),
  -- IP tidak tersedia pada alur signUp (GoTrue tidak meneruskan header request), sehingga tidak dicatat di sini.
  created_at timestamptz not null default now()
);
create index if not exists persetujuan_pengguna_user_idx on public.persetujuan_pengguna (user_id);

alter table public.persetujuan_pengguna enable row level security;
revoke all on public.persetujuan_pengguna from public, anon, authenticated;
grant select on public.persetujuan_pengguna to authenticated;

-- Pengguna hanya bisa membaca catatan persetujuannya sendiri.
create policy persetujuan_baca_sendiri on public.persetujuan_pengguna
  for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.catat_persetujuan_daftar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p jsonb := new.raw_user_meta_data -> 'persetujuan';
  v_versi text;
begin
  if v_p is null then return new; end if;
  -- Hanya persetujuan yang bernilai true yang dicatat.
  if coalesce(v_p ->> 'setuju', '') not in ('true') then return new; end if;

  v_versi := left(coalesce(nullif(v_p ->> 'versi', ''), 'tidak diketahui'), 40);

  insert into public.persetujuan_pengguna (user_id, versi_dokumen, sumber, disetujui_at)
  values (new.id, v_versi, 'daftar', now());

  insert into public.activity_logs
    (actor_id, actor_peran, modul, aksi, status, tabel, target_id, target_user_id, detail)
  values (
    new.id, 'User', 'Akses', 'setujui_ketentuan', 'berhasil',
    'persetujuan_pengguna', new.id::text, new.id,
    jsonb_build_object('versi', v_versi, 'sumber', 'daftar')
  );
  return new;
end $$;

drop trigger if exists persetujuan_daftar on auth.users;
create trigger persetujuan_daftar
  after insert on auth.users
  for each row execute function public.catat_persetujuan_daftar();

revoke execute on function public.catat_persetujuan_daftar() from public, anon, authenticated;
