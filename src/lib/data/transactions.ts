import { supabase } from '../supabase-client';
import type { Transaction, TransactionType } from '../types';
import { toNumber, type WriteResult } from './shared';

/* ---------- Transaksi: baca dan tulis ---------- */

export interface TransactionRow {
  id: string;
  tanggal: string;
  deskripsi: string;
  tipe: string;
  nominal: number | string;
  kategori: string | null;
  wallet_id: string | null;
  berulang: boolean | null;
  transfer_id: string | null;
  subkategori_id?: string | null;
  created_at: string | null;
}

export function transactionFromRow(r: TransactionRow): Transaction {
  return {
    id: r.id,
    tanggal: r.tanggal,
    deskripsi: r.deskripsi,
    tipe: (r.tipe === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran') as TransactionType,
    nominal: toNumber(r.nominal),
    kategori: r.kategori ?? undefined,
    walletId: r.wallet_id ?? undefined,
    berulang: r.berulang ?? false,
    transferId: r.transfer_id ?? undefined,
    subkategoriId: r.subkategori_id ?? undefined,
    createdAt: r.created_at ?? undefined,
    dompet: '',
  };
}

export interface NewTransactionInput {
  tanggal: string;
  deskripsi: string;
  tipe: TransactionType;
  nominal: number;
  walletId: string;
  kategori?: string;
  subkategoriId?: string | null;
  berulang?: boolean;
}

export type UpdateTransactionInput = Partial<NewTransactionInput>;

export async function insertTransaction(input: NewTransactionInput): Promise<WriteResult> {
  const { error } = await supabase.from('transactions').insert({
    tanggal: input.tanggal,
    deskripsi: input.deskripsi,
    tipe: input.tipe,
    nominal: input.nominal,
    kategori: input.kategori || null,
    subkategori_id: input.subkategoriId || null,
    wallet_id: input.walletId || null,
    berulang: input.berulang ?? false,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function updateTransactionRow(
  id: string,
  input: UpdateTransactionInput,
): Promise<WriteResult> {
  const patch: Record<string, unknown> = {};
  if (input.tanggal !== undefined) patch.tanggal = input.tanggal;
  if (input.deskripsi !== undefined) patch.deskripsi = input.deskripsi;
  if (input.tipe !== undefined) patch.tipe = input.tipe;
  if (input.nominal !== undefined) patch.nominal = input.nominal;
  if (input.kategori !== undefined) patch.kategori = input.kategori || null;
  if (input.subkategoriId !== undefined) patch.subkategori_id = input.subkategoriId || null;
  if (input.walletId !== undefined) patch.wallet_id = input.walletId || null;
  if (input.berulang !== undefined) patch.berulang = input.berulang;
  const { error } = await supabase.from('transactions').update(patch).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteTransactionRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteTransactionsBulk(ids: string[]): Promise<WriteResult> {
  if (!ids.length) return { success: true, error: null };
  const { error } = await supabase.from('transactions').delete().in('id', ids);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Simpan banyak transaksi sekaligus (hasil AI scan mutasi). */
export async function insertTransactions(
  inputs: NewTransactionInput[],
): Promise<WriteResult & { saved: number }> {
  if (!inputs.length) return { success: true, error: null, saved: 0 };
  const { error } = await supabase
    .from('transactions')
    .insert(
      inputs.map((i) => ({
        tanggal: i.tanggal,
        deskripsi: i.deskripsi,
        tipe: i.tipe,
        nominal: i.nominal,
        kategori: i.kategori || null,
        subkategori_id: i.subkategoriId || null,
        wallet_id: i.walletId || null,
      })),
    );
  if (error) return { success: false, error: error.message, saved: 0 };
  return { success: true, error: null, saved: inputs.length };
}
