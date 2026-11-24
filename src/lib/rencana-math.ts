/** Perhitungan murni untuk rencana bulanan. Tidak menyentuh database dan tidak mengubah transaksi riil. */

export interface RencanaItemLike {
  jenis: 'pemasukan' | 'pengeluaran';
  nominal: number;
  kategori: string | null;
}

export interface RencanaSummary {
  pemasukan: number;
  pengeluaran: number;
  /** Pemasukan rencana dikurangi pengeluaran rencana. Positif berarti surplus. */
  sisaRencana: number;
  budget: number;
  /** Budget dikurangi pengeluaran rencana. Positif berarti masih di bawah batas, negatif berarti melebihi. */
  selisihBudget: number;
}

export function summarizeRencana(budget: number, items: RencanaItemLike[]): RencanaSummary {
  let pemasukan = 0;
  let pengeluaran = 0;
  for (const item of items) {
    if (item.jenis === 'pemasukan') pemasukan += item.nominal;
    else pengeluaran += item.nominal;
  }
  return {
    pemasukan,
    pengeluaran,
    sisaRencana: pemasukan - pengeluaran,
    budget,
    selisihBudget: budget - pengeluaran,
  };
}

/** Total pengeluaran per kategori, terbesar dulu. Item tanpa kategori masuk "Tanpa kategori". */
export function categoryBreakdown(items: RencanaItemLike[]): { kategori: string; total: number }[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.jenis !== 'pengeluaran') continue;
    const key = item.kategori || 'Tanpa kategori';
    totals.set(key, (totals.get(key) ?? 0) + item.nominal);
  }
  return Array.from(totals, ([kategori, total]) => ({ kategori, total })).sort((a, b) => b.total - a.total);
}

/** Bulan dalam format YYYY-MM-01 (tanggal pertama), dipakai sebagai kunci rencana. */
export function monthKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

export function monthLabel(bulan: string): string {
  const date = new Date(`${bulan}T00:00:00`);
  if (Number.isNaN(date.getTime())) return bulan;
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
}

/** Kategori level 1 untuk item pengeluaran rencana. Sama dengan master kategori di migrasi fondasi. */
export const RENCANA_KATEGORI = [
  'Kebutuhan Rumah Tangga',
  'Transportasi',
  'Pendidikan',
  'Kesehatan',
  'Anak & Bayi',
  'Kebutuhan Pribadi',
  'Hiburan & Lifestyle',
  'Sosial',
  'Investasi & Tabungan',
  'Lain-lain',
] as const;
