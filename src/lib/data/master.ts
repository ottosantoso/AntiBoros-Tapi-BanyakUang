import { supabase } from '../supabase-client';
import type { TransactionType } from '../types';
import type { WriteResult } from './shared';
import { SUBKATEGORI_COLUMNS, subkategoriFromRow, type Budgeting, type Subkategori, type SubkategoriDbRow } from './budget';

/* ---------- Master kategori dan subkategori (Pengaturan) ---------- */

export type JenisMaster = 'Pengeluaran' | 'Pemasukan';

export interface KategoriMaster {
  id: string;
  nama: string;
  jenis: JenisMaster;
  isSystem: boolean;
  aktif: boolean;
}

interface KategoriDbRow {
  id: string;
  nama: string;
  jenis: string;
  is_system: boolean | null;
  aktif: boolean | null;
}

/** Semua subkategori termasuk yang nonaktif, untuk halaman Pengaturan. */
export async function fetchSubkategoriSemua(): Promise<{ data: Subkategori[]; error: string | null }> {
  const { data, error } = await supabase
    .from('subkategori')
    .select(SUBKATEGORI_COLUMNS)
    .order('nama', { ascending: true });
  if (error) return { data: [], error: error.message };
  return { data: ((data ?? []) as SubkategoriDbRow[]).map(subkategoriFromRow), error: null };
}

/** Semua kategori master (level 1) termasuk yang nonaktif. */
export async function fetchKategoriMaster(): Promise<{ data: KategoriMaster[]; error: string | null }> {
  const { data, error } = await supabase
    .from('kategori')
    .select('id,nama,jenis,is_system,aktif')
    .order('urutan', { ascending: true });
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as KategoriDbRow[]).map((r) => ({
      id: r.id,
      nama: r.nama,
      jenis: (r.jenis === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran') as JenisMaster,
      isSystem: r.is_system === true,
      aktif: r.aktif !== false,
    })),
    error: null,
  };
}

export async function insertKategori(input: { nama: string; jenis: JenisMaster }): Promise<WriteResult> {
  const { error } = await supabase.from('kategori').insert({ nama: input.nama.trim(), jenis: input.jenis });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function updateKategoriRow(id: string, patch: { nama?: string; aktif?: boolean }): Promise<WriteResult> {
  const body: Record<string, unknown> = {};
  if (patch.nama !== undefined) body.nama = patch.nama.trim();
  if (patch.aktif !== undefined) body.aktif = patch.aktif;
  const { error } = await supabase.from('kategori').update(body).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteKategoriRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('kategori').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export interface SubkategoriInput {
  nama: string;
  kategori: string;
  jenis: TransactionType;
  budgeting: Budgeting | null;
}

export async function insertSubkategori(input: SubkategoriInput): Promise<WriteResult> {
  const { error } = await supabase.from('subkategori').insert({
    nama: input.nama.trim(),
    kategori: input.kategori,
    jenis: input.jenis,
    budgeting: input.jenis === 'Pemasukan' ? null : input.budgeting,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function updateSubkategoriRow(
  id: string,
  patch: Partial<Pick<SubkategoriInput, 'nama' | 'kategori' | 'budgeting'>> & { aktif?: boolean },
): Promise<WriteResult> {
  const body: Record<string, unknown> = {};
  if (patch.nama !== undefined) body.nama = patch.nama.trim();
  if (patch.kategori !== undefined) body.kategori = patch.kategori;
  if (patch.budgeting !== undefined) body.budgeting = patch.budgeting;
  if (patch.aktif !== undefined) body.aktif = patch.aktif;
  const { error } = await supabase.from('subkategori').update(body).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Hapus subkategori. Ditolak database jika subkategori sistem. Transaksi lama tetap, subkategorinya kosong. */
export async function deleteSubkategoriRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('subkategori').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
