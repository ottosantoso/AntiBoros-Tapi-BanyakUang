import { supabase } from '../supabase-client';

/* ---------- Reset data (Pengaturan) ---------- */

export interface ResetResult {
  success: boolean;
  error: string | null;
  /** Transaksi yang dipindah ke Sampah. Masih bisa dipulihkan dari Sampah. */
  jumlahTransaksi: number;
  /** Transfer antar-dompet yang dihapus permanen. Tidak bisa dipulihkan, tapi tercatat di riwayat saldo. */
  jumlahTransfer: number;
}

/**
 * Reset data bulan ini: transaksi dengan tanggal dalam rentang dipindah ke Sampah.
 * Transfer antar-dompet dan biaya admin-nya tidak disentuh. Dompet, saldo awal, kategori, budget, dan target tetap.
 */
export async function resetTransaksiPeriode(range: { start: string; end: string }): Promise<ResetResult> {
  const { data, error } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .is('deleted_at', null)
    .is('transfer_id', null)
    .gte('tanggal', range.start)
    .lte('tanggal', range.end)
    .select('id');
  if (error) return { success: false, error: error.message, jumlahTransaksi: 0, jumlahTransfer: 0 };
  return { success: true, error: null, jumlahTransaksi: (data ?? []).length, jumlahTransfer: 0 };
}

/**
 * Reset semua data: semua transaksi dipindah ke Sampah, lalu semua transfer antar-dompet dihapus permanen.
 * Saldo dompet kembali ke saldo awal karena setiap efek dibalik oleh trigger database.
 * Dompet, kategori, budget, dan target tetap.
 */
export async function resetSemuaTransaksi(): Promise<ResetResult> {
  const { data: trx, error: trxErr } = await supabase
    .from('transactions')
    .update({ deleted_at: new Date().toISOString() })
    .is('deleted_at', null)
    .select('id');
  if (trxErr) return { success: false, error: trxErr.message, jumlahTransaksi: 0, jumlahTransfer: 0 };

  const jumlahTransaksi = (trx ?? []).length;
  const { data: trf, error: trfErr } = await supabase
    .from('wallet_transfers')
    .delete()
    .not('id', 'is', null)
    .select('id');
  if (trfErr) {
    return {
      success: false,
      error: `Transaksi sudah dipindah ke Sampah, tetapi transfer gagal dihapus: ${trfErr.message}`,
      jumlahTransaksi,
      jumlahTransfer: 0,
    };
  }
  return { success: true, error: null, jumlahTransaksi, jumlahTransfer: (trf ?? []).length };
}
