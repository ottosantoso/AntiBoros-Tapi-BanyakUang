-- Jenis dompet Tunai (Fase A).
-- Hanya memperluas constraint: menambah nilai 'tunai' untuk kolom jenis.
-- Data dompet yang sudah ada TIDAK diubah di migrasi ini. Dompet CASH dipindah ke 'tunai'
-- di langkah berikutnya, bersamaan dengan dukungan 'tunai' di data.ts dan form Tambah Dompet,
-- supaya tidak tampil sebagai "bank" di antara dua langkah.

ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_jenis_check;

ALTER TABLE public.wallets
  ADD CONSTRAINT wallets_jenis_check
  CHECK (jenis IN ('bank', 'ewallet', 'tunai', 'lainnya'));
