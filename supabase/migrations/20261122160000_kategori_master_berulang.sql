/*
# Master kategori & subkategori (dari Excel), kategori sistem, dan transaksi berulang

1. Tabel `kategori`: master kategori per jenis (Pengeluaran / Pemasukan), per pengguna.
2. `subkategori` mendapat kolom:
   - `is_system`: subkategori sistem (Transfer, Penyesuaian Saldo, Biaya Admin). Tidak bisa dinonaktifkan, diubah namanya, atau dihapus.
   - `aktif`: subkategori yang disembunyikan dari dropdown tanpa menghapus riwayat transaksi.
   - `urutan`: 1 = berasal dari master Excel, 0 = subkategori lama dari seed awal, 2 = dibuat pengguna.
3. Isi awal diambil dari sheet Kategori dan Subkategori di Excel "Hepeng History New Generation 4".
   Subkategori lama yang tidak ada di master (urutan 0) dinonaktifkan, transaksi lamanya tidak diubah.
   Catatan: budgeting "Investasi" di Excel dipetakan ke "Tabungan" karena constraint database hanya menerima Kebutuhan / Keinginan / Tabungan.
4. Tabel `transaksi_berulang` dan fungsi `proses_transaksi_berulang()` yang mencatat transaksi yang sudah jatuh tempo.
5. RLS: hanya pemilik baris. anon tidak punya akses.
*/

-- 1. Kolom baru di subkategori
ALTER TABLE public.subkategori
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aktif boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS urutan integer NOT NULL DEFAULT 0;

-- 2. Tabel master kategori
CREATE TABLE IF NOT EXISTS public.kategori (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE DEFAULT auth.uid(),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 1 AND 60),
  jenis text NOT NULL CHECK (jenis IN ('Pengeluaran', 'Pemasukan')),
  is_system boolean NOT NULL DEFAULT false,
  aktif boolean NOT NULL DEFAULT true,
  urutan integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, jenis, nama)
);

