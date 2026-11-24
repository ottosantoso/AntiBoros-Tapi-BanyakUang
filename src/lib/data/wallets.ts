import { supabase } from '../supabase-client';
import type { Wallet } from '../types';
import { toNumber, escapeLike, type WriteResult } from './shared';

/* ---------- Dompet: baca, tulis, arsip ---------- */

export interface WalletRow {
  id: string;
  nama: string;
  provider: string;
  saldo: number | string;
  jenis?: string | null;
  logo_url?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  created_at?: string | null;
}

export function walletFromRow(r: WalletRow): Wallet {
  return {
    id: r.id,
    nama: r.nama,
    provider: r.provider,
    saldo: toNumber(r.saldo),
    jenis: (r.jenis === 'ewallet' || r.jenis === 'lainnya' || r.jenis === 'tunai' ? r.jenis : 'bank') as Wallet['jenis'],
    logoUrl: r.logo_url ?? null,
  };
}

export interface WalletInput {
  nama: string;
  provider: string;
  saldo: number;
  jenis?: Wallet['jenis'];
  logo_url?: string | null;
}

/** Dompet arsip: sisa saldo dan riwayatnya tetap tersimpan. */
export interface ArchivedWallet extends Wallet {
  archivedAt: string | null;
}

/** Hasil pencarian nama dompet, termasuk yang sudah diarsip. */
export interface WalletNameMatch {
  id: string;
  nama: string;
  saldo: number;
  isArchived: boolean;
  createdAt: string | null;
}

/** Field yang boleh diubah dari menu edit. Saldo sengaja tidak ikut: saldo hanya berubah lewat transaksi dan transfer. */
export interface WalletEditInput {
  nama: string;
  provider: string;
  jenis: Wallet['jenis'];
  logo_url: string | null;
}

/** Unggah logo dompet ke bucket publik. Hanya untuk pengguna yang sudah masuk. */
export async function uploadWalletLogo(file: File): Promise<{ url: string | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { url: null, error: 'Sesi tidak ditemukan. Masuk ulang.' };

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, '-');
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('wallet-logos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from('wallet-logos').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export async function insertWallet(input: WalletInput): Promise<WriteResult> {
  const { error } = await supabase.from('wallets').insert(input);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function updateWalletRow(id: string, input: WalletEditInput): Promise<WriteResult> {
  const { error } = await supabase.from('wallets').update(input).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Cari dompet dengan nama yang sama (tanpa membedakan huruf besar kecil), aktif maupun arsip. */
export async function findWalletsByName(
  nama: string,
): Promise<{ matches: WalletNameMatch[]; error: string | null }> {
  const { data, error } = await supabase
    .from('wallets')
    .select('id, nama, saldo, is_archived, created_at')
    .ilike('nama', escapeLike(nama.trim()));
  if (error) return { matches: [], error: error.message };
  const matches = ((data ?? []) as WalletRow[]).map((r) => ({
    id: r.id,
    nama: r.nama,
    saldo: toNumber(r.saldo),
    isArchived: Boolean(r.is_archived),
    createdAt: r.created_at ?? null,
  }));
  return { matches, error: null };
}

/** Daftar dompet diarsip, yang terbaru diarsip di atas. */
export async function fetchArchivedWallets(): Promise<{ wallets: ArchivedWallet[]; error: string | null }> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('is_archived', true)
    .order('archived_at', { ascending: false });
  if (error) return { wallets: [], error: error.message };
  const wallets = ((data ?? []) as WalletRow[]).map((r) => ({
    ...walletFromRow(r),
    archivedAt: r.archived_at ?? null,
  }));
  return { wallets, error: null };
}

/** Arsipkan dompet. Saldonya tetap tersimpan dan dompet tidak bisa dipakai untuk transaksi baru. */
export async function archiveWalletRow(id: string): Promise<WriteResult> {
  const { error } = await supabase
    .from('wallets')
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Pulihkan dompet arsip. Extra bisa dipakai untuk mengganti provider atau logo saat dipulihkan. */
export async function restoreWalletRow(
  id: string,
  extra?: { provider?: string; jenis?: Wallet['jenis']; logo_url?: string | null },
): Promise<WriteResult> {
  const { error } = await supabase
    .from('wallets')
    .update({ is_archived: false, archived_at: null, ...extra })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Ganti nama dompet (dipakai saat dompet arsip perlu diberi nama baru). */
export async function renameWalletRow(id: string, nama: string): Promise<WriteResult> {
  const { error } = await supabase.from('wallets').update({ nama }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/**
 * Hapus dompet. Jika `moveTo` diberikan, transaksi milik dompet ini
 * dipindahkan dulu ke dompet tujuan agar riwayat tidak hilang.
 */
export async function deleteWalletRow(id: string, moveTo?: string): Promise<WriteResult> {
  if (moveTo) {
    const { error: moveErr } = await supabase
      .from('transactions')
      .update({ wallet_id: moveTo })
      .eq('wallet_id', id);
    if (moveErr) return { success: false, error: moveErr.message };
  }
  const { error } = await supabase.from('wallets').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function countTransactionsForWallet(walletId: string): Promise<number> {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_id', walletId);
  if (error) return 0;
  return count ?? 0;
}
