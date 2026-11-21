/*
# Arsip dompet

1. Kolom baru di wallets:
   - `is_archived` (default false): dompet diarsipkan.
   - `archived_at`: waktu diarsipkan.
   Sisa saldo dompet arsip tetap tersimpan di kolom `saldo`.

2. Aturan untuk dompet arsip:
   - Transaksi atau transfer BARU ke dompet arsip ditolak.
   - Transaksi lama di dompet arsip TETAP bisa diubah dan dihapus, supaya koreksi pencatatan tetap bisa dilakukan.
   - Transaksi lama tetap tampil di riwayat dengan nama dompetnya.

3. Pemulihan dompet cukup mengubah is_archived kembali ke false.
*/

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

GRANT UPDATE (is_archived, archived_at) ON public.wallets TO anon, authenticated;

-- Transaksi baru (atau dipindah) ke dompet arsip ditolak.
CREATE OR REPLACE FUNCTION public.guard_archived_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.wallet_id IS DISTINCT FROM OLD.wallet_id THEN
    IF EXISTS (SELECT 1 FROM public.wallets WHERE id = NEW.wallet_id AND is_archived) THEN
      RAISE EXCEPTION 'Dompet ini sudah diarsipkan. Pulihkan dompetnya dulu untuk mencatat transaksi baru.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Transfer baru (atau dialihkan) ke dompet arsip ditolak.
CREATE OR REPLACE FUNCTION public.guard_archived_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.from_wallet_id IS DISTINCT FROM OLD.from_wallet_id
     OR NEW.to_wallet_id IS DISTINCT FROM OLD.to_wallet_id THEN
    IF EXISTS (SELECT 1 FROM public.wallets
               WHERE id IN (NEW.from_wallet_id, NEW.to_wallet_id) AND is_archived) THEN
      RAISE EXCEPTION 'Salah satu dompet sudah diarsipkan. Pulihkan dompetnya dulu untuk membuat transfer baru.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transactions_guard_archived ON public.transactions;
CREATE TRIGGER transactions_guard_archived
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_archived_tx();

DROP TRIGGER IF EXISTS wallet_transfers_guard_archived ON public.wallet_transfers;
CREATE TRIGGER wallet_transfers_guard_archived
BEFORE INSERT OR UPDATE ON public.wallet_transfers
FOR EACH ROW EXECUTE FUNCTION public.guard_archived_transfer();

REVOKE EXECUTE ON FUNCTION public.guard_archived_tx() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_archived_transfer() FROM PUBLIC, anon, authenticated;
