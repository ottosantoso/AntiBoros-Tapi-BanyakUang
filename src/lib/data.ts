import { supabase } from './supabase-client';
import type {
  DashboardData,
  MonthlyTrend,
  NewTransferInput,
  Transaction,
  TransactionType,
  Wallet,
  WalletTransfer,
} from './types';
import { shortMonth } from './format';

/* ---------- Row types (DB shape) ---------- */

interface WalletRow {
  id: string;
  nama: string;
  provider: string;
  saldo: number | string;
  jenis?: string | null;
  logo_url?: string | null;
  is_archived?: boolean | null;
  archived_at?: string | null;
  created_at?: string | null;
}

interface TransactionRow {
  id: string;
  tanggal: string;
  deskripsi: string;
  tipe: string;
  nominal: number | string;
  kategori: string | null;
  wallet_id: string | null;
  berulang: boolean | null;
  transfer_id: string | null;
  created_at: string | null;
}

function toNumber(v: number | string): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

function walletFromRow(r: WalletRow): Wallet {
  return {
    id: r.id,
    nama: r.nama,
    provider: r.provider,
    saldo: toNumber(r.saldo),
    jenis: (r.jenis === 'ewallet' || r.jenis === 'lainnya' ? r.jenis : 'bank') as Wallet['jenis'],
    logoUrl: r.logo_url ?? null,
  };
}

