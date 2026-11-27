import type { ScanPayload, ScanReceipt, ScanMutasi, ScanResult, ScanRow, TransactionType } from './types';
import { supabaseConfigured } from './supabase-client';
import { invokeAi } from './ai-invoke';

export interface ScanResponseResult {
  success: boolean;
  data: ScanResult | null;
  error: string | null;
}

/** Kirim gambar ke Edge Function `scan-image` untuk dibaca AI. */
export async function scanImage(payload: ScanPayload): Promise<ScanResponseResult> {
  if (!supabaseConfigured) {
    return { success: false, data: null, error: 'Koneksi Supabase belum diatur.' };
  }

  try {
    const { data, error } = await invokeAi<{
      status?: string;
      data?: ScanResult;
      message?: string;
    }>('scan', 'scan-image', {
      body: { imageType: payload.imageType, imageBase64: payload.imageBase64 },
    });

    if (error) {
      return { success: false, data: null, error: `Gagal memindai: ${error.message}` };
    }
    if (data?.status === 'success' && data.data) {
      return { success: true, data: normaliseScanResult(data.data, payload.imageType), error: null };
    }
    return {
      success: false,
      data: null,
      error: data?.message ?? 'AI tidak dapat membaca dokumen ini. Coba foto lain.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal terhubung ke server.';
    return { success: false, data: null, error: `Gagal memindai: ${msg}` };
  }
}

function toTransactionType(v: unknown): TransactionType {
  const s = String(v ?? '').toLowerCase();
  if (s === 'pemasukan' || s === 'income' || s === 'kredit' || s === '+') return 'Pemasukan';
  return 'Pengeluaran';
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  const cleaned = String(v ?? '').replace(/[^0-9-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function toString(v: unknown, fallback = ''): string {
  const s = v == null ? '' : String(v);
  return s.trim() || fallback;
}

function toISODateVal(v: unknown): string {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/** Normalise the AI scan payload into a consistent shape the UI can render. */
function normaliseScanResult(raw: ScanResult, imageType: 'struk' | 'mutasi'): ScanResult {
  if (imageType === 'struk') {
    const r = raw as Partial<ScanReceipt>;
    const items = Array.isArray(r.items)
      ? r.items
          .map((it) => ({
            nama: toString(it?.nama, 'Barang'),
            nominal: toNumber(it?.nominal),
            kategori: toString(it?.kategori, 'Lainnya'),
          }))
          .filter((it) => it.nominal > 0)
      : [];
    return {
      imageType: 'struk',
      nominal: toNumber(r.nominal),
      deskripsi: toString(r.deskripsi, 'Struk Belanja'),
      tanggal: toISODateVal(r.tanggal),
      kategori: toString(r.kategori, 'Lainnya'),
      jenis: toTransactionType(r.jenis),
      items,
    } satisfies ScanReceipt;
  }
  const m = raw as Partial<ScanMutasi>;
  const transaksi = Array.isArray(m.transaksi)
    ? m.transaksi.map((t: Partial<ScanRow>) => ({
        tanggal: toISODateVal(t.tanggal),
        deskripsi: toString(t.deskripsi, 'Transaksi'),
        nominal: toNumber(t.nominal),
        jenis: toTransactionType(t.jenis),
        kategori: toString(t.kategori, 'Lainnya'),
      }))
    : [];
  return {
    imageType: 'mutasi',
    transaksi,
  } satisfies ScanMutasi;
}
