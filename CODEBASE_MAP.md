# CODEBASE_MAP: AntiBoros-Tapi-BanyakUang ("Hepeng History")

Pelacak keuangan pribadi (dompet, transaksi, scanner struk/mutasi dengan AI). UI berbahasa Indonesia.
Dibuat dari Bolt (`.bolt/`). Terakhir dipetakan dari `main` commit `31434c4` (2026-11-21). Setelah itu hanya ditambah 3 file dokumentasi (PR #1).

## Status verifikasi
Peta ini diverifikasi per file. Bagian yang belum dibuka tandai "belum diverifikasi" dan jangan dianggap fakta.
- Sudah dibaca: `package.json`, `README.md`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `eslint.config.js`, `.gitignore`, `.bolt/prompt`, `.bolt/ignore`, `src/main.tsx`, `src/App.tsx`, `src/app/*` (kecuali `dashboard-view` sudah dibaca, semua file app sudah dibaca), `src/components/` (sidebar, header, cashflow-charts, transaction-list, wallet-card, metric-card, add-transaction-sheet, date-range-picker), `src/lib/` (api, data, use-dashboard, supabase-client, types, date-range, format, theme, wallets, demo-data), kedua migrasi SQL.
- Belum dibaca: `src/components/ui/*` (shadcn), `src/hooks/use-toast.ts`, `src/lib/utils.ts`, `src/components/logo.tsx`, `theme-toggle.tsx`, `src/App.css`, `src/index.css`, `tailwind.config.js`, `components.json`, `tsconfig.node.json`, `postcss.config.js`, `vite-env.d.ts`, `package-lock.json`, `.bolt/config.json`.

## Stack
- Vite 5 + React 18 + TypeScript (strict), Tailwind CSS 3 + shadcn/ui (Radix), ikon `lucide-react`
- Data: Supabase (`@supabase/supabase-js`), polling 30 detik. Chart: `recharts`. Tanggal: `date-fns`
- Dependensi terpasang tapi belum terverifikasi dipakai: `react-hook-form`, `zod`, `@hookform/resolvers` (kemungkinan dipakai di `ui/form.tsx`, belum diverifikasi), `react-dropzone` dipakai di `scanner-view.tsx`
- Alias import: `@/` = `src/`
- ESLint flat config dengan `react-hooks` dan `react-refresh`. `noUnusedLocals` dimatikan di `tsconfig.app.json`.

## Perintah
- `npm run dev` | `npm run build` (`tsc -b && vite build`) | `npm run lint` | `npm run typecheck` (`tsc --noEmit -p tsconfig.app.json`)
- Env wajib (tidak ada `.env` di repo): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Struktur
```
index.html, vite.config.ts, tailwind.config.js, components.json (shadcn)
.bolt/                      config & prompt Bolt. .bolt/ignore mengecualikan src/components/ui/* dan hooks/use-toast.ts
supabase/migrations/        skema DB (3 file)
src/
  main.tsx, App.tsx         entry; App memegang state view, dateRange, sheet tambah transaksi
  app/                      satu file per halaman
    views.ts                type View = dashboard|wallets|transactions|scanner|settings; TransactionSection (duplikat dengan types.ts)
    dashboard-view.tsx      metrik, chart arus kas, kategori, target tabungan, transaksi terbaru
    wallets-view.tsx        kartu dompet + rincian saldo (belum ada UI tambah/edit/hapus dompet)
    transactions-view.tsx   ringkasan + riwayat + filter (jenis, cari, dompet, tanggal)
    scanner-view.tsx        upload struk/mutasi -> scan AI (Apps Script) -> review -> simpan (Apps Script)
    settings-view.tsx       input URL Google Apps Script (localStorage)
    login-view.tsx          halaman masuk, daftar, dan lupa password (Supabase Auth)
  components/
    sidebar, header, cashflow-charts, transaction-list, wallet-card, metric-card, date-range-picker,
    add-transaction-sheet.tsx   form tambah transaksi (side sheet), simpan via Apps Script
    ui/                         komponen shadcn (jangan diedit manual)
  lib/
    supabase-client.ts      createClient dari env VITE_* (cek env, exporter supabaseConfigured)
    use-session.ts          hook sesi Supabase Auth (getSession + onAuthStateChange)
    data.ts                 SEMUA akses Supabase: fetchDashboardData, insertTransaction(s), CRUD wallet
    use-dashboard.ts        hook utama: load per date range, polling 30s, bungkus aksi tulis dari data.ts (aksi tulis belum dipakai UI)
    api.ts                  klien LAMA Google Apps Script (getDashboard, addTransaction, scanImage)
    types.ts                semua type (Wallet, Transaction, DashboardData, WalletTransfer, Scan*)
    date-range.ts           preset & format rentang tanggal
    wallets.ts              styling brand dompet (BCA, GoPay, OVO, ...)
    format.ts, theme.tsx
    demo-data.ts            data demo `demoDashboardData()`. Tidak diimpor oleh file yang sudah dibaca (lihat Temuan)
```

## Alur data
`main.tsx` -> `App.tsx` -> `useDashboard(dateRange)` -> `data.fetchDashboardData()`.
`fetchDashboardData` mengambil SEMUA baris `wallets` dan `transactions`, lalu memfilter tanggal di sisi klien. Hasilnya `DashboardData` (total saldo, pemasukan/pengeluaran periode, rekap kategori, top 5 pengeluaran, tren 6 bulan, daftar transaksi) dikirim sebagai props ke view.
Polling ulang tiap 30 detik. Setelah tulis data, view memanggil `onSaved/onSubmitted` -> `refresh()`.

## Database (Supabase)
- `wallets(id, nama UNIQUE, provider, saldo, created_at)`: seed 6 dompet bawaan
- `transactions(id, tanggal, deskripsi, tipe 'Pemasukan'|'Pengeluaran', nominal, kategori, wallet_id FK, berulang, transfer_id FK, created_at)`
- `wallet_transfers(id, tanggal, from_wallet_id, to_wallet_id, nominal>0, biaya_admin>=0, catatan, created_at)`
- Trigger (migrasi ke-2): insert/update/delete transaksi menyesuaikan `wallets.saldo`. Transfer menyesuaikan saldo asal/tujuan dan membuat transaksi "Biaya admin transfer" bila `biaya_admin > 0`.
- Migrasi ke-3 `20261121120000_user_scoping_rls.sql`: kolom `user_id` (default auth.uid()) di ketiga tabel; RLS hanya pemilik (`auth.uid() = user_id`); anon dicabut; trigger memastikan dompet milik pengguna yang sama. Backfill data lama dan NOT NULL dijalankan manual setelah akun pertama dibuat.

## Status migrasi (PENTING sebelum mengubah kode)
Proyek sedang pindah dari Google Apps Script/Sheets ke Supabase; belum selesai:
1. Baca data sudah via Supabase (`data.ts`). Tulis data dan scanner masih via `api.ts` (Apps Script): `add-transaction-sheet.tsx`, `scanner-view.tsx`. `settings-view.tsx` juga masih memakai Apps Script untuk URL-nya. Fungsi tulis di `data.ts`/`use-dashboard.ts` belum dipakai UI.
2. Form tambah transaksi memakai nama dompet (`dompet`), sedangkan `insertTransaction` butuh `walletId`.
3. Fitur transfer antar dompet: tabel, trigger, dan type (`WalletTransfer`, `NewTransferInput`) ada, tapi belum ada fungsi di `data.ts` maupun UI.
4. Teks UI masih menyebut Google Sheets (lihat Temuan).
5. Dugaan kuat bermasalah: migrasi ke-2 menjalankan `REVOKE UPDATE (saldo)` pada `wallets`, tapi migrasi ke-1 sudah memberi `GRANT UPDATE` di level tabel. Di PostgreSQL, REVOKE pada kolom tidak mencabut privilege level tabel, jadi REVOKE ini kemungkinan tidak berpengaruh. Sementara `updateWalletRow` di `data.ts` mengirim `saldo` di payload update. Perlu dicek langsung di database.

## Temuan kode (dari file yang sudah dibaca)
- Delta metrik hardcoded, bukan dari data: `dashboard-view.tsx` memakai `4.2`, `-3.1`, dan persentase tabungan. `transactions-view.tsx` `SummaryCard` selalu menampilkan `+0.0%`.
- Mode demo tidak bisa tercapai: `use-dashboard.ts` selalu mengembalikan `usingDemo: false`, jadi cabang "Mode Demo" di sidebar dan header tidak pernah aktif.
- Teks usang: pesan error dan footer di `App.tsx` menyebut Google Sheets dan data demo. Sidebar menulis "Data live dari Google Sheets". `wallet-card.tsx` menulis "Hubungkan Google Apps Script".
- Target tabungan hardcoded Rp 50.000.000 di `BudgetRule`. Progres dihitung dari `totalSaldo`, bukan dari tabungan periode.
- Setiap 30 detik seluruh tabel `transactions` diambil lalu difilter di klien. Akan melambat seiring data bertambah.
- `.gitignore` tidak mengabaikan `*.tsbuildinfo`, padahal `tsconfig.app.tsbuildinfo` dan `tsconfig.node.tsbuildinfo` ikut ter-commit.
- `index.html` memakai `lang="en"` dan title berbahasa Inggris, sementara UI berbahasa Indonesia.
- `demo-data.ts`: tidak ditemukan impor dari file yang sudah dibaca. Impor di `ui/` dan `hooks/` belum diperiksa, jadi belum bisa dipastikan sebagai kode mati.

## Keamanan
- `settings-view.tsx` memuat URL Apps Script default lengkap dengan parameter `?key=...` di repo publik. Key yang sama muncul juga di atribut `placeholder` input. Sebaiknya key diganti (rotate) dan URL dipindah ke env/pengaturan.
- Policy RLS terbuka untuk `anon`. Siapa pun yang punya anon key (yang memang ada di bundle frontend) bisa membaca dan mengubah semua data. Ini disengaja untuk single-tenant, tapi perlu diingat jika data menjadi lebih sensitif.
