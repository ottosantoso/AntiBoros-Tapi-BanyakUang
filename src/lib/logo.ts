/**
 * Menyesuaikan logo unggahan secara otomatis: area gambar yang berisi (bukan margin kosong
 * atau putih) dipotong, lalu diletakkan di tengah kanvas 480×160 dengan margin yang sama.
 * Hasilnya PNG transparan sehingga selalu pas di chip kartu dan preview.
 *
 * Jika gagal membaca gambar (format tidak didukung, dsb.), file asli dikembalikan apa adanya.
 */

const KANVAS_W = 480;
const KANVAS_H = 160;
const MARGIN = 16;
const MAKS_SISI_SUMBER = 1200;

function muatGambar(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gambar tidak bisa dibaca'));
    img.src = url;
  });
}

export async function normalizeLogo(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await muatGambar(url);
    const w0 = img.naturalWidth || KANVAS_W;
    const h0 = img.naturalHeight || KANVAS_H;

    // Gambar sumber dibatasi agar pencarian area berisi tidak terlalu berat.
    const skala = Math.min(1, MAKS_SISI_SUMBER / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * skala));
    const h = Math.max(1, Math.round(h0 * skala));

    const sumber = document.createElement('canvas');
    sumber.width = w;
    sumber.height = h;
    const sctx = sumber.getContext('2d', { willReadFrequently: true });
    if (!sctx) return file;
    sctx.drawImage(img, 0, 0, w, h);
    const { data } = sctx.getImageData(0, 0, w, h);

    // Area berisi = piksel yang tidak transparan dan tidak putih.
    let minX = w, minY = h, maxX = -1, maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (data[i + 3] < 20) continue;
        if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) return file; // tidak ada isi yang terbaca

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const s = Math.min((KANVAS_W - MARGIN * 2) / bw, (KANVAS_H - MARGIN * 2) / bh);
    const dw = bw * s;
    const dh = bh * s;

    const out = document.createElement('canvas');
    out.width = KANVAS_W;
    out.height = KANVAS_H;
    const octx = out.getContext('2d');
    if (!octx) return file;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(sumber, minX, minY, bw, bh, (KANVAS_W - dw) / 2, (KANVAS_H - dh) / 2, dw, dh);

    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    if (!blob) return file;
    const nama = file.name.replace(/\.[^.]+$/, '') || 'logo';
    return new File([blob], `${nama}.png`, { type: 'image/png' });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
