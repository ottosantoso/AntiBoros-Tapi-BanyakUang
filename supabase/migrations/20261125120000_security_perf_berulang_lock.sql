-- Perbaikan keamanan, performa, dan race condition:
-- 1. Fungsi SECURITY DEFINER lama (tabel recurring_rules, tidak dipakai kode) tidak boleh dipanggil lewat API.
-- 2. proses_transaksi_berulang tidak boleh dipanggil anon.
-- 3. RLS: auth.uid() dibungkus (select ...) supaya tidak dievaluasi ulang per baris.
-- 4. Indeks untuk foreign key transaksi_berulang.
-- 5. proses_transaksi_berulang mengunci baris (FOR UPDATE) supaya dua pemanggilan bersamaan
--    tidak mencatat transaksi berulang yang sama dua kali.

-- 1 & 2: cabut akses EXECUTE dari role API. Trigger tidak memerlukan grant EXECUTE saat dijalankan.
REVOKE EXECUTE ON FUNCTION public.tg_check_recurring_owner() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proses_transaksi_berulang() FROM anon;

-- 3: policy RLS
DROP POLICY IF EXISTS wallets_owner_select ON public.wallets;
DROP POLICY IF EXISTS wallets_owner_insert ON public.wallets;
DROP POLICY IF EXISTS wallets_owner_update ON public.wallets;
DROP POLICY IF EXISTS wallets_owner_delete ON public.wallets;
CREATE POLICY wallets_owner_select ON public.wallets FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY wallets_owner_insert ON public.wallets FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY wallets_owner_update ON public.wallets FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY wallets_owner_delete ON public.wallets FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS transactions_owner_select ON public.transactions;
DROP POLICY IF EXISTS transactions_owner_insert ON public.transactions;
DROP POLICY IF EXISTS transactions_owner_update ON public.transactions;
DROP POLICY IF EXISTS transactions_owner_delete ON public.transactions;
CREATE POLICY transactions_owner_select ON public.transactions FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY transactions_owner_insert ON public.transactions FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY transactions_owner_update ON public.transactions FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY transactions_owner_delete ON public.transactions FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS wallet_transfers_owner_select ON public.wallet_transfers;
DROP POLICY IF EXISTS wallet_transfers_owner_insert ON public.wallet_transfers;
DROP POLICY IF EXISTS wallet_transfers_owner_update ON public.wallet_transfers;
DROP POLICY IF EXISTS wallet_transfers_owner_delete ON public.wallet_transfers;
CREATE POLICY wallet_transfers_owner_select ON public.wallet_transfers FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY wallet_transfers_owner_insert ON public.wallet_transfers FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY wallet_transfers_owner_update ON public.wallet_transfers FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY wallet_transfers_owner_delete ON public.wallet_transfers FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ai_reports owner select" ON public.ai_reports;
DROP POLICY IF EXISTS "ai_reports owner insert" ON public.ai_reports;
DROP POLICY IF EXISTS "ai_reports owner delete" ON public.ai_reports;
CREATE POLICY "ai_reports owner select" ON public.ai_reports FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "ai_reports owner insert" ON public.ai_reports FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "ai_reports owner delete" ON public.ai_reports FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "recurring owner all" ON public.recurring_rules;
CREATE POLICY "recurring owner all" ON public.recurring_rules FOR ALL TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

-- 4: indeks foreign key
CREATE INDEX IF NOT EXISTS transaksi_berulang_wallet_id_idx ON public.transaksi_berulang (wallet_id);
CREATE INDEX IF NOT EXISTS transaksi_berulang_subkategori_id_idx ON public.transaksi_berulang (subkategori_id);

-- 5: proses_transaksi_berulang dengan penguncian baris
CREATE OR REPLACE FUNCTION public.proses_transaksi_berulang()
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  kand date;
  kat text;
  hari_ini date := (now() AT TIME ZONE 'Asia/Jakarta')::date;
  jumlah integer := 0;
BEGIN
  FOR r IN
    SELECT b.*
    FROM public.transaksi_berulang b
    JOIN public.wallets w ON w.id = b.wallet_id
    WHERE b.aktif AND NOT COALESCE(w.is_archived, false)
    FOR UPDATE OF b
  LOOP
    IF r.terakhir_dicatat IS NULL THEN
      kand := make_date(extract(year FROM r.tanggal_mulai)::int,
                        extract(month FROM r.tanggal_mulai)::int,
                        r.hari_jatuh_tempo);
      IF kand < r.tanggal_mulai THEN
        kand := (kand + interval '1 month')::date;
      END IF;
    ELSE
      kand := (make_date(extract(year FROM r.terakhir_dicatat)::int,
                         extract(month FROM r.terakhir_dicatat)::int,
                         r.hari_jatuh_tempo) + interval '1 month')::date;
    END IF;

    WHILE kand <= hari_ini LOOP
      SELECT s.kategori INTO kat FROM public.subkategori s WHERE s.id = r.subkategori_id;
      INSERT INTO public.transactions (user_id, tanggal, deskripsi, tipe, nominal, kategori, wallet_id, subkategori_id, berulang)
      VALUES (r.user_id, kand, r.nama, r.tipe, r.nominal, kat, r.wallet_id, r.subkategori_id, true);
      jumlah := jumlah + 1;
      UPDATE public.transaksi_berulang SET terakhir_dicatat = kand WHERE id = r.id;
      kand := (make_date(extract(year FROM kand)::int,
                         extract(month FROM kand)::int,
                         r.hari_jatuh_tempo) + interval '1 month')::date;
    END LOOP;
  END LOOP;
  RETURN jumlah;
END;
$function$;
