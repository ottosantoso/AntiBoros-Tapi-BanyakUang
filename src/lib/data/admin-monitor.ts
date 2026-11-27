import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

/* ---------- Admin: log aktivitas, monitoring transaksi, dan monitoring AI ---------- */

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => String(v ?? '');
const strOrNull = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

export interface LogAdmin {
  waktu: string;
  aksi: string;
  admin: string | null;
  adminIdSingkat: string;
  targetIdSingkat: string | null;
}

/** Log aksi admin, terbaru dulu. Filter aksi opsional. */
export async function fetchLogAktivitas(
  aksi: string | null,
  offset: number,
): Promise<{ data: LogAdmin[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_log_aktivitas', {
    p_aksi: aksi,
    p_limit: 25,
    p_offset: offset,
  });
  if (error) return { data: [], error: error.message };
  return {
    data: arr(data).map((r) => ({
      waktu: str(r.waktu),
      aksi: str(r.aksi),
      admin: strOrNull(r.admin),
      adminIdSingkat: str(r.admin_id_singkat),
      targetIdSingkat: strOrNull(r.target_id_singkat),
    })),
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
