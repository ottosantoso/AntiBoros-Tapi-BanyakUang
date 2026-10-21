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
};

const DEFAULT_STYLE: BrandStyle = {
  brand: 'Dompet',
  gradient: 'from-slate-700 via-slate-600 to-slate-500',
  glyph: 'RP',
};

export function getWalletMeta(wallet: Wallet): WalletMeta {
  const key = wallet.nama.toUpperCase().replace(/[\s-]/g, '');
  const style = BRANDS[key] ?? DEFAULT_STYLE;
  return {
    ...wallet,
    brand: style.brand,
    gradient: style.gradient,
    glyph: style.glyph,
    negative: wallet.saldo < 0,
  };
}

export function walletGlyph(name: string): string {
  const key = name.toUpperCase().replace(/[\s-]/g, '');
  return (BRANDS[key] ?? DEFAULT_STYLE).glyph;
}

export const WALLET_NAMES = Object.keys(BRANDS);
