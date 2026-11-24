import { supabase } from '../supabase-client';
import type { MonthlyTrend } from '../types';
import { shortMonth } from '../format';

/* ---------- Analisa: laporan satu periode dan insight AI ---------- */

export interface AnalisaKategori {
  kategori: string;
  total: number;
  /** Persen terhadap total pengeluaran periode. */
  persen: number;
}

export interface AnalisaTopItem {
  id: string;
  tanggal: string;
  deskripsi: string;
  nominal: number;
  kategori: string;
}

export interface AnalisaSumber {
  kategori: string;
  total: number;
}

export interface AnalisaData {
  pemasukan: number;
  pengeluaran: number;
  sisaBersih: number;
  /** Null bila pemasukan periode 0. */
  rasioTabungan: number | null;
  perKategori: AnalisaKategori[];
  topPengeluaran: AnalisaTopItem[];
  /** Enam bulan yang berakhir di bulan akhir periode. */
  tren: MonthlyTrend[];
  sumberPemasukan: AnalisaSumber[];
  /** Transfer antar dompet: tidak dihitung sebagai pemasukan/pengeluaran. */
  transfer: { jumlah: number; total: number; biayaAdmin: number };
}

export interface AnalisaResult {
  data: AnalisaData | null;
  error: string | null;
}

type JsonObject = Record<string, unknown>;

function asObject(v: unknown): JsonObject {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObject) : {};
}

function asArray(v: unknown): JsonObject[] {
  return Array.isArray(v) ? v.map(asObject) : [];
}

function asNumber(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Ringkasan laporan satu periode. Tanggal berformat YYYY-MM-DD. */
export async function fetchAnalisa(range: { start: string; end: string }): Promise<AnalisaResult> {
  try {
    const { data, error } = await supabase.rpc('report_summary', { p_from: range.start, p_to: range.end });
    if (error) throw error;

    const r = asObject(data);
    const aliran = asObject(r.aliran_dana);
    const transfer = asObject(aliran.transfer);
    const rasio = r.rasio_tabungan;

    const tren: MonthlyTrend[] = asArray(r.tren_6_bulan).map((x) => {
      const bulan = asText(x.bulan);
      const idx = Number(bulan.slice(5, 7)) - 1;
      return {
        bulan: idx >= 0 && idx < 12 ? shortMonth(idx) : bulan,
        pemasukan: asNumber(x.pemasukan),
        pengeluaran: asNumber(x.pengeluaran),
      };
    });

    return {
      data: {
        pemasukan: asNumber(r.pemasukan),
        pengeluaran: asNumber(r.pengeluaran),
        sisaBersih: asNumber(r.sisa_bersih),
        rasioTabungan: rasio === null || rasio === undefined ? null : asNumber(rasio),
        perKategori: asArray(r.per_kategori).map((x) => ({
          kategori: asText(x.kategori) || 'Tanpa kategori',
          total: asNumber(x.total),
          persen: asNumber(x.persen),
        })),
        topPengeluaran: asArray(r.top_pengeluaran).map((x) => ({
          id: asText(x.id),
          tanggal: asText(x.tanggal),
          deskripsi: asText(x.deskripsi),
          nominal: asNumber(x.nominal),
          kategori: asText(x.kategori) || 'Tanpa kategori',
        })),
        tren,
        sumberPemasukan: asArray(aliran.sumber_pemasukan).map((x) => ({
          kategori: asText(x.kategori) || 'Tanpa kategori',
          total: asNumber(x.total),
        })),
        transfer: {
          jumlah: asNumber(transfer.jumlah),
          total: asNumber(transfer.total),
          biayaAdmin: asNumber(transfer.biaya_admin),
        },
      },
      error: null,
    };
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : 'Gagal memuat analisa.';
    return { data: null, error: message };
  }
}

export interface AiAnalysisResult {
  data: { insights: string[]; hemat: string[] } | null;
  error: string | null;
}

/** Minta insight AI untuk satu periode. Hanya ringkasan angka yang dikirim, bukan detail transaksi. */
export async function fetchAiAnalysis(payload: {
  periode: string;
  data: AnalisaData;
}): Promise<AiAnalysisResult> {
  try {
    const d = payload.data;
    const { data, error } = await supabase.functions.invoke<{
      status?: string;
      data?: { insights?: string[]; hemat?: string[] };
      message?: string;
    }>('ai-analysis', {
      body: {
        periode: payload.periode,
        pemasukan: d.pemasukan,
        pengeluaran: d.pengeluaran,
        sisaBersih: d.sisaBersih,
        rasioTabungan: d.rasioTabungan,
        perKategori: d.perKategori.slice(0, 12).map((k) => ({ kategori: k.kategori, total: k.total, persen: k.persen })),
        tren: d.tren.map((t) => ({ bulan: t.bulan, pemasukan: t.pemasukan, pengeluaran: t.pengeluaran })),
        sumberPemasukan: d.sumberPemasukan.map((s) => ({ kategori: s.kategori, total: s.total })),
        transferJumlah: d.transfer.jumlah,
        transferBiayaAdmin: d.transfer.biayaAdmin,
      },
    });
    if (error) return { data: null, error: `Gagal menghubungi AI: ${error.message}` };
    if (data?.status === 'success' && data.data) {
      return { data: { insights: data.data.insights ?? [], hemat: data.data.hemat ?? [] }, error: null };
    }
    return { data: null, error: data?.message ?? 'AI belum bisa membuat insight. Coba lagi nanti.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal terhubung ke server.';
    return { data: null, error: `Gagal menghubungi AI: ${msg}` };
  }
}
