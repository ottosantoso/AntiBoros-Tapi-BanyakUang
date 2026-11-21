/*
# Edit dompet: izinkan pengubahan jenis dan logo

1. Menu edit dompet bisa mengubah `jenis` dan `logo_url`.
   Sebelumnya kolom ini belum punya grant UPDATE untuk pengguna login,
   sehingga update dari aplikasi ditolak (permission denied).
2. `saldo` tetap tidak bisa diubah langsung. Saldo hanya berubah lewat
   transaksi dan transfer, supaya tetap sinkron dengan riwayat.
3. Kepemilikan tetap dijaga oleh kebijakan RLS yang sudah ada
   (hanya pemilik baris yang bisa update).
*/

GRANT UPDATE (jenis, logo_url) ON public.wallets TO authenticated;
