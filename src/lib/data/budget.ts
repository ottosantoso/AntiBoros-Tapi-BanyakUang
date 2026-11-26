import { supabase } from '../supabase-client';
import type { TransactionType } from '../types';
import { toNumber, type WriteResult } from './shared';

/* ---------- Subkategori (baca), budget, dan goals ---------- */

export type Budgeting = 'Kebutuhan' | 'Keinginan' | 'Tabungan';

/** Kategori sistem: bukan pemasukan/pengeluaran riil untuk analisa 50/30/20. */
export const NON_REAL_KATEGORI = new Set(['Transfer', 'Penyesuaian Saldo']);

export interface Subkategori {
  id: string;
  nama: string;
  kategori: string;
  jenis: TransactionType;
  budgeting: Budgeting | null;
  /** Subkategori sistem (Transfer, Penyesuaian Saldo, Biaya Admin): tidak bisa diubah atau dinonaktifkan. */
  isSystem: boolean;
  aktif: boolean;
}

export interface SubkategoriDbRow {
  id: string;
  nama: string;
  kategori: string;
  jenis: string;
  budgeting: string | null;
  is_system?: boolean | null;
  aktif?: boolean | null;
}

export const SUBKATEGORI_COLUMNS = 'id,nama,kategori,jenis,budgeting,is_system,aktif';

export function subkategoriFromRow(r: SubkategoriDbRow): Subkategori {
  return {
    id: r.id,
    nama: r.nama,
    kategori: r.kategori,
    jenis: (r.jenis === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran') as TransactionType,
    budgeting: (r.budgeting as Budgeting | null) ?? null,
    isSystem: r.is_system === true,
    aktif: r.aktif !== false,
  };
}

export interface BudgetLimit {
  id: string;
  subkategoriId: string;
  limit: number;
}

export interface Goal {
  id: string;
  nama: string;
  target: number;
  terkumpul: number;
  deadline: string | null;
}

export interface BudgetData {
  subkategori: Subkategori[];
  budgets: BudgetLimit[];
  goals: Goal[];
  /** Pemasukan periode, tanpa kategori sistem (transfer antar dompet, penyesuaian saldo). */
  pemasukan: number;
  /** Pengeluaran periode per subkategori_id. */
  spentBySubkat: Record<string, number>;
  error: string | null;
}

interface BudgetDbRow {
  id: string;
  subkategori_id: string;
  limit_amount: number | string;
}

interface GoalDbRow {
  id: string;
  nama: string;
  target: number | string;
  terkumpul: number | string;
  deadline: string | null;
}

interface TxAggDbRow {
  tipe: string;
  nominal: number | string;
  subkategori_id: string | null;
  kategori: string | null;
  transfer_id: string | null;
}

export async function fetchBudgetData(range: { start: string; end: string }): Promise<BudgetData> {
  try {
    const [subRes, budRes, goalRes, txRes] = await Promise.all([
      supabase.from('subkategori').select(SUBKATEGORI_COLUMNS).order('nama', { ascending: true }),
      supabase.from('budgets').select('id,subkategori_id,limit_amount'),
      supabase.from('goals').select('id,nama,target,terkumpul,deadline').order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select('tipe,nominal,subkategori_id,kategori,transfer_id')
        .is('deleted_at', null)
        .gte('tanggal', range.start)
        .lte('tanggal', range.end),
    ]);
    if (subRes.error) throw subRes.error;
    if (budRes.error) throw budRes.error;
    if (goalRes.error) throw goalRes.error;
    if (txRes.error) throw txRes.error;

    const subkategori: Subkategori[] = ((subRes.data ?? []) as SubkategoriDbRow[])
      .map(subkategoriFromRow)
      .filter((s) => s.aktif);
    let pemasukan = 0;
    const spentBySubkat: Record<string, number> = {};
    for (const r of (txRes.data ?? []) as TxAggDbRow[]) {
      const nominal = toNumber(r.nominal);
      // Koreksi saldo dan sisi transfer antar dompet bukan uang masuk/keluar riil. Pemasukan dari pihak luar tetap dihitung.
      const isKoreksi = r.kategori === 'Penyesuaian Saldo';
      const isSisiTransfer = r.transfer_id !== null && r.kategori !== 'Biaya Admin';
      if (isKoreksi || isSisiTransfer) continue;
      if (r.tipe === 'Pemasukan') {
        pemasukan += nominal;
      } else if (r.subkategori_id) {
        spentBySubkat[r.subkategori_id] = (spentBySubkat[r.subkategori_id] ?? 0) + nominal;
      }
    }

    return {
      subkategori,
      budgets: ((budRes.data ?? []) as BudgetDbRow[]).map((r) => ({
        id: r.id,
        subkategoriId: r.subkategori_id,
        limit: toNumber(r.limit_amount),
      })),
      goals: ((goalRes.data ?? []) as GoalDbRow[]).map((r) => ({
        id: r.id,
        nama: r.nama,
        target: toNumber(r.target),
        terkumpul: toNumber(r.terkumpul),
        deadline: r.deadline,
      })),
      pemasukan,
      spentBySubkat,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat data budget.';
    return { subkategori: [], budgets: [], goals: [], pemasukan: 0, spentBySubkat: {}, error: message };
  }
}

export async function upsertBudgetLimit(subkategoriId: string, limit: number): Promise<WriteResult> {
  const { error } = await supabase
    .from('budgets')
    .upsert({ subkategori_id: subkategoriId, limit_amount: limit }, { onConflict: 'user_id,subkategori_id' });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteBudgetRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export interface GoalInput {
  nama: string;
  target: number;
  terkumpul?: number;
  deadline?: string | null;
}

export async function insertGoal(input: GoalInput): Promise<WriteResult> {
  const { error } = await supabase.from('goals').insert({
    nama: input.nama,
    target: input.target,
    terkumpul: input.terkumpul ?? 0,
    deadline: input.deadline ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function updateGoalRow(id: string, patch: Partial<GoalInput>): Promise<WriteResult> {
  const { error } = await supabase.from('goals').update(patch).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteGoalRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Daftar subkategori AKTIF, untuk dropdown transaksi dan pemetaan scanner. */
export async function fetchSubkategori(): Promise<Subkategori[]> {
  const { data, error } = await supabase
    .from('subkategori')
    .select(SUBKATEGORI_COLUMNS)
    .eq('aktif', true)
    .order('nama', { ascending: true });
  if (error || !data) return [];
  return (data as SubkategoriDbRow[]).map(subkategoriFromRow);
}

/**
 * Cocokkan teks kategori (dari AI scanner) ke subkategori yang ada.
 * Urutan: nama persis, lalu kategori persis, lalu fallback 'Lain-lain' (pengeluaran)
 * atau 'Pendapatan Lainnya' (pemasukan).
 */
export function matchSubkategori(
  list: Subkategori[],
  kategori: string,
  jenis: TransactionType,
): Subkategori | undefined {
  const k = kategori.trim().toLowerCase();
  const sameJenis = list.filter((s) => s.jenis === jenis);
  const exact =
    sameJenis.find((s) => s.nama.toLowerCase() === k) ??
    sameJenis.find((s) => s.kategori.toLowerCase() === k);
  if (exact) return exact;
  const fallbackNama = jenis === 'Pemasukan' ? 'Pendapatan Lainnya' : 'Lain-lain';
  return sameJenis.find((s) => s.nama === fallbackNama);
}
