import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

/* ---------- Riwayat pindaian AI Scanner (tabel scan_batches) ---------- */

export type ScanKind = 'struk' | 'mutasi';
export type ScanStatus = 'draft' | 'saved' | 'cancelled';

export interface ScanBatchItem {
  id: string;
  kind: ScanKind;
  status: ScanStatus;
  jumlahItem: number;
  createdAt: string;
  /** Ringkasan dari draft: deskripsi atau jumlah baris, untuk tampilan daftar. */
  ringkasan: string;
}

interface ScanBatchRow {
  id: string;
  kind: ScanKind;
  status: ScanStatus;
  draft: { deskripsi?: unknown; transaksi?: unknown[] } | null;
  jumlah_item: number;
  created_at: string;
}

/** Daftar riwayat pindaian, terbaru di atas. Dibatasi 100 baris. */
export async function fetchScanBatches(): Promise<{ batches: ScanBatchItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('scan_batches')
    .select('id,kind,status,draft,jumlah_item,created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return { batches: [], error: error.message };
  const batches = ((data ?? []) as ScanBatchRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    status: r.status,
    jumlahItem: r.jumlah_item,
    createdAt: r.created_at,
    ringkasan:
      r.kind === 'struk'
        ? (typeof r.draft?.deskripsi === 'string' && r.draft.deskripsi) || 'Struk tanpa deskripsi'
        : `${r.jumlah_item} baris mutasi`,
  }));
  return { batches, error: null };
}

/** Catat satu hasil pindaian sebagai draft. Dipakai di B-3b saat hasil muncul. */
export async function createScanBatch(input: {
  kind: ScanKind;
  draft: Record<string, unknown>;
  jumlahItem: number;
}): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from('scan_batches')
    .insert({ kind: input.kind, draft: input.draft, jumlah_item: input.jumlahItem })
    .select('id')
    .single();
  if (error) return { id: null, error: error.message };
  return { id: (data as { id: string }).id, error: null };
}

/** Ubah status draft menjadi 'saved' atau 'cancelled'. */
export async function setScanBatchStatus(id: string, status: Exclude<ScanStatus, 'draft'>): Promise<WriteResult> {
  const { error } = await supabase
    .from('scan_batches')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
