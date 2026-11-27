-- Asisten AI Pencatat, fase 1: draf transaksi dari chat harus dikonfirmasi user sebelum masuk ke transactions.
-- - chat_actions: menyimpan draf (status pending). Hanya pemilik yang bisa melihat dan mengubahnya.
-- - confirm_chat_action: mengubah draf menjadi transaksi. Memakai insert transactions biasa,
--   jadi trigger saldo dompet dan transaksi_log ikut berjalan seperti catat manual.
-- Draf kedaluwarsa 15 menit dan tidak bisa dikonfirmasi setelah itu.

create table if not exists public.chat_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  jenis text not null check (jenis in ('catat_transaksi')),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  result_transaction_id uuid null references public.transactions (id) on delete set null,
  expires_at timestamptz not null default now() + interval '15 minutes',
  created_at timestamptz not null default now()
);

create index if not exists chat_actions_user_idx on public.chat_actions (user_id, created_at desc);

alter table public.chat_actions enable row level security;

drop policy if exists "aksi chat milik sendiri" on public.chat_actions;
create policy "aksi chat milik sendiri" on public.chat_actions
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.chat_actions from anon;

-- Ubah draf catat_transaksi menjadi transaksi. Mengembalikan id transaksi yang dibuat.
create or replace function public.confirm_chat_action(p_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_aksi public.chat_actions%rowtype;
  v_tipe text;
  v_nominal numeric;
  v_deskripsi text;
  v_wallet uuid;
  v_tanggal date;
  v_tx uuid;
begin
  select * into v_aksi
  from public.chat_actions
  where id = p_id and user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Draf transaksi tidak ditemukan.';
  end if;
  if v_aksi.status <> 'pending' then
    raise exception 'Draf ini sudah diproses.';
  end if;
  if v_aksi.expires_at < now() then
    raise exception 'Draf sudah kedaluwarsa. Tulis ulang transaksinya.';
  end if;
  if v_aksi.jenis <> 'catat_transaksi' then
    raise exception 'Jenis aksi tidak didukung.';
  end if;

  v_tipe := v_aksi.payload ->> 'tipe';
  if v_tipe not in ('Pemasukan', 'Pengeluaran') then
    raise exception 'Tipe transaksi tidak valid.';
  end if;

  v_nominal := (v_aksi.payload ->> 'nominal')::numeric;
  if v_nominal is null or v_nominal <= 0 then
    raise exception 'Nominal tidak valid.';
  end if;

  v_deskripsi := btrim(coalesce(v_aksi.payload ->> 'deskripsi', ''));
  if v_deskripsi = '' then
    raise exception 'Deskripsi belum ada.';
  end if;

  v_wallet := (v_aksi.payload ->> 'walletId')::uuid;
  if v_wallet is null then
    raise exception 'Dompet belum dipilih.';
  end if;

  v_tanggal := (v_aksi.payload ->> 'tanggal')::date;
  if v_tanggal is null then
    raise exception 'Tanggal tidak valid.';
  end if;

  insert into public.transactions (tanggal, deskripsi, tipe, nominal, wallet_id, kategori, subkategori_id, berulang)
  values (
    v_tanggal,
    v_deskripsi,
    v_tipe,
    v_nominal,
    v_wallet,
    nullif(v_aksi.payload ->> 'kategori', ''),
    nullif(v_aksi.payload ->> 'subkategoriId', '')::uuid,
    false
  )
  returning id into v_tx;

  update public.chat_actions
  set status = 'confirmed', result_transaction_id = v_tx
  where id = p_id;

  return v_tx;
end;
$$;

revoke execute on function public.confirm_chat_action(uuid) from public, anon;
grant execute on function public.confirm_chat_action(uuid) to authenticated;
