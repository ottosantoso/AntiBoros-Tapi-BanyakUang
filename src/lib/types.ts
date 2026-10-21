export type TransactionType = 'Pemasukan' | 'Pengeluaran';

export interface Wallet {
  nama: string;
  saldo: number;
}

export interface TopExpense {
  deskripsi: string;
  nominal: number;
}

export interface DashboardData {
  totalSaldo: number;
  pemasukanBulanIni: number;
  pengeluaranBulanIni: number;
  tabunganBulanIni: number;
  dompet: Wallet[];
  topPengeluaran: TopExpense[];
  rekapKategori: Record<string, number>;
  /** Optional fields the Apps Script may return. */
  transaksi?: Transaction[];
  trenBulanan?: MonthlyTrend[];
}

export interface Transaction {
  tanggal: string;
  deskripsi: string;
  tipe: TransactionType;
  nominal: number;
  dompet: string;
  kategori?: string;
}

export interface MonthlyTrend {
  bulan: string;
  pemasukan: number;
  pengeluaran: number;
}

export interface NewTransaction {
  action: 'addTransaction';
  tanggal: string;
  deskripsi: string;
  tipe: TransactionType;
  nominal: number;
  dompet: string;
}

/** Normalised copy of a wallet with extra UI metadata. */
export interface WalletMeta extends Wallet {
  brand: string;
  gradient: string;
  glyph: string;
  negative: boolean;
}

/* ---------- AI Smart Scanner ---------- */

export type ImageType = 'struk' | 'mutasi';

export interface ScanPayload {
  action: 'scanImage';
  imageType: ImageType;
  imageBase64: string;
}

/** A single line item extracted from a bank-statement / mutasi scan. */
export interface ScanRow {
  tanggal: string;
  deskripsi: string;
  nominal: number;
  jenis: TransactionType;
  kategori: string;
}

/** Result for a receipt (struk) scan. */
export interface ScanReceipt {
  imageType: 'struk';
  nominal: number;
  deskripsi: string;
  tanggal: string;
  kategori: string;
  jenis: TransactionType;
}

/** Result for a bank-statement (mutasi) scan. */
export interface ScanMutasi {
  imageType: 'mutasi';
  transaksi: ScanRow[];
}

export type ScanResult = ScanReceipt | ScanMutasi;

