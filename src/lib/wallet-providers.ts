import type { WalletJenis } from './types';

export interface WalletProvider {
  /** Kode yang disimpan di kolom `provider`. Harus cocok dengan kunci BRANDS di wallets.ts. */
  code: string;
  nama: string;
  /** Tulisan singkat di dalam tile, dipakai bila provider belum punya logo. */
  glyph: string;
  jenis: Exclude<WalletJenis, 'lainnya'>;
  /** Warna dasar merek untuk tile (cadangan saat logo tidak ada atau gagal dimuat). */
  color: string;
  /** Logo SVG di public/assets/wallet-logos. Kosong = tampilkan glyph berwarna. */
  logo?: string;
}

const LOGO_DIR = '/assets/wallet-logos';
const logo = (file: string) => `${LOGO_DIR}/${file}.svg`;

export const BANK_PROVIDERS: WalletProvider[] = [
  { code: 'BCA', nama: 'BCA', glyph: 'BCA', jenis: 'bank', color: '#0061a8', logo: logo('bca') },
  { code: 'BLU', nama: 'blu by BCA Digital', glyph: 'blu', jenis: 'bank', color: '#00b7d8', logo: `${LOGO_DIR}/blu-bca-digital.png` },
  { code: 'BNI', nama: 'BNI', glyph: 'BNI', jenis: 'bank', color: '#f15a22', logo: logo('bni') },
  { code: 'BRI', nama: 'BRI', glyph: 'BRI', jenis: 'bank', color: '#00529c', logo: logo('bri') },
  { code: 'MANDIRI', nama: 'Mandiri', glyph: 'mandiri', jenis: 'bank', color: '#003d79', logo: logo('mandiri') },
  { code: 'BI', nama: 'Bank Indonesia', glyph: 'BI', jenis: 'bank', color: '#1e3a8a', logo: logo('bank-indonesia') },
  { code: 'CIMB', nama: 'CIMB Niaga', glyph: 'CIMB', jenis: 'bank', color: '#b10c0c', logo: logo('cimb-niaga') },
  { code: 'PERMATA', nama: 'PermataBank', glyph: 'permata', jenis: 'bank', color: '#0c7a43', logo: logo('permata-bank') },
  { code: 'DANAMON', nama: 'Danamon', glyph: 'danamon', jenis: 'bank', color: '#f7941d', logo: logo('danamon') },
  { code: 'BTN', nama: 'BTN', glyph: 'BTN', jenis: 'bank', color: '#0a4fa0' },
];

export const EWALLET_PROVIDERS: WalletProvider[] = [
  { code: 'DANA', nama: 'DANA', glyph: 'DANA', jenis: 'ewallet', color: '#108ee9', logo: logo('dana') },
  { code: 'OVO', nama: 'OVO', glyph: 'OVO', jenis: 'ewallet', color: '#4c3494', logo: logo('ovo') },
  { code: 'GOPAY', nama: 'gopay', glyph: 'gopay', jenis: 'ewallet', color: '#00aa13', logo: logo('gopay') },
  { code: 'SHOPEEPAY', nama: 'ShopeePay', glyph: 'SP', jenis: 'ewallet', color: '#ee4d2d', logo: logo('shopeepay') },
  { code: 'LINKAJA', nama: 'LinkAja', glyph: 'LA', jenis: 'ewallet', color: '#e41c24', logo: logo('linkaja') },
  { code: 'GOPAYLATER', nama: 'GoPay Later', glyph: 'GPL', jenis: 'ewallet', color: '#00aa13' },
];

/** Kode untuk dompet yang tidak ada di daftar (pilihan "Lainnya"). */
export const OTHER_PROVIDER_CODE = 'LAINNYA';

const ALL_PROVIDERS = [...BANK_PROVIDERS, ...EWALLET_PROVIDERS];

/** Logo katalog untuk kode provider tersimpan, atau null jika tidak ada. */
export function providerLogo(code: string): string | null {
  const key = code.toUpperCase().replace(/[\s-]/g, '');
  return ALL_PROVIDERS.find((p) => p.code === key)?.logo ?? null;
}
