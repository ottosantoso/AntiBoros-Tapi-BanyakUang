import { supabase } from '../supabase-client';
import type { DashboardData, MonthlyTrend, Transaction } from '../types';
import { shortMonth } from '../format';
import { walletFromRow, type WalletRow } from './wallets';
import { transactionFromRow, type TransactionRow } from './transactions';
import { isPemasukanRiil, isPengeluaranRiil } from '../transaction-view';

/* ---------- Dashboard: agregat satu rentang ---------- */

export interface DataResult {
  data: DashboardData | null;
  error: string | null;
}

/**
 * Dompet aktif saja yang masuk ke `dompet`, total saldo, dan dropdown.
 * Nama dompet arsip tetap dipakai untuk riwayat transaksi lama.
 * Transaksi yang sudah dihapus sementara (deleted_at) tidak dibaca sama sekali.
 */
export async function fetchDashboardData(range?: { start?: string; end?: string }): Promise<DataResult> {
  try {
    // Catat transaksi berulang yang sudah jatuh tempo sebelum data dibaca. Idempoten.
    await supabase.rpc('proses_transaksi_berulang');
    const [walletsRes, txRes] = await Promise.all([
      supabase.from('wallets').select('*').order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select('*')
        .is('deleted_at', null)
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    if (walletsRes.error) throw walletsRes.error;
    if (txRes.error) throw txRes.error;

    const rows = (walletsRes.data ?? []) as WalletRow[];
    const walletName = new Map(rows.map((r) => [r.id, r.nama]));
    const wallets = rows.filter((r) => !r.is_archived).map(walletFromRow);

    const allTx: Transaction[] = ((txRes.data ?? []) as TransactionRow[])
      .map(transactionFromRow)
      .map((t) => ({ ...t, dompet: walletName.get(t.walletId ?? '') ?? 'Tanpa Dompet' }));

    const start = range?.start;
    const end = range?.end;
    const scoped = allTx.filter((t) => {
      if (start && t.tanggal < start) return false;
      if (end && t.tanggal > end) return false;
      return true;
    });

    // Pemasukan/pengeluaran riil: koreksi saldo dan sisi transfer antar dompet tidak dihitung.
    const pemasukan = scoped.filter(isPemasukanRiil).reduce((s, t) => s + t.nominal, 0);
    const pengeluaran = scoped.filter(isPengeluaranRiil).reduce((s, t) => s + t.nominal, 0);

    const rekapKategori: Record<string, number> = {};
    scoped
      .filter(isPengeluaranRiil)
      .forEach((t) => {
        const k = t.kategori ?? 'Lainnya';
        rekapKategori[k] = (rekapKategori[k] ?? 0) + t.nominal;
      });

    const topPengeluaran = [...scoped]
      .filter(isPengeluaranRiil)
      .sort((a, b) => b.nominal - a.nominal)
      .slice(0, 5)
      .map((t) => ({ deskripsi: t.deskripsi, nominal: t.nominal }));

    // 12 bulan terakhir; tampilan grafik memilih 1, 3, 6, atau 12 bulan dari akhir.
    const trenBulanan: MonthlyTrend[] = buildMonthlyTrend(allTx, 12);

    return {
      data: {
        totalSaldo: wallets.reduce((s, w) => s + w.saldo, 0),
        pemasukanBulanIni: pemasukan,
        pengeluaranBulanIni: pengeluaran,
        tabunganBulanIni: pemasukan - pengeluaran,
        dompet: wallets,
        topPengeluaran,
        rekapKategori,
        transaksi: scoped,
        trenBulanan,
      },
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat data.';
    return { data: null, error: msg };
  }
}

function buildMonthlyTrend(allTx: Transaction[], months: number): MonthlyTrend[] {
  const now = new Date();
  const out: MonthlyTrend[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = allTx.filter((t) => t.tanggal.startsWith(key));
    out.push({
      bulan: shortMonth(d.getMonth()),
      pemasukan: monthTx.filter(isPemasukanRiil).reduce((s, t) => s + t.nominal, 0),
      pengeluaran: monthTx.filter(isPengeluaranRiil).reduce((s, t) => s + t.nominal, 0),
    });
  }
  return out;
}
