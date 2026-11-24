/** Perhitungan murni untuk rencana bulanan. Tidak menyentuh database dan tidak mengubah transaksi riil. */

export type Kelompok = 'kebutuhan' | 'keinginan' | 'investasi';

export const KELOMPOK_LABEL: Record<Kelompok, string> = {
  kebutuhan: 'Kebutuhan',
  keinginan: 'Keinginan',
  investasi: 'Investasi',
};

/** Persentase dari total pemasukan untuk tiap kelompok. Total harus 100. */
export interface Persen {
  kebutuhan: number;
  keinginan: number;
  investasi: number;
}

export type ModelKode = 'standar' | 'cepat-nabung' | 'keluarga' | 'hemat' | 'kustom';

export interface ModelKeuangan {
  kode: ModelKode;
  nama: string;
  persen: Persen;
  cocok: string;
}

/** Daftar model yang bisa dipilih. Mengubah daftar ini tidak mengubah rencana lama, karena persentasenya disimpan per rencana. */
export const MODEL_KEUANGAN: ModelKeuangan[] = [
  { kode: 'standar', nama: '50/30/20 (standar)', persen: { kebutuhan: 50, keinginan: 30, investasi: 20 }, cocok: 'Pekerja single dengan penghasilan stabil' },
  { kode: 'cepat-nabung', nama: '40/30/30', persen: { kebutuhan: 40, keinginan: 30, investasi: 30 }, cocok: 'Single yang ingin cepat menabung' },
  { kode: 'keluarga', nama: '60/20/20', persen: { kebutuhan: 60, keinginan: 20, investasi: 20 }, cocok: 'Sudah berkeluarga, ada tanggungan' },
  { kode: 'hemat', nama: '70/20/10', persen: { kebutuhan: 70, keinginan: 20, investasi: 10 }, cocok: 'Masih kuliah, atau penghasilan kecil' },
  { kode: 'kustom', nama: 'Kustom', persen: { kebutuhan: 50, keinginan: 30, investasi: 20 }, cocok: 'Kondisi khusus, harus berjumlah 100%' },
];

export const MODEL_DEFAULT: ModelKode = 'standar';

export function getModel(kode: ModelKode): ModelKeuangan {
  return MODEL_KEUANGAN.find((m) => m.kode === kode) ?? MODEL_KEUANGAN[0];
}

/** Pesan error untuk persentase kustom. Null berarti valid. */
export function validatePersen(p: Persen): string | null {
  const values = [p.kebutuhan, p.keinginan, p.investasi];
  if (values.some((v) => !Number.isInteger(v) || v < 0 || v > 100)) return 'Persentase tiap kelompok harus bilangan bulat 0 sampai 100.';
  const total = values.reduce((s, v) => s + v, 0);
  if (total === 100) return null;
  const selisih = Math.abs(100 - total);
  return `Total masih ${total}%, ${total < 100 ? 'kurang' : 'lebih'} ${selisih}%`;
}

export interface RencanaItemLike {
  jenis: 'pemasukan' | 'pengeluaran';
  nominal: number;
  kategori: string | null;
  kelompok: Kelompok | null;
}

/** Kelompok awal per kategori. Pengguna bisa mengubahnya per item. */
const KATEGORI_KELOMPOK: Record<string, Kelompok> = {
  'Kebutuhan Rumah Tangga': 'kebutuhan',
  Transportasi: 'kebutuhan',
  Pendidikan: 'kebutuhan',
  Kesehatan: 'kebutuhan',
  'Anak & Bayi': 'kebutuhan',
  'Kebutuhan Pribadi': 'kebutuhan',
  'Hiburan & Lifestyle': 'keinginan',
  Sosial: 'kebutuhan',
  'Investasi & Tabungan': 'investasi',
  'Lain-lain': 'kebutuhan',
};

export function defaultKelompok(kategori: string | null): Kelompok {
  return (kategori && KATEGORI_KELOMPOK[kategori]) || 'kebutuhan';
}

export interface RencanaSummary {
  pemasukan: number;
  pengeluaran: number;
  /** Pemasukan dikurangi pengeluaran. Positif = bisa ditabung, negatif = defisit. */
  tabungan: number;
  /** Budget sama dengan total pemasukan rencana, jadi tidak perlu diisi manual. */
  budget: number;
}

export function summarizeRencana(items: RencanaItemLike[]): RencanaSummary {
  let pemasukan = 0;
  let pengeluaran = 0;
  for (const item of items) {
    if (item.jenis === 'pemasukan') pemasukan += item.nominal;
    else pengeluaran += item.nominal;
  }
  return { pemasukan, pengeluaran, tabungan: pemasukan - pengeluaran, budget: pemasukan };
}

export type TargetStatus = 'aman' | 'waspada' | 'lewat';

export interface KelompokRow {
  kelompok: Kelompok;
  label: string;
  persen: number;
  target: number;
  realisasi: number;
  /** Target dikurangi realisasi. Negatif berarti sudah lewat. */
  sisa: number;
  /** Realisasi dibanding target, 0 sampai tak hingga. */
  ratio: number;
  status: TargetStatus;
}

/** Target per kelompok dari total pemasukan, dengan persentase model yang dipilih untuk rencana ini. */
export function kelompokTargets(pemasukan: number, items: RencanaItemLike[], persen: Persen): KelompokRow[] {
  const realisasi: Record<Kelompok, number> = { kebutuhan: 0, keinginan: 0, investasi: 0 };
  for (const item of items) {
    if (item.jenis !== 'pengeluaran') continue;
    const kelompok = item.kelompok ?? defaultKelompok(item.kategori);
    realisasi[kelompok] += item.nominal;
  }
  const order: Kelompok[] = ['kebutuhan', 'keinginan', 'investasi'];
  return order.map((kelompok) => {
    const persenKelompok = persen[kelompok];
    const target = Math.round((pemasukan * persenKelompok) / 100);
    const real = realisasi[kelompok];
    const ratio = target > 0 ? real / target : real > 0 ? Number.POSITIVE_INFINITY : 0;
    const status: TargetStatus = ratio >= 1 ? 'lewat' : ratio >= 0.8 ? 'waspada' : 'aman';
    return { kelompok, label: KELOMPOK_LABEL[kelompok], persen: persenKelompok, target, realisasi: real, sisa: target - real, ratio, status };
  });
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