/** Escape karakter khusus LIKE supaya nama dicocokkan apa adanya. */
function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function transactionFromRow(r: TransactionRow): Transaction {
  return {
    id: r.id,
    tanggal: r.tanggal,
    deskripsi: r.deskripsi,
    tipe: (r.tipe === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran') as TransactionType,
    nominal: toNumber(r.nominal),
    kategori: r.kategori ?? undefined,
    walletId: r.wallet_id ?? undefined,
    berulang: r.berulang ?? false,
    transferId: r.transfer_id ?? undefined,
    createdAt: r.created_at ?? undefined,
    dompet: '',
  };
}

/* ---------- Read: dashboard aggregate ---------- */

export interface DataResult {
  data: DashboardData | null;
  error: string | null;
}

/**
 * Dompet aktif saja yang masuk ke `dompet`, total saldo, dan dropdown.
 * Nama dompet arsip tetap dipakai untuk riwayat transaksi lama.
 */
export async function fetchDashboardData(range?: { start?: string; end?: string }): Promise<DataResult> {
  try {
    const [walletsRes, txRes] = await Promise.all([
      supabase.from('wallets').select('*').order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select('*')
        .order('tanggal', { ascending: false })
        .order('created_at', { ascending: false }),
    ]);
    if (walletsRes.error) throw walletsRes.error;
    if (txRes.error) throw txRes.error;

    const rows = (walletsRes.data ?? []) as WalletRow[];
    const walletName = new Map(rows.map((r) => [r.id, r.nama]));
    const wallets: Wallet[] = rows.filter((r) => !r.is_archived).map(walletFromRow);

    const allTx: Transaction[] = (txRes.data ?? [])
      .map(transactionFromRow)
      .map((t) => ({ ...t, dompet: walletName.get(t.walletId ?? '') ?? 'Tanpa Dompet' }));

    const start = range?.start;
    const end = range?.end;
    const scoped = allTx.filter((t) => {
      if (start && t.tanggal < start) return false;
      if (end && t.tanggal > end) return false;
      return true;
    });

    const pemasukan = scoped.filter((t) => t.tipe === 'Pemasukan').reduce((s, t) => s + t.nominal, 0);
    const pengeluaran = scoped.filter((t) => t.tipe === 'Pengeluaran').reduce((s, t) => s + t.nominal, 0);

    const rekapKategori: Record<string, number> = {};
    scoped
      .filter((t) => t.tipe === 'Pengeluaran')
      .forEach((t) => {
        const k = t.kategori ?? 'Lainnya';
        rekapKategori[k] = (rekapKategori[k] ?? 0) + t.nominal;
      });

    const topPengeluaran = [...scoped]
      .filter((t) => t.tipe === 'Pengeluaran')
      .sort((a, b) => b.nominal - a.nominal)
      .slice(0, 5)
      .map((t) => ({ deskripsi: t.deskripsi, nominal: t.nominal }));

    const trenBulanan: MonthlyTrend[] = buildMonthlyTrend(allTx);

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

function buildMonthlyTrend(allTx: Transaction[]): MonthlyTrend[] {
  const now = new Date();
  const out: MonthlyTrend[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthTx = allTx.filter((t) => t.tanggal.startsWith(key));
    out.push({
      bulan: shortMonth(d.getMonth()),
      pemasukan: monthTx.filter((t) => t.tipe === 'Pemasukan').reduce((s, t) => s + t.nominal, 0),
      pengeluaran: monthTx.filter((t) => t.tipe === 'Pengeluaran').reduce((s, t) => s + t.nominal, 0),
    });
  }
  return out;
}

/* ---------- Write: transactions ---------- */

export interface WriteResult {
  success: boolean;
  error: string | null;
}

export interface NewTransactionInput {
  tanggal: string;
  deskripsi: string;
  tipe: TransactionType;
  nominal: number;
  walletId: string;
  kategori?: string;
  berulang?: boolean;
}

export async function insertTransaction(input: NewTransactionInput): Promise<WriteResult> {
  const { error } = await supabase.from('transactions').insert({
    tanggal: input.tanggal,
    deskripsi: input.deskripsi,
    tipe: input.tipe,
    nominal: input.nominal,
    kategori: input.kategori || null,
    wallet_id: input.walletId || null,
    berulang: input.berulang ?? false,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export type UpdateTransactionInput = Partial<NewTransactionInput>;

export async function updateTransactionRow(
  id: string,
  input: UpdateTransactionInput,
): Promise<WriteResult> {
  const patch: Record<string, unknown> = {};
  if (input.tanggal !== undefined) patch.tanggal = input.tanggal;
  if (input.deskripsi !== undefined) patch.deskripsi = input.deskripsi;
  if (input.tipe !== undefined) patch.tipe = input.tipe;
  if (input.nominal !== undefined) patch.nominal = input.nominal;
  if (input.kategori !== undefined) patch.kategori = input.kategori || null;
  if (input.walletId !== undefined) patch.wallet_id = input.walletId || null;
  if (input.berulang !== undefined) patch.berulang = input.berulang;
  const { error } = await supabase.from('transactions').update(patch).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteTransactionRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteTransactionsBulk(ids: string[]): Promise<WriteResult> {
  if (!ids.length) return { success: true, error: null };
  const { error } = await supabase.from('transactions').delete().in('id', ids);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/* ---------- Write: transfers ---------- */

export async function insertTransfer(input: NewTransferInput): Promise<WriteResult> {
  const { error } = await supabase.from('wallet_transfers').insert({
    tanggal: input.tanggal,
    from_wallet_id: input.fromWalletId,
    to_wallet_id: input.toWalletId,
    nominal: input.nominal,
    biaya_admin: input.biayaAdmin ?? 0,
    catatan: input.catatan || null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteTransferRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('wallet_transfers').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function fetchTransfers(): Promise<{ transfers: WalletTransfer[]; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('wallet_transfers')
      .select(
        `id, tanggal, nominal, biaya_admin, catatan, created_at,
         from:wallets!wallet_transfers_from_wallet_id_fkey(id, nama),
         to:wallets!wallet_transfers_to_wallet_id_fkey(id, nama)`,
      )
      .order('tanggal', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    type TransferRow = {
      id: string;
      tanggal: string;
      nominal: number | string;
      biaya_admin: number | string;
      catatan: string | null;
      created_at: string | null;
      from: { id: string; nama: string } | null;
      to: { id: string; nama: string } | null;
    };
    const transfers: WalletTransfer[] = ((data ?? []) as unknown as TransferRow[]).map((r) => ({
      id: r.id,
      tanggal: r.tanggal,
      fromWalletId: r.from?.id ?? '',
      fromWallet: r.from?.nama ?? 'Tanpa Dompet',
      toWalletId: r.to?.id ?? '',
      toWallet: r.to?.nama ?? 'Tanpa Dompet',
      nominal: toNumber(r.nominal),
      biayaAdmin: toNumber(r.biaya_admin),
      catatan: r.catatan ?? undefined,
      createdAt: r.created_at ?? undefined,
    }));
    return { transfers, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat data transfer.';
    return { transfers: [], error: msg };
  }
}

/** Simpan banyak transaksi sekaligus (hasil AI scan mutasi). */
export async function insertTransactions(
  inputs: NewTransactionInput[],
): Promise<WriteResult & { saved: number }> {
  if (!inputs.length) return { success: true, error: null, saved: 0 };
  const { error } = await supabase
    .from('transactions')
    .insert(
      inputs.map((i) => ({
        tanggal: i.tanggal,
        deskripsi: i.deskripsi,
        tipe: i.tipe,
        nominal: i.nominal,
        kategori: i.kategori || null,
        wallet_id: i.walletId || null,
      })),
    );
  if (error) return { success: false, error: error.message, saved: 0 };
  return { success: true, error: null, saved: inputs.length };
}

/* ---------- Write: wallets (CRUD) ---------- */

export interface WalletInput {
  nama: string;
  provider: string;
  saldo: number;
  jenis?: Wallet['jenis'];
  logo_url?: string | null;
}

/** Dompet arsip: sisa saldo dan riwayatnya tetap tersimpan. */
export interface ArchivedWallet extends Wallet {
  archivedAt: string | null;
}

/** Hasil pencarian nama dompet, termasuk yang sudah diarsip. */
export interface WalletNameMatch {
  id: string;
  nama: string;
  saldo: number;
  isArchived: boolean;
  createdAt: string | null;
}

/** Unggah logo dompet ke bucket publik. Hanya untuk pengguna yang sudah masuk. */
export async function uploadWalletLogo(file: File): Promise<{ url: string | null; error: string | null }> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return { url: null, error: 'Sesi tidak ditemukan. Masuk ulang.' };

  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.\-_]+/g, '-');
  const path = `${userId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from('wallet-logos').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from('wallet-logos').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export async function insertWallet(input: WalletInput): Promise<WriteResult> {
  const { error } = await supabase.from('wallets').insert(input);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function updateWalletRow(id: string, input: WalletInput): Promise<WriteResult> {
  const { error } = await supabase.from('wallets').update(input).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Cari dompet dengan nama yang sama (tanpa membedakan huruf besar kecil), aktif maupun arsip. */
export async function findWalletsByName(
  nama: string,
): Promise<{ matches: WalletNameMatch[]; error: string | null }> {
  const { data, error } = await supabase
    .from('wallets')
    .select('id, nama, saldo, is_archived, created_at')
    .ilike('nama', escapeLike(nama.trim()));
  if (error) return { matches: [], error: error.message };
  const matches = ((data ?? []) as WalletRow[]).map((r) => ({
    id: r.id,
    nama: r.nama,
    saldo: toNumber(r.saldo),
    isArchived: Boolean(r.is_archived),
    createdAt: r.created_at ?? null,
  }));
  return { matches, error: null };
}

/** Daftar dompet diarsip, yang terbaru diarsip di atas. */
export async function fetchArchivedWallets(): Promise<{ wallets: ArchivedWallet[]; error: string | null }> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('is_archived', true)
    .order('archived_at', { ascending: false });
  if (error) return { wallets: [], error: error.message };
  const wallets = ((data ?? []) as WalletRow[]).map((r) => ({
    ...walletFromRow(r),
    archivedAt: r.archived_at ?? null,
  }));
  return { wallets, error: null };
}

/** Arsipkan dompet. Saldonya tetap tersimpan dan dompet tidak bisa dipakai untuk transaksi baru. */
export async function archiveWalletRow(id: string): Promise<WriteResult> {
  const { error } = await supabase
    .from('wallets')
    .update({ is_archived: true, archived_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Pulihkan dompet arsip. Extra bisa dipakai untuk mengganti provider atau logo saat dipulihkan. */
export async function restoreWalletRow(
  id: string,
  extra?: { provider?: string; jenis?: Wallet['jenis']; logo_url?: string | null },
): Promise<WriteResult> {
  const { error } = await supabase
    .from('wallets')
    .update({ is_archived: false, archived_at: null, ...extra })
    .eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Ganti nama dompet (dipakai saat dompet arsip perlu diberi nama baru). */
export async function renameWalletRow(id: string, nama: string): Promise<WriteResult> {
  const { error } = await supabase.from('wallets').update({ nama }).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/**
 * Hapus dompet. Jika `moveTo` diberikan, transaksi milik dompet ini
 * dipindahkan dulu ke dompet tujuan agar riwayat tidak hilang.
 */
export async function deleteWalletRow(id: string, moveTo?: string): Promise<WriteResult> {
  if (moveTo) {
    const { error: moveErr } = await supabase
      .from('transactions')
      .update({ wallet_id: moveTo })
      .eq('wallet_id', id);
    if (moveErr) return { success: false, error: moveErr.message };
  }
  const { error } = await supabase.from('wallets').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function countTransactionsForWallet(walletId: string): Promise<number> {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('wallet_id', walletId);
  if (error) return 0;
  return count ?? 0;
}
