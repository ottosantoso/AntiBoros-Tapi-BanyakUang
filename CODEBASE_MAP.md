# CODEBASE_MAP: AntiBoros-Tapi-BanyakUang ("Hepeng History")

Pelacak keuangan pribadi: dompet, transaksi, budget, analisa, scanner struk/mutasi, dan AI Center. UI berbahasa Indonesia.
Diperbarui setelah PR #56 (sub-menu Prediksi di sidebar). Versi sebelumnya sudah tidak sesuai dengan kode dan dihapus.

## Status verifikasi
- Bagian "Struktur" dan "Alur data" ditulis dari kode yang saya baca dan ubah langsung selama pengerjaan. Dianggap akurat.
- Bagian "Belum diverifikasi" di akhir file adalah daftar file yang belum saya buka. Jangan dianggap fakta.
- Sebelum mengubah file yang tercantum di sini, baca versi terbaru dari `main`. Ada beberapa kali file ditulis ulang dari salinan lama dan menghilangkan perubahan PR lain.

## Stack
- Vite + React 18 + TypeScript, Tailwind CSS 3, shadcn/ui (Radix), `lucide-react`, `recharts`, `date-fns`, `react-dropzone`, `sonner` (notifikasi)
- Backend: Supabase (Postgres + RLS, Auth, Storage bucket `wallet-logos`, Edge Functions)
- AI: Google Gemini, dipanggil hanya dari Edge Function. Kunci ada di Supabase Secrets (`GEMINI_API_KEY`).
- Alias import: `@/` = `src/`

