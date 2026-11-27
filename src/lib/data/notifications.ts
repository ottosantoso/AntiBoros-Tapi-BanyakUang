import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

/* ---------- Notifikasi dasar (kotak masuk di aplikasi) ---------- */

export type JenisNotifikasi =
  | 'pengingat_harian'
  | 'saldo_minus'
  | 'budget_80'
  | 'budget_100'
  | 'jatuh_tempo_utang';

export interface Notifikasi {
  id: string;
  jenis: JenisNotifikasi;
  judul: string;
  isi: string;
  dibacaPada: string | null;
  createdAt: string;
}

interface NotifikasiDbRow {
  id: string;
  jenis: JenisNotifikasi;
  judul: string;
  isi: string;
  dibaca_pada: string | null;
  created_at: string;
}

export const JENIS_NOTIFIKASI: { jenis: JenisNotifikasi; judul: string; deskripsi: string }[] = [
  {
    jenis: 'jatuh_tempo_utang',
    judul: 'Jatuh tempo utang & cicilan',
    deskripsi: 'Angsuran yang jatuh tempo dalam 3 hari ke depan, dan angsuran yang terlambat.',
  },
  {
    jenis: 'budget_80',
    judul: 'Budget hampir habis',
    deskripsi: 'Pengeluaran satu kategori sudah mencapai 80% batas bulan ini.',
  },
  {
    jenis: 'budget_100',
    judul: 'Budget terlampaui',
    deskripsi: 'Pengeluaran satu kategori sudah mencapai atau melewati batas bulan ini.',
  },
  {
    jenis: 'saldo_minus',
    judul: 'Saldo minus',
    deskripsi: 'Saldo dompet di bawah nol.',
  },
  {
    jenis: 'pengingat_harian',
    judul: 'Pengingat catat harian',
    deskripsi: 'Dikirim mulai pukul 20.00 WIB kalau belum ada catatan hari ini.',
  },
];

/** Ambil notifikasi terbaru milik user yang sedang masuk (RLS membatasi ke user sendiri). */
export async function fetchNotifikasi(limit = 30): Promise<{ items: Notifikasi[]; error: string | null }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,jenis,judul,isi,dibaca_pada,created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { items: [], error: error.message };
  const items = ((data ?? []) as NotifikasiDbRow[]).map((r): Notifikasi => ({
    id: r.id,
    jenis: r.jenis,
    judul: r.judul,
    isi: r.isi,
    dibacaPada: r.dibaca_pada,
    createdAt: r.created_at,
  }));
  return { items, error: null };
}

/** Jumlah notifikasi yang belum dibaca. */
export async function fetchJumlahBelumDibaca(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('dibaca_pada', null);
  if (error) return 0;
  return count ?? 0;
}

export async function tandaiNotifikasiDibaca(id: string): Promise<WriteResult> {
  const { error } = await supabase
    .from('notifications')
    .update({ dibaca_pada: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function tandaiSemuaDibaca(): Promise<WriteResult> {
  const { error } = await supabase
    .from('notifications')
    .update({ dibaca_pada: new Date().toISOString() })
    .is('dibaca_pada', null);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Buat notifikasi yang memenuhi syarat (hanya untuk jenis yang diaktifkan). Aman dipanggil berulang. */
export async function sinkronkanNotifikasi(): Promise<WriteResult> {
  const { error } = await supabase.rpc('sinkronkan_notifikasi');
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Pengaturan notifikasi user. Jenis yang belum ada dianggap mati. */
export async function fetchPengaturanNotifikasi(): Promise<{ aktif: Record<JenisNotifikasi, boolean>; error: string | null }> {
  const aktif = Object.fromEntries(JENIS_NOTIFIKASI.map((j) => [j.jenis, false])) as Record<JenisNotifikasi, boolean>;
  const { data, error } = await supabase.from('notification_settings').select('jenis,aktif');
  if (error) return { aktif, error: error.message };
  for (const row of (data ?? []) as { jenis: JenisNotifikasi; aktif: boolean }[]) {
    if (row.jenis in aktif) aktif[row.jenis] = row.aktif;
  }
  return { aktif, error: null };
}

export async function simpanPengaturanNotifikasi(jenis: JenisNotifikasi, aktif: boolean): Promise<WriteResult> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { success: false, error: 'Belum masuk.' };
  const { error } = await supabase
    .from('notification_settings')
    .upsert({ user_id: userId, jenis, aktif }, { onConflict: 'user_id,jenis' });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
