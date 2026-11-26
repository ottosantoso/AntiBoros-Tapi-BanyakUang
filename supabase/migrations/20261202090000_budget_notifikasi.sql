-- Notifikasi budget: peringatan saat pemakaian batas subkategori mencapai 80% dan 100%.
-- Setiap ambang hanya dicatat sekali per subkategori per bulan (kunci unik).
-- Hanya pemilik yang bisa membaca dan mengubah baris miliknya (RLS).

create table if not exists public.budget_notifikasi (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  subkategori_id uuid not null references public.subkategori(id) on delete cascade,
  periode text not null check (periode ~ '^[0-9]{4}-[0-9]{2}$'),
  ambang int not null check (ambang in (80, 100)),
  pesan text not null,
  dibaca boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, subkategori_id, periode, ambang)
);

create index if not exists budget_notifikasi_user_idx on public.budget_notifikasi (user_id, dibaca, created_at desc);

alter table public.budget_notifikasi enable row level security;

create policy "notifikasi budget milik sendiri" on public.budget_notifikasi
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
