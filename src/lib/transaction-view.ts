import type { Transaction } from '@/lib/types';

/** Jenis tampilan satu baris. Penyesuaian = koreksi saldo, tidak dihitung sebagai pemasukan/pengeluaran. */
export type Jenis = 'Pemasukan' | 'Pengeluaran' | 'Transfer' | 'Penyesuaian';
export type JenisFilter = 'all' | Jenis;

/** Kategori sistem untuk koreksi saldo (edit saldo dompet). */
export const KATEGORI_PENYESUAIAN = 'Penyesuaian Saldo';
/** Kategori sistem untuk biaya admin transfer. Ini pengeluaran riil. */
export const KATEGORI_BIAYA_ADMIN = 'Biaya Admin';

/**
 * Kategori sistem untuk utang dan piutang. Keputusan 27 Nov 2026: uangnya memang masuk atau keluar dompet,
 * tetapi pokok utang dan piutang bukan pemasukan atau pengeluaran riil. Bunga dan biaya tetap riil.
 */
export const KATEGORI_KEWAJIBAN = ['Utang', 'Pembayaran Utang', 'Piutang', 'Pelunasan Piutang'] as const;
const KATEGORI_KEWAJIBAN_SET: ReadonlySet<string> = new Set(KATEGORI_KEWAJIBAN);

/** Koreksi saldo dompet. Mengubah saldo, tapi bukan uang masuk atau keluar sungguhan. */
export function isPenyesuaian(tx: Transaction): boolean {
  return tx.kategori === KATEGORI_PENYESUAIAN;
}

/** Transaksi utang atau piutang (termasuk pembayaran dan pelunasannya). Mengubah saldo, bukan pemasukan atau pengeluaran riil. */
export function isKewajiban(tx: Transaction): boolean {
  return isKewajibanKategori(tx.kategori);
}

/** Sama seperti isKewajiban, untuk data mentah yang hanya punya nama kategori. */
export function isKewajibanKategori(kategori: string | null | undefined): boolean {
  return kategori != null && KATEGORI_KEWAJIBAN_SET.has(kategori);
}

/**
 * Sisi transfer antar dompet di tabel transaksi. Biaya admin tidak termasuk, karena itu pengeluaran riil.
 * Di database saat ini hanya biaya admin yang punya transferId, jadi fungsi ini cadangan untuk sisi transfer.
 */
export function isTransfer(tx: Transaction): boolean {
  return Boolean(tx.transferId) && tx.kategori !== KATEGORI_BIAYA_ADMIN;
}

/** Pemasukan yang benar-benar uang masuk: termasuk dari pihak luar (istri, dsb.), tidak termasuk koreksi atau sisi transfer. */
export function isPemasukanRiil(tx: Transaction): boolean {
  return tx.tipe === 'Pemasukan' && !isPenyesuaian(tx) && !isTransfer(tx) && !isKewajiban(tx);
}

/** Pengeluaran yang benar-benar uang keluar: termasuk ke pihak luar dan biaya admin. */
export function isPengeluaranRiil(tx: Transaction): boolean {
  return tx.tipe === 'Pengeluaran' && !isPenyesuaian(tx) && !isTransfer(tx) && !isKewajiban(tx);
}

export function txJenis(tx: Transaction): Jenis {
  if (isTransfer(tx)) return 'Transfer';
  if (isPenyesuaian(tx)) return 'Penyesuaian';
  return tx.tipe;
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
