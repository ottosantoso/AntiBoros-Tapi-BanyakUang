/*
# Subkategori, budget, dan target tabungan (Sprint 4)

1. Tabel `subkategori`: daftar kategori per pengguna.
   - `jenis`: 'Pengeluaran' atau 'Pemasukan' (sama dengan transactions.tipe).
   - `kategori`: kelompok (mis. 'Makan & Minum').
   - `budgeting`: 'Kebutuhan' | 'Keinginan' | 'Tabungan', wajib untuk pengeluaran, null untuk pemasukan.
2. Setiap akun baru otomatis mendapat subkategori default. Akun yang sudah ada diisi saat migrasi.
3. transactions.subkategori_id (nullable) menunjuk ke subkategori. Kolom text `kategori` tetap dipertahankan
   dan diisi dari nama subkategori yang cocok, supaya tampilan yang sudah ada tetap berjalan.
4. Tabel `budgets`: batas bulanan per subkategori (satu baris per subkategori per pengguna).
5. Tabel `goals`: target tabungan. Kolom `terkumpul` diisi manual.
6. Trigger biaya admin transfer ikut mengisi subkategori 'Biaya Admin'.
7. RLS: hanya pemilik baris. Anon tidak punya akses.
*/

-- 1. Tabel subkategori
CREATE TABLE IF NOT EXISTS public.subkategori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE DEFAULT auth.uid(),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 1 AND 60),
  kategori text NOT NULL CHECK (char_length(btrim(kategori)) BETWEEN 1 AND 60),
  jenis text NOT NULL CHECK (jenis IN ('Pengeluaran', 'Pemasukan')),
  budgeting text CHECK (budgeting IN ('Kebutuhan', 'Keinginan', 'Tabungan')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (jenis = 'Pengeluaran' AND budgeting IS NOT NULL) OR
    (jenis = 'Pemasukan' AND budgeting IS NULL)
  ),
  UNIQUE (user_id, jenis, nama)
);

