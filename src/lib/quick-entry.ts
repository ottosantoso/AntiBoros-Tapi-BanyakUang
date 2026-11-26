import type { TransactionType, Wallet } from './types';

/**
 * Catat cepat: menerjemahkan satu baris teks menjadi draf transaksi. Fungsi murni, tanpa database.
 *
 * Contoh yang didukung:
 *   15/04 25rb parkir GOPAY       -> pengeluaran 25.000, parkir, dompet GoPay, tanggal 15 April tahun ini
 *   +5jt gaji BCA                 -> pemasukan 5.000.000, gaji, dompet BCA, tanggal hari ini
 *   1,5jt makan siang Mandiri     -> pengeluaran 1.500.000 (koma sebagai desimal)
 *   1.500.000 belanja Blu         -> pengeluaran 1.500.000 (titik sebagai pemisah ribuan)
 *
 * Aturan:
 * - Nominal wajib. Angka + satuan: rb/ribu/k = 1.000, jt/juta = 1.000.000.
 * - Dompet dicocokkan dari akhir kalimat (tanpa membedakan huruf besar kecil). Kalau hanya ada satu dompet, dipakai otomatis.
 * - Tanggal opsional: dd/mm atau dd/mm/yyyy. Kalau tidak ada, hari ini.
 * - Tanda + di depan, atau kata gaji/bonus/thr/cashback/refund/komisi, menandai pemasukan. Lainnya pengeluaran.
 * - Sisa kata menjadi deskripsi.
 */

export interface QuickEntryDraft {
  tanggal: string;
  deskripsi: string;
  tipe: TransactionType;
  nominal: number;
  walletId: string;
  walletNama: string;
}

export type QuickEntryResult = { ok: true; draft: QuickEntryDraft } | { ok: false; error: string };

const SATUAN: Record<string, number> = { rb: 1_000, ribu: 1_000, k: 1_000, jt: 1_000_000, juta: 1_000_000 };
const KATA_PEMASUKAN = ['gaji', 'bonus', 'thr', 'cashback', 'refund', 'komisi'];
const NOMINAL_RE = /^(\d{1,3}(?:\.\d{3})+|\d+(?:[.,]\d+)?)(rb|ribu|k|jt|juta)?$/i;
const TANGGAL_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "15/04" atau "15/04/2026" menjadi YYYY-MM-DD. Null bila bukan tanggal yang valid. */
function parseTanggal(token: string, tahunDefault: number): string | null {
  const m = TANGGAL_RE.exec(token);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = tahunDefault;
  if (m[3]) year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return isoDate(d);
}

/** "25rb", "1,5jt", "1.500.000", "500000" menjadi angka rupiah. Null bila bukan nominal. */
function parseNominal(token: string): number | null {
  const m = NOMINAL_RE.exec(token);
  if (!m) return null;
  const raw = m[1];
  const satuan = m[2] ? SATUAN[m[2].toLowerCase()] : 1;
  const angka = /^\d{1,3}(\.\d{3})+$/.test(raw) ? Number(raw.replace(/\./g, '')) : Number(raw.replace(',', '.'));
  if (!Number.isFinite(angka)) return null;
  return Math.round(angka * satuan);
}

export function parseQuickEntry(input: string, wallets: Wallet[], today: Date = new Date()): QuickEntryResult {
  let text = input.trim().replace(/\s+/g, ' ');
  if (!text) return { ok: false, error: 'Tulis transaksi, contoh: 25rb parkir GOPAY' };

  let tipe: TransactionType = 'Pengeluaran';
  if (text.startsWith('+')) {
    tipe = 'Pemasukan';
    text = text.slice(1).trim();
  }

  // Dompet dicocokkan dari akhir kalimat. Nama yang lebih panjang dicek dulu, supaya "blu by BCA" tidak terpotong jadi "BCA".
  let walletId = '';
  let walletNama = '';
  const sorted = [...wallets].sort((a, b) => b.nama.length - a.nama.length);
  const lower = text.toLowerCase();
  for (const w of sorted) {
    const nama = w.nama.toLowerCase();
    if (lower === nama || lower.endsWith(` ${nama}`)) {
      walletId = w.id;
      walletNama = w.nama;
      text = text.slice(0, text.length - w.nama.length).trim();
      break;
    }
  }
  if (!walletId && wallets.length === 1) {
    walletId = wallets[0].id;
    walletNama = wallets[0].nama;
  }

  const tahun = today.getFullYear();
  let tanggal = isoDate(today);
  let tanggalAda = false;
  let nominal: number | null = null;
  const sisa: string[] = [];
  for (const token of text.split(' ').filter(Boolean)) {
    if (!tanggalAda) {
      const t = parseTanggal(token, tahun);
      if (t) {
        tanggal = t;
        tanggalAda = true;
        continue;
      }
    }
    if (nominal === null) {
      const candidate = token.startsWith('+') ? token.slice(1) : token;
      const n = parseNominal(candidate);
      if (n !== null) {
        nominal = n;
        if (token.startsWith('+')) tipe = 'Pemasukan';
        continue;
      }
    }
    sisa.push(token);
  }

  if (nominal === null || nominal <= 0) {
    return { ok: false, error: 'Nominal belum ada. Contoh: 25rb, 1,5jt, atau 500000' };
  }
  if (sisa.some((kata) => KATA_PEMASUKAN.includes(kata.toLowerCase()))) tipe = 'Pemasukan';

  const deskripsi = sisa.join(' ').trim();
  if (!deskripsi) return { ok: false, error: 'Deskripsi belum ada. Contoh: 25rb parkir GOPAY' };
  if (!walletId) {
    return { ok: false, error: 'Dompet belum dikenali. Tulis nama dompet di akhir, contoh: ... GOPAY' };
  }

  return { ok: true, draft: { tanggal, deskripsi, tipe, nominal, walletId, walletNama } };
}
