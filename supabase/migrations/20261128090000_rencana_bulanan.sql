-- Rencana bulanan: rencana pengeluaran dan pemasukan yang dibuat pengguna sendiri.
-- Terpisah dari tabel transactions dan dari menu Budget. Rencana tidak mengubah saldo dompet
-- atau angka pemasukan/pengeluaran riil. Hanya pemilik data yang bisa membaca dan mengubah (RLS).

create table if not exists public.rencana_bulanan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bulan date not null check (extract(day from bulan) = 1),
  nama text not null default 'Rencana' check (length(btrim(nama)) > 0),
  budget bigint not null default 0 check (budget >= 0),
  status text not null default 'draft' check (status in ('draft', 'aktif', 'ditutup')),
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, bulan)
);

create table if not exists public.rencana_item (
  id uuid primary key default gen_random_uuid(),
  rencana_id uuid not null references public.rencana_bulanan(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jenis text not null check (jenis in ('pemasukan', 'pengeluaran')),
  nama text not null check (length(btrim(nama)) > 0),
  nominal bigint not null check (nominal >= 0),
  kategori text,
  created_at timestamptz not null default now()
);

create index if not exists rencana_item_rencana_idx on public.rencana_item (rencana_id);
create index if not exists rencana_item_user_idx on public.rencana_item (user_id);

-- Item hanya boleh menempel ke rencana milik user yang sama.
create or replace function public.tg_rencana_item_owner() returns trigger
language plpgsql as $$
begin
  if not exists (
    select 1 from public.rencana_bulanan r
    where r.id = new.rencana_id and r.user_id = new.user_id
  ) then
    raise exception 'Rencana tidak valid untuk user ini';
  end if;
  return new;
end $$;

drop trigger if exists trg_rencana_item_owner on public.rencana_item;
create trigger trg_rencana_item_owner
  before insert or update on public.rencana_item
  for each row execute function public.tg_rencana_item_owner();

alter table public.rencana_bulanan enable row level security;
alter table public.rencana_item enable row level security;

create policy "rencana milik sendiri" on public.rencana_bulanan
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "item rencana milik sendiri" on public.rencana_item
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.rencana_bulanan from anon;
revoke all on public.rencana_item from anon;
