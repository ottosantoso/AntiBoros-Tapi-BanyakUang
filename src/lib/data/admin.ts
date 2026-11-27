import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

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

/* ---------- Manajemen pengguna & akses dukungan ---------- */

export interface PenggunaAdmin {
  /** UUID lengkap. Null untuk peran analyst. */
  id: string | null;
  idSingkat: string;
  nama: string | null;
  email: string | null;
  dibuat: string;
  terakhirMasuk: string | null;
  jumlahTransaksi: number;
}

export interface TransaksiDukungan {
  tanggal: string;
  deskripsi: string;
  tipe: string;
  nominal: number;
  kategori: string;
  dibuat: string;
}

/** Peran admin yang sedang masuk, misalnya ['super_admin', 'support']. */
export async function fetchPeranSaya(): Promise<string[]> {
  const { data, error } = await supabase.rpc('admin_peran_saya');
  if (error || !Array.isArray(data)) return [];
  return data as string[];
}

/** Daftar pengguna dengan pencarian dan paging (25 per halaman). */
export async function fetchDaftarPengguna(
  cari: string,
  offset: number,
): Promise<{ data: PenggunaAdmin[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_list_pengguna', {
    p_cari: cari.trim() || null,
    p_limit: 25,
    p_offset: offset,
  });
  if (error) return { data: [], error: error.message };
  return {
    data: arr(data).map((r) => ({
      id: strOrNull(r.id),
      idSingkat: str(r.id_singkat),
      nama: strOrNull(r.nama),
      email: strOrNull(r.email),
      dibuat: str(r.dibuat),
      terakhirMasuk: strOrNull(r.terakhir_masuk),
      jumlahTransaksi: num(r.jumlah_transaksi),
    })),
    error: null,
  };
}

/** Batas waktu akses dukungan yang masih aktif untuk admin ini ke pengguna tertentu, atau null. */
export async function fetchStatusDukungan(userId: string): Promise<{ berlakuSampai: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_status_dukungan', { p_user: userId });
  if (error) return { berlakuSampai: null, error: error.message };
  return { berlakuSampai: strOrNull(data), error: null };
}

/** Minta akses dukungan (1 sampai 24 jam). Server mencatat permintaan di audit. */
export async function mintaAksesDukungan(userId: string, alasan: string, jam: number): Promise<WriteResult> {
  const { error } = await supabase.rpc('admin_minta_akses_dukungan', {
    p_user: userId,
    p_alasan: alasan,
    p_jam: jam,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Transaksi pribadi pengguna. Hanya bisa dibuka saat akses dukungan aktif. Setiap pembacaan dicatat. */
export async function fetchTransaksiDukungan(userId: string): Promise<{ data: TransaksiDukungan[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_transaksi_dukungan', { p_user: userId });
  if (error) return { data: [], error: error.message };
  return {
    data: arr(data).map((r) => ({
      tanggal: str(r.tanggal),
      deskripsi: str(r.deskripsi),
      tipe: str(r.tipe),
      nominal: num(r.nominal),
      kategori: str(r.kategori),
      dibuat: str(r.dibuat),
    })),
    error: null,
  };
}
