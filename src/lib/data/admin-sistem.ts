import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

/* ---------- Admin: kesehatan AI, notifikasi sistem, backup manual, status sistem, master kategori ---------- */

type Raw = Record<string, unknown>;
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? (v as Raw[]) : []);
const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string => String(v ?? '');
const strOrNull = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v));

export interface KesehatanAi {
  total: number;
  error: number;
  rataLatensi: number | null;
  p95Latensi: number | null;
  perFitur: { fitur: string; jumlah: number; error: number; rataLatensi: number | null; p95: number | null }[];
  kodeError: { kode: string; jumlah: number }[];
}

export async function fetchKesehatanAi(mulai: string, selesai: string): Promise<{ data: KesehatanAi | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_ai_kesehatan', { p_mulai: mulai, p_selesai: selesai });
  if (error) return { data: null, error: error.message };
  const raw = (data ?? {}) as Raw;
  const nullableNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
  return {
    data: {
      total: num(raw.total),
      error: num(raw.error),
      rataLatensi: nullableNum(raw.rata_latensi),
      p95Latensi: nullableNum(raw.p95_latensi),
      perFitur: arr(raw.per_fitur).map((r) => ({
        fitur: str(r.fitur),
        jumlah: num(r.jumlah),
        error: num(r.error),
        rataLatensi: nullableNum(r.rata_latensi),
        p95: nullableNum(r.p95),
      })),
      kodeError: arr(raw.kode_error).map((r) => ({ kode: str(r.kode), jumlah: num(r.jumlah) })),
    },
    error: null,
  };
}

export interface NotifikasiSistem {
  id: string;
  judul: string;
  isi: string;
  level: 'info' | 'peringatan' | 'penting';
  aktifSampai: string | null;
  nonaktifPada: string | null;
  dibuat: string;
  pembuat: string | null;
  aktif: boolean;
}

export async function fetchNotifikasiSistem(): Promise<{ data: NotifikasiSistem[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_daftar_notifikasi_sistem');
  if (error) return { data: [], error: error.message };
  return {
    data: arr(data).map((r) => ({
      id: str(r.id),
      judul: str(r.judul),
      isi: str(r.isi),
      level: (str(r.level) as NotifikasiSistem['level']) || 'info',
      aktifSampai: strOrNull(r.aktif_sampai),
      nonaktifPada: strOrNull(r.nonaktif_pada),
      dibuat: str(r.dibuat),
      pembuat: strOrNull(r.pembuat),
      aktif: r.aktif === true,
    })),
    error: null,
  };
}

/** Membuat notifikasi sistem. Hanya super_admin. Jam kosong berarti tidak kedaluwarsa. */
export async function buatNotifikasiSistem(
  judul: string,
  isi: string,
  level: NotifikasiSistem['level'],
  jam: number | null,
): Promise<WriteResult> {
  const { error } = await supabase.rpc('admin_buat_notifikasi_sistem', {
    p_judul: judul,
    p_isi: isi,
    p_level: level,
    p_jam: jam,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function nonaktifkanNotifikasiSistem(id: string): Promise<WriteResult> {
  const { error } = await supabase.rpc('admin_nonaktifkan_notifikasi_sistem', { p_id: id });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Notifikasi sistem yang aktif untuk semua pengguna yang masuk. */
export async function fetchNotifikasiSistemAktif(): Promise<{ id: string; judul: string; isi: string; level: string }[]> {
  const { data, error } = await supabase.rpc('notifikasi_sistem_aktif');
  if (error) return [];
  return arr(data).map((r) => ({ id: str(r.id), judul: str(r.judul), isi: str(r.isi), level: str(r.level) }));
}

export interface CatatanBackup {
  catatan: string;
  dibuat: string;
  pencatat: string | null;
}

export async function fetchBackup(): Promise<{ data: CatatanBackup[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_daftar_backup');
  if (error) return { data: [], error: error.message };
  return {
    data: arr(data).map((r) => ({ catatan: str(r.catatan), dibuat: str(r.dibuat), pencatat: strOrNull(r.pencatat) })),
    error: null,
  };
}

export async function catatBackup(catatan: string): Promise<WriteResult> {
  const { error } = await supabase.rpc('admin_catat_backup', { p_catatan: catatan });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export interface StatusSistem {
  databaseMb: number;
  batasFreeMb: number;
  versiPostgres: string;
  waktuServer: string;
  jumlahTabel: number;
}

export async function fetchStatusSistem(): Promise<{ data: StatusSistem | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_status_sistem');
  if (error) return { data: null, error: error.message };
  const raw = (data ?? {}) as Raw;
  return {
    data: {
      databaseMb: num(raw.database_mb),
      batasFreeMb: num(raw.batas_free_mb) || 500,
      versiPostgres: str(raw.versi_postgres),
      waktuServer: str(raw.waktu_server),
      jumlahTabel: num(raw.jumlah_tabel),
    },
    error: null,
  };
}

export interface MasterKategori {
  kategori: string;
  jumlahSub: number;
  jumlahAktif: number;
  budgeting: string | null;
  pemakaian: number;
}

export async function fetchKategoriAdmin(): Promise<{ data: MasterKategori[]; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_kategori_master');
  if (error) return { data: [], error: error.message };
  return {
    data: arr(data).map((r) => ({
      kategori: str(r.kategori),
      jumlahSub: num(r.jumlah_sub),
      jumlahAktif: num(r.jumlah_aktif),
      budgeting: strOrNull(r.budgeting),
      pemakaian: num(r.pemakaian),
    })),
    error: null,
  };
}