-- 2. Seed subkategori default per pengguna
CREATE OR REPLACE FUNCTION public.seed_default_subkategori(p_user uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.subkategori (user_id, nama, kategori, jenis, budgeting) VALUES
    (p_user, 'Makan & Minum',     'Makan & Minum',      'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Transportasi',      'Transportasi',       'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Belanja Bulanan',   'Belanja',            'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Tagihan & Utilitas','Tagihan & Utilitas', 'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Kesehatan',         'Kesehatan',          'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Pendidikan',        'Pendidikan',         'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Transfer',          'Transfer',           'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Biaya Admin',       'Biaya Admin',        'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Penyesuaian Saldo', 'Penyesuaian Saldo',  'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Lain-lain',         'Lain-lain',          'Pengeluaran', 'Kebutuhan'),
    (p_user, 'Hiburan',           'Hiburan',            'Pengeluaran', 'Keinginan'),
    (p_user, 'Gaji',              'Pemasukan',          'Pemasukan',   NULL),
    (p_user, 'Bonus',             'Pemasukan',          'Pemasukan',   NULL),
    (p_user, 'Cashback',          'Cashback & Refund',  'Pemasukan',   NULL),
    (p_user, 'Refund',            'Cashback & Refund',  'Pemasukan',   NULL),
    (p_user, 'Top Up',            'Transfer',           'Pemasukan',   NULL),
    (p_user, 'Transfer',          'Transfer',           'Pemasukan',   NULL),
    (p_user, 'Penyesuaian Saldo', 'Penyesuaian Saldo',  'Pemasukan',   NULL),
    (p_user, 'Pendapatan Lainnya','Pemasukan',          'Pemasukan',   NULL)
  ON CONFLICT (user_id, jenis, nama) DO NOTHING;
$$;

-- Akun baru mendapat subkategori default otomatis
CREATE OR REPLACE FUNCTION public.tg_seed_subkategori_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_subkategori(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_seed_subkategori ON auth.users;
CREATE TRIGGER on_auth_user_seed_subkategori
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.tg_seed_subkategori_new_user();

-- Akun yang sudah ada mendapat subkategori default
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_default_subkategori(r.id);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_default_subkategori(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tg_seed_subkategori_new_user() FROM PUBLIC, anon, authenticated;

-- 3. transactions.subkategori_id
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS subkategori_id uuid REFERENCES public.subkategori (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_subkategori ON public.transactions (subkategori_id);

-- Backfill: cocokkan nama kategori lama dengan subkategori milik pemilik transaksi
UPDATE public.transactions t
SET subkategori_id = s.id
FROM public.subkategori s
WHERE t.subkategori_id IS NULL
  AND s.user_id = t.user_id
  AND s.jenis = t.tipe
  AND s.nama = t.kategori;

-- Subkategori transaksi harus milik pengguna yang sama
CREATE OR REPLACE FUNCTION public.tg_check_transaction_subkategori_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.subkategori_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subkategori s WHERE s.id = NEW.subkategori_id AND s.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Subkategori tidak ditemukan untuk pengguna ini';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_subkategori_owner ON public.transactions;
CREATE TRIGGER transactions_subkategori_owner
BEFORE INSERT OR UPDATE OF subkategori_id, user_id ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_check_transaction_subkategori_owner();

-- 4. Trigger biaya admin transfer: isi subkategori 'Biaya Admin' milik pengguna
CREATE OR REPLACE FUNCTION public.apply_transfer_wallet_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    DELETE FROM public.transactions WHERE transfer_id = OLD.id;

    UPDATE public.wallets SET saldo = saldo + OLD.nominal WHERE id = OLD.from_wallet_id;
    UPDATE public.wallets SET saldo = saldo - OLD.nominal WHERE id = OLD.to_wallet_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.wallets SET saldo = saldo - NEW.nominal WHERE id = NEW.from_wallet_id;
    UPDATE public.wallets SET saldo = saldo + NEW.nominal WHERE id = NEW.to_wallet_id;

    IF NEW.biaya_admin > 0 THEN
      INSERT INTO public.transactions (
        user_id, tanggal, deskripsi, tipe, nominal, kategori, subkategori_id, wallet_id, transfer_id
      )
      VALUES (
        NEW.user_id, NEW.tanggal, 'Biaya admin transfer', 'Pengeluaran',
        NEW.biaya_admin, 'Biaya Admin',
        (SELECT s.id FROM public.subkategori s
          WHERE s.user_id = NEW.user_id AND s.jenis = 'Pengeluaran' AND s.nama = 'Biaya Admin'),
        NEW.from_wallet_id, NEW.id
      );
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- 5. Tabel budgets
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE DEFAULT auth.uid(),
  subkategori_id uuid NOT NULL REFERENCES public.subkategori (id) ON DELETE CASCADE,
  limit_amount numeric NOT NULL CHECK (limit_amount > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, subkategori_id)
);
CREATE INDEX IF NOT EXISTS idx_budgets_subkategori ON public.budgets (subkategori_id);

CREATE OR REPLACE FUNCTION public.tg_check_budget_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.subkategori s WHERE s.id = NEW.subkategori_id AND s.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Subkategori tidak ditemukan untuk pengguna ini';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS budgets_subkategori_owner ON public.budgets;
CREATE TRIGGER budgets_subkategori_owner
BEFORE INSERT OR UPDATE OF subkategori_id, user_id ON public.budgets
FOR EACH ROW EXECUTE FUNCTION public.tg_check_budget_owner();

-- 6. Tabel goals (target tabungan)
CREATE TABLE IF NOT EXISTS public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE DEFAULT auth.uid(),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 1 AND 80),
  target numeric NOT NULL CHECK (target > 0),
  terkumpul numeric NOT NULL DEFAULT 0 CHECK (terkumpul >= 0),
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON public.goals (user_id);

-- 7. RLS: hanya pemilik baris
ALTER TABLE public.subkategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subkategori_owner_select" ON public.subkategori;
CREATE POLICY "subkategori_owner_select" ON public.subkategori FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "subkategori_owner_insert" ON public.subkategori;
CREATE POLICY "subkategori_owner_insert" ON public.subkategori FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "subkategori_owner_update" ON public.subkategori;
CREATE POLICY "subkategori_owner_update" ON public.subkategori FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "subkategori_owner_delete" ON public.subkategori;
CREATE POLICY "subkategori_owner_delete" ON public.subkategori FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "budgets_owner_select" ON public.budgets;
CREATE POLICY "budgets_owner_select" ON public.budgets FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "budgets_owner_insert" ON public.budgets;
CREATE POLICY "budgets_owner_insert" ON public.budgets FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "budgets_owner_update" ON public.budgets;
CREATE POLICY "budgets_owner_update" ON public.budgets FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "budgets_owner_delete" ON public.budgets;
CREATE POLICY "budgets_owner_delete" ON public.budgets FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "goals_owner_select" ON public.goals;
CREATE POLICY "goals_owner_select" ON public.goals FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "goals_owner_insert" ON public.goals;
CREATE POLICY "goals_owner_insert" ON public.goals FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "goals_owner_update" ON public.goals;
CREATE POLICY "goals_owner_update" ON public.goals FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "goals_owner_delete" ON public.goals;
CREATE POLICY "goals_owner_delete" ON public.goals FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 8. Grant: anon tidak punya akses, authenticated lewat kebijakan di atas
REVOKE ALL ON public.subkategori, public.budgets, public.goals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subkategori, public.budgets, public.goals TO authenticated;
