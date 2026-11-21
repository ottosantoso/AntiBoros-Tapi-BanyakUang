import type { WalletJenis } from './types';

export interface WalletProvider {
  /** Kode yang disimpan di kolom `provider`. Harus cocok dengan kunci BRANDS di wallets.ts. */
  code: string;
  nama: string;
  /** Tulisan singkat di dalam tile, meniru wordmark merek. */
  glyph: string;
  jenis: Exclude<WalletJenis, 'lainnya'>;
  /** Warna dasar merek untuk tile. */
  color: string;
}

export const BANK_PROVIDERS: WalletProvider[] = [
  { code: 'BCA', nama: 'BCA', glyph: 'BCA', jenis: 'bank', color: '#0061a8' },
  { code: 'BNI', nama: 'BNI', glyph: 'BNI', jenis: 'bank', color: '#f15a22' },
  { code: 'BRI', nama: 'BRI', glyph: 'BRI', jenis: 'bank', color: '#00529c' },
  { code: 'MANDIRI', nama: 'Mandiri', glyph: 'mandiri', jenis: 'bank', color: '#003d79' },
  { code: 'BI', nama: 'Bank Indonesia', glyph: 'BI', jenis: 'bank', color: '#1e3a8a' },
  { code: 'CIMB', nama: 'CIMB Niaga', glyph: 'CIMB', jenis: 'bank', color: '#b10c0c' },
  { code: 'PERMATA', nama: 'PermataBank', glyph: 'permata', jenis: 'bank', color: '#0c7a43' },
  { code: 'DANAMON', nama: 'Danamon', glyph: 'danamon', jenis: 'bank', color: '#f7941d' },
  { code: 'BTN', nama: 'BTN', glyph: 'BTN', jenis: 'bank', color: '#0a4fa0' },
];

export const EWALLET_PROVIDERS: WalletProvider[] = [
  { code: 'DANA', nama: 'DANA', glyph: 'DANA', jenis: 'ewallet', color: '#108ee9' },
  { code: 'OVO', nama: 'OVO', glyph: 'OVO', jenis: 'ewallet', color: '#4c3494' },
  { code: 'GOPAY', nama: 'gopay', glyph: 'gopay', jenis: 'ewallet', color: '#00aa13' },
  { code: 'SHOPEEPAY', nama: 'ShopeePay', glyph: 'SP', jenis: 'ewallet', color: '#ee4d2d' },
  { code: 'LINKAJA', nama: 'LinkAja', glyph: 'LA', jenis: 'ewallet', color: '#e41c24' },
  { code: 'GOPAYLATER', nama: 'GoPay Later', glyph: 'GPL', jenis: 'ewallet', color: '#00aa13' },
];

/** Kode untuk dompet yang tidak ada di daftar (pilihan "Lainnya"). */
export const OTHER_PROVIDER_CODE = 'LAINNYA';
