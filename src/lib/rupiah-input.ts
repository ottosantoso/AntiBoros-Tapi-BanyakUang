/** Input rupiah: pengguna mengetik angka saja, tampilan langsung diberi titik ribuan. */

/** Menyisakan digit saja dan membuang nol di depan. Hasilnya string angka, kosong jika belum diisi. */
export function parseRupiahInput(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

/** Tampilan dengan titik ribuan, misalnya "10000000" menjadi "10.000.000". */
export function formatRupiahInput(digits: string): string {
  if (!digits) return '';
  return new Intl.NumberFormat('id-ID').format(Number(digits));
}
