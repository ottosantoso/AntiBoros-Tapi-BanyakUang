import { supabase } from '../supabase-client';
import { toNumber, type WriteResult } from './shared';
import { defaultKelompok, type Kelompok } from '../rencana-math';

/* ---------- Rencana bulanan ---------- */

export type RencanaStatus = 'draft' | 'aktif' | 'ditutup';
export type RencanaJenis = 'pemasukan' | 'pengeluaran';

export interface RencanaItem {
  id: string;
  jenis: RencanaJenis;
  nama: string;
  nominal: number;
  kategori: string | null;
  /** Kelompok 50/30/20. Hanya untuk pengeluaran, null untuk pemasukan. */
  kelompok: Kelompok | null;
}

export interface Rencana {
  id: string;
  /** Tanggal pertama bulan, format YYYY-MM-DD. */
  bulan: string;
  nama: string;
  status: RencanaStatus;
  catatan: string | null;
  items: RencanaItem[];
}

export interface RencanaInput {
  bulan: string;
  nama: string;
  catatan?: string | null;
}

export interface RencanaItemInput {
  jenis: RencanaJenis;
  nama: string;
  nominal: number;
  kategori: string | null;
  kelompok: Kelompok | null;
}

interface RencanaDbRow {
  id: string;
  bulan: string;
  nama: string;
  status: string;
  catatan: string | null;
  rencana_item: {
    id: string;
    jenis: string;
    nama: string;
    nominal: number | string;
    kategori: string | null;
    kelompok: string | null;
  }[] | null;
}

function mapStatus(value: string): RencanaStatus {
  return value === 'aktif' || value === 'ditutup' ? value : 'draft';
}

function mapKelompok(value: string | null): Kelompok | null {
  return value === 'kebutuhan' || value === 'keinginan' || value === 'investasi' ? value : null;
}

function messageFor(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Sudah ada rencana untuk bulan ini.';
  return error.message;
}

export async function fetchRencanaList(): Promise<{ data: Rencana[]; error: string | null }> {
  const { data, error } = await supabase
    .from('rencana_bulanan')
    .select('id,bulan,nama,status,catatan,rencana_item(id,jenis,nama,nominal,kategori,kelompok)')
    .order('bulan', { ascending: false });
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as unknown as RencanaDbRow[]).map((r) => ({
      id: r.id,
      bulan: r.bulan,
      nama: r.nama,
      status: mapStatus(r.status),
      catatan: r.catatan,
      items: (r.rencana_item ?? []).map((i) => ({
        id: i.id,
        jenis: i.jenis === 'pemasukan' ? 'pemasukan' : 'pengeluaran',
        nama: i.nama,
        nominal: toNumber(i.nominal),
        kategori: i.kategori,
        kelompok: i.jenis === 'pengeluaran' ? mapKelompok(i.kelompok) ?? defaultKelompok(i.kategori) : null,
      })),
    })),
    error: null,
  };
}

export async function createRencana(input: RencanaInput): Promise<WriteResult & { id: string | null }> {
  const { data, error } = await supabase
    .from('rencana_bulanan')
    .insert({ bulan: input.bulan, nama: input.nama, catatan: input.catatan ?? null, status: 'draft' })
    .select('id')
    .single();
  if (error) return { success: false, error: messageFor(error), id: null };
  return { success: true, error: null, id: (data as { id: string }).id };
}

export async function updateRencana(
  id: string,
  patch: Partial<Pick<RencanaInput, 'nama' | 'catatan'>> & { status?: RencanaStatus },
): Promise<WriteResult> {
  const { error } = await supabase
    .from('rencana_bulanan')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, error: messageFor(error) };
  return { success: true, error: null };
}

export async function deleteRencana(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('rencana_bulanan').delete().eq('id', id);
  if (error) return { success: false, error: messageFor(error) };
  return { success: true, error: null };
}

export async function insertRencanaItem(rencanaId: string, input: RencanaItemInput): Promise<WriteResult> {
  const { error } = await supabase.from('rencana_item').insert({
    rencana_id: rencanaId,
    jenis: input.jenis,
    nama: input.nama,
    nominal: input.nominal,
    kategori: input.jenis === 'pengeluaran' ? input.kategori : null,
    kelompok: input.jenis === 'pengeluaran' ? input.kelompok ?? 'kebutuhan' : null,
  });
  if (error) return { success: false, error: messageFor(error) };
  return { success: true, error: null };
}

export async function updateRencanaItemKelompok(id: string, kelompok: Kelompok): Promise<WriteResult> {
  const { error } = await supabase.from('rencana_item').update({ kelompok }).eq('id', id);
  if (error) return { success: false, error: messageFor(error) };
  return { success: true, error: null };
}

export async function deleteRencanaItem(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('rencana_item').delete().eq('id', id);
  if (error) return { success: false, error: messageFor(error) };
  return { success: true, error: null };
}
