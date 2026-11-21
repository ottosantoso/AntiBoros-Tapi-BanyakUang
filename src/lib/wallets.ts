import type { Wallet, WalletMeta } from './types';

interface BrandStyle {
  brand: string;
  gradient: string;
  glyph: string;
}

const BRANDS: Record<string, BrandStyle> = {
  BCA: { brand: 'BCA', gradient: 'from-[#0d2872] via-[#1640b8] to-[#1f6feb]', glyph: 'BCA' },
  GOPAY: { brand: 'GoPay', gradient: 'from-[#00a155] via-[#00bd5e] to-[#39e07f]', glyph: 'GP' },
  OVO: { brand: 'OVO', gradient: 'from-[#4c2a8a] via-[#6b3fb5] to-[#8b5cf6]', glyph: 'OVO' },
  DANA: { brand: 'DANA', gradient: 'from-[#118ee9] via-[#1aa0f5] to-[#4cc4ff]', glyph: 'DANA' },
  CASH: { brand: 'Cash', gradient: 'from-[#3f6212] via-[#4d7c0f] to-[#65a30d]', glyph: 'CASH' },
  SHOPEEPAY: { brand: 'ShopeePay', gradient: 'from-[#e8550d] via-[#f5701a] to-[#ff9248]', glyph: 'SP' },
  MANDIRI: { brand: 'Mandiri', gradient: 'from-[#0d3b80] via-[#1450a8] to-[#1f6feb]', glyph: 'MDR' },
  BRI: { brand: 'BRI', gradient: 'from-[#00529b] via-[#006fc4] to-[#1f9fff]', glyph: 'BRI' },
  BNI: { brand: 'BNI', gradient: 'from-[#f58634] via-[#f59e0b] to-[#fbbf24]', glyph: 'BNI' },
  JENIUS: { brand: 'Jenius', gradient: 'from-[#166d7c] via-[#1d8c9f] to-[#38b6c4]', glyph: 'JNS' },
  SAKUKU: { brand: 'Sakuku', gradient: 'from-[#1e3a8a] via-[#2546b8] to-[#3b64e6]', glyph: 'SKK' },
  LINKAJA: { brand: 'LinkAja', gradient: 'from-[#d32f2f] via-[#e53935] to-[#ef5350]', glyph: 'LA' },
  BI: { brand: 'Bank Indonesia', gradient: 'from-[#172554] via-[#1e3a8a] to-[#2563eb]', glyph: 'BI' },
  CIMB: { brand: 'CIMB Niaga', gradient: 'from-[#8a0a0a] via-[#b10c0c] to-[#e11d1d]', glyph: 'CIMB' },
  PERMATA: { brand: 'PermataBank', gradient: 'from-[#065f36] via-[#0c7a43] to-[#16a34a]', glyph: 'PMT' },
  DANAMON: { brand: 'Danamon', gradient: 'from-[#c2410c] via-[#ea7a10] to-[#f7941d]', glyph: 'DNM' },
  BTN: { brand: 'BTN', gradient: 'from-[#07366f] via-[#0a4fa0] to-[#2f7ad6]', glyph: 'BTN' },
  BLU: { brand: 'blu by BCA Digital', gradient: 'from-[#0891b2] via-[#00a5c8] to-[#22d3ee]', glyph: 'BLU' },
  GOPAYLATER: { brand: 'GoPay Later', gradient: 'from-[#00a155] via-[#00bd5e] to-[#39e07f]', glyph: 'GPL' },
};

/** Dompet "Lainnya": nama dompet dipakai sebagai merek, inisial sebagai glyph. */
const LAINNYA_KEY = 'LAINNYA';

const DEFAULT_STYLE: BrandStyle = {
  brand: 'Dompet',
  gradient: 'from-slate-700 via-slate-600 to-slate-500',
  glyph: 'RP',
};

export function getWalletMeta(wallet: Wallet): WalletMeta {
  const key = (wallet.provider || wallet.nama).toUpperCase().replace(/[\s-]/g, '');
  const style = key === LAINNYA_KEY ? customStyle(wallet.nama) : (BRANDS[key] ?? DEFAULT_STYLE);
  return {
    ...wallet,
    brand: style.brand,
    gradient: style.gradient,
    glyph: style.glyph,
    negative: wallet.saldo < 0,
  };
}

function customStyle(nama: string): BrandStyle {
  const inisial = nama
    .split(/\s+/)
    .filter(Boolean)
    .map((kata) => kata[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();
  return { brand: nama || DEFAULT_STYLE.brand, gradient: DEFAULT_STYLE.gradient, glyph: inisial || DEFAULT_STYLE.glyph };
}

export function walletGlyph(name: string): string {
  const key = name.toUpperCase().replace(/[\s-]/g, '');
  return (BRANDS[key] ?? DEFAULT_STYLE).glyph;
}

/** Generate a stable-ish client-side id for demo-mode wallets. */
export function generateWalletId(): string {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export const WALLET_NAMES = Object.keys(BRANDS);
