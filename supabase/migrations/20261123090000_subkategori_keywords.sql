-- Kata kunci subkategori untuk saran kategori otomatis dari deskripsi.
-- Migrasi baru: migrasi lama tidak diubah.
--
-- 1. Kolom keywords di subkategori (sebelumnya tidak ada di migrasi yang berjalan).
-- 2. Fungsi default_subkategori_keywords: kata kunci bawaan per nama subkategori default.
-- 3. Isi kata kunci untuk subkategori yang sudah ada.
-- 4. Trigger: subkategori baru tanpa keywords otomatis diisi kata kunci bawaan.

alter table public.subkategori
  add column if not exists keywords text[] not null default '{}';

create or replace function public.default_subkategori_keywords(p_nama text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case p_nama
    when 'Makan & Minum' then array['makan','kopi','resto','warteg','bakso','gofood','grabfood','shopeefood','jajan','cafe','coffee','kenangan','starbucks','mcd','kfc','restoran']::text[]
    when 'Transportasi' then array['bensin','bbm','pertalite','pertamax','parkir','tol','gojek','grab','ojek','bus','kereta','krl','transjakarta','angkot','servis motor','kendaraan']::text[]
    when 'Belanja Bulanan' then array['indomaret','alfamart','superindo','giant','hypermart','belanja','pasar','sayur','supermarket','carrefour']::text[]
    when 'Tagihan & Utilitas' then array['listrik','pln','token','pdam','air','internet','wifi','indihome','biznet','paket data','kuota','tagihan','gas','lpg']::text[]
    when 'Kesehatan' then array['obat','apotek','dokter','rs','rumah sakit','klinik','bpjs','vitamin','kesehatan']::text[]
    when 'Pendidikan' then array['spp','sekolah','kursus','buku','alat tulis','kuliah']::text[]
    when 'Hiburan' then array['bioskop','cgv','cinema','konser','game','steam','playstore','netflix','spotify','wisata','hotel']::text[]
    when 'Gaji' then array['gaji','salary']::text[]
    when 'Bonus' then array['bonus','thr']::text[]
    when 'Cashback' then array['cashback','cash back']::text[]
    when 'Refund' then array['refund','pengembalian dana']::text[]
    when 'Top Up' then array['top up','topup','isi saldo']::text[]
    else '{}'::text[]
  end
$$;

update public.subkategori
set keywords = public.default_subkategori_keywords(nama)
where keywords = '{}'
  and public.default_subkategori_keywords(nama) <> '{}';

create or replace function public.tg_subkategori_default_keywords()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(array_length(new.keywords, 1), 0) = 0 then
    new.keywords := public.default_subkategori_keywords(new.nama);
  end if;
  return new;
end;
$$;

drop trigger if exists subkategori_default_keywords on public.subkategori;
create trigger subkategori_default_keywords
  before insert on public.subkategori
  for each row execute function public.tg_subkategori_default_keywords();
