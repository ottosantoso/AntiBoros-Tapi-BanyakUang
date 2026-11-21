/*
# Add wallet transfers and automatic balance synchronization

1. New Tables
- `wallet_transfers` stores movement between two existing wallets without classifying the movement as income or expense.
- `wallet_transfers.id` is the transfer identifier.
- `wallet_transfers.tanggal` stores the transfer date.
- `wallet_transfers.from_wallet_id` stores the source wallet.
- `wallet_transfers.to_wallet_id` stores the destination wallet.
- `wallet_transfers.nominal` stores the amount moved.
- `wallet_transfers.biaya_admin` stores an optional source-wallet fee.
- `wallet_transfers.catatan` stores an optional note.
- `wallet_transfers.created_at` stores creation time.

2. Modified Tables
- `transactions.berulang` marks recurring income or expense records.
- `transactions.transfer_id` links an automatically-created admin-fee expense to its transfer.
- Existing income and expense transaction types remain unchanged; transfers use the dedicated table so they never affect income or expense totals.

3. Automatic balance behavior
- New, edited, or deleted income and expense transactions adjust the linked wallet balance.
- New, edited, or deleted transfers adjust the source and destination wallet balances.
- A transfer fee is recorded as a normal expense linked to that transfer, so the fee affects expense totals while the transferred principal does not.
- Balance changes run inside database triggers so browser-side checks cannot bypass synchronization.

4. Security
- Row level security is enabled on `wallet_transfers`.
- This application has no sign-in screen and is intentionally single-tenant, so anon and authenticated receive CRUD access with explicit four-verb policies.
- Wallet balance updates are performed by protected trigger functions. Direct wallet balance updates are revoked from anon and authenticated; wallet name and provider remain editable.

5. Compatibility notes
- The migration is additive and keeps all existing wallets and transactions.
- Existing income and expense rows are not rewritten. Future mutations are synchronized automatically.
*/

CREATE TABLE IF NOT EXISTS public.wallet_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tanggal date NOT NULL,
  from_wallet_id uuid NOT NULL REFERENCES public.wallets (id) ON DELETE RESTRICT,
  to_wallet_id uuid NOT NULL REFERENCES public.wallets (id) ON DELETE RESTRICT,
  nominal numeric NOT NULL CHECK (nominal > 0),
  biaya_admin numeric NOT NULL DEFAULT 0 CHECK (biaya_admin >= 0),
  catatan text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wallet_transfers_different_wallets CHECK (from_wallet_id <> to_wallet_id)
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS berulang boolean NOT NULL DEFAULT false;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS transfer_id uuid REFERENCES public.wallet_transfers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_transfers_tanggal ON public.wallet_transfers (tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_from_wallet ON public.wallet_transfers (from_wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transfers_to_wallet ON public.wallet_transfers (to_wallet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_id ON public.transactions (transfer_id);

ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transfers TO anon, authenticated;
GRANT UPDATE (nama, provider) ON public.wallets TO anon, authenticated;
REVOKE UPDATE (saldo) ON public.wallets FROM anon, authenticated;

DROP POLICY IF EXISTS "wallet_transfers_select" ON public.wallet_transfers;
CREATE POLICY "wallet_transfers_select" ON public.wallet_transfers
FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "wallet_transfers_insert" ON public.wallet_transfers;
CREATE POLICY "wallet_transfers_insert" ON public.wallet_transfers
FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "wallet_transfers_update" ON public.wallet_transfers;
CREATE POLICY "wallet_transfers_update" ON public.wallet_transfers
FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "wallet_transfers_delete" ON public.wallet_transfers;
CREATE POLICY "wallet_transfers_delete" ON public.wallet_transfers
FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.apply_transaction_wallet_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.wallet_id IS NOT NULL THEN
    UPDATE public.wallets
    SET saldo = saldo - CASE WHEN OLD.tipe = 'Pemasukan' THEN OLD.nominal ELSE -OLD.nomINAL END
    WHERE id = OLD.wallet_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.wallet_id IS NOT NULL THEN
    UPDATE public.wallets
    SET saldo = saldo + CASE WHEN NEW.tipe = 'Pemasukan' THEN NEW.nomINAL ELSE -NEW.NOMINAL END
    WHERE id = NEW.wallet_id;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_transfer_wallet_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    DELETE FROM public.transactions WHERE transfer_id = OLD.id;

    UPDATE public.wallets
    SET saldo = saldo + OLD.nominal
    WHERE id = OLD.from_wallet_id;

    UPDATE public.wallets
    SET saldo = saldo - OLD.nominal
    WHERE id = OLD.to_wallet_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.wallets
    SET saldo = saldo - NEW.nominal
    WHERE id = NEW.from_wallet_id;

    UPDATE public.wallets
    SET saldo = saldo + NEW.nominal
    WHERE id = NEW.to_wallet_id;

    IF NEW.biaya_admin > 0 THEN
      INSERT INTO public.transactions (
        tanggal,
        deskripsi,
        tipe,
        nominal,
        kategori,
        wallet_id,
        transfer_id
      )
      VALUES (
        NEW.tanggal,
        'Biaya admin transfer',
        'Pengeluaran',
        NEW.biaya_admin,
        'Biaya Admin',
        NEW.from_wallet_id,
        NEW.id
      );
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS transactions_balance_sync ON public.transactions;
CREATE TRIGGER transactions_balance_sync
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_wallet_delta();

DROP TRIGGER IF EXISTS wallet_transfers_balance_sync ON public.wallet_transfers;
CREATE TRIGGER wallet_transfers_balance_sync
AFTER INSERT OR UPDATE OR DELETE ON public.wallet_transfers
FOR EACH ROW EXECUTE FUNCTION public.apply_transfer_wallet_delta();

REVOKE EXECUTE ON FUNCTION public.apply_transaction_wallet_delta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_transfer_wallet_delta() FROM PUBLIC, anon, authenticated;
