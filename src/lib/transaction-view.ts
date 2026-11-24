import type { Transaction } from '@/lib/types';
import { toISODate } from '@/lib/format';

/** Jenis tampilan satu baris: transfer antar-dompet dibedakan dari pemasukan/pengeluaran riil. */
export type Jenis = 'Pemasukan' | 'Pengeluaran' | 'Transfer';
export type JenisFilter = 'all' | Jenis;

/** Baris transfer punya transferId (sisi keluar atau masuk). Tidak pernah dihitung sebagai pemasukan/pengeluaran. */
export function isTransfer(tx: Transaction): boolean {
  return Boolean(tx.transferId);
}

export function txJenis(tx: Transaction): Jenis {
  return isTransfer(tx) ? 'Transfer' : tx.tipe;
}

export function matchesJenis(tx: Transaction, jenis: JenisFilter): boolean {
  return jenis === 'all' || txJenis(tx) === jenis;
}

/** Efek satu baris terhadap saldo dompetnya. */
export function txEffect(tx: Transaction): number {
  return tx.tipe === 'Pemasukan' ? tx.nominal : -tx.nominal;
}

/**
 * Saldo dompet setelah setiap transaksi.
 * Saldo dompet sekarang dipakai sebagai titik awal, lalu dijalankan mundur dari transaksi terbaru.
 * Dengan begitu hasil terakhir selalu sama dengan saldo yang tampil di halaman Dompet.
 * `transactions` sebaiknya berisi semua baris (termasuk yang sedang menunggu hapus) agar sesuai database.
 */
export function balanceAfterEach(
  transactions: Transaction[],
  wallets: { id: string; saldo: number }[],
): Map<string, number> {
  const current = new Map(wallets.map((wallet) => [wallet.id, wallet.saldo]));
  const byWallet = new Map<string, Transaction[]>();

  for (const tx of transactions) {
    if (!tx.id || !tx.walletId || !current.has(tx.walletId)) continue;
    const list = byWallet.get(tx.walletId);
    if (list) list.push(tx);
    else byWallet.set(tx.walletId, [tx]);
  }

  const result = new Map<string, number>();
  byWallet.forEach((list, walletId) => {
    // Terbaru dulu: tanggal, lalu waktu simpan sebagai pembeda.
    list.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
    let running = current.get(walletId) ?? 0;
    for (const tx of list) {
      result.set(tx.id as string, running);
      running -= txEffect(tx);
    }
  });
  return result;
}

/** Deret kumulatif per tanggal untuk grafik mini. Mengambil maksimal `maxPoints` tanggal terakhir. */
export function dailySeries(items: Transaction[], valueOf: (tx: Transaction) => number, maxPoints = 20): number[] {
  const byDay = new Map<string, number>();
  for (const tx of items) byDay.set(tx.tanggal, (byDay.get(tx.tanggal) ?? 0) + valueOf(tx));
  let running = 0;
  return [...byDay.keys()]
    .sort()
    .map((day) => {
      running += byDay.get(day) ?? 0;
      return running;
    })
    .slice(-maxPoints);
}

/** Membaca nilai dari kolom input angka. Mengembalikan null jika kosong atau tidak valid. */
export function parseNominal(value: string): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

/** CSV untuk dibuka di Excel. Diberi BOM supaya karakter Indonesia tampil benar. Ekspor .xlsx dengan rumus menyusul. */
export function buildTransactionsCsv(rows: Transaction[], balances: Map<string, number>): string {
  const header = ['Tanggal', 'Keterangan', 'Kategori', 'Dompet', 'Jenis', 'Masuk', 'Keluar', 'Saldo Setelah'];
  const lines = rows.map((tx) => {
    const jenis = txJenis(tx);
    const income = tx.tipe === 'Pemasukan';
    const balance = tx.id ? balances.get(tx.id) : undefined;
    return [
      tx.tanggal,
      tx.deskripsi,
      isTransfer(tx) ? '' : tx.kategori ?? '',
      tx.dompet,
      jenis,
      income ? tx.nominal : '',
      income ? '' : tx.nominal,
      balance ?? '',
    ]
      .map(csvCell)
      .join(',');
  });
  return `\uFEFF${[header.map(csvCell).join(','), ...lines].join('\r\n')}`;
}

export function exportFileName(): string {
  return `transaksi-${toISODate()}.csv`;
}