## Perintah
- `npm run dev` | `npm run build` | `npm run lint` | `npm run typecheck`
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Struktur
```
supabase/
  migrations/                 skema DB. Setiap perubahan = file baru, migrasi lama tidak diubah
  functions/
    scan-image/               OCR struk dan mutasi (Gemini)
    ai-analysis/              insight dan saran hemat dari ringkasan angka periode (Gemini)
    ai-categorize/            saran subkategori dari deskripsi: riwayat, kata kunci, lalu Gemini
    ai-chat/                  Asisten Keuangan AI: cek kuota 20 per hari, ringkasan angka bulan berjalan, lalu Gemini
src/
  App.tsx                     state view, dateRange, detailWalletId, aiSection, sheet tambah dompet
  app/                        satu file per halaman
    views.ts                  View, TransactionSection, AiSection
    dashboard-view.tsx        KPI, arus kas, ringkasan, kategori, transaksi terbaru, target, insight AI (tersimpan: dashboard), notifikasi
    wallets-view.tsx          ringkasan dompet, kartu (persen bulan ini, klik ke detail), rincian, arsip dan pulihkan (dengan paginasi)
    wallet-detail-view.tsx    detail dompet: ringkasan, riwayat, pengeluaran per kategori
    transactions-view.tsx     empat submenu (semua, pemasukan, pengeluaran, transfer), riwayat, aksi ubah dan hapus
    budget-view.tsx           ringkasan, grafik anggaran vs realisasi, distribusi, aturan 50/30/20, batas per subkategori (Lihat Semua, paginasi), target tabungan
    rencana-view.tsx          menu Rencana bulanan (draf rencana pengeluaran dan pemasukan)
    analisa-view.tsx          periode bulan, rentang, tahun. KPI, tren, insight, kategori, top 5, ringkasan, aliran dana, status. Insight AI tersimpan (kind: analisa)
    scanner-view.tsx          AI Smart Scanner: unggah, pindai (scan-image), periksa, simpan. Melapor hasil lewat onResult dan onDiscard
    ai-scanner-page.tsx       AI Scanner dengan tab Pindai, Hasil, Riwayat. Mencatat riwayat ke scan_batches
    ai-center-view.tsx        hub AI Center dan sub-halaman: kategorisasi, asisten, prediksi, riwayat
    ai-asisten-view.tsx       chat Asisten Keuangan AI (riwayat hanya di layar)
    ai-prediksi-view.tsx      prediksi pengeluaran bulan depan dan skor kesehatan keuangan
    ai-riwayat-view.tsx       daftar riwayat insight AI, filter Semua, Dashboard, Analisa
    master-kategori-settings.tsx  CRUD kategori dan subkategori (Pengaturan)
    berulang-settings.tsx     CRUD transaksi berulang (Pengaturan)
    settings-view.tsx         Pengaturan
    login-view.tsx            masuk, daftar, lupa password, atur ulang password
  components/
    sidebar.tsx               menu: Dashboard, Dompet, Budget, Analisa, Rencana, grup Transaksi, grup AI Center (AI Scanner, Kategorisasi, Asisten, Prediksi, Riwayat), Pengaturan
    header.tsx                judul dan ikon per view, tombol muat ulang, tema, profil
    add-transaction-sheet.tsx form transaksi: subkategori opsional, saran dari deskripsi (riwayat, kata kunci, AI), chip nominal untuk transfer
    add-wallet-sheet.tsx      tambah dompet: bank, e-wallet, tunai, lainnya; deteksi nama arsip
    edit-wallet-sheet.tsx     ubah dompet: nama, provider, logo, saldo lewat transaksi penyesuaian
    wallet-card.tsx           kartu dompet (min-h, bukan aspect-ratio, agar nominal tidak terpotong di iOS)
    ui/                       komponen shadcn (jangan diedit manual)
  lib/
    data.ts                   PINTU MASUK data: hanya `export *` dari src/lib/data/*
    data/                     SEMUA akses Supabase, satu file per fitur:
      shared.ts               WriteResult, toNumber, escapeLike
      wallets.ts              dompet, logo, arsip, pulihkan, ganti nama, hapus
      transactions.ts         transaksi
      transfers.ts            transfer antar dompet
      dashboard.ts            fetchDashboardData (memanggil proses_transaksi_berulang)
      wallet-insights.ts      detail dompet, persen bulan ini, grafik saldo 6 bulan
      budget.ts               subkategori (baca), budget, goals, matchSubkategori
      master.ts               kategori dan subkategori master (CRUD)
      berulang.ts             transaksi berulang (CRUD)
      analisa.ts              report_summary dan fetchAiAnalysis
      ai-reports.ts           riwayat insight AI: simpan, ambil terakhir, daftar
      ai-chat.ts              askAiChat (Edge Function ai-chat)
      scan-batches.ts         riwayat pindaian: daftar, buat, ubah status
    use-dashboard.ts          hook utama: load per rentang, polling 30 detik, aksi tulis
    use-analisa.ts            hook data analisa per rentang
    use-session.ts            sesi Supabase Auth
    supabase-client.ts        createClient dari env VITE_*
    categorize.ts             wrapper Edge Function ai-categorize (tanpa akses tabel)
    subkategori-suggest.ts    saran lokal dari nama subkategori dan tebakan kategori
    health-score.ts           fungsi murni: prediksi bulan depan dan skor kesehatan keuangan (tanpa database)
    api.ts                    sisa klien Google Apps Script (scanImage), akan dipensiunkan
    types.ts, format.ts, date-range.ts, wallets.ts, wallet-providers.ts, theme.tsx
```

## Aturan akses data (CLAUDE.md)
- Query Supabase hanya di `src/lib/data/*`. Komponen mengimpor dari `@/lib/data`.
- Menambah fitur data: buat file baru di `src/lib/data/`, lalu satu baris `export *` di `src/lib/data.ts`.
- Helper bersama di `shared.ts`. Jangan menduplikasi.
- Memanggil Edge Function dari browser boleh lewat wrapper di `src/lib` (contoh `categorize.ts`, `ai-chat.ts` di data) karena tidak mengakses tabel.

## Alur data
- `App.tsx` -> `useDashboard(dateRange)` -> `fetchDashboardData` -> `DashboardData` (dompet aktif, transaksi terfilter, tren 12 bulan, rekap kategori).
- `fetchDashboardData` mengambil semua transaksi lalu memfilter rentang di klien.
- Setelah tulis data, view memanggil `onSaved` atau `onChanged`, lalu `refresh()`.
- Insight AI (Dashboard dan Analisa): `fetchAiAnalysis` -> `saveAiReport` -> tampil di Riwayat AI.
- Pindai: `scanImage` -> `onResult` -> `createScanBatch` (draft) -> `onSaved` atau `onDiscard` -> `setScanBatchStatus` (saved atau cancelled).
- Asisten AI: `askAiChat` -> Edge Function `ai-chat` (kuota di database, ringkasan angka, Gemini).