-- 3. Seed master per pengguna (idempotent)
CREATE OR REPLACE FUNCTION public.seed_master_akun(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.kategori (user_id, nama, jenis, is_system, aktif, urutan)
  VALUES
    (p_user, 'Kebutuhan Rumah Tangga', 'Pengeluaran', false, true, 1),
    (p_user, 'Transportasi', 'Pengeluaran', false, true, 2),
    (p_user, 'Pendidikan', 'Pengeluaran', false, true, 3),
    (p_user, 'Kesehatan', 'Pengeluaran', false, true, 4),
    (p_user, 'Anak & Bayi', 'Pengeluaran', false, true, 5),
    (p_user, 'Kebutuhan Pribadi', 'Pengeluaran', false, true, 6),
    (p_user, 'Hiburan & Lifestyle', 'Pengeluaran', false, true, 7),
    (p_user, 'Sosial', 'Pengeluaran', false, true, 8),
    (p_user, 'Investasi & Tabungan', 'Pengeluaran', false, true, 9),
    (p_user, 'Lain-lain', 'Pengeluaran', false, true, 10),
    (p_user, 'Transfer', 'Pengeluaran', true, true, 11),
    (p_user, 'Penyesuaian Saldo', 'Pengeluaran', true, true, 12),
    (p_user, 'Gaji & Pendapatan Tetap', 'Pemasukan', false, true, 1),
    (p_user, 'Usaha & Freelance', 'Pemasukan', false, true, 2),
    (p_user, 'Investasi', 'Pemasukan', false, true, 3),
    (p_user, 'Pasif & Royalti', 'Pemasukan', false, true, 4),
    (p_user, 'Cashback & Refund', 'Pemasukan', false, true, 5),
    (p_user, 'Pendapatan Lainnya', 'Pemasukan', false, true, 6),
    (p_user, 'Transfer', 'Pemasukan', true, true, 7),
    (p_user, 'Penyesuaian Saldo', 'Pemasukan', true, true, 8)
  ON CONFLICT (user_id, jenis, nama) DO UPDATE
    SET is_system = EXCLUDED.is_system, aktif = true, urutan = EXCLUDED.urutan;

  -- Subkategori pengeluaran dari master Excel
  INSERT INTO public.subkategori (user_id, nama, kategori, jenis, budgeting, is_system, aktif, urutan)
  SELECT p_user, v.nama, v.kategori, 'Pengeluaran', v.budgeting, v.is_system, true, 1
  FROM (VALUES
    ('Belanja bulanan', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Listrik', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Air', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Gas (LPG)', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Internet', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Paket Data', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('TV Kabel / Streaming', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Sewa / Cicilan rumah', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Laundry', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Perawatan rumah', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Pajak PBB', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Iuran kebersihan', 'Kebutuhan Rumah Tangga', 'Kebutuhan', false),
    ('Bensin/BBM', 'Transportasi', 'Kebutuhan', false),
    ('Parkir', 'Transportasi', 'Kebutuhan', false),
    ('Tol', 'Transportasi', 'Kebutuhan', false),
    ('Servis kendaraan', 'Transportasi', 'Kebutuhan', false),
    ('Angkutan umum (ojek, bus, kereta)', 'Transportasi', 'Kebutuhan', false),
    ('Pajak kendaraan', 'Transportasi', 'Kebutuhan', false),
    ('Asuransi kendaraan', 'Transportasi', 'Kebutuhan', false),
    ('Pembayaran SPP', 'Pendidikan', 'Kebutuhan', false),
    ('Buku & alat tulis', 'Pendidikan', 'Kebutuhan', false),
    ('Biaya kursus', 'Pendidikan', 'Tabungan', false),
    ('Perlengkapan belajar', 'Pendidikan', 'Kebutuhan', false),
    ('Asuransi kesehatan', 'Kesehatan', 'Kebutuhan', false),
    ('Obat-obatan', 'Kesehatan', 'Kebutuhan', false),
    ('Biaya dokter / rumah sakit', 'Kesehatan', 'Kebutuhan', false),
    ('Vitamin', 'Kesehatan', 'Keinginan', false),
    ('Alat kesehatan', 'Kesehatan', 'Kebutuhan', false),
    ('Membership gym', 'Kesehatan', 'Keinginan', false),
    ('Popok', 'Anak & Bayi', 'Kebutuhan', false),
    ('Susu formula', 'Anak & Bayi', 'Kebutuhan', false),
    ('Mainan anak', 'Anak & Bayi', 'Keinginan', false),
    ('Perlengkapan bayi', 'Anak & Bayi', 'Kebutuhan', false),
    ('Pendidikan anak (PAUD)', 'Anak & Bayi', 'Kebutuhan', false),
    ('Perawatan diri (salon, skincare, kosmetik)', 'Kebutuhan Pribadi', 'Kebutuhan', false),
    ('Pakaian', 'Kebutuhan Pribadi', 'Kebutuhan', false),
    ('Gadget', 'Kebutuhan Pribadi', 'Kebutuhan', false),
    ('Alas kaki', 'Kebutuhan Pribadi', 'Kebutuhan', false),
    ('Aksesoris diri', 'Kebutuhan Pribadi', 'Keinginan', false),
    ('Nonton bioskop', 'Hiburan & Lifestyle', 'Keinginan', false),
    ('Nonton konser', 'Hiburan & Lifestyle', 'Keinginan', false),
    ('Jajan / Makan di luar', 'Hiburan & Lifestyle', 'Keinginan', false),
    ('Wisata', 'Hiburan & Lifestyle', 'Keinginan', false),
    ('Game', 'Hiburan & Lifestyle', 'Keinginan', false),
    ('Hobi', 'Hiburan & Lifestyle', 'Keinginan', false),
    ('Amplop pernikahan', 'Sosial', 'Keinginan', false),
    ('Ulang tahun', 'Sosial', 'Keinginan', false),
    ('Sumbangan', 'Sosial', 'Kebutuhan', false),
    ('Zakat / infaq', 'Sosial', 'Kebutuhan', false),
    ('Sedekah', 'Sosial', 'Kebutuhan', false),
    ('Tabungan rutin', 'Investasi & Tabungan', 'Tabungan', false),
    ('Dana darurat', 'Investasi & Tabungan', 'Tabungan', false),
    ('Saham', 'Investasi & Tabungan', 'Tabungan', false),
    ('Reksadana', 'Investasi & Tabungan', 'Tabungan', false),
    ('Emas', 'Investasi & Tabungan', 'Tabungan', false),
    ('Deposito', 'Investasi & Tabungan', 'Tabungan', false),
    ('Asuransi jiwa', 'Investasi & Tabungan', 'Tabungan', false),
    ('Properti', 'Investasi & Tabungan', 'Tabungan', false),
    ('Dana Pendidikan Anak', 'Investasi & Tabungan', 'Tabungan', false),
    ('Denda', 'Lain-lain', 'Kebutuhan', false),
    ('Tilang', 'Lain-lain', 'Kebutuhan', false),
    ('Biaya admin bank', 'Lain-lain', 'Kebutuhan', false),
    ('Pengeluaran tak terduga', 'Lain-lain', 'Kebutuhan', false),
    ('Biaya Admin', 'Lain-lain', 'Kebutuhan', true),
    ('Transfer', 'Transfer', 'Kebutuhan', true),
    ('Penyesuaian Saldo', 'Penyesuaian Saldo', 'Kebutuhan', true)
  ) AS v(nama, kategori, budgeting, is_system)
  ON CONFLICT (user_id, jenis, nama) DO UPDATE
    SET kategori = EXCLUDED.kategori, budgeting = EXCLUDED.budgeting,
        is_system = EXCLUDED.is_system, aktif = true, urutan = 1;

  -- Subkategori pemasukan dari master Excel (budgeting selalu NULL)
  INSERT INTO public.subkategori (user_id, nama, kategori, jenis, budgeting, is_system, aktif, urutan)
  SELECT p_user, v.nama, v.kategori, 'Pemasukan', NULL, v.is_system, true, 1
  FROM (VALUES
    ('Gaji pokok', 'Gaji & Pendapatan Tetap', false),
    ('Tunjangan', 'Gaji & Pendapatan Tetap', false),
    ('Bonus', 'Gaji & Pendapatan Tetap', false),
    ('THR', 'Gaji & Pendapatan Tetap', false),
    ('Komisi', 'Gaji & Pendapatan Tetap', false),
    ('Top Up', 'Gaji & Pendapatan Tetap', false),
    ('Pendapatan usaha sendiri', 'Usaha & Freelance', false),
    ('Pendapatan dari freelance', 'Usaha & Freelance', false),
    ('Jasa', 'Usaha & Freelance', false),
    ('Afiliasi', 'Usaha & Freelance', false),
    ('Dividen saham', 'Investasi', false),
    ('Bunga deposito', 'Investasi', false),
    ('Pendapatan dari reksa dana', 'Investasi', false),
    ('Sewa properti', 'Investasi', false),
    ('Capital gain', 'Investasi', false),
    ('Royalti (buku, musik, karya seni)', 'Pasif & Royalti', false),
    ('Lisensi penggunaan produk/jasa', 'Pasif & Royalti', false),
    ('Cashback', 'Cashback & Refund', false),
    ('Refund', 'Cashback & Refund', false),
    ('Reward / Poin Cair', 'Cashback & Refund', false),
    ('Gopay Coins', 'Cashback & Refund', false),
    ('Pendapatan Lainnya', 'Pendapatan Lainnya', false),
    ('Lain-lain', 'Pendapatan Lainnya', false),
    ('Transfer', 'Transfer', true),
    ('Penyesuaian Saldo', 'Penyesuaian Saldo', true)
  ) AS v(nama, kategori, is_system)
  ON CONFLICT (user_id, jenis, nama) DO UPDATE
    SET kategori = EXCLUDED.kategori, budgeting = NULL,
        is_system = EXCLUDED.is_system, aktif = true, urutan = 1;

  -- Subkategori lama yang bukan bagian master dinonaktifkan (riwayat tetap utuh)
  UPDATE public.subkategori
  SET aktif = false
  WHERE user_id = p_user AND urutan = 0 AND is_system = false;
END;
$$;

-- Seed awal akun baru memakai master yang sama
CREATE OR REPLACE FUNCTION public.seed_default_subkategori(p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_master_akun(p_user);
END;
$$;

-- Backfill semua akun yang sudah ada
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT id FROM auth.users LOOP
    PERFORM public.seed_master_akun(r.id);
  END LOOP;
END $$;

REVOKE EXECUTE ON FUNCTION public.seed_master_akun(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_default_subkategori(uuid) FROM PUBLIC, anon, authenticated;

-- 4. Penjaga subkategori & kategori sistem
CREATE OR REPLACE FUNCTION public.tg_guard_system_subkategori()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN RAISE EXCEPTION 'Subkategori sistem tidak bisa dihapus'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_system AND (
    NEW.aktif = false OR NEW.nama <> OLD.nama OR NEW.kategori <> OLD.kategori
    OR NEW.jenis <> OLD.jenis OR NEW.budgeting IS DISTINCT FROM OLD.budgeting
  ) THEN
    RAISE EXCEPTION 'Subkategori sistem tidak bisa diubah atau dinonaktifkan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subkategori_guard_system ON public.subkategori;
CREATE TRIGGER subkategori_guard_system
BEFORE UPDATE OR DELETE ON public.subkategori
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_system_subkategori();

CREATE OR REPLACE FUNCTION public.tg_guard_system_kategori()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN RAISE EXCEPTION 'Kategori sistem tidak bisa dihapus'; END IF;
    RETURN OLD;
  END IF;
  IF OLD.is_system AND (NEW.aktif = false OR NEW.nama <> OLD.nama OR NEW.jenis <> OLD.jenis) THEN
    RAISE EXCEPTION 'Kategori sistem tidak bisa diubah atau dinonaktifkan';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS kategori_guard_system ON public.kategori;
CREATE TRIGGER kategori_guard_system
BEFORE UPDATE OR DELETE ON public.kategori
FOR EACH ROW EXECUTE FUNCTION public.tg_guard_system_kategori();

-- 5. Transaksi berulang
CREATE TABLE IF NOT EXISTS public.transaksi_berulang (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE DEFAULT auth.uid(),
  nama text NOT NULL CHECK (char_length(btrim(nama)) BETWEEN 1 AND 80),
  tipe text NOT NULL CHECK (tipe IN ('Pemasukan', 'Pengeluaran')),
  nominal numeric NOT NULL CHECK (nominal > 0),
  wallet_id uuid NOT NULL REFERENCES public.wallets (id) ON DELETE CASCADE,
  subkategori_id uuid REFERENCES public.subkategori (id) ON DELETE SET NULL,
  tanggal_mulai date NOT NULL,
  hari_jatuh_tempo integer NOT NULL CHECK (hari_jatuh_tempo BETWEEN 1 AND 28),
  terakhir_dicatat date,
  aktif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transaksi_berulang_user ON public.transaksi_berulang (user_id);

CREATE OR REPLACE FUNCTION public.tg_check_berulang_owner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.wallets w WHERE w.id = NEW.wallet_id AND w.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'Dompet tidak ditemukan untuk pengguna ini';
  END IF;
  IF NEW.subkategori_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.subkategori s WHERE s.id = NEW.subkategori_id AND s.user_id = NEW.user_id
  ) THEN
    RAISE EXCEPTION 'Subkategori tidak ditemukan untuk pengguna ini';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transaksi_berulang_owner ON public.transaksi_berulang;
CREATE TRIGGER transaksi_berulang_owner
BEFORE INSERT OR UPDATE OF wallet_id, subkategori_id, user_id ON public.transaksi_berulang
FOR EACH ROW EXECUTE FUNCTION public.tg_check_berulang_owner();

-- Mencatat semua transaksi berulang yang sudah jatuh tempo (sampai hari ini, WIB).
-- SECURITY INVOKER: RLS pemilik tetap berlaku.
CREATE OR REPLACE FUNCTION public.proses_transaksi_berulang()
RETURNS integer
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

-- 6. RLS & grant: hanya pemilik baris
ALTER TABLE public.kategori ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_berulang ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kategori_owner_select" ON public.kategori;
CREATE POLICY "kategori_owner_select" ON public.kategori FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "kategori_owner_insert" ON public.kategori;
CREATE POLICY "kategori_owner_insert" ON public.kategori FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "kategori_owner_update" ON public.kategori;
CREATE POLICY "kategori_owner_update" ON public.kategori FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "kategori_owner_delete" ON public.kategori;
CREATE POLICY "kategori_owner_delete" ON public.kategori FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "berulang_owner_select" ON public.transaksi_berulang;
CREATE POLICY "berulang_owner_select" ON public.transaksi_berulang FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "berulang_owner_insert" ON public.transaksi_berulang;
CREATE POLICY "berulang_owner_insert" ON public.transaksi_berulang FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "berulang_owner_update" ON public.transaksi_berulang;
CREATE POLICY "berulang_owner_update" ON public.transaksi_berulang FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "berulang_owner_delete" ON public.transaksi_berulang;
CREATE POLICY "berulang_owner_delete" ON public.transaksi_berulang FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.kategori, public.transaksi_berulang FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kategori, public.transaksi_berulang TO authenticated;
GRANT EXECUTE ON FUNCTION public.proses_transaksi_berulang() TO authenticated;
