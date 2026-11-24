import { supabase } from '../supabase-client';
import type { TransactionType } from '../types';
import { toNumber, type WriteResult } from './shared';

/* ---------- Transaksi berulang ---------- */

export interface BerulangItem {
  id: string;
  nama: string;
  tipe: TransactionType;
  nominal: number;
  walletId: string;
  subkategoriId: string | null;
  hariJatuhTempo: number;
  terakhirDicatat: string | null;
  aktif: boolean;
}

export interface BerulangInput {
  nama: string;
  tipe: TransactionType;
  nominal: number;
  walletId: string;
  subkategoriId: string | null;
  hariJatuhTempo: number;
  tanggalMulai: string;
}

interface BerulangDbRow {
  id: string;
  nama: string;
  tipe: string;
  nominal: number | string;
  wallet_id: string;
  subkategori_id: string | null;
  hari_jatuh_tempo: number;
  terakhir_dicatat: string | null;
  aktif: boolean;
}

export async function fetchBerulang(): Promise<{ data: BerulangItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('transaksi_berulang')
    .select('id,nama,tipe,nominal,wallet_id,subkategori_id,hari_jatuh_tempo,terakhir_dicatat,aktif')
    .order('created_at', { ascending: true });
  if (error) return { data: [], error: error.message };
  return {
    data: ((data ?? []) as BerulangDbRow[]).map((r) => ({
      id: r.id,
      nama: r.nama,
      tipe: (r.tipe === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran') as TransactionType,
      nominal: toNumber(r.nominal),
      walletId: r.wallet_id,
      subkategoriId: r.subkategori_id,
      hariJatuhTempo: r.hari_jatuh_tempo,
      terakhirDicatat: r.terakhir_dicatat,
      aktif: r.aktif,
    })),
    error: null,
  };
}

export async function insertBerulang(input: BerulangInput): Promise<WriteResult> {
  const { error } = await supabase.from('transaksi_berulang').insert({
    nama: input.nama.trim(),
    tipe: input.tipe,
    nominal: input.nominal,
    wallet_id: input.walletId,
    subkategori_id: input.subkategoriId,
    hari_jatuh_tempo: input.hariJatuhTempo,
    tanggal_mulai: input.tanggalMulai,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function updateBerulangAktif(id: string, aktif: boolean): Promise<WriteResult> {
  const { error } = await supabase.from('transaksi_berulang').update({ aktif }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteBerulangRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('transaksi_berulang').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
