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
  subkategori_id?: string | null;
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
    jenis: (r.jenis === 'ewallet' || r.jenis === 'lainnya' || r.jenis === 'tunai' ? r.jenis : 'bank') as Wallet['jenis'],
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
    subkategoriId: r.subkategori_id ?? undefined,
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
  subkategoriId?: string | null;
  berulang?: boolean;
}

export async function insertTransaction(input: NewTransactionInput): Promise<WriteResult> {
  const { error } = await supabase.from('transactions').insert({
    tanggal: input.tanggal,
    deskripsi: input.deskripsi,
    tipe: input.tipe,
    nominal: input.nominal,
    kategori: input.kategori || null,
    subkategori_id: input.subkategoriId || null,
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
  if (input.subkategoriId !== undefined) patch.subkategori_id = input.subkategoriId || null;
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
        subkategori_id: i.subkategoriId || null,
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

/** Field yang boleh diubah dari menu edit. Saldo sengaja tidak ikut: saldo hanya berubah lewat transaksi dan transfer. */
export interface WalletEditInput {
  nama: string;
  provider: string;
  jenis: Wallet['jenis'];
  logo_url: string | null;
}

export async function updateWalletRow(id: string, input: WalletEditInput): Promise<WriteResult> {
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

/* ---------- Sprint 4: subkategori, budget, goals ---------- */

export type Budgeting = 'Kebutuhan' | 'Keinginan' | 'Tabungan';

/** Kategori sistem: bukan pemasukan/pengeluaran riil untuk analisa 50/30/20. */
export const NON_REAL_KATEGORI = new Set(['Transfer', 'Penyesuaian Saldo']);

export interface Subkategori {
  id: string;
  nama: string;
  kategori: string;
  jenis: TransactionType;
  budgeting: Budgeting | null;
}

export interface BudgetLimit {
  id: string;
  subkategoriId: string;
  limit: number;
}

export interface Goal {
  id: string;
  nama: string;
  target: number;
  terkumpul: number;
  deadline: string | null;
}

export interface BudgetData {
  subkategori: Subkategori[];
  budgets: BudgetLimit[];
  goals: Goal[];
  /** Pemasukan periode, tanpa kategori sistem (transfer antar dompet, penyesuaian saldo). */
  pemasukan: number;
  /** Pengeluaran periode per subkategori_id. */
  spentBySubkat: Record<string, number>;
  error: string | null;
}

interface SubkategoriDbRow {
  id: string;
  nama: string;
  kategori: string;
  jenis: string;
  budgeting: string | null;
}

interface BudgetDbRow {
  id: string;
  subkategori_id: string;
  limit_amount: number | string;
}

interface GoalDbRow {
  id: string;
  nama: string;
  target: number | string;
  terkumpul: number | string;
  deadline: string | null;
}

interface TxAggDbRow {
  tipe: string;
  nominal: number | string;
  subkategori_id: string | null;
}

export async function fetchBudgetData(range: { start: string; end: string }): Promise<BudgetData> {
  try {
    const [subRes, budRes, goalRes, txRes] = await Promise.all([
      supabase.from('subkategori').select('id,nama,kategori,jenis,budgeting').order('nama', { ascending: true }),
      supabase.from('budgets').select('id,subkategori_id,limit_amount'),
      supabase.from('goals').select('id,nama,target,terkumpul,deadline').order('created_at', { ascending: true }),
      supabase
        .from('transactions')
        .select('tipe,nominal,subkategori_id')
        .gte('tanggal', range.start)
        .lte('tanggal', range.end),
    ]);
    if (subRes.error) throw subRes.error;
    if (budRes.error) throw budRes.error;
    if (goalRes.error) throw goalRes.error;
    if (txRes.error) throw txRes.error;

    const subkategori: Subkategori[] = ((subRes.data ?? []) as SubkategoriDbRow[]).map((r) => ({
      id: r.id,
      nama: r.nama,
      kategori: r.kategori,
      jenis: (r.jenis === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran') as TransactionType,
      budgeting: (r.budgeting as Budgeting | null) ?? null,
    }));
    const kategoriById = new Map(subkategori.map((s) => [s.id, s.kategori]));

    let pemasukan = 0;
    const spentBySubkat: Record<string, number> = {};
    for (const r of (txRes.data ?? []) as TxAggDbRow[]) {
      const nominal = toNumber(r.nominal);
      const kat = r.subkategori_id ? kategoriById.get(r.subkategori_id) : undefined;
      if (r.tipe === 'Pemasukan') {
        if (!(kat && NON_REAL_KATEGORI.has(kat))) pemasukan += nominal;
      } else if (r.subkategori_id) {
        spentBySubkat[r.subkategori_id] = (spentBySubkat[r.subkategori_id] ?? 0) + nominal;
      }
    }

    return {
      subkategori,
      budgets: ((budRes.data ?? []) as BudgetDbRow[]).map((r) => ({
        id: r.id,
        subkategoriId: r.subkategori_id,
        limit: toNumber(r.limit_amount),
      })),
      goals: ((goalRes.data ?? []) as GoalDbRow[]).map((r) => ({
        id: r.id,
        nama: r.nama,
        target: toNumber(r.target),
        terkumpul: toNumber(r.terkumpul),
        deadline: r.deadline,
      })),
      pemasukan,
      spentBySubkat,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memuat data budget.';
    return { subkategori: [], budgets: [], goals: [], pemasukan: 0, spentBySubkat: {}, error: message };
  }
}

export async function upsertBudgetLimit(subkategoriId: string, limit: number): Promise<WriteResult> {
  const { error } = await supabase
    .from('budgets')
    .upsert({ subkategori_id: subkategoriId, limit_amount: limit }, { onConflict: 'user_id,subkategori_id' });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteBudgetRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('budgets').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export interface GoalInput {
  nama: string;
  target: number;
  terkumpul?: number;
  deadline?: string | null;
}

export async function insertGoal(input: GoalInput): Promise<WriteResult> {
  const { error } = await supabase.from('goals').insert({
    nama: input.nama,
    target: input.target,
    terkumpul: input.terkumpul ?? 0,
    deadline: input.deadline ?? null,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function updateGoalRow(id: string, patch: Partial<GoalInput>): Promise<WriteResult> {
  const { error } = await supabase.from('goals').update(patch).eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

export async function deleteGoalRow(id: string): Promise<WriteResult> {
  const { error } = await supabase.from('goals').delete().eq('id', id);
  if (error) return { success: false, error: error.message };
  return { success: true, error: null };
}

/** Daftar subkategori milik pengguna, untuk dropdown transaksi dan pemetaan scanner. */
export async function fetchSubkategori(): Promise<Subkategori[]> {
  const { data, error } = await supabase
    .from('subkategori')
    .select('id,nama,kategori,jenis,budgeting')
    .order('nama', { ascending: true });
  if (error || !data) return [];
  return (data as SubkategoriDbRow[]).map((r) => ({
    id: r.id,
    nama: r.nama,
    kategori: r.kategori,
    jenis: (r.jenis === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran') as TransactionType,
    budgeting: (r.budgeting as Budgeting | null) ?? null,
  }));
}

/**
 * Cocokkan teks kategori (dari AI scanner) ke subkategori yang ada.
 * Urutan: nama persis, lalu kategori persis, lalu fallback 'Lain-lain' (pengeluaran)
 * atau 'Pendapatan Lainnya' (pemasukan).
 */
export function matchSubkategori(
  list: Subkategori[],
  kategori: string,
  jenis: TransactionType,
): Subkategori | undefined {
  const k = kategori.trim().toLowerCase();
  const sameJenis = list.filter((s) => s.jenis === jenis);
  const exact =
    sameJenis.find((s) => s.nama.toLowerCase() === k) ??
    sameJenis.find((s) => s.kategori.toLowerCase() === k);
  if (exact) return exact;
  const fallbackNama = jenis === 'Pemasukan' ? 'Pendapatan Lainnya' : 'Lain-lain';
  return sameJenis.find((s) => s.nama === fallbackNama);
}

/* ---------- Sprint 5: analisa (fungsi database report_summary) ---------- */

export interface AnalisaKategori {
  kategori: string;
  total: number;
  /** Persen terhadap total pengeluaran periode. */
  persen: number;
}

export interface AnalisaTopItem {
  id: string;
  tanggal: string;
  deskripsi: string;
  nominal: number;
  kategori: string;
}

export interface AnalisaSumber {
  kategori: string;
  total: number;
}

export interface AnalisaData {
  pemasukan: number;
  pengeluaran: number;
  sisaBersih: number;
  /** Null bila pemasukan periode 0. */
  rasioTabungan: number | null;
  perKategori: AnalisaKategori[];
  topPengeluaran: AnalisaTopItem[];
  /** Enam bulan yang berakhir di bulan akhir periode. */
  tren: MonthlyTrend[];
  sumberPemasukan: AnalisaSumber[];
  /** Transfer antar dompet: tidak dihitung sebagai pemasukan/pengeluaran. */
  transfer: { jumlah: number; total: number; biayaAdmin: number };
}

export interface AnalisaResult {
  data: AnalisaData | null;
  error: string | null;
}

type JsonObject = Record<string, unknown>;

function asObject(v: unknown): JsonObject {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonObject) : {};
}

function asArray(v: unknown): JsonObject[] {
  return Array.isArray(v) ? v.map(asObject) : [];
}

function asNumber(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

function asText(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/** Ringkasan laporan satu periode. Tanggal berformat YYYY-MM-DD. */
export async function fetchAnalisa(range: { start: string; end: string }): Promise<AnalisaResult> {
  try {
    const { data, error } = await supabase.rpc('report_summary', { p_from: range.start, p_to: range.end });
    if (error) throw error;

    const r = asObject(data);
    const aliran = asObject(r.aliran_dana);
    const transfer = asObject(aliran.transfer);
    const rasio = r.rasio_tabungan;

    const tren: MonthlyTrend[] = asArray(r.tren_6_bulan).map((x) => {
      const bulan = asText(x.bulan);
      const idx = Number(bulan.slice(5, 7)) - 1;
      return {
        bulan: idx >= 0 && idx < 12 ? shortMonth(idx) : bulan,
        pemasukan: asNumber(x.pemasukan),
        pengeluaran: asNumber(x.pengeluaran),
      };
    });

    return {
      data: {
        pemasukan: asNumber(r.pemasukan),
        pengeluaran: asNumber(r.pengeluaran),
        sisaBersih: asNumber(r.sisa_bersih),
        rasioTabungan: rasio === null || rasio === undefined ? null : asNumber(rasio),
        perKategori: asArray(r.per_kategori).map((x) => ({
          kategori: asText(x.kategori) || 'Tanpa kategori',
          total: asNumber(x.total),
          persen: asNumber(x.persen),
        })),
        topPengeluaran: asArray(r.top_pengeluaran).map((x) => ({
          id: asText(x.id),
          tanggal: asText(x.tanggal),
          deskripsi: asText(x.deskripsi),
          nominal: asNumber(x.nominal),
          kategori: asText(x.kategori) || 'Tanpa kategori',
        })),
        tren,
        sumberPemasukan: asArray(aliran.sumber_pemasukan).map((x) => ({
          kategori: asText(x.kategori) || 'Tanpa kategori',
          total: asNumber(x.total),
        })),
        transfer: {
          jumlah: asNumber(transfer.jumlah),
          total: asNumber(transfer.total),
          biayaAdmin: asNumber(transfer.biaya_admin),
        },
      },
      error: null,
    };
  } catch (err) {
    const message =
      err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string'
        ? (err as { message: string }).message
        : 'Gagal memuat analisa.';
    return { data: null, error: message };
  }
}

export interface AiAnalysisResult {
  data: { insights: string[]; hemat: string[] } | null;
  error: string | null;
}

/** Minta insight AI untuk satu periode. Hanya ringkasan angka yang dikirim, bukan detail transaksi. */
export async function fetchAiAnalysis(payload: {
  periode: string;
  data: AnalisaData;
}): Promise<AiAnalysisResult> {
  try {
    const d = payload.data;
    const { data, error } = await supabase.functions.invoke<{
      status?: string;
      data?: { insights?: string[]; hemat?: string[] };
      message?: string;
    }>('ai-analysis', {
      body: {
        periode: payload.periode,
        pemasukan: d.pemasukan,
        pengeluaran: d.pengeluaran,
        sisaBersih: d.sisaBersih,
        rasioTabungan: d.rasioTabungan,
        perKategori: d.perKategori.slice(0, 12).map((k) => ({ kategori: k.kategori, total: k.total, persen: k.persen })),
        tren: d.tren.map((t) => ({ bulan: t.bulan, pemasukan: t.pemasukan, pengeluaran: t.pengeluaran })),
        sumberPemasukan: d.sumberPemasukan.map((s) => ({ kategori: s.kategori, total: s.total })),
        transferJumlah: d.transfer.jumlah,
        transferBiayaAdmin: d.transfer.biayaAdmin,
      },
    });
    if (error) return { data: null, error: `Gagal menghubungi AI: ${error.message}` };
    if (data?.status === 'success' && data.data) {
      return { data: { insights: data.data.insights ?? [], hemat: data.data.hemat ?? [] }, error: null };
    }
    return { data: null, error: data?.message ?? 'AI belum bisa membuat insight. Coba lagi nanti.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal terhubung ke server.';
    return { data: null, error: `Gagal menghubungi AI: ${msg}` };
  }
}

/* ---------- Riwayat insight AI (tabel ai_reports) ---------- */

export interface AiReportRecord {
  id: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  insights: string[];
  hemat: string[];
}

/** Simpan hasil insight AI sebagai riwayat. Gagal simpan tidak membatalkan tampilan hasil. */
export async function saveAiReport(input: {
  kind: 'dashboard' | 'analisa';
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, unknown>;
  narrative: { insights: string[]; hemat: string[] };
}): Promise<WriteResult> {
  try {
    const { error } = await supabase.from('ai_reports').insert({
      kind: input.kind,
      period_start: input.periodStart,
      period_end: input.periodEnd,
      metrics: input.metrics,
      narrative: input.narrative,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan riwayat insight.';
    return { success: false, error: msg };
  }
}

/** Insight AI terakhir untuk satu jenis tampilan. Null bila belum pernah dibuat. */
export async function fetchLatestAiReport(
  kind: 'dashboard' | 'analisa',
): Promise<{ report: AiReportRecord | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('ai_reports')
      .select('id,created_at,period_start,period_end,narrative')
      .eq('kind', kind)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return { report: null, error: error.message };
    const row = ((data ?? []) as Array<{
      id: string;
      created_at: string;
      period_start: string;
      period_end: string;
      narrative: { insights?: string[]; hemat?: string[] } | null;
    }>)[0];
    if (!row) return { report: null, error: null };
    return {
      report: {
        id: row.id,
        createdAt: row.created_at,
        periodStart: row.period_start,
        periodEnd: row.period_end,
        insights: row.narrative?.insights ?? [],
        hemat: row.narrative?.hemat ?? [],
      },
      error: null,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal memuat riwayat insight.';
    return { report: null, error: msg };
  }
}

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
 */
export async function fetchWalletInsights(): Promise<WalletInsightsResult> {
  try {
    const [wRes, tRes, trRes] = await Promise.all([
      supabase.from('wallets').select('id,nama,saldo').eq('is_archived', false),
      supabase.from('transactions').select('id,tanggal,deskripsi,tipe,nominal,kategori,wallet_id'),
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
          saldo: saldoSekarang - efekSetelah(tanggal) - (i === 0 ? 0 : 0),
        });
      }
      // Titik bulan ini memakai saldo sekarang, supaya tepat sama dengan kartu.
      series[series.length - 1] = { bulan: series[series.length - 1].bulan, saldo: saldoSekarang };

      const perKategori = new Map<string, number>();
      for (const r of riwayat) {
        if (r.jenis !== 'Pengeluaran' || r.tanggal < awalBulanIni || r.tanggal > akhirBulanIni) continue;
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
