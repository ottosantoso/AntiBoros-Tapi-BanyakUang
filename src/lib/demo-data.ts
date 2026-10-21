import type { DashboardData, MonthlyTrend, Transaction } from './types';
import { shortMonth } from './format';

function buildTrend(): MonthlyTrend[] {
  const now = new Date();
  const out: MonthlyTrend[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const seed = i * 7 + now.getMonth();
    const income = 6_500_000 + ((seed * 173) % 1_200_000);
    const expense = 1_400_000 + ((seed * 251) % 900_000);
    out.push({
      bulan: shortMonth(d.getMonth()),
      pemasukan: income,
      pengeluaran: expense,
    });
  }
  return out;
}

function buildTransactions(): Transaction[] {
  const today = new Date();
  const iso = (offset: number) => {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    return d.toISOString().slice(0, 10);
  };
  return [
    { tanggal: iso(0), deskripsi: 'Gaji Bulanan', tipe: 'Pemasukan', nominal: 7_000_000, dompet: 'BCA', kategori: 'Gaji' },
    { tanggal: iso(0), deskripsi: 'Kopi Senja', tipe: 'Pengeluaran', nominal: 32_000, dompet: 'GOPAY', kategori: 'Makan & Minum' },
    { tanggal: iso(1), deskripsi: 'Belanja Bulanan', tipe: 'Pengeluaran', nominal: 500_000, dompet: 'BCA', kategori: 'Belanja' },
    { tanggal: iso(1), deskripsi: 'Gojek ke Kantor', tipe: 'Pengeluaran', nominal: 28_000, dompet: 'GOPAY', kategori: 'Transportasi' },
    { tanggal: iso(2), deskripsi: 'Top Up GOPAY', tipe: 'Pengeluaran', nominal: 100_000, dompet: 'BCA', kategori: 'Top Up' },
    { tanggal: iso(3), deskripsi: 'Freelance Desain', tipe: 'Pemasukan', nominal: 1_200_000, dompet: 'DANA', kategori: 'Freelance' },
    { tanggal: iso(4), deskripsi: 'Makan Siang', tipe: 'Pengeluaran', nominal: 45_000, dompet: 'OVO', kategori: 'Makan & Minum' },
    { tanggal: iso(5), deskripsi: 'Netflix Langganan', tipe: 'Pengeluaran', nominal: 153_000, dompet: 'BCA', kategori: 'Hiburan' },
    { tanggal: iso(6), deskripsi: 'Bensin Motor', tipe: 'Pengeluaran', nominal: 50_000, dompet: 'CASH', kategori: 'Transportasi' },
    { tanggal: iso(7), deskripsi: 'Penjualan Online', tipe: 'Pemasukan', nominal: 350_000, dompet: 'DANA', kategori: 'Penjualan' },
  ];
}

export function demoDashboardData(): DashboardData {
  const dompet = [
    { nama: 'BCA', saldo: 4_500_000 },
    { nama: 'GOPAY', saldo: 750_000 },
    { nama: 'OVO', saldo: 320_000 },
    { nama: 'DANA', saldo: 580_000 },
    { nama: 'CASH', saldo: 150_000 },
    { nama: 'SHOPEEPAY', saldo: -85_000 },
  ];
  const pemasukanBulanIni = 7_000_000;
  const pengeluaranBulanIni = 1_750_000;
  return {
    totalSaldo: 6_215_000,
    pemasukanBulanIni,
    pengeluaranBulanIni,
    tabunganBulanIni: pemasukanBulanIni - pengeluaranBulanIni,
    dompet,
    topPengeluaran: [
      { deskripsi: 'Belanja Bulanan', nominal: 500_000 },
      { deskripsi: 'Netflix Langganan', nominal: 153_000 },
      { deskripsi: 'Bensin Motor', nominal: 50_000 },
      { deskripsi: 'Makan Siang', nominal: 45_000 },
      { deskripsi: 'Kopi Senja', nominal: 32_000 },
    ],
    rekapKategori: {
      'Makan & Minum': 350_000,
      Transportasi: 150_000,
      Belanja: 500_000,
      Hiburan: 153_000,
      Lainnya: 597_000,
    },
    transaksi: buildTransactions(),
    trenBulanan: buildTrend(),
  };
}
