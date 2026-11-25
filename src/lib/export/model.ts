import type { Transaction, WalletTransfer } from '@/lib/types';
import { isPemasukanRiil, isPengeluaranRiil, txJenis, type Jenis } from '@/lib/transaction-view';

/** Data laporan yang sama dipakai untuk Excel dan PDF, supaya angkanya selalu sama. */
export interface LaporanRow {
  tanggal: string;
  deskripsi: string;
  kategori: string;
  dompet: string;
  jenis: Jenis;
  pihakLuar: string;
  masuk: number | null;
  keluar: number | null;
  saldoSetelah: number | null;
}

export interface LaporanBulan {
  /** Kunci YYYY-MM untuk pengurutan. */
  kunci: string;
  /** Label tampilan, mis. "Nov 2026". */
  label: string;
  pemasukan: number;
  pengeluaran: number;
}

export interface LaporanKategori {
  nama: string;
  total: number;
  /** Persen dari total pengeluaran riil. */
  persen: number;
}

export interface LaporanDompet {
  nama: string;
  saldo: number;
}

export interface LaporanTransfer {
  tanggal: string;
  dari: string;
  ke: string;
  nominal: number;
  biayaAdmin: number;
  catatan: string;
}

export interface LaporanModel {
  judul: string;
  periode: string;
  dibuat: string;
  rows: LaporanRow[];
  totalPemasukan: number;
  totalPengeluaran: number;
  sisaBersih: number;
  totalTransfer: number;
  jumlahTransfer: number;
  sisaSaldoSemua: number;
  bulanan: LaporanBulan[];
  kategori: LaporanKategori[];
  dompet: LaporanDompet[];
  transfers: LaporanTransfer[];
}

const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/** Nama bulan tanpa tergantung locale browser. */
function labelBulan(kunci: string): string {
  const [tahun, bulan] = kunci.split('-');
  return `${BULAN_SINGKAT[Number(bulan) - 1]} ${tahun}`;
}

/** Maksimal 12 bulan terakhir, dari bulan paling awal sampai paling akhir yang ada datanya (bulan kosong tetap ditampilkan). */
function bulananDariData(items: Transaction[]): LaporanBulan[] {
  const riil = items.filter((t) => isPemasukanRiil(t) || isPengeluaranRiil(t));
  if (riil.length === 0) return [];
  const keys = riil.map((t) => t.tanggal.slice(0, 7)).sort();
  const awal = keys[0];
  const akhir = keys[keys.length - 1];
  const daftar: string[] = [];
  let [y, m] = awal.split('-').map(Number);
  const [ya, ma] = akhir.split('-').map(Number);
  while (y < ya || (y === ya && m <= ma)) {
    daftar.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  const dipakai = daftar.slice(-12);
  return dipakai.map((kunci) => {
    const bulanItems = riil.filter((t) => t.tanggal.startsWith(kunci));
    return {
      kunci,
      label: labelBulan(kunci),
      pemasukan: bulanItems.filter(isPemasukanRiil).reduce((s, t) => s + t.nominal, 0),
      pengeluaran: bulanItems.filter(isPengeluaranRiil).reduce((s, t) => s + t.nominal, 0),
    };
  });
}

export interface BuildLaporanInput {
  /** Baris yang sedang tampil di halaman Transaksi (sudah difilter). */
  items: Transaction[];
  /** Saldo sesudah tiap baris, sama dengan kolom "Saldo Setelah" di layar. */
  balances: Map<string, number>;
  /** Transfer antar dompet yang sudah difilter tanggal dan dompet. */
  transfers: WalletTransfer[];
  /** Dompet aktif beserta saldo sekarang. */
  dompet: { nama: string; saldo: number }[];
  totalSaldo: number;
  /** Keterangan periode untuk judul, mis. "01/11/2026 – 26/11/2026". */
  periode: string;
  dibuat: string;
}

export function buildLaporanModel(input: BuildLaporanInput): LaporanModel {
  const { items, balances } = input;

  const rows: LaporanRow[] = items.map((tx) => {
    const jenis = txJenis(tx);
    return {
      tanggal: tx.tanggal,
      deskripsi: tx.deskripsi,
      kategori: tx.kategori ?? '',
      dompet: tx.dompet,
      jenis,
      pihakLuar: tx.pihakLuar ?? '',
      masuk: tx.tipe === 'Pemasukan' ? tx.nominal : null,
      keluar: tx.tipe === 'Pengeluaran' ? tx.nominal : null,
      saldoSetelah: tx.id ? (balances.get(tx.id) ?? null) : null,
    };
  });

  const pemasukan = items.filter(isPemasukanRiil);
  const pengeluaran = items.filter(isPengeluaranRiil);
  const totalPemasukan = pemasukan.reduce((s, t) => s + t.nominal, 0);
  const totalPengeluaran = pengeluaran.reduce((s, t) => s + t.nominal, 0);

  const katMap = new Map<string, number>();
  for (const t of pengeluaran) {
    const k = t.kategori ?? 'Tanpa kategori';
    katMap.set(k, (katMap.get(k) ?? 0) + t.nominal);
  }
  const kategori: LaporanKategori[] = [...katMap.entries()]
    .map(([nama, total]) => ({
      nama,
      total,
      persen: totalPengeluaran > 0 ? Math.round((total * 1000) / totalPengeluaran) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const transfers: LaporanTransfer[] = input.transfers.map((tr) => ({
    tanggal: tr.tanggal,
    dari: tr.fromWallet,
    ke: tr.toWallet,
    nominal: tr.nominal,
    biayaAdmin: tr.biayaAdmin,
    catatan: tr.catatan ?? '',
  }));

  return {
    judul: 'Laporan Keuangan',
    periode: input.periode,
    dibuat: input.dibuat,
    rows,
    totalPemasukan,
    totalPengeluaran,
    sisaBersih: totalPemasukan - totalPengeluaran,
    totalTransfer: transfers.reduce((s, t) => s + t.nominal, 0),
    jumlahTransfer: transfers.length,
    sisaSaldoSemua: input.totalSaldo,
    bulanan: bulananDariData(items),
    kategori,
    dompet: input.dompet,
    transfers,
  };
}
