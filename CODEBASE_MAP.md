# CODEBASE_MAP: AntiBoros-Tapi-BanyakUang ("Hepeng History")

Pelacak keuangan pribadi (dompet, transaksi, scanner struk/mutasi dengan AI). UI berbahasa Indonesia.
Dibuat dari Bolt (`.bolt/`). Terakhir dipetakan dari branch `main` (commit `31434c4`, 2026-11-21).

## Stack
- Vite 5 + React 18 + TypeScript, Tailwind CSS 3 + shadcn/ui (Radix), ikon `lucide-react`
- Data: Supabase (`@supabase/supabase-js`), polling 30 detik. Chart: `recharts`. Tanggal: `date-fns`
- Terpasang tapi belum terlihat dipakai di file yang dipetakan: `react-hook-form`, `zod`, `@hookform/resolvers`
- Alias import: `@/` = `src/`

## Perintah
- `npm run dev` | `npm run build` (`tsc -b && vite build`) | `npm run lint` | `npm run typecheck`
- Env wajib (tidak ada `.env` di repo): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Struktur
```
index.html, vite.config.ts, tailwind.config.js, components.json (shadcn)
.bolt/                      config & prompt Bolt (gaya UI: indah, pakai shadcn + lucide)
supabase/migrations/        skema DB (2 file, lihat bagian Database)
src/
  main.tsx, App.tsx         entry; App memegang state view, dateRange, sheet tambah transaksi
  app/                      satu file per halaman
    views.ts                type View = dashboard|wallets|transactions|scanner|settings
    dashboard-view.tsx      ringkasan metrik, chart cashflow, top pengeluaran
    wallets-view.tsx        kartu dompet + rincian saldo (belum ada UI tambah/edit/hapus dompet)
    transactions-view.tsx   riwayat + filter (jenis, cari, dompet, tanggal)
    scanner-view.tsx        upload struk/mutasi -> scan AI -> review -> simpan
    settings-view.tsx       input URL Google Apps Script (localStorage)
  components/
    sidebar, header, logo, theme-toggle, metric-card, wallet-card,
    cashflow-charts, date-range-picker, transaction-list,
    add-transaction-sheet.tsx   form tambah transaksi (side sheet)
    ui/                         komponen shadcn (jangan diedit manual)
  lib/
    supabase-client.ts      createClient dari env VITE_*
    data.ts                 SEMUA akses Supabase: fetchDashboardData, insertTransaction(s), CRUD wallet
    use-dashboard.ts        hook utama: load per date range, polling 30s, bungkus aksi tulis dari data.ts
    api.ts                  klien LAMA Google Apps Script (getDashboard, addTransaction, scanImage)
    types.ts                semua type (Wallet, Transaction, DashboardData, WalletTransfer, Scan*)
    date-range.ts           preset & format rentang tanggal
    wallets.ts              styling brand dompet (BCA, GoPay, OVO, ...)
    format.ts, utils.ts, theme.tsx
    demo-data.ts            data demo (tidak terlihat diimpor oleh file yang dipetakan)
```

## Alur data
`main.tsx` -> `App.tsx` -> `useDashboard(dateRange)` -> `data.fetchDashboardData()` -> Supabase tabel `wallets` + `transactions`
-> `DashboardData` (total saldo, pemasukan/pengeluaran periode, rekap kategori, top 5 pengeluaran, tren 6 bulan) -> dikirim sebagai props ke view.
Setelah tulis data, view memanggil `onSaved/onSubmitted` -> `refresh()`.

## Database (Supabase)
- `wallets(id, nama UNIQUE, provider, saldo, created_at)`: seed 6 dompet bawaan
- `transactions(id, tanggal, deskripsi, tipe 'Pemasukan'|'Pengeluaran', nominal, kategori, wallet_id FK, berulang, transfer_id FK, created_at)`
- `wallet_transfers(id, tanggal, from_wallet_id, to_wallet_id, nominal>0, biaya_admin>=0, catatan, created_at)`
- Trigger (migrasi ke-2): insert/update/delete transaksi otomatis menyesuaikan `wallets.saldo`; transfer menyesuaikan saldo asal/tujuan dan membuat transaksi "Biaya admin transfer" bila `biaya_admin > 0`
- RLS aktif tapi policy terbuka untuk `anon` (single-tenant tanpa login, disengaja)

## Status migrasi (PENTING sebelum mengubah kode)
Proyek sedang pindah dari Google Apps Script/Sheets ke Supabase; belum selesai:
1. Baca data sudah via Supabase (`data.ts`), tapi tulis data & scanner masih via `api.ts` (Apps Script): `add-transaction-sheet.tsx`, `scanner-view.tsx`, `settings-view.tsx`. Fungsi tulis di `data.ts`/`use-dashboard.ts` belum dipakai UI.
2. Form memakai nama dompet (`dompet`), sedangkan `insertTransaction` butuh `walletId`.
3. Fitur transfer antar dompet: tabel, trigger, dan type (`WalletTransfer`, `NewTransferInput`) ada, tapi belum ada fungsi di `data.ts` maupun UI. `TransactionSection` terdefinisi dobel (`types.ts` dan `app/views.ts`).
4. Teks UI di `App.tsx` (pesan error, footer) masih menyebut Google Sheets.
5. Perlu dicek: migrasi ke-2 melakukan `REVOKE UPDATE (saldo)` pada `wallets`, sementara `insertWallet`/`updateWalletRow` di `data.ts` mengirim `saldo`.

## Keamanan
- `settings-view.tsx` memuat URL Apps Script default lengkap dengan parameter `?key=...` di repo publik. Sebaiknya key diganti (rotate) dan URL dipindah ke env/pengaturan.
