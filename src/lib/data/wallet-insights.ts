import { supabase } from '../supabase-client';
import { shortMonth } from '../format';
import { toNumber } from './shared';

/* ---------- Detail dompet: riwayat, grafik saldo, persen perubahan ---------- */

export type RiwayatJenis = 'Pemasukan' | 'Pengeluaran' | 'Transfer masuk' | 'Transfer keluar';

export interface WalletRiwayatRow {
  id: string;
  tanggal: string;
  deskripsi: string;
  jenis: RiwayatJenis;
  nominal: number;
  /** Efek ke saldo dompet ini: positif menambah, negatif mengurangi. */
  efek: number;
  kategori: string | null;
  /** Nama dompet lawan untuk transfer. */
  lawan: string | null;
}

export interface WalletSeriesPoint {
  bulan: string;
  /** Saldo di akhir bulan tersebut. Titik terakhir = saldo sekarang. */
  saldo: number;
}

export interface WalletInsight {
  saldoSekarang: number;
  /** Saldo di akhir bulan lalu (= awal bulan ini). */
  saldoAwalBulan: number;
  perubahanBulan: number;
  /** Persen perubahan terhadap saldo awal bulan. Null bila saldo awal bulan 0. */
  persenBulan: number | null;
  /** 6 titik, dari 5 bulan lalu sampai bulan ini. */
  series: WalletSeriesPoint[];
  /** Terbaru di atas. */
  riwayat: WalletRiwayatRow[];
  /** Pengeluaran bulan ini per kategori, terbesar di atas. */
  pengeluaranBulanIni: { kategori: string; total: number }[];
}

export interface WalletInsightsResult {
  byWallet: Record<string, WalletInsight>;
  error: string | null;
}

interface WalletInsightTxRow {
  id: string;
  tanggal: string;
  deskripsi: string;
  tipe: string;
  nominal: number | string;
  kategori: string | null;
  wallet_id: string | null;
}

interface WalletInsightTransferRow {
  id: string;
  tanggal: string;
  nominal: number | string;
  from_wallet_id: string;
  to_wallet_id: string;
}

interface WalletInsightWalletRow {
  id: string;
  nama: string;
  saldo: number | string;
}

