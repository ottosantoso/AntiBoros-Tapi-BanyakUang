import { formatIDR } from './format';
import type { NotifikasiBudgetDraft } from './data/notifikasi';

/**
 * Aturan notifikasi budget. Fungsi murni, tanpa database.
 * - Pemakaian >= 100% dari batas: notifikasi 100%.
 * - Pemakaian >= 80% tapi < 100%: notifikasi 80%.
 * - Setiap ambang hanya dicatat sekali per subkategori per bulan (diatur oleh referensi di database).
 * Kalau pemakaian langsung melewati 80% dan 100% sekaligus, hanya 100% yang dicatat supaya tidak berisik.
 */

export interface BudgetAlertRow {
  subkategoriId: string;
  nama: string;
  spent: number;
  limit: number;
}

/** Periode dalam bentuk YYYY-MM, dipakai sebagai bagian referensi. */
export function buatPeringatanBudget(rows: BudgetAlertRow[], periode: string): NotifikasiBudgetDraft[] {
  const drafts: NotifikasiBudgetDraft[] = [];
  for (const r of rows) {
    if (r.limit <= 0) continue;
    const persen = (r.spent / r.limit) * 100;
    if (persen >= 100) {
      drafts.push({
        referensi: `budget:${r.subkategoriId}:${periode}:100`,
        jenis: 'budget_100',
        judul: `Budget ${r.nama} sudah terlampaui`,
        isi: `Terpakai ${formatIDR(r.spent)} dari batas ${formatIDR(r.limit)} bulan ini.`,
      });
    } else if (persen >= 80) {
      drafts.push({
        referensi: `budget:${r.subkategoriId}:${periode}:80`,
        jenis: 'budget_80',
        judul: `Budget ${r.nama} hampir habis (${Math.round(persen)}%)`,
        isi: `Terpakai ${formatIDR(r.spent)} dari batas ${formatIDR(r.limit)} bulan ini.`,
      });
    }
  }
  return drafts;
}
