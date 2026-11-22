import type { Subkategori } from '@/lib/data';
import type { TransactionType } from '@/lib/types';

/**
 * Saran lokal dari nama subkategori yang muncul di deskripsi. Dipakai sebagai pratinjau
 * sambil menunggu saran server. Tidak mengembalikan apa pun bila deskripsi kosong.
 */
export function suggestSubkategori(
  list: Subkategori[],
  description: string,
  type: TransactionType,
): Subkategori | undefined {
  const desc = description.trim().toLowerCase();
  if (!desc || list.length === 0) return undefined;

  const byName = list
    .filter((s) => desc.includes(s.nama.toLowerCase()))
    .sort((a, b) => b.nama.length - a.nama.length)[0];
  if (byName) return byName;

  const kategori = guessCategory(description, type);
  if (type === 'Pemasukan' && kategori === 'Pemasukan') {
    return list.find((s) => s.nama === 'Pendapatan Lainnya') ?? list.find((s) => s.kategori === kategori);
  }
  return (
    list.find((s) => s.nama === kategori) ??
    list.find((s) => s.kategori === kategori) ??
    list.find((s) => s.nama === 'Lain-lain' || s.nama === 'Pendapatan Lainnya')
  );
}

export function guessCategory(description: string, type: TransactionType): string {
  if (type === 'Pemasukan') {
    const value = description.toLowerCase();
    if (value.includes('gaji')) return 'Gaji';
    if (value.includes('freelance')) return 'Freelance';
    if (value.includes('jual') || value.includes('penjualan')) return 'Penjualan';
    return 'Pemasukan';
  }
  const value = description.toLowerCase();
  if (value.includes('makan') || value.includes('kopi') || value.includes('resto')) return 'Makan & Minum';
  if (value.includes('gojek') || value.includes('bensin') || value.includes('transport')) return 'Transportasi';
  if (value.includes('belanja') || value.includes('supermarket')) return 'Belanja';
  if (value.includes('listrik') || value.includes('internet') || value.includes('tagihan')) return 'Tagihan & Utilitas';
  return 'Lainnya';
}
