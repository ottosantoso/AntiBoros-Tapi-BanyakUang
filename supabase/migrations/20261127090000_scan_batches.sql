-- Riwayat pindaian AI Scanner (struk dan mutasi).
-- Setiap hasil pindai dicatat sebagai batch: draft saat hasil muncul, lalu 'saved' atau 'cancelled'.
-- Hanya pemilik data yang bisa membaca dan mengubah baris miliknya (RLS).

create table if not exists public.scan_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('struk', 'mutasi')),
  status text not null default 'draft' check (status in ('draft', 'saved', 'cancelled')),
  draft jsonb not null default '{}'::jsonb,
  jumlah_item int not null default 0 check (jumlah_item >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scan_batches_user_time_idx on public.scan_batches (user_id, created_at desc);

alter table public.scan_batches enable row level security;

create policy "riwayat pindai milik sendiri" on public.scan_batches
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