## Database (ringkas)
- Tabel: `wallets`, `transactions`, `wallet_transfers`, `subkategori`, `kategori`, `budgets`, `goals`, `transaksi_berulang`, `ai_reports`, `ai_chat_usage`, `scan_batches`.
- RLS pemilik (`user_id = auth.uid()`) di semua tabel di atas.
- `wallets.jenis`: 'bank' | 'ewallet' | 'tunai' | 'lainnya'. Dompet `CASH` sudah dipindah ke 'tunai'.
- Fungsi: `report_summary`, `proses_transaksi_berulang`, `ai_chat_consume` (batas 20 per hari WIB), `seed_master_akun`, `default_subkategori_keywords`.
- Trigger: saldo dompet dihitung otomatis dari transaksi dan transfer. Subkategori baru mendapat kata kunci bawaan. Dompet arsip menolak transaksi baru.
- Bucket Storage: `wallet-logos` (publik, per folder user).

## Migrasi terbaru (urut)
- `20261122140000` subkategori, budget, goals
- `20261122150000` ai_reports
- `20261122160000` kategori master dan transaksi berulang
- `20261123090000` subkategori_keywords
- `20261124090000` wallet_jenis_tunai (constraint)
- `20261125090000` wallet_cash_tunai (data)
- `20261126090000` ai_chat_usage
- `20261127090000` scan_batches

## Edge Functions (semua verify_jwt = true)
- `scan-image`, `ai-analysis`, `ai-categorize`, `ai-chat`. Semua memakai `GEMINI_API_KEY` dari Secrets.

## Yang sudah selesai (ringkas)
- Dompet: tunai, sembunyi saldo, detail dompet, persen bulan ini, arsip, ubah, footer form di atas badge Netlify.
- Transaksi: subkategori opsional, saran dari deskripsi (tiga lapis), chip nominal transfer.
- Budget: redesign sesuai mockup, batas dengan Lihat Semua dan paginasi, grup Tabungan dari subkategori.
- AI Center: hub, Kategorisasi, Asisten Keuangan AI, Prediksi & Kesehatan, Riwayat AI, AI Scanner dengan tab dan riwayat pindaian.
- Analisa: insight AI tersimpan ke riwayat.
- Refactor data per fitur.

## Yang belum atau perlu dicek
- Typecheck dan lint untuk PR #47 sampai #56 belum dijalankan dari repo. Jalankan `npm run typecheck` dan `npm run lint` sebelum melanjutkan.
- Tes manual di browser: Asisten (batas 20), Riwayat AI (filter), Prediksi, tab AI Scanner, detail dompet.
- Rencana bulanan (#52): ringkasan belum saya baca di sini.
- Transaksi (#51, redesign): belum saya baca di sini.
- Fase 3 dan 4 dari blueprint yang belum ada: filter dan paginasi di Transaksi, notifikasi budget 50, 80, 100 persen, preset 3 dan 6 bulan di Analisa, ekspor Excel, impor Excel, cek kecocokan, halaman rumus dan metodologi.
- Telegram (Fase 5): belum dimulai.
- Prediksi dan skor kesehatan: belum ada notifikasi atau insight anomali (Fase C lanjutan).
- Sub-menu Prediksi di sidebar sudah ada (PR #56).

## Keamanan
- Kunci Gemini hanya di Supabase Secrets. Kunci Apps Script lama di repo publik sudah tidak dipakai, tapi sebaiknya dicabut dan dibuat ulang.
- Anon key ada di frontend. Keamanan data bergantung pada RLS, bukan pada kerahasiaan anon key.

## Belum diverifikasi (jangan dianggap fakta)
- `src/components/ui/*`, `src/lib/utils.ts`, `src/components/logo.tsx`, `theme-toggle.tsx`, `date-range-picker.tsx`, `transaction-list.tsx`, `cashflow-charts.tsx`, `metric-card.tsx`, `use-analisa.ts`, `rencana-view.tsx`, `transactions-view.tsx` (isi detailnya).
- `.bolt/`, `tailwind.config.js`, `components.json`, `tsconfig*.json`, `eslint.config.js` (sebagian sudah dibaca di sesi sebelumnya).
