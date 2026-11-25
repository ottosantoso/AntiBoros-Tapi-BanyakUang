/** Unduh file dari memori lewat link sementara. */
export function unduhFile(blob: Blob, nama: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nama;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nama file laporan dengan tanggal hari ini, mis. laporan-keuangan-2026-11-26.xlsx */
export function namaFileLaporan(ekstensi: 'xlsx' | 'pdf'): string {
  const d = new Date();
  const tgl = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `laporan-keuangan-${tgl}.${ekstensi}`;
}

/** Format rupiah sederhana untuk laporan (tanpa karakter spasi khusus, aman untuk PDF). */
export function rupiah(n: number): string {
  const negatif = n < 0;
  const angka = Math.abs(Math.round(n)).toLocaleString('id-ID');
  return `${negatif ? '-' : ''}Rp ${angka}`;
}
