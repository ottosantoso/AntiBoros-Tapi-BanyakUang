export type TransactionType = 'Pemasukan' | 'Pengeluaran';

export type TransactionSection = 'all' | 'income' | 'expense' | 'transfer';

export type WalletJenis = 'bank' | 'ewallet' | 'lainnya';

export interface Wallet {
  id: string;
  nama: string;
  provider: string;
  saldo: number;
  jenis: WalletJenis;
  logoUrl: string | null;
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
  id?: string;
  tanggal: string;
  deskripsi: string;
  tipe: TransactionType;
  nominal: number;
  /** Nama dompet untuk tampilan. */
  dompet: string;
  /** ID dompet di database. */
  walletId?: string;
  kategori?: string;
  berulang?: boolean;
  transferId?: string;
  createdAt?: string;
}

export interface MonthlyTrend {
  bulan: string;
  pemasukan: number;
  pengeluaran: number;
}

export interface WalletTransfer {
  id: string;
  tanggal: string;
  fromWalletId: string;
  fromWallet: string;
  toWalletId: string;
  toWallet: string;
  nominal: number;
  biayaAdmin: number;
  catatan?: string;
  createdAt?: string;
}

export interface NewTransferInput {
  tanggal: string;
  fromWalletId: string;
  toWalletId: string;
  nominal: number;
  biayaAdmin?: number;
  catatan?: string;
}

export interface NewTransaction {
  action: 'addTransaction';
  tanggal: string;
  deskripsi: string;
  tipe: TransactionType;
  nominal: number;
  dompet: string;
  kategori?: string;
  berulang?: boolean;
}

/** Normalised copy of a wallet with extra UI metadata. */
export interface WalletMeta extends Wallet {
  brand: string;
  gradient: string;
  glyph: string;
  negative: boolean;
}

/* ---------- Wallet management (CRUD) ---------- */

export interface AddWalletPayload {
  action: 'addWallet';
  nama: string;
  provider: string;
  saldo: number;
}

export interface UpdateWalletPayload {
  action: 'updateWallet';
  id: string;
  nama: string;
  provider: string;
  saldo: number;
}

export interface DeleteWalletPayload {
  action: 'deleteWallet';
  id: string;
  /** Optional: move transactions from the deleted wallet to this target id. */
  moveTo?: string;
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

