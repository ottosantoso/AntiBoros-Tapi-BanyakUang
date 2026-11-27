import type { MetodeBunga } from './data/utang';

export interface BarisJadwal {
  pokok: number;
  bunga: number;
}

/**
 * Pratinjau jadwal cicilan di sisi klien. Logikanya mengikuti RPC buat_cicilan di database,
 * supaya angka di layar sama dengan jadwal yang tersimpan. Jadwal yang tersimpan tetap yang dipakai.
 * Bunga per tahun (p.a.).
 */
export function hitungJadwalCicilan(
  pokok: number,
  bungaPersen: number,
  metode: MetodeBunga,
  tenor: number,
): BarisJadwal[] {
  if (!(pokok > 0) || !(tenor >= 1)) return [];
  const bunga = metode === 'tanpa_bunga' ? 0 : bungaPersen;
  const r = bunga / 100 / 12;
  const totalBungaFlat = metode === 'flat' ? Math.round((pokok * bunga) / 100 * tenor / 12) : 0;
  let pmt = 0;
  if (metode === 'anuitas') {
    pmt = r > 0 ? Math.round((pokok * r) / (1 - Math.pow(1 + r, -tenor))) : Math.round(pokok / tenor);
  }

  const jadwal: BarisJadwal[] = [];
  let sisa = pokok;
  for (let n = 1; n <= tenor; n++) {
    let p: number;
    let b: number;
    if (metode === 'anuitas') {
      b = Math.round(sisa * r);
      p = pmt - b;
    } else {
      p = Math.floor(pokok / tenor);
      b = Math.floor(totalBungaFlat / tenor);
    }
    if (n === tenor) {
      p = sisa;
      b = metode === 'anuitas' ? Math.round(sisa * r) : totalBungaFlat - Math.floor(totalBungaFlat / tenor) * (tenor - 1);
    }
    jadwal.push({ pokok: p, bunga: b });
    sisa -= p;
  }
  return jadwal;
}

export function ringkasPratinjau(jadwal: BarisJadwal[]): { angsuranPertama: number; totalBunga: number; totalBayar: number } {
  const totalBunga = jadwal.reduce((s, b) => s + b.bunga, 0);
  const totalPokok = jadwal.reduce((s, b) => s + b.pokok, 0);
  return {
    angsuranPertama: jadwal[0] ? jadwal[0].pokok + jadwal[0].bunga : 0,
    totalBunga,
    totalBayar: totalPokok + totalBunga,
  };
}
