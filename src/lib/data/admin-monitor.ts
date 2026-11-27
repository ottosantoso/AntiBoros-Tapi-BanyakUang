import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

/* ---------- Admin: log aktivitas, monitoring transaksi, dan monitoring AI ---------- */

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => String(v ?? '');
const strOrNull = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

export type StatusLog = 'berhasil' | 'gagal';

export interface LogItem {
  waktu: string;
  sumber: 'admin' | 'pengguna';
  aktor: string;
  aktorIdSingkat: string;
  peran: string;
  modul: string;
  aksi: string;
  status: StatusLog;
  tabel: string | null;
  targetIdSingkat: string | null;
  /** Hanya terisi untuk super_admin. Selain itu null. */
  ip: string | null;
  /** Hanya terisi untuk super_admin. */
  userAgent: string | null;
  /** Hanya terisi untuk super_admin. Berisi alasan atau nama kolom yang berubah, tanpa nilai data. */
  detail: Record<string, unknown> | null;
}

export interface LogPage {
  total: number;
  items: LogItem[];
}

export interface FilterLog {
  mulai: string;
  selesai: string;
  aksi: string | null;
  modul: string | null;
  status: StatusLog | null;
  cari: string | null;
}

/**
 * Log aktivitas (admin dan pengguna), terbaru dulu.
 * ekspor = true mengambil seluruh hasil filter (maks 5000 baris) untuk diunduh.
 */
export async function fetchLogAktivitas(
  f: FilterLog,
  offset: number,
  limit = 25,
  ekspor = false,
): Promise<{ data: LogPage | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_log_aktivitas', {
    p_mulai: f.mulai,
    p_selesai: f.selesai,
    p_aksi: f.aksi,
    p_modul: f.modul,
    p_status: f.status,
    p_cari: f.cari,
    p_limit: limit,
    p_offset: offset,
    p_ekspor: ekspor,
  });
  if (error) return { data: null, error: error.message };
  const raw = (data ?? {}) as Raw;
  return {
    data: {
      total: num(raw.total),
      items: arr(raw.items).map((r) => ({
        waktu: str(r.waktu),
        sumber: str(r.sumber) === 'pengguna' ? 'pengguna' : 'admin',
        aktor: str(r.aktor) || 'Tidak diketahui',
        aktorIdSingkat: str(r.aktor_id_singkat),
        peran: str(r.peran) || '-',
        modul: str(r.modul) || 'Lainnya',
        aksi: str(r.aksi),
        status: str(r.status) === 'gagal' ? 'gagal' : 'berhasil',
        tabel: strOrNull(r.tabel),
        targetIdSingkat: strOrNull(r.target_id_singkat),
        ip: strOrNull(r.ip),
        userAgent: strOrNull(r.user_agent),
        detail: r.detail && typeof r.detail === 'object' ? (r.detail as Record<string, unknown>) : null,
      })),
    },
    error: null,
  };
}

export interface LogRingkasan {
  total: number;
  totalSebelumnya: number;
  gagal: number;
  gagalSebelumnya: number;
  pelakuAktif: number;
  penggunaAktivitas: number;
  adminAktivitas: number;
  /** Hanya super_admin. null untuk peran lain. */
  ipGagalUnik: number | null;
  perHari: { tanggal: string; total: number; gagal: number }[];
  perModul: { modul: string; jumlah: number }[];
  aksiTerbanyak: { aksi: string; jumlah: number }[];
}

