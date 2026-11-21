/*
# Login dan data terkunci per pengguna (Sprint 1)

1. Kolom user_id di wallets, transactions, wallet_transfers (default auth.uid()).
2. Nama dompet unik per pengguna, bukan global.
3. Kebijakan lama (using true untuk anon dan authenticated) dicabut.
   Kebijakan baru: hanya pemilik baris (auth.uid() = user_id) untuk select, insert, update, delete.
4. Akses anon dicabut seluruhnya.
5. Trigger memastikan dompet pada transaksi dan transfer milik pengguna yang sama.
6. Trigger transfer menyalin user_id ke baris biaya admin.
7. Data lama diisi ke akun pertama yang terdaftar. Jika belum ada akun saat migrasi,
   baris lama tetap tanpa user_id dan tidak terlihat. Setelah akun pertama dibuat, jalankan:

     update public.wallets set user_id = '<uuid akun>' where user_id is null;
     update public.transactions set user_id = '<uuid akun>' where user_id is null;
     update public.wallet_transfers set user_id = '<uuid akun>' where user_id is null;

   Lalu jalankan ulang blok NOT NULL di bagian akhir file ini (atau alter column set not null manual).
*/

-- 1. Kolom pemilik
ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.wallet_transfers
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users (id) ON DELETE CASCADE DEFAULT auth.uid();

-- 2. Backfill: data lama dimiliki akun pertama yang terdaftar (jika sudah ada)
DO $$
DECLARE
  owner_id uuid;
BEGIN
  SELECT id INTO owner_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF owner_id IS NOT NULL THEN
    UPDATE public.wallets SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE public.transactions SET user_id = owner_id WHERE user_id IS NULL;
    UPDATE public.wallet_transfers SET user_id = owner_id WHERE user_id IS NULL;
  END IF;
END $$;

-- 3. Nama dompet unik per pengguna
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_nama_key;
CREATE UNIQUE INDEX IF NOT EXISTS wallets_user_nama_key ON public.wallets (user_id, nama);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_user ON public.wallet_transfers (user_id);

-- 4. Hapus kebijakan lama
DROP POLICY IF EXISTS "wallets_select" ON public.wallets;
DROP POLICY IF EXISTS "wallets_insert" ON public.wallets;
DROP POLICY IF EXISTS "wallets_update" ON public.wallets;
DROP POLICY IF EXISTS "wallets_delete" ON public.wallets;
DROP POLICY IF EXISTS "transactions_select" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete" ON public.transactions;
DROP POLICY IF EXISTS "wallet_transfers_select" ON public.wallet_transfers;
DROP POLICY IF EXISTS "wallet_transfers_insert" ON public.wallet_transfers;
DROP POLICY IF EXISTS "wallet_transfers_update" ON public.wallet_transfers;
DROP POLICY IF EXISTS "wallet_transfers_delete" ON public.wallet_transfers;

-- 5. Kebijakan baru: hanya pemilik baris
DROP POLICY IF EXISTS "wallets_owner_select" ON public.wallets;
CREATE POLICY "wallets_owner_select" ON public.wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallets_owner_insert" ON public.wallets;
CREATE POLICY "wallets_owner_insert" ON public.wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallets_owner_update" ON public.wallets;
CREATE POLICY "wallets_owner_update" ON public.wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallets_owner_delete" ON public.wallets;
CREATE POLICY "wallets_owner_delete" ON public.wallets FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "transactions_owner_select" ON public.transactions;
CREATE POLICY "transactions_owner_select" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "transactions_owner_insert" ON public.transactions;
CREATE POLICY "transactions_owner_insert" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "transactions_owner_update" ON public.transactions;
CREATE POLICY "transactions_owner_update" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "transactions_owner_delete" ON public.transactions;
CREATE POLICY "transactions_owner_delete" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallet_transfers_owner_select" ON public.wallet_transfers;
CREATE POLICY "wallet_transfers_owner_select" ON public.wallet_transfers FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallet_transfers_owner_insert" ON public.wallet_transfers;
CREATE POLICY "wallet_transfers_owner_insert" ON public.wallet_transfers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallet_transfers_owner_update" ON public.wallet_transfers;
CREATE POLICY "wallet_transfers_owner_update" ON public.wallet_transfers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "wallet_transfers_owner_delete" ON public.wallet_transfers;
CREATE POLICY "wallet_transfers_owner_delete" ON public.wallet_transfers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. Grant: anon dicabut, authenticated hanya lewat kebijakan di atas
REVOKE ALL ON public.wallets, public.transactions, public.wallet_transfers FROM anon;
REVOKE ALL ON public.wallets, public.transactions, public.wallet_transfers FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets, public.transactions, public.wallet_transfers TO authenticated;
REVOKE UPDATE ON public.wallets FROM authenticated;
GRANT UPDATE (nama, provider) ON public.wallets TO authenticated;

-- 7. Trigger kepemilikan dompet
CREATE OR REPLACE FUNCTION public.tg_check_transaction_wallet_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.wallet_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.wallets w WHERE w.id = NEW.wallet_id AND w.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Dompet tidak ditemukan untuk pengguna ini';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_wallet_owner ON public.transactions;
CREATE TRIGGER transactions_wallet_owner
BEFORE INSERT OR UPDATE OF wallet_id, user_id ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_check_transaction_wallet_owner();

CREATE OR REPLACE FUNCTION public.tg_check_transfer_wallet_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT count(*) FROM public.wallets w
    WHERE w.id IN (NEW.from_wallet_id, NEW.to_wallet_id) AND w.user_id = NEW.user_id
  ) <> 2 THEN
    RAISE EXCEPTION 'Dompet transfer tidak ditemukan untuk pengguna ini';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_transfers_wallet_owner ON public.wallet_transfers;
CREATE TRIGGER wallet_transfers_wallet_owner
BEFORE INSERT OR UPDATE OF from_wallet_id, to_wallet_id, user_id ON public.wallet_transfers
FOR EACH ROW EXECUTE FUNCTION public.tg_check_transfer_wallet_owner();

-- 8. Trigger saldo transfer: biaya admin ikut user_id transfer
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
        user_id, tanggal, deskripsi, tipe, nominal, kategori, wallet_id, transfer_id
      )
      VALUES (
        NEW.user_id, NEW.tanggal, 'Biaya admin transfer', 'Pengeluaran',
        NEW.biaya_admin, 'Biaya Admin', NEW.from_wallet_id, NEW.id
      );
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- 9. NOT NULL hanya jika semua baris sudah punya pemilik
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.wallets WHERE user_id IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.transactions WHERE user_id IS NULL)
     AND NOT EXISTS (SELECT 1 FROM public.wallet_transfers WHERE user_id IS NULL) THEN
    ALTER TABLE public.wallets ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.transactions ALTER COLUMN user_id SET NOT NULL;
    ALTER TABLE public.wallet_transfers ALTER COLUMN user_id SET NOT NULL;
  ELSE
    RAISE NOTICE 'Ada baris tanpa user_id. NOT NULL belum diterapkan; lihat catatan di atas.';
  END IF;
END $$;
