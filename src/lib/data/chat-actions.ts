import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

/* ---------- Asisten Pencatat: draf transaksi dari chat ---------- */

/** Isi draf catat_transaksi. Sudah divalidasi parser lokal; server memeriksa ulang di confirm_chat_action. */
export interface CatatTransaksiPayload {
  tanggal: string;
  deskripsi: string;
  tipe: 'Pemasukan' | 'Pengeluaran';
  nominal: number;
  walletId: string;
  walletNama: string;
  kategori: string;
  subkategoriId: string | null;
}

/** Simpan draf sebagai status pending. Belum masuk ke transactions. */
export async function createCatatAction(
  payload: CatatTransaksiPayload,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('chat_actions')
    .insert({ jenis: 'catat_transaksi', payload })
    .select('id')
    .single();
  if (error || !data) return { id: null, error: error?.message ?? 'Draf tidak tersimpan.' };
  return { id: (data as { id: string }).id, error: null };
}

/** Ubah draf menjadi transaksi lewat RPC. Gagal bila draf sudah kedaluwarsa atau sudah diproses. */
export async function confirmChatAction(id: string): Promise<WriteResult> {
  const { error } = await supabase.rpc('confirm_chat_action', { p_id: id });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Batalkan draf yang masih pending. Draf lain tidak terpengaruh. */
export async function cancelChatAction(id: string): Promise<WriteResult> {
  const { error } = await supabase
    .from('chat_actions')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