/** Tanggal YYYY-MM-DD untuk hari terakhir bulan tertentu (monthOffset 0 = bulan ini). */
function akhirBulan(now: Date, monthOffset: number): string {
  const d = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Data untuk halaman detail dompet dan persen di kartu. Saldo masa lalu dihitung mundur dari
 * saldo sekarang dan semua pergerakan setelahnya (transaksi dan transfer), sehingga tidak perlu
 * tabel riwayat saldo. Transfer dihitung di sini; biaya admin sudah tercatat sebagai transaksi.
 * Transaksi yang sudah dihapus sementara (deleted_at) tidak dihitung.
 */
export async function fetchWalletInsights(): Promise<WalletInsightsResult> {
  try {
    const [wRes, tRes, trRes] = await Promise.all([
      supabase.from('wallets').select('id,nama,saldo').eq('is_archived', false),
      supabase
        .from('transactions')
        .select('id,tanggal,deskripsi,tipe,nominal,kategori,wallet_id')
        .is('deleted_at', null),
      supabase.from('wallet_transfers').select('id,tanggal,nominal,from_wallet_id,to_wallet_id'),
    ]);
    if (wRes.error) throw wRes.error;
    if (tRes.error) throw tRes.error;
    if (trRes.error) throw trRes.error;

    const wallets = (wRes.data ?? []) as WalletInsightWalletRow[];
    const namaById = new Map(wallets.map((w) => [w.id, w.nama]));
    const txs = (tRes.data ?? []) as WalletInsightTxRow[];
    const transfers = (trRes.data ?? []) as WalletInsightTransferRow[];

    const now = new Date();
    const awalBulanIni = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const akhirBulanIni = akhirBulan(now, 0);

    const byWallet: Record<string, WalletInsight> = {};

    for (const w of wallets) {
      const riwayat: WalletRiwayatRow[] = [];
      const perubahan: { tanggal: string; efek: number }[] = [];

      for (const t of txs) {
        if (t.wallet_id !== w.id) continue;
        const nominal = toNumber(t.nominal);
        const isMasuk = t.tipe === 'Pemasukan';
        const efek = isMasuk ? nominal : -nominal;
        riwayat.push({
          id: t.id,
          tanggal: t.tanggal,
          deskripsi: t.deskripsi,
          jenis: isMasuk ? 'Pemasukan' : 'Pengeluaran',
          nominal,
          efek,
          kategori: t.kategori,
          lawan: null,
        });
        perubahan.push({ tanggal: t.tanggal, efek });
      }

      for (const tr of transfers) {
        const nominal = toNumber(tr.nominal);
        if (tr.from_wallet_id === w.id) {
          riwayat.push({
            id: tr.id,
            tanggal: tr.tanggal,
            deskripsi: `Transfer ke ${namaById.get(tr.to_wallet_id) ?? 'dompet lain'}`,
            jenis: 'Transfer keluar',
            nominal,
            efek: -nominal,
            kategori: null,
            lawan: namaById.get(tr.to_wallet_id) ?? null,
          });
          perubahan.push({ tanggal: tr.tanggal, efek: -nominal });
        } else if (tr.to_wallet_id === w.id) {
          riwayat.push({
            id: tr.id,
            tanggal: tr.tanggal,
            deskripsi: `Transfer dari ${namaById.get(tr.from_wallet_id) ?? 'dompet lain'}`,
            jenis: 'Transfer masuk',
            nominal,
            efek: nominal,
            kategori: null,
            lawan: namaById.get(tr.from_wallet_id) ?? null,
          });
          perubahan.push({ tanggal: tr.tanggal, efek: nominal });
        }
      }

      riwayat.sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : 0));

      const saldoSekarang = toNumber(w.saldo);
      // Saldo pada tanggal D = saldo sekarang dikurangi efek setelah D.
      const efekSejak = (dariTanggal: string) =>
        perubahan.filter((p) => p.tanggal >= dariTanggal).reduce((s, p) => s + p.efek, 0);
      const efekSetelah = (tanggal: string) =>
        perubahan.filter((p) => p.tanggal > tanggal).reduce((s, p) => s + p.efek, 0);

      const saldoAwalBulan = saldoSekarang - efekSejak(awalBulanIni);
      const perubahanBulan = saldoSekarang - saldoAwalBulan;
      const persenBulan =
        saldoAwalBulan !== 0 ? Math.round((perubahanBulan / Math.abs(saldoAwalBulan)) * 1000) / 10 : null;

      const series: WalletSeriesPoint[] = [];
      for (let i = -5; i <= 0; i++) {
        const tanggal = akhirBulan(now, i);
        const bulanIdx = new Date(now.getFullYear(), now.getMonth() + i, 1).getMonth();
        series.push({
          bulan: shortMonth(bulanIdx),
          saldo: saldoSekarang - efekSetelah(tanggal),
        });
      }
      // Titik bulan ini memakai saldo sekarang, supaya tepat sama dengan kartu.
      series[series.length - 1] = { bulan: series[series.length - 1].bulan, saldo: saldoSekarang };

      const perKategori = new Map<string, number>();
      for (const r of riwayat) {
        if (r.jenis !== 'Pengeluaran' || r.kategori === 'Penyesuaian Saldo') continue;
        if (r.tanggal < awalBulanIni || r.tanggal > akhirBulanIni) continue;
        const k = r.kategori ?? 'Tanpa kategori';
        perKategori.set(k, (perKategori.get(k) ?? 0) + r.nominal);
      }

      byWallet[w.id] = {
        saldoSekarang,
        saldoAwalBulan,
        perubahanBulan,
        persenBulan,
        series,
        riwayat,
        pengeluaranBulanIni: [...perKategori.entries()]
          .map(([kategori, total]) => ({ kategori, total }))
          .sort((a, b) => b.total - a.total),
      };
    }

    return { byWallet, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat detail dompet.';
    return { byWallet: {}, error: msg };
  }
}
