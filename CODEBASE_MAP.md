# CODEBASE_MAP: AntiBoros-Tapi-BanyakUang ("Hepeng History")

Pelacak keuangan pribadi (dompet, transaksi, scanner struk/mutasi dengan AI). UI berbahasa Indonesia.
Dibuat dari Bolt (`.bolt/`). Terakhir diperbarui setelah Sprint 2 (branch `feat/sprint-2-jalur-data`) di atas `main` commit `7d3c5f3` (PR #5 merge). Riwayat: Sprint 1 (PR #3), tambah dompet (PR #4), menu ubah dompet dan logo (PR #5).

## Status verifikasi
Peta ini diverifikasi per file. Bagian yang belum dibuka tandai "belum diverifikasi" dan jangan dianggap fakta.
- Sudah dibaca: `package.json`, `README.md`, `index.html`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`, `eslint.config.js`, `.gitignore`, `.bolt/prompt`, `.bolt/ignore`, `src/main.tsx`, `src/App.tsx`, `src/app/*` (semua file app sudah dibaca), `src/components/` (sidebar, header, cashflow-charts, transaction-list, wallet-card, metric-card, add-transaction-sheet, date-range-picker, add-wallet-sheet), `src/lib/` (api, data, use-dashboard, supabase-client, types, date-range, format, theme, wallets, wallet-providers, demo-data), ketiga migrasi SQL di `main` dan keempat migrasi di `feat/tambah-dompet`.
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
public/assets/wallet-logos/ logo SVG provider dompet (placeholder, bukan artwork resmi). Dirujuk dari wallet-providers.ts
supabase/migrations/        skema DB (4 file di feat/tambah-dompet, lihat Database)
src/
  main.tsx, App.tsx         entry; App memegang state view, dateRange, sheet tambah transaksi & dompet
  app/                      satu file per halaman
    views.ts                type View = dashboard|wallets|transactions|scanner|settings; TransactionSection (duplikat dengan types.ts)
    dashboard-view.tsx      metrik, chart arus kas, kategori, target tabungan, transaksi terbaru
    wallets-view.tsx        kartu dompet, rincian saldo, tombol arsip per dompet, bagian Dompet Diarsipkan dengan Pulihkan
    transactions-view.tsx   satu komponen untuk 4 submenu (all, income, expense, transfer). Tiap submenu punya tombol form sendiri (AddTransactionSheet dengan lockTab). Submenu Transfer menampilkan daftar transfer.
    scanner-view.tsx        upload struk/mutasi -> scan AI (Apps Script, scanImage) -> review -> simpan ke Supabase (insertTransaction / insertTransactions, dompet dipetakan dari nama ke id)
    settings-view.tsx       input URL Google Apps Script (localStorage)
    login-view.tsx          halaman masuk, daftar, dan lupa password (Supabase Auth)
  components/
    sidebar, header, cashflow-charts, transaction-list, wallet-card, metric-card, date-range-picker,
    add-transaction-sheet.tsx   form tambah transaksi (side sheet), simpan lewat prop addTransaction (Supabase, dari use-dashboard)
    add-wallet-sheet.tsx        form tambah dompet: pilih bank/e-wallet/lainnya, nama, saldo awal opsional,
                                deteksi nama dompet arsip (pulihkan atau ganti nama arsip lalu buat baru)
    edit-wallet-sheet.tsx       form ubah dompet aktif: nama, provider (jenis mengikuti provider, atau pilih untuk Lainnya), logo. Saldo tidak diubah dari sini.
    ui/                         komponen shadcn (jangan diedit manual)
  lib/
    supabase-client.ts      createClient dari env VITE_* (cek env, exporter supabaseConfigured)
    use-session.ts          hook sesi Supabase Auth (getSession + onAuthStateChange)
    data.ts                 SEMUA akses Supabase: fetchDashboardData, insertTransaction(s), CRUD wallet,
                            arsip/pulihkan/ganti nama/cek nama dompet
    use-dashboard.ts        hook utama: load per date range, polling 30s, bungkus aksi tulis dari data.ts (aksi tulis belum dipakai UI)
    api.ts                  klien Google Apps Script. Sisa: scanImage saja (dipensiunkan di Sprint 5). addTransaction sudah dihapus di Sprint 2
    types.ts                semua type (Wallet, Transaction, DashboardData, WalletTransfer, Scan*)
    date-range.ts           preset & format rentang tanggal
    wallets.ts              styling brand dompet (BCA, GoPay, OVO, blu, ...)
    wallet-providers.ts     daftar provider bank & e-wallet untuk sheet Tambah Dompet, termasuk path logo
    format.ts, theme.tsx
    demo-data.ts            data demo `demoDashboardData()`. Tidak diimpor oleh file yang sudah dibaca (lihat Temuan)
```

## Alur data
`main.tsx` -> `App.tsx` -> `useDashboard(dateRange)` -> `data.fetchDashboardData()`.
`fetchDashboardData` mengambil SEMUA baris `wallets` dan `transactions`, lalu memfilter tanggal di sisi klien. Hasilnya `DashboardData` dikirim sebagai props ke view.
- `data.dompet` hanya berisi dompet AKTIF (`is_archived = false`). Total saldo, dropdown transaksi, transfer, dan scanner memakai daftar ini, jadi dompet arsip otomatis tidak muncul di sana.
- Nama dompet arsip tetap dipakai untuk menampilkan riwayat transaksi lama.
Polling ulang tiap 30 detik. Setelah tulis data, view memanggil `onSaved/onSubmitted/onChanged` -> `refresh()`.

## Database (Supabase)
- `wallets(id, nama UNIQUE, provider, saldo, created_at)`: seed 6 dompet bawaan
- `transactions(id, tanggal, deskripsi, tipe 'Pemasukan'|'Pengeluaran', nominal, kategori, wallet_id FK, berulang, transfer_id FK, created_at)`
- `wallet_transfers(id, tanggal, from_wallet_id, to_wallet_id, nominal>0, biaya_admin>=0, catatan, created_at)`
- Trigger (migrasi ke-2): insert/update/delete transaksi menyesuaikan `wallets.saldo`. Transfer menyesuaikan saldo asal/tujuan dan membuat transaksi "Biaya admin transfer" bila `biaya_admin > 0`.
- Migrasi ke-3 `20261121120000_user_scoping_rls.sql`: kolom `user_id` (default auth.uid()) di ketiga tabel; RLS hanya pemilik (`auth.uid() = user_id`); anon dicabut; trigger memastikan dompet milik pengguna yang sama. Backfill data lama dan NOT NULL dijalankan manual setelah akun pertama dibuat.
- Migrasi `20261121130000_wallet_jenis_logo.sql`: kolom `jenis` ('bank'|'ewallet'|'lainnya') dan `logo_url` di `wallets`; bucket publik `wallet-logos` dengan policy per folder user.
- Migrasi `20261122120000_wallet_edit_grants.sql`: `GRANT UPDATE (jenis, logo_url)` untuk `authenticated` agar menu edit dompet bisa menyimpan. `saldo` dan `user_id` tetap tidak bisa diubah langsung.
- Migrasi `20261122090000_wallet_archive.sql`: kolom `wallets.is_archived` (default false) dan `wallets.archived_at`; trigger `guard_archived_tx` dan `guard_archived_transfer` yang menolak transaksi atau transfer BARU (atau yang dialihkan) ke dompet arsip. Transaksi dan transfer lama di dompet arsip tetap bisa diubah dan dihapus. Saldo dompet arsip tetap tersimpan.

## Status migrasi (PENTING sebelum mengubah kode)
Proyek sedang pindah dari Google Apps Script/Sheets ke Supabase; belum selesai:
Sprint 1 (login, RLS per user) SELESAI dan terverifikasi di database:
- Policy `*_owner_*` per user ada di `wallets`, `transactions`, `wallet_transfers`. Role `anon` tidak punya hak SELECT pada ketiga tabel.
- `authenticated` tidak bisa UPDATE `wallets.saldo` maupun `user_id` (REVOKE kolom berfungsi). Dugaan di bawah sudah tidak berlaku.
- `DEFAULT_APPS_SCRIPT_URL` dan key di kode sudah dihapus. Placeholder `KEY_ANDA` di `settings-view.tsx` hanya teks contoh.
- Belum dibuktikan dengan tes dua akun (S1-11). Lupa password (S1-06) belum diverifikasi.

Sprint 2 (jalur tulis ke Supabase), di branch `feat/sprint-2-jalur-data`:
- Scanner menyimpan ke Supabase lewat `insertTransaction` (struk) dan `insertTransactions` (mutasi, satu insert). Dompet dipetakan dari nama ke `id`.
- `addTransaction` di `api.ts` dihapus. Form tambah transaksi sudah memakai Supabase sejak sebelumnya.
- Belum diuji di browser dengan login. Verifikasi manual diperlukan: simpan struk, simpan mutasi, dan saldo dompet berubah.

Yang masih tersisa:
1. `scanImage` (scan AI) masih lewat Apps Script. Dipindah ke Edge Function di Sprint 5.
2. `settings-view.tsx` masih menyimpan URL Apps Script untuk scanner. Hilang bersama scanner di Sprint 5.
3. Transfer antar dompet: tabel, trigger, dan type ada, tapi belum ada fungsi UI (Sprint 3).
4. Kategori masih teks bebas. `scanner-view` mengirim kategori hasil AI apa adanya (Sprint 4 membuat FK ke subkategori).
5. Teks UI masih menyebut Google Sheets (lihat Temuan).

## Riwayat perubahan
- PR #3 (Sprint 1): login, sesi, RLS per user, backfill user_id.
- PR #4: tambah dompet dengan bank, e-wallet, Lainnya, saldo awal, arsip dengan pulihkan atau mulai baru.
- PR #5: menu ubah dompet (nama, provider, jenis, logo). Saldo diubah lewat transaksi penyesuaian. Logo unggahan dinormalisasi otomatis ke PNG 480×160. Logo resmi blu by BCA Digital ditambahkan ke katalog.
- Sprint 2: lihat bagian di atas.
- Sprint 3 (branch `feat/sprint-3-edit-hapus`): kolom Aksi di riwayat transaksi berisi tombol ubah (sheet mode edit, `editTransaction`) dan hapus. Hapus lewat tombol Hapus di sheet edit, dengan jeda 8 detik dan tombol Urungkan. Penghapusan dijalankan setelah jeda, atau saat halaman ditutup. Peringatan duplikat dicek di sisi klien (tanggal, deskripsi, nominal, dompet) dan tidak memblokir simpan. Baris transaksi hasil transfer (`transferId`) tidak bisa diubah dari submenu Transaksi.
- Deviasi dari dokumen Sprint 3: "soft delete" di sisi klien, bukan kolom `deleted_at` di database. Tidak ada riwayat hapus, dan tidak ada `dedupe_hash`.

## Temuan kode (dari file yang sudah dibaca)
- Delta metrik hardcoded, bukan dari data: `dashboard-view.tsx` memakai `4.2`, `-3.1`, dan persentase tabungan. `transactions-view.tsx` `SummaryCard` selalu menampilkan `+0.0%`.
- Mode demo tidak bisa tercapai: `use-dashboard.ts` selalu mengembalikan `usingDemo: false`, jadi cabang "Mode Demo" di sidebar dan header tidak pernah aktif.
- Teks usang: pesan error dan footer di `App.tsx` menyebut Google Sheets dan data demo. Sidebar menulis "Data live dari Google Sheets". `wallet-card.tsx` menulis "Hubungkan Google Apps Script".
- Target tabungan hardcoded Rp 50.000.000 di `BudgetRule`. Progres dihitung dari `totalSaldo`, bukan dari tabungan periode.
- Setiap 30 detik seluruh tabel `transactions` diambil lalu difilter di klien. Akan melambat seiring data bertambah.
- `.gitignore` tidak mengabaikan `*.tsbuildinfo`, padahal `tsconfig.app.tsbuildinfo` dan `tsconfig.node.tsbuildinfo` ikut ter-commit.
- `index.html` memakai `lang="en"` dan title berbahasa Inggris, sementara UI berbahasa Indonesia.
- `demo-data.ts`: tidak ditemukan impor dari file yang sudah dibaca. Impor di `ui/` dan `hooks/` belum diperiksa, jadi belum bisa dipastikan sebagai kode mati.
- `add-wallet-sheet.tsx` dan `wallets-view.tsx` belum diuji typecheck atau lint dari sisi repo; perlu `npm run typecheck` dan `npm run lint`.

## Keamanan
- `settings-view.tsx` memuat URL Apps Script default lengkap dengan parameter `?key=...` di repo publik. Key yang sama muncul juga di atribut `placeholder` input. Sebaiknya key diganti (rotate) dan URL dipindah ke env/pengaturan.
- Policy RLS terbuka untuk `anon`. Siapa pun yang punya anon key (yang memang ada di bundle frontend) bisa membaca dan mengubah semua data. Ini disengaja untuk single-tenant, tapi perlu diingat jika data menjadi lebih sensitif.
