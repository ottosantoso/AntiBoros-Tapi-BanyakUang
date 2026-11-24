-- Batas pemakaian Asisten Keuangan AI: 20 pertanyaan per hari per user (tanggal WIB).
-- Dihitung di database dan di server, jadi tidak bisa dilewati dari browser.
-- Hanya menyimpan jumlah pemakaian, tidak menyimpan isi percakapan.

create table if not exists public.ai_chat_usage (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tanggal date not null,
  jumlah int not null default 0 check (jumlah >= 0),
  primary key (user_id, tanggal)
);

alter table public.ai_chat_usage enable row level security;

create policy "pemakaian ai milik sendiri" on public.ai_chat_usage
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tambah satu pemakaian hari ini. Mengembalikan true bila masih di bawah batas, false bila sudah habis.
create or replace function public.ai_chat_consume(p_limit int)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tanggal date := (now() at time zone 'Asia/Jakarta')::date;
  v_ok boolean;
begin
  insert into public.ai_chat_usage (user_id, tanggal, jumlah)
  values (auth.uid(), v_tanggal, 1)
  on conflict (user_id, tanggal)
  do update set jumlah = public.ai_chat_usage.jumlah + 1
    where public.ai_chat_usage.jumlah < p_limit
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;
