import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

/* ---------- Riwayat insight AI (tabel ai_reports) ---------- */

export interface AiReportRecord {
  id: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  insights: string[];
  hemat: string[];
}

/** Simpan hasil insight AI sebagai riwayat. Gagal simpan tidak membatalkan tampilan hasil. */
export async function saveAiReport(input: {
  kind: 'dashboard' | 'analisa';
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, unknown>;
  narrative: { insights: string[]; hemat: string[] };
}): Promise<WriteResult> {
  try {
    const { error } = await supabase.from('ai_reports').insert({
      kind: input.kind,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      metrics: input.metrics,
      narrative: input.narrative,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan riwayat insight.';
    return { success: false, error: msg };
  }
}

/** Insight AI terakhir untuk satu jenis tampilan. Null bila belum pernah dibuat. */
export async function fetchLatestAiReport(
  kind: 'dashboard' | 'analisa',
): Promise<{ report: AiReportRecord | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('ai_reports')
      .select('id,created_at,period_start,period_end,narrative')
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return { report: null, error: error.message };
    const row = ((data ?? []) as Array<{
      id: string;
      created_at: string;
      period_start: string;
      period_end: string;
      narrative: { insights?: string[]; hemat?: string[] } | null;
    }>)[0];
    if (!row) return { report: null, error: null };
    return {
      report: {
        id: row.id,
        createdAt: row.created_at,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        insights: row.narrative?.insights ?? [],
        hemat: row.narrative?.hemat ?? [],
      },
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat riwayat insight.';
    return { report: null, error: msg };
  }
}
