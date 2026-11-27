import { supabase } from '../supabase-client';
import { toNumber, type WriteResult } from './shared';

/* ---------- Utang & piutang (fase 1: tanpa bunga, tanpa jadwal cicilan) ---------- */

export type JenisUtang = 'utang' | 'piutang';

export interface PembayaranUtang {
  id: string;
  nomor: number;
  tanggal: string;
  jumlah: number;
  transactionId: string | null;
}

export interface Utang {
  id: string;
  jenis: JenisUtang;
  pihak: string;
  pokok: number;
  terbayar: number;
  sisa: number;
  tanggalMulai: string;
  status: 'aktif' | 'lunas' | 'dibatalkan';
  catatan: string | null;
  walletId: string | null;
  pembayaran: PembayaranUtang[];
}

interface DebtDbRow {
  id: string;
  jenis: JenisUtang;
  pihak: string;
  pokok: number | string;
  tanggal_mulai: string;
  status: Utang['status'];
  catatan: string | null;
  wallet_id: string | null;
  debt_payments: {
    id: string;
    nomor: number;
    dibayar_pada: string | null;
    jumlah_pokok: number | string;
    transaction_id: string | null;
  }[];
}

export async function fetchUtang(): Promise<{ items: Utang[]; error: string | null }> {
  const { data, error } = await supabase
    .from('debts')
    .select(
      'id,jenis,pihak,pokok,tanggal_mulai,status,catatan,wallet_id,created_at,debt_payments(id,nomor,dibayar_pada,jumlah_pokok,transaction_id)',
    )
    .order('created_at', { ascending: false });
  if (error) return { items: [], error: error.message };

  const items = ((data ?? []) as DebtDbRow[]).map((r): Utang => {
    const pokok = toNumber(r.pokok);
    const pembayaran = [...(r.debt_payments ?? [])]
      .sort((a, b) => a.nomor - b.nomor)
      .map((p) => ({
        id: p.id,
        nomor: p.nomor,
        tanggal: p.dibayar_pada ?? '',
        jumlah: toNumber(p.jumlah_pokok),
        transactionId: p.transaction_id,
      }));
    const terbayar = pembayaran.reduce((s, p) => s + p.jumlah, 0);
    return {
      id: r.id,
      jenis: r.jenis,
      pihak: r.pihak,
      pokok,
      terbayar,
      sisa: Math.max(0, pokok - terbayar),
      tanggalMulai: r.tanggal_mulai,
      status: r.status,
      catatan: r.catatan,
      walletId: r.wallet_id,
      pembayaran,
    };
  });
  return { items, error: null };
}

export interface CatatUtangInput {
  jenis: JenisUtang;
  pihak: string;
  pokok: number;
  tanggal: string;
  walletId: string;
  catatan?: string;
}

/** Catat utang atau piutang baru. Baris utang dan transaksinya dibuat dalam satu RPC. */
export async function catatUtang(input: CatatUtangInput): Promise<WriteResult> {
  const { error } = await supabase.rpc('catat_utang', {
    p_jenis: input.jenis,
    p_pihak: input.pihak,
    p_pokok: input.pokok,
    p_tanggal: input.tanggal,
    p_wallet: input.walletId,
    p_catatan: input.catatan ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Bayar angsuran utang, atau terima pelunasan piutang. Angsuran dan transaksinya dibuat dalam satu RPC. */
export async function bayarUtang(
  debtId: string,
  jumlah: number,
  tanggal: string,
  walletId: string,
): Promise<WriteResult> {
  const { error } = await supabase.rpc('bayar_utang', {
    p_debt: debtId,
    p_jumlah: jumlah,
    p_tanggal: tanggal,
    p_wallet: walletId,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
