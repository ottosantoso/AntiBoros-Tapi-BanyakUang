-- Pindahkan dompet Cash (provider CASH) dari jenis 'lainnya' ke 'tunai'.
-- Sudah diterapkan langsung ke database project bdaoftrmiesxioinsxlp (1 baris: "Cash", saldo tidak berubah).
-- File ini dicatat supaya riwayat migrasi di repo sama dengan database. Aman dijalankan ulang:
-- hanya baris dengan jenis 'lainnya' yang berubah.

UPDATE public.wallets
SET jenis = 'tunai'
WHERE provider = 'CASH'
  AND jenis = 'lainnya';
