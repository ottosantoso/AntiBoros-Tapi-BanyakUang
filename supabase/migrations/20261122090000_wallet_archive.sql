/*
# Arsip dompet

1. Kolom baru di wallets:
   - `is_archived` (default false): dompet diarsipkan, tidak dipakai lagi.
   - `archived_at`: waktu diarsipkan.
   Sisa saldo dompet diarsip tetap tersimpan di kolom `saldo`.

2. Dompet arsip dibekukan di database:
   - Transaksi baru, ubah, atau hapus yang menyentuh dompet arsip ditolak.
   - Transfer baru, ubah, atau hapus yang menyentuh dompet arsip ditolak.
   Dengan begitu saldo dompet arsip tidak bisa berubah diam-diam.

3. Pemulihan dompet cukup mengubah is_archived kembali ke false.
*/

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

GRANT UPDATE (is_archived, archived_at) ON public.wallets TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.guard_archived_tx()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP IN ('UPDATE', 'DELETE')
      AND EXISTS (SELECT 1 FROM public.wallets WHERE id = OLD.wallet_id AND is_archived))
     OR (TG_OP IN ('INSERT', 'UPDATE')
      AND EXISTS (SELECT 1 FROM public.wallets WHERE id = NEW.wallet_id AND is_archived)) THEN
    RAISE EXCEPTION 'Dompet ini sudah diarsipkan. Pulihkan dompetnya dulu untuk mengubah transaksi.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_archived_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP IN ('UPDATE', 'DELETE')
      AND EXISTS (SELECT 1 FROM public.wallets
                  WHERE id IN (OLD.from_wallet_id, OLD.to_wallet_id) AND is_archived))
     OR (TG_OP IN ('INSERT', 'UPDATE')
      AND EXISTS (SELECT 1 FROM public.wallets
                  WHERE id IN (NEW.from_wallet_id, NEW.to_wallet_id) AND is_archived)) THEN
    RAISE EXCEPTION 'Salah satu dompet sudah diarsipkan. Pulihkan dompetnya dulu untuk mengubah transfer.';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS transactions_guard_archived ON public.transactions;
CREATE TRIGGER transactions_guard_archived
BEFORE INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.guard_archived_tx();

DROP TRIGGER IF EXISTS wallet_transfers_guard_archived ON public.wallet_transfers;
CREATE TRIGGER wallet_transfers_guard_archived
BEFORE INSERT OR UPDATE OR DELETE ON public.wallet_transfers
FOR EACH ROW EXECUTE FUNCTION public.guard_archived_transfer();

REVOKE EXECUTE ON FUNCTION public.guard_archived_tx() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_archived_transfer() FROM PUBLIC, anon, authenticated;
