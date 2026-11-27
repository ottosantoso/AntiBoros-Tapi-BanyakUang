import { supabase } from '../supabase-client';
import { toNumber, type WriteResult } from './shared';

/* ---------- Utang, piutang, dan cicilan ---------- */

export type JenisUtang = 'utang' | 'piutang' | 'cicilan';
export type MetodeBunga = 'flat' | 'anuitas' | 'tanpa_bunga';
export type StatusAngsuran = 'belum' | 'lunas' | 'terlambat';

/** Satu baris riwayat (utang/piutang) atau jadwal angsuran (cicilan). */
export interface Angsuran {
  id: string;
  nomor: number;
  jatuhTempo: string;
  /** Tanggal pembayaran. Kosong kalau belum dibayar. */
  dibayarPada: string;
  pokok: number;
  bunga: number;
  status: StatusAngsuran;
}

export interface Utang {
  id: string;
  jenis: JenisUtang;
  pihak: string;
  pokok: number;
  /** Pokok yang sudah dibayar (hanya baris berstatus lunas). */
  terbayar: number;
  sisa: number;
  tanggalMulai: string;
  status: 'aktif' | 'lunas' | 'dibatalkan';
  catatan: string | null;
  walletId: string | null;
  bungaPersen: number;
  metodeBunga: MetodeBunga;
  tenorBulan: number | null;
  hariJatuhTempo: number | null;
  /** Semua baris, diurutkan dari nomor terkecil. */
  angsuran: Angsuran[];
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
  bunga_persen: number | string;
  metode_bunga: MetodeBunga;
  tenor_bulan: number | null;
  hari_jatuh_tempo: number | null;
  debt_payments: {
    id: string;
    nomor: number;
    jatuh_tempo: string;
    dibayar_pada: string | null;
    jumlah_pokok: number | string;
    jumlah_bunga: number | string;
    status: StatusAngsuran;
  }[];
}

export async function fetchUtang(): Promise<{ items: Utang[]; error: string | null }> {
  const { data, error } = await supabase
    .from('debts')
    .select(
      'id,jenis,pihak,pokok,tanggal_mulai,status,catatan,wallet_id,bunga_persen,metode_bunga,tenor_bulan,hari_jatuh_tempo,created_at,debt_payments(id,nomor,jatuh_tempo,dibayar_pada,jumlah_pokok,jumlah_bunga,status)',
    )
    .order('created_at', { ascending: false });
  if (error) return { items: [], error: error.message };

  const items = ((data ?? []) as DebtDbRow[]).map((r): Utang => {
    const pokok = toNumber(r.pokok);
    const angsuran = [...(r.debt_payments ?? [])]
      .sort((a, b) => a.nomor - b.nomor)
      .map((p): Angsuran => ({
        id: p.id,
        nomor: p.nomor,
        jatuhTempo: p.jatuh_tempo,
        dibayarPada: p.dibayar_pada ?? '',
        pokok: toNumber(p.jumlah_pokok),
        bunga: toNumber(p.jumlah_bunga),
        status: p.status,
      }));
    const terbayar = angsuran.filter((a) => a.status === 'lunas').reduce((s, a) => s + a.pokok, 0);
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
      bungaPersen: toNumber(r.bunga_persen),
      metodeBunga: r.metode_bunga,
      tenorBulan: r.tenor_bulan,
      hariJatuhTempo: r.hari_jatuh_tempo,
      angsuran,
    };
  });
  return { items, error: null };
}

export interface CatatUtangInput {
  jenis: Exclude<JenisUtang, 'cicilan'>;
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

export interface BuatCicilanInput {
  pihak: string;
  pokok: number;
  bungaPersen: number;
  metode: MetodeBunga;
  tenor: number;
  tanggalMulai: string;
  hariJatuhTempo: number;
  walletId: string;
  catatan?: string;
}

/** Buat cicilan beserta seluruh jadwal angsuran dalam satu RPC. */
export async function buatCicilan(input: BuatCicilanInput): Promise<WriteResult> {
  const { error } = await supabase.rpc('buat_cicilan', {
    p_pihak: input.pihak,
    p_pokok: input.pokok,
    p_bunga_persen: input.bungaPersen,
    p_metode: input.metode,
    p_tenor: input.tenor,
    p_tanggal_mulai: input.tanggalMulai,
    p_hari_jatuh_tempo: input.hariJatuhTempo,
    p_wallet: input.walletId,
    p_catatan: input.catatan ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Bayar satu angsuran cicilan. Pokok dan bunga masing-masing menjadi transaksi. */
export async function bayarAngsuran(paymentId: string, walletId: string, tanggal: string): Promise<WriteResult> {
  const { error } = await supabase.rpc('bayar_angsuran', {
    p_payment: paymentId,
    p_wallet: walletId,
    p_tanggal: tanggal,
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
