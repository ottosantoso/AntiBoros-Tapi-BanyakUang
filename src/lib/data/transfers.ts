import { supabase } from '../supabase-client';
import type { NewTransferInput, WalletTransfer } from '../types';
import { toNumber, type WriteResult } from './shared';

/* ---------- Transfer antar dompet ---------- */

export async function insertTransfer(input: NewTransferInput): Promise<WriteResult> {
  const { error } = await supabase.from('wallet_transfers').insert({
    tanggal: input.tanggal,
    from_wallet_id: input.fromWalletId,
    to_wallet_id: input.toWalletId,
    nominal: input.nominal,
    biaya_admin: input.biayaAdmin ?? 0,
    catatan: input.catatan || null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteTransferRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('wallet_transfers').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function fetchTransfers(): Promise<{ transfers: WalletTransfer[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('wallet_transfers')
      .select(
        `id, tanggal, nominal, biaya_admin, catatan, created_at,
         from:wallets!wallet_transfers_from_wallet_id_fkey(id, nama),
         to:wallets!wallet_transfers_to_wallet_id_fkey(id, nama)`,
      )
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    type TransferRow = {
      id: string;
      tanggal: string;
      nominal: number | string;
      biaya_admin: number | string;
      catatan: string | null;
      created_at: string | null;
      from: { id: string; nama: string } | null;
      to: { id: string; nama: string } | null;
    };
    const transfers: WalletTransfer[] = ((data ?? []) as unknown as TransferRow[]).map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      fromWalletId: r.from?.id ?? '',
      fromWallet: r.from?.nama ?? 'Tanpa Dompet',
      toWalletId: r.to?.id ?? '',
      toWallet: r.to?.nama ?? 'Tanpa Dompet',
      nominal: toNumber(r.nominal),
      biayaAdmin: toNumber(r.biaya_admin),
      catatan: r.catatan ?? undefined,
      createdAt: r.created_at ?? undefined,
    }));
    return { transfers, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat data transfer.';
    return { transfers: [], error: msg };
  }
}
