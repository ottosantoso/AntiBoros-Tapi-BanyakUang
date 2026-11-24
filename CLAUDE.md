# Aturan Navigasi Kode

- SELALU baca `CODEBASE_MAP.md` terlebih dahulu sebelum mencari file atau memindai seluruh repositori.
- Jangan membaca seluruh file jika informasi sudah ada di `CODEBASE_MAP.md`; buka hanya file yang relevan.
- Perbarui `CODEBASE_MAP.md` hanya jika ada file/folder baru atau dihapus, tabel DB berubah, atau status migrasi berubah.

# Konvensi Proyek

- Stack: Vite + React 18 + TypeScript + Tailwind 3 + shadcn/ui + Supabase. Alias import `@/` = `src/`.
- Teks UI berbahasa Indonesia. Pakai ikon `lucide-react`; jangan menambah paket UI/ikon baru tanpa diminta.
- `src/components/ui/` adalah komponen shadcn: jangan diedit manual.
- Akses database hanya lewat folder `src/lib/data/`, satu file per fitur (misalnya `wallets.ts`, `budget.ts`, `ai-reports.ts`). `src/lib/data.ts` hanya meneruskan ekspor dari modul-modul itu. Komponen tetap mengimpor dari `@/lib/data`.
- Menambah fitur baru yang butuh data: buat file baru di `src/lib/data/`, lalu tambahkan satu baris `export * from './data/<nama>'` di `src/lib/data.ts`. Jangan menulis ulang file yang sudah ada hanya untuk menambah satu fungsi.
- Helper bersama (`toNumber`, `escapeLike`, `WriteResult`) ada di `src/lib/data/shared.ts`. Jangan menduplikasinya di modul lain.
- Jangan memanggil Supabase langsung dari komponen.
- Jangan commit secret/key (termasuk URL Apps Script berparameter `key`). Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- Perubahan skema database dibuat sebagai file migrasi baru di `supabase/migrations/`, jangan mengubah migrasi lama.
- Sebelum selesai: jalankan `npm run typecheck` dan `npm run lint`.
- Jangan menulis ulang file besar dari salinan lama. Selalu baca versi terbaru dari `main` sebelum mengubah file yang sudah ada, supaya perubahan dari PR lain tidak ikut hilang.

# Alur Git

- Jangan menulis langsung ke `main`. Buat branch baru, lalu buka pull request.
