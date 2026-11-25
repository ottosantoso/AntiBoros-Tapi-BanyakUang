/**
 * Logika prediksi dan skor kesehatan keuangan. Fungsi murni: tidak memanggil database.
 * Semua aturannya tertulis di sini supaya bisa dijelaskan ke pengguna.
 */

/* ---------- Prediksi bulan depan ---------- */

export interface BulanTotal {
  /** Label bulan, mis. "Nov". */
  bulan: string;
  total: number;
}

export interface Prediksi {
  /** Estimasi total untuk bulan depan. Null bila belum ada data bulan lalu. */
  estimasi: number | null;
  /** Jumlah bulan lalu yang dipakai untuk rata-rata (0 sampai 3). */
  bulanDipakai: number;
  /** Penjelasan singkat untuk ditampilkan. */
  catatan: string;
}

/**
 * Estimasi = rata-rata total 3 bulan terakhir yang sudah lewat (bulan berjalan tidak dihitung,
 * karena belum selesai). `series` harus berurutan dari bulan paling lama, dan bulan berjalan
 * berada di elemen terakhir.
 */
export function prediksiBulanDepan(series: BulanTotal[]): Prediksi {
  const sebelumnya = series.slice(0, -1).slice(-3);
  const n = sebelumnya.length;
  if (n === 0) {
    return { estimasi: null, bulanDipakai: 0, catatan: 'Belum ada data bulan sebelumnya untuk dihitung.' };
  }
  const rata = sebelumnya.reduce((s, b) => s + b.total, 0) / n;
  const catatan =
    n >= 3
      ? 'Rata-rata 3 bulan terakhir. Ini estimasi, bukan kepastian.'
      : `Hanya ${n} bulan data. Estimasi belum stabil.`;
  return { estimasi: Math.round(rata), bulanDipakai: n, catatan };
}

/* ---------- Skor kesehatan keuangan (0 sampai 100) ---------- */

export interface SkorInput {
  pemasukan: number;
  pengeluaran: number;
  /** Hanya subkategori yang punya batas budget bulan ini. */
  budget: { limit: number; spent: number }[];
  /** Saldo setiap dompet aktif. */
  dompet: { saldo: number }[];
}

export interface RincianSkor {
  nama: string;
  poin: number;
  maks: number;
  keterangan: string;
}

export interface SkorResult {
  skor: number;
  label: 'Sangat Baik' | 'Baik' | 'Perlu Perhatian' | 'Kritis';
  rincian: RincianSkor[];
}

/**
 * Tiga komponen, total maksimal 100:
 * 1. Tabungan (40): sisa bersih dibagi pemasukan. >= 20% = 40, >= 10% = 25, >= 0% = 10, minus = 0.
 * 2. Budget (30): 30 dikali (1 - jumlah batas yang terlampaui / jumlah batas). Tanpa batas = 15 (netral).
 * 3. Saldo dompet (30): 30 dikali (dompet tidak minus / jumlah dompet). Tanpa dompet = 15 (netral).
 */
export function skorKesehatan(input: SkorInput): SkorResult {
  const rincian: RincianSkor[] = [];

  // 1. Tabungan
  let poinTabungan = 0;
  let ketTabungan = 'Belum ada pemasukan bulan ini.';
  if (input.pemasukan > 0) {
    const rasio = (input.pemasukan - input.pengeluaran) / input.pemasukan;
    const persen = Math.round(rasio * 100);
    if (rasio >= 0.2) poinTabungan = 40;
    else if (rasio >= 0.1) poinTabungan = 25;
    else if (rasio >= 0) poinTabungan = 10;
    ketTabungan = `Sisa ${persen}% dari pemasukan.`;
  }
  rincian.push({ nama: 'Tabungan', poin: poinTabungan, maks: 40, keterangan: ketTabungan });

  // 2. Budget
  let poinBudget = 15;
  let ketBudget = 'Belum ada batas budget, dihitung netral.';
  if (input.budget.length > 0) {
    const terlampaui = input.budget.filter((b) => b.spent > b.limit).length;
    poinBudget = Math.round(30 * (1 - terlampaui / input.budget.length));
    ketBudget =
      terlampaui === 0
        ? `Semua ${input.budget.length} batas masih aman.`
        : `${terlampaui} dari ${input.budget.length} batas terlampaui.`;
  }
  rincian.push({ nama: 'Budget', poin: poinBudget, maks: 30, keterangan: ketBudget });

  // 3. Saldo dompet
  let poinSaldo = 15;
  let ketSaldo = 'Belum ada dompet, dihitung netral.';
  if (input.dompet.length > 0) {
    const tidakMinus = input.dompet.filter((d) => d.saldo >= 0).length;
    poinSaldo = Math.round(30 * (tidakMinus / input.dompet.length));
    ketSaldo =
      tidakMinus === input.dompet.length
        ? 'Semua dompet tidak minus.'
        : `${input.dompet.length - tidakMinus} dompet bersaldo minus.`;
  }
  rincian.push({ nama: 'Saldo dompet', poin: poinSaldo, maks: 30, keterangan: ketSaldo });

  const skor = rincian.reduce((s, r) => s + r.poin, 0);
  const label: SkorResult['label'] =
    skor >= 80 ? 'Sangat Baik' : skor >= 60 ? 'Baik' : skor >= 40 ? 'Perlu Perhatian' : 'Kritis';
  return { skor, label, rincian };
}
