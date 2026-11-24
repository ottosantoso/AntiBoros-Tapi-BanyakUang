-- Rencana bulanan v2: kelompok 50/30/20 per item pengeluaran.
-- Budget kini sama dengan total pemasukan rencana, jadi kolom rencana_bulanan.budget tidak dipakai lagi
-- (tidak dihapus, supaya data lama aman). Migrasi sebelumnya tidak diubah.

alter table public.rencana_item add column if not exists kelompok text;

-- Isi awal dari kategori untuk item pengeluaran yang sudah ada. Sama dengan pemetaan di aplikasi.
update public.rencana_item
set kelompok = case kategori
  when 'Hiburan & Lifestyle' then 'keinginan'
  when 'Investasi & Tabungan' then 'investasi'
  else 'kebutuhan'
end
where jenis = 'pengeluaran' and kelompok is null;

alter table public.rencana_item drop constraint if exists rencana_item_kelompok_check;
alter table public.rencana_item add constraint rencana_item_kelompok_check check (
  (jenis = 'pengeluaran' and kelompok in ('kebutuhan', 'keinginan', 'investasi'))
  or (jenis = 'pemasukan' and kelompok is null)
);