/** Angka ringkasan log untuk rentang tanggal (YYYY-MM-DD). Dihitung dari gabungan admin_audit dan activity_logs. */
export async function fetchLogRingkasan(
  mulai: string,
  selesai: string,
): Promise<{ data: LogRingkasan | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_log_ringkasan', { p_mulai: mulai, p_selesai: selesai });
  if (error) return { data: null, error: error.message };
  const raw = (data ?? {}) as Raw;
  return {
    data: {
      total: num(raw.total),
      totalSebelumnya: num(raw.total_sebelumnya),
      gagal: num(raw.gagal),
      gagalSebelumnya: num(raw.gagal_sebelumnya),
      pelakuAktif: num(raw.pelaku_aktif),
      penggunaAktivitas: num(raw.pengguna_aktivitas),
      adminAktivitas: num(raw.admin_aktivitas),
      ipGagalUnik: raw.ip_gagal_unik === null || raw.ip_gagal_unik === undefined ? null : num(raw.ip_gagal_unik),
      perHari: arr(raw.per_hari).map((r) => ({ tanggal: str(r.tanggal), total: num(r.total), gagal: num(r.gagal) })),
      perModul: arr(raw.per_modul).map((r) => ({ modul: str(r.modul), jumlah: num(r.jumlah) })),
      aksiTerbanyak: arr(raw.aksi_terbanyak).map((r) => ({ aksi: str(r.aksi), jumlah: num(r.jumlah) })),
    },
    error: null,
  };
}

export interface MonitorTransaksi {
  dicatat: number;
  dihapus: number;
  transfer: number;
  berulang: number;
  tanpaKategori: number;
  perTipe: { tipe: string; jumlah: number; rataRata: number }[];
  perHari: { tanggal: string; jumlah: number }[];
}

export async function fetchMonitorTransaksi(
  mulai: string,
  selesai: string,
): Promise<{ data: MonitorTransaksi | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_monitor_transaksi', { p_mulai: mulai, p_selesai: selesai });
  if (error) return { data: null, error: error.message };
  const raw = (data ?? {}) as Raw;
  return {
    data: {
      dicatat: num(raw.dicatat),
      dihapus: num(raw.dihapus),
      transfer: num(raw.transfer),
      berulang: num(raw.berulang),
      tanpaKategori: num(raw.tanpa_kategori),
      perTipe: arr(raw.per_tipe).map((r) => ({ tipe: str(r.tipe), jumlah: num(r.jumlah), rataRata: num(r.rata_rata) })),
      perHari: arr(raw.per_hari).map((r) => ({ tanggal: str(r.tanggal), jumlah: num(r.jumlah) })),
    },
    error: null,
  };
}

export interface MonitorAi {
  totalPermintaan: number;
  penggunaAsisten: number;
  perHari: { tanggal: string; jumlah: number }[];
  teraktif: { idSingkat: string; nama: string | null; jumlah: number }[];
  scan: { jenis: string; status: string; jumlah: number; item: number }[];
}

export async function fetchMonitorAi(
  mulai: string,
  selesai: string,
): Promise<{ data: MonitorAi | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_monitor_ai', { p_mulai: mulai, p_selesai: selesai });
  if (error) return { data: null, error: error.message };
  const raw = (data ?? {}) as Raw;
  return {
    data: {
      totalPermintaan: num(raw.total_permintaan),
      penggunaAsisten: num(raw.pengguna_asisten),
      perHari: arr(raw.per_hari).map((r) => ({ tanggal: str(r.tanggal), jumlah: num(r.jumlah) })),
      teraktif: arr(raw.teraktif).map((r) => ({ idSingkat: str(r.id_singkat), nama: strOrNull(r.nama), jumlah: num(r.jumlah) })),
      scan: arr(raw.scan).map((r) => ({ jenis: str(r.jenis), status: str(r.status), jumlah: num(r.jumlah), item: num(r.item) })),
    },
    error: null,
  };
}

/** Cabut semua akses dukungan aktif yang diberikan admin ini ke satu pengguna. */
export async function cabutAksesPengguna(userId: string): Promise<WriteResult & { jumlah: number }> {
  const { data, error } = await supabase.rpc('admin_cabut_akses_pengguna', { p_user: userId });
  if (error) return { success: false, error: error.message, jumlah: 0 };
  return { success: true, error: null, jumlah: num(data) };
}
