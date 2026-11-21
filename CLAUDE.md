# Aturan Navigasi Kode

- SELALU baca `CODEBASE_MAP.md` terlebih dahulu sebelum mencari file atau memindai seluruh repositori.
- Jangan membaca seluruh file jika informasi sudah ada di `CODEBASE_MAP.md`; buka hanya file yang relevan.
- Perbarui `CODEBASE_MAP.md` hanya jika ada file/folder baru atau dihapus, tabel DB berubah, atau status migrasi berubah.

# Konvensi Proyek

- Stack: Vite + React 18 + TypeScript + Tailwind 3 + shadcn/ui + Supabase. Alias import `@/` = `src/`.
- Teks UI berbahasa Indonesia. Pakai ikon `lucide-react`; jangan menambah paket UI/ikon baru tanpa diminta.
- `src/components/ui/` adalah komponen shadcn: jangan diedit manual.
- Akses database hanya lewat `src/lib/data.ts`; jangan memanggil Supabase langsung dari komponen.
- Jangan commit secret/key (termasuk URL Apps Script berparameter `key`). Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Perubahan skema database dibuat sebagai file migrasi baru di `supabase/migrations/`, jangan mengubah migrasi lama.
- Sebelum selesai: jalankan `npm run typecheck` dan `npm run lint`.

# Alur Git

- Jangan menulis langsung ke `main`. Buat branch baru, lalu buka pull request.
