/*
# Jenis dompet (bank / e-wallet / lainnya) dan logo opsional

1. Kolom `jenis` di wallets: 'bank' | 'ewallet' | 'lainnya'. Default 'bank'.
   Dompet bawaan di-set manual sesuai provider-nya.
2. Kolom `logo_url` (opsional) untuk gambar dompet yang diunggah pengguna.
3. Bucket publik `wallet-logos`. Hanya pemilik yang bisa mengunggah, mengubah,
   dan menghapus file di folder miliknya: <user_id>/nama-file.
*/

ALTER TABLE public.wallets
  ADD COLUMN IF NOT EXISTS jenis text NOT NULL DEFAULT 'bank'
    CHECK (jenis IN ('bank', 'ewallet', 'lainnya')),
  ADD COLUMN IF NOT EXISTS logo_url text;

UPDATE public.wallets SET jenis = 'ewallet' WHERE provider IN ('GOPAY', 'OVO', 'DANA', 'SHOPEEPAY');
UPDATE public.wallets SET jenis = 'lainnya' WHERE provider = 'CASH';

INSERT INTO storage.buckets (id, name, public)
VALUES ('wallet-logos', 'wallet-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "wallet_logos_owner_insert" ON storage.objects;
CREATE POLICY "wallet_logos_owner_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'wallet-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "wallet_logos_owner_update" ON storage.objects;
CREATE POLICY "wallet_logos_owner_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'wallet-logos' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'wallet-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "wallet_logos_owner_delete" ON storage.objects;
CREATE POLICY "wallet_logos_owner_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'wallet-logos' AND (storage.foldername(name))[1] = auth.uid()::text);
