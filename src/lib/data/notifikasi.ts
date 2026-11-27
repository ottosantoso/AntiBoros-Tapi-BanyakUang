import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

/* ---------- Notifikasi budget (tabel notifications, jenis budget_80 dan budget_100) ---------- */

export type NotifikasiBudgetJenis = 'budget_80' | 'budget_100';

export interface NotifikasiBudgetDraft {
  referensi: string;
  jenis: NotifikasiBudgetJenis;
  judul: string;
  isi: string;
}

export interface NotifikasiBudgetItem {
  id: string;
  jenis: NotifikasiBudgetJenis;
  judul: string;
  isi: string;
  createdAt: string;
}

/** Notifikasi budget yang belum dibaca, terbaru di atas. */
export async function fetchNotifikasiBudgetBelumDibaca(): Promise<{ items: NotifikasiBudgetItem[]; error: string | null }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id,jenis,judul,isi,created_at')
    .in('jenis', ['budget_80', 'budget_100'])
    .is('dibaca_pada', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { items: [], error: error.message };
  return {
    items: ((data ?? []) as { id: string; jenis: NotifikasiBudgetJenis; judul: string; isi: string; created_at: string }[]).map(
      (r) => ({ id: r.id, jenis: r.jenis, judul: r.judul, isi: r.isi, createdAt: r.created_at }),
    ),
    error: null,
  };
}

/**
 * Catat notifikasi budget yang belum ada. Setiap referensi hanya tercatat sekali (kunci unik di database),
 * jadi memanggil ulang dengan data yang sama tidak membuat duplikat.
 */
export async function catatNotifikasiBudget(drafts: NotifikasiBudgetDraft[]): Promise<WriteResult & { dicatat: number }> {
  let dicatat = 0;
  for (const d of drafts) {
    const { error } = await supabase.from('notifications').insert({
      jenis: d.jenis,
      judul: d.judul,
      isi: d.isi,
      referensi: d.referensi,
    });
    if (!error) {
      dicatat += 1;
      continue;
    }
    // 23505 = sudah pernah dicatat. Itu bukan kegagalan.
    if (error.code !== '23505') return { success: false, error: error.message, dicatat };
  }
  return { success: true, error: null, dicatat };
}

/** Tandai notifikasi sudah dibaca. */
export async function tandaiNotifikasiDibaca(ids: string[]): Promise<WriteResult> {
  if (!ids.length) return { success: true, error: null };
  const { error } = await supabase
    .from('notifications')
    .update({ dibaca_pada: new Date().toISOString() })
    .in('id', ids);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}
