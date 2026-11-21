Analisis struktur repositori ini dan buat atau perbarui file `CODEBASE_MAP.md` di root.

Isi `CODEBASE_MAP.md` dengan:
1. Stack, perintah penting, dan variabel env yang dibutuhkan.
2. Pohon direktori utama (abaikan node_modules, .git, dist, *.tsbuildinfo).
3. Fungsi singkat tiap folder dan file inti.
4. Alur data utama (entry point, state, akses database, skema tabel).
5. Status pekerjaan yang belum selesai atau tidak konsisten (mis. migrasi yang setengah jalan).
6. Catatan keamanan (secret yang ter-commit, policy terlalu terbuka).

Jika `CODEBASE_MAP.md` sudah ada, perbarui hanya bagian yang berubah (cek `git log` sejak commit yang tertulis di baris "Terakhir dipetakan").
Tulis dengan format ringkas agar hemat token, dan jangan menyalin isi kode.
