/*
# Hepeng History: tabel wallets & transactions (single-tenant, tanpa login)

1. Tabel Baru
- `wallets` — dompet pengguna (BCA, GoPay, OVO, dll).
  - `id` (uuid, primary key, default gen_random_uuid())
  - `nama` (text, unik, wajib) — nama tampilan dompet
  - `provider` (text, wajib, default 'Lainnya') — penyedia/brand untuk styling kartu
  - `saldo` (numeric, wajib, default 0) — saldo saat ini (boleh negatif)
  - `created_at` (timestamptz, default now())
- `transactions` — SEMUA transaksi dicatat di sini.
  - `id` (uuid, primary key, default gen_random_uuid())
  - `tanggal` (date, wajib) — tanggal transaksi
  - `deskripsi` (text, wajib)
  - `tipe` (text, wajib, CHECK: 'Pemasukan' | 'Pengeluaran')
  - `nominal` (numeric, wajib, default 0)
  - `kategori` (text, opsional)
  - `wallet_id` (uuid, FK ke wallets.id ON DELETE SET NULL) — transaksi terhubung
    ke dompet lewat ID, bukan nama, jadi ganti nama dompet tidak memutus riwayat.
  - `created_at` (timestamptz, default now())

2. Index
- `idx_transactions_tanggal` pada transactions(tanggal DESC) untuk filter periode.
- `idx_transactions_wallet` pada transactions(wallet_id) untuk hitung transaksi per dompet.

3. Keamanan
- RLS aktif di kedua tabel.
- Aplikasi ini tanpa login (data sengaja dibagikan/dipakai satu perangkat),
  jadi kebijakan SELECT/INSERT/UPDATE/DELETE diberikan ke `anon, authenticated`
  dengan USING/WITH CHECK (true). Hal ini disengaja dan didokumentasikan.
- GRANT CRUD minimal kepada anon + authenticated di kedua tabel.

4. Seed
- 6 dompet bawaan (BCA, GoPay, OVO, DANA, Cash, ShopeePay) hanya diinsert
  bila tabel masih kosong, memakai ON CONFLICT (nama) DO NOTHING agar idempotent.
*/

CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'Lainnya',
  saldo numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal date NOT NULL,
  deskripsi text NOT NULL,
  tipe text NOT NULL CHECK (tipe IN ('Pemasukan', 'Pengeluaran')),
  nominal numeric NOT NULL DEFAULT 0,
  kategori text,
  wallet_id uuid REFERENCES wallets (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_tanggal ON transactions (tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions (wallet_id);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON wallets TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON transactions TO anon, authenticated;

DROP POLICY IF EXISTS "wallets_select" ON wallets;
CREATE POLICY "wallets_select" ON wallets
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "wallets_insert" ON wallets;
CREATE POLICY "wallets_insert" ON wallets
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "wallets_update" ON wallets;
CREATE POLICY "wallets_update" ON wallets
FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wallets_delete" ON wallets;
CREATE POLICY "wallets_delete" ON wallets
FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "transactions_select" ON transactions;
CREATE POLICY "transactions_select" ON transactions
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert" ON transactions
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "transactions_update" ON transactions;
CREATE POLICY "transactions_update" ON transactions
FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "transactions_delete" ON transactions;
CREATE POLICY "transactions_delete" ON transactions
FOR DELETE TO anon, authenticated USING (true);

-- Seed dompet bawaan (hanya bila tabel kosong / nama belum ada)
INSERT INTO wallets (nama, provider, saldo) VALUES
  ('BCA', 'BCA', 4500000),
  ('GoPay', 'GOPAY', 750000),
  ('OVO', 'OVO', 320000),
  ('DANA', 'DANA', 580000),
  ('Cash', 'CASH', 150000),
  ('ShopeePay', 'SHOPEEPAY', -85000)
ON CONFLICT (nama) DO NOTHING;
