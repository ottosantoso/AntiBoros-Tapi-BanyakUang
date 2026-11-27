-- Notifikasi budget memakai tabel notifications yang sudah ada (#71).
-- Kolom referensi menandai notifikasi per subkategori, bulan, dan ambang, supaya setiap ambang
-- hanya tercatat sekali. Contoh nilai: 'budget:<subkategori_id>:2026-11:80'.

alter table public.notifications
  add column if not exists referensi text;

create unique index if not exists notifications_referensi_unik
  on public.notifications (user_id, referensi)
  where referensi is not null;
