import { supabase } from '../supabase-client';

/* ---------- Admin: hanya agregat dan data yang sudah disetujui untuk peran admin ---------- */

/** True kalau akun yang sedang masuk punya peran admin. Dibaca lewat RPC, bukan dari tabel langsung. */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

export interface AdminDashboard {
  periode: { dari: string; sampai: string };
  kpi: {
    totalPengguna: number;
    penggunaAktif: number;
    totalTransaksi: number;
    pemasukan: number;
    pengeluaran: number;
  };
  trenHarian: { tanggal: string; transaksi: number; pengguna: number }[];
  kategori: { kategori: string; total: number }[];
  fitur: { fitur: string; pengguna: number }[];
  penggunaTeraktif: { idSingkat: string; nama: string | null; jumlah: number }[];
  aktivitasTerbaru: { waktu: string; aksi: string; idSingkat: string; nama: string | null; email: string | null }[];
  logAdmin: { waktu: string; aksi: string; admin: string; target: string | null }[];
}

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => String(v ?? '');
const strOrNull = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

/**
 * Dashboard admin untuk rentang tanggal [mulai, selesai] (format YYYY-MM-DD).
 * Server membatasi akses ke admin, mencatat pembacaan di admin_audit, dan menyembunyikan nama/email
 * dari peran analyst (hanya ID singkat yang dikirim).
 */
export async function fetchAdminDashboard(
  mulai: string,
  selesai: string,
): Promise<{ data: AdminDashboard | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_dashboard', { p_mulai: mulai, p_selesai: selesai });
  if (error) return { data: null, error: error.message };
  const raw = (data ?? {}) as Raw;
  const kpi = (raw.kpi ?? {}) as Raw;
  const periode = (raw.periode ?? {}) as Raw;
  return {
    data: {
      periode: { dari: str(periode.dari), sampai: str(periode.sampai) },
      kpi: {
        totalPengguna: num(kpi.total_pengguna),
        penggunaAktif: num(kpi.pengguna_aktif),
        totalTransaksi: num(kpi.total_transaksi),
        pemasukan: num(kpi.pemasukan),
        pengeluaran: num(kpi.pengeluaran),
      },
      trenHarian: arr(raw.tren_harian).map((r) => ({
        tanggal: str(r.tanggal),
        transaksi: num(r.transaksi),
        pengguna: num(r.pengguna),
      })),
      kategori: arr(raw.kategori).map((r) => ({ kategori: str(r.kategori), total: num(r.total) })),
      fitur: arr(raw.fitur).map((r) => ({ fitur: str(r.fitur), pengguna: num(r.pengguna) })),
      penggunaTeraktif: arr(raw.pengguna_teraktif).map((r) => ({
        idSingkat: str(r.id_singkat),
        nama: strOrNull(r.nama),
        jumlah: num(r.jumlah),
      })),
      aktivitasTerbaru: arr(raw.aktivitas_terbaru).map((r) => ({
        waktu: str(r.waktu),
        aksi: str(r.aksi),
        idSingkat: str(r.id_singkat),
        nama: strOrNull(r.nama),
        email: strOrNull(r.email),
      })),
      logAdmin: arr(raw.log_admin).map((r) => ({
        waktu: str(r.waktu),
        aksi: str(r.aksi),
        admin: str(r.admin),
        target: strOrNull(r.target),
      })),
    },
    error: null,
  };
}
