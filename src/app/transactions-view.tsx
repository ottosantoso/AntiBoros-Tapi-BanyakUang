import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, FileSearch2, Filter, ListFilter, PlusCircle, Search, Sparkles, WalletCards, X } from 'lucide-react';
import { toast } from 'sonner';
import type { DashboardData, Transaction, TransactionType, WalletTransfer } from '@/lib/types';
import type { TransactionSection } from '@/app/views';
import { AddTransactionSheet, type SheetTab, type TxActions } from '@/components/add-transaction-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { GRID_COLS_WITH_ACTIONS, TransactionList } from '@/components/transaction-list';
import { cn } from '@/lib/utils';
import { formatIDR } from '@/lib/format';
import { PaginationBar, usePagination } from '@/components/pagination-bar';

type TypeFilter = 'all' | TransactionType;

/** Jumlah baris per halaman di tabel Riwayat Transaksi dan daftar Transfer. */
const TX_PAGE_SIZE = 50;
const TRANSFER_PAGE_SIZE = 20;

/** Jeda sebelum penghapusan benar-benar dikirim ke database; selama itu bisa diurungkan. */
const UNDO_MS = 8000;

interface Props extends TxActions {
  data: DashboardData;
  transfers: WalletTransfer[];
  loading: boolean;
  txSection: TransactionSection;
  onChanged: () => void;
  removeTransaction: (id: string) => Promise<{ success: boolean; error: string | null }>;
}

/** Tab form yang dibuka dari tombol di setiap submenu Transaksi. */
const SECTION_ACTIONS: Record<TransactionSection, { tab: SheetTab; label: string; className: string }[]> = {
  all: [
    { tab: 'Pemasukan', label: 'Pemasukan', className: 'bg-emerald-500 hover:bg-emerald-600' },
    { tab: 'Pengeluaran', label: 'Pengeluaran', className: 'bg-rose-500 hover:bg-rose-600' },
    { tab: 'Transfer', label: 'Transfer', className: 'bg-violet-500 hover:bg-violet-600' },
  ],
  income: [{ tab: 'Pemasukan', label: 'Catat Pemasukan', className: 'bg-emerald-500 hover:bg-emerald-600' }],
  expense: [{ tab: 'Pengeluaran', label: 'Catat Pengeluaran', className: 'bg-rose-500 hover:bg-rose-600' }],
  transfer: [{ tab: 'Transfer', label: 'Catat Transfer', className: 'bg-violet-500 hover:bg-violet-600' }],
};

const SECTION_TITLE: Record<TransactionSection, string> = {
  all: 'Semua transaksi',
  income: 'Riwayat pemasukan',
  expense: 'Riwayat pengeluaran',
  transfer: 'Riwayat transfer antar-dompet',
};

export function TransactionsView({
  data,
  transfers,
  loading,
  txSection,
  onChanged,
  addTransaction,
  editTransaction,
  addTransfer,
  removeTransaction,
}: Props) {
  const [sheetTab, setSheetTab] = useState<SheetTab | null>(null);
  const [editTarget, setEditTarget] = useState<Transaction | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const pendingDeletes = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const removeRef = useRef(removeTransaction);

  useEffect(() => {
    removeRef.current = removeTransaction;
  }, [removeTransaction]);

  // Penghapusan yang masih menunggu dijalankan saat halaman ditutup, supaya tidak hilang diam-diam.
  useEffect(() => {
    const pending = pendingDeletes.current;
    return () => {
      pending.forEach((timer, id) => {
        clearTimeout(timer);
        void removeRef.current(id);
      });
      pending.clear();
    };
  }, []);
  const [filter, setFilter] = useState<TypeFilter>('all');
  const [query, setQuery] = useState('');
  const [wallet, setWallet] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const allTransactions = useMemo(() => data.transaksi ?? [], [data.transaksi]);
  // Transaksi yang sedang menunggu penghapusan disembunyikan dari tampilan.
  const transactions = useMemo(
    () => allTransactions.filter((t) => !t.id || !hiddenIds.has(t.id)),
    [allTransactions, hiddenIds],
  );
  const wallets = useMemo(() => Array.from(new Set(transactions.map((transaction) => transaction.dompet))).filter(Boolean), [transactions]);
  const activeAdvancedFilters = [wallet !== 'all', Boolean(fromDate), Boolean(toDate)].filter(Boolean).length;

  // Di submenu Pemasukan/Pengeluaran, jenis sudah ditentukan oleh menu, jadi pill filter jenis tidak dipakai.
  const typeFilter: TypeFilter =
    txSection === 'income' ? 'Pemasukan' : txSection === 'expense' ? 'Pengeluaran' : filter;

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (typeFilter !== 'all' && transaction.tipe !== typeFilter) return false;
      if (wallet !== 'all' && transaction.dompet !== wallet) return false;
      if (fromDate && transaction.tanggal < fromDate) return false;
      if (toDate && transaction.tanggal > toDate) return false;
      if (search && !`${transaction.deskripsi} ${transaction.kategori ?? ''}`.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [typeFilter, fromDate, query, toDate, transactions, wallet]);

  // Halaman kembali ke 1 setiap filter berubah.
  const filterKey = [typeFilter, wallet, fromDate, toDate, query].join('|');
  const tablePage = usePagination(filtered, TX_PAGE_SIZE, filterKey);

  const incomeTotal = transactions.filter((transaction) => transaction.tipe === 'Pemasukan').reduce((sum, transaction) => sum + transaction.nominal, 0);
  const expenseTotal = transactions.filter((transaction) => transaction.tipe === 'Pengeluaran').reduce((sum, transaction) => sum + transaction.nominal, 0);
  const netTotal = incomeTotal - expenseTotal;

  function clearFilters() {
    setFilter('all');
    setQuery('');
    setWallet('all');
    setFromDate('');
    setToDate('');
  }

  const actions = SECTION_ACTIONS[txSection];
  const defaultTab: SheetTab = actions[0].tab;

  function openCreate(tab: SheetTab) {
    setEditTarget(null);
    setSheetTab(tab);
  }

  function openEdit(tx: Transaction) {
    setSheetTab(null);
    setEditTarget(tx);
  }

  function hideTransaction(id: string) {
    setHiddenIds((prev) => new Set(prev).add(id));
  }

  function showTransaction(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleDelete(tx: Transaction) {
    const id = tx.id;
    if (!id) return;
    setEditTarget(null);
    hideTransaction(id);
    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(id);
      const res = await removeRef.current(id);
      if (!res.success) {
        showTransaction(id);
        toast.error('Gagal menghapus transaksi', { description: res.error ?? undefined });
      }
    }, UNDO_MS);
    pendingDeletes.current.set(id, timer);
    toast('Transaksi dihapus', {
      description: `${tx.deskripsi} · ${formatIDR(tx.nominal)}`,
      duration: UNDO_MS,
      action: { label: 'Urungkan', onClick: () => undoDelete(id) },
    });
  }

  function undoDelete(id: string) {
    const timer = pendingDeletes.current.get(id);
    if (timer) clearTimeout(timer);
    pendingDeletes.current.delete(id);
    showTransaction(id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-muted-foreground">{SECTION_TITLE[txSection]}</p>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.tab}
              size="sm"
              onClick={() => openCreate(action.tab)}
              className={cn('h-10 gap-2 rounded-full px-4 font-bold text-white shadow-sm', action.className)}
            >
              <PlusCircle className="h-4 w-4" strokeWidth={2.4} />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {txSection === 'transfer' ? (
        <TransferList transfers={transfers} loading={loading} onAdd={() => openCreate('Transfer')} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <SummaryCard label="Total Pemasukan" value={incomeTotal} icon={ArrowDownLeft} className="border-[#93c5fd] bg-[#e0f2fe]" iconClass="bg-[#bfdbfe] text-[#0284c7]" valueClass="text-[#172554]" loading={loading} />
            <SummaryCard label="Total Pengeluaran" value={expenseTotal} icon={ArrowUpRight} className="border-[#fecdd3] bg-[#ffe4e6]" iconClass="bg-[#fda4af] text-[#be123c]" valueClass="text-[#172554]" loading={loading} />
            <SummaryCard label="Selisih Bersih" value={netTotal} icon={ListFilter} className="border-[#a7f3d0] bg-[#dcfce7]" iconClass="bg-[#86efac] text-[#047857]" valueClass={netTotal >= 0 ? 'text-[#047857]' : 'text-[#be123c]'} loading={loading} />
          </div>

          <Card className="rounded-2xl border-[#dbeafe] bg-white p-3 shadow-[0_6px_18px_rgba(30,64,175,0.06)] md:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              {txSection === 'all' && (
                <div className="flex shrink-0 rounded-full bg-[#eff6ff] p-1">
                  {(['all', 'Pemasukan', 'Pengeluaran'] as TypeFilter[]).map((item) => (
                    <button key={item} type="button" onClick={() => setFilter(item)} className={cn('rounded-full px-4 py-2 text-xs font-extrabold transition-all', filter === item ? 'bg-[#2563eb] text-white shadow-[0_5px_12px_rgba(37,99,235,0.2)]' : 'text-[#31548a] hover:bg-white')}>
                      {item === 'all' ? 'Semua' : item}
                    </button>
                  ))}
                </div>
              )}
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7da4]" />
                <Input placeholder="Cari deskripsi, kategori..." value={query} onChange={(event) => setQuery(event.target.value)} className="h-10 rounded-full border-[#dbeafe] bg-[#f8fbff] pl-10 text-sm font-medium text-[#172554] placeholder:text-[#7d8eaf]" />
              </div>
              <button type="button" onClick={() => setAdvancedOpen((open) => !open)} className={cn('inline-flex h-10 items-center justify-center gap-2 rounded-full border px-4 text-xs font-extrabold transition', advancedOpen || activeAdvancedFilters ? 'border-[#93c5fd] bg-[#e0f2fe] text-[#1d4ed8]' : 'border-[#dbeafe] bg-white text-[#172554] hover:bg-[#eff6ff]')}>
                <Filter className="h-4 w-4" /> Filter {activeAdvancedFilters > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#2563eb] px-1 text-[10px] text-white">{activeAdvancedFilters}</span>}
              </button>
            </div>
            {advancedOpen && (
              <div className="mt-3 grid gap-3 border-t border-[#e7eef9] pt-3 md:grid-cols-3">
                <label className="space-y-1.5 text-xs font-extrabold text-[#31548a]">Dompet<select value={wallet} onChange={(event) => setWallet(event.target.value)} className="h-10 w-full rounded-xl border border-[#dbeafe] bg-[#f8fbff] px-3 text-sm font-bold text-[#172554] outline-none focus:border-[#93c5fd]"> <option value="all">Semua Dompet</option>{wallets.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
                <label className="space-y-1.5 text-xs font-extrabold text-[#31548a]">Dari tanggal<div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2563eb]" /><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-10 w-full rounded-xl border border-[#dbeafe] bg-[#f8fbff] pl-9 pr-3 text-sm font-bold text-[#172554] outline-none focus:border-[#93c5fd]" /></div></label>
                <label className="space-y-1.5 text-xs font-extrabold text-[#31548a]">Sampai tanggal<div className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2563eb]" /><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-10 w-full rounded-xl border border-[#dbeafe] bg-[#f8fbff] pl-9 pr-3 text-sm font-bold text-[#172554] outline-none focus:border-[#93c5fd]" /></div></label>
              </div>
            )}
            {(query || filter !== 'all' || activeAdvancedFilters > 0) && <button type="button" onClick={clearFilters} className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-[#2563eb] hover:text-[#1d4ed8]">Hapus semua filter <X className="h-3.5 w-3.5" /></button>}
          </Card>

          <Card className="overflow-hidden rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]"><ListFilter className="h-5 w-5" /></span><div><h2 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">Riwayat Transaksi</h2><p className="text-xs font-medium text-[#5b6f99]">{loading ? 'Memuat transaksi...' : `${filtered.length} transaksi ditemukan`}</p></div></div>
              {!loading && filtered.length > 0 && <span className="hidden rounded-full bg-[#eff6ff] px-3 py-1.5 text-xs font-extrabold text-[#2563eb] sm:inline-flex">Terbaru</span>}
            </div>
            {loading ? <TransactionList transactions={filtered} loading limit={5} /> : filtered.length ? <div className="overflow-x-auto"><div className="min-w-[760px]"><div className={cn('grid gap-3 border-b border-[#dbeafe] pb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#5b6f99]', GRID_COLS_WITH_ACTIONS)}><span>Tanggal</span><span>Keterangan</span><span>Kategori</span><span className="text-right">Nominal</span><span className="text-right">Aksi</span></div><TransactionList transactions={tablePage.pageItems} onEdit={openEdit} onDelete={handleDelete} /></div></div> : <EmptyTransactions hasAnyTransactions={transactions.length > 0} onAdd={() => openCreate(defaultTab)} actionLabel={actions[0].label} />}
            {!loading && filtered.length > 0 && (
              <PaginationBar
                page={tablePage.page}
                totalPages={tablePage.totalPages}
                total={tablePage.total}
                from={tablePage.from}
                to={tablePage.to}
                setPage={tablePage.setPage}
                noun="transaksi"
              />
            )}
          </Card>
        </>
      )}

      <AddTransactionSheet
        open={sheetTab !== null || editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSheetTab(null);
            setEditTarget(null);
          }
        }}
        wallets={data.dompet}
        onSubmitted={onChanged}
        initialTab={sheetTab ?? defaultTab}
        lockTab
        editing={editTarget}
        existingTransactions={allTransactions}
        onDelete={editTarget ? () => handleDelete(editTarget) : undefined}
        addTransaction={addTransaction}
        editTransaction={editTransaction}
        addTransfer={addTransfer}
      />
    </div>
  );
}

function TransferList({ transfers, loading, onAdd }: { transfers: WalletTransfer[]; loading: boolean; onAdd: () => void }) {
  const transferPage = usePagination(transfers, TRANSFER_PAGE_SIZE, '');
  if (loading) {
    return (
      <Card className="rounded-2xl border-[#dbeafe] bg-white p-5">
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }
  return (
    <Card className="overflow-hidden rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]">
      <div className="mb-3 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-100 text-violet-600"><ArrowLeftRight className="h-5 w-5" /></span>
        <div>
          <h2 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">Riwayat Transfer</h2>
          <p className="text-xs font-medium text-[#5b6f99]">{transfers.length} transfer tercatat</p>
        </div>
      </div>
      {transfers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <FileSearch2 className="h-9 w-9 text-[#93a4c4]" />
          <p className="mt-3 text-sm font-bold text-[#5b6f99]">Belum ada transfer antar-dompet.</p>
          <Button size="sm" onClick={onAdd} className="mt-4 gap-2 rounded-full bg-violet-500 font-bold text-white hover:bg-violet-600">
            <PlusCircle className="h-4 w-4" /> Catat Transfer
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-[#e7eef9]">
          {transferPage.pageItems.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-600"><WalletCards className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#172554]">{item.fromWallet} → {item.toWallet}</p>
                <p className="truncate text-xs font-medium text-[#5b6f99]">
                  {formatTanggal(item.tanggal)}{item.catatan ? ` · ${item.catatan}` : ''}{item.biayaAdmin > 0 ? ` · biaya admin ${formatIDR(item.biayaAdmin)}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-sm font-extrabold tnum text-[#172554]">{formatIDR(item.nominal)}</span>
            </li>
          ))}
        </ul>
      )}
      {transfers.length > 0 && (
        <PaginationBar
          page={transferPage.page}
          totalPages={transferPage.totalPages}
          total={transferPage.total}
          from={transferPage.from}
          to={transferPage.to}
          setPage={transferPage.setPage}
          noun="transfer"
        />
      )}
    </Card>
  );
}

function formatTanggal(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SummaryCard({ label, value, icon: Icon, className, iconClass, valueClass, loading }: { label: string; value: number; icon: typeof ArrowDownLeft; className: string; iconClass: string; valueClass: string; loading: boolean }) {
  return <Card className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-[0_6px_18px_rgba(30,64,175,0.06)]', className)}><div className="flex items-start justify-between"><span className={cn('grid h-10 w-10 place-items-center rounded-xl', iconClass)}><Icon className="h-5 w-5" strokeWidth={2.4} /></span><span className="rounded-full bg-white/65 px-2.5 py-1 text-[11px] font-extrabold text-[#2563eb]">+0.0%</span></div><p className="mt-3 text-xs font-bold text-[#172554]">{label}</p>{loading ? <Skeleton className="mt-1 h-8 w-32" /> : <p className={cn('mt-1 font-display text-[25px] font-extrabold tracking-[-0.04em] tnum', valueClass)}>{formatIDR(value)}</p>}<div className="pointer-events-none absolute -bottom-3 right-3 flex items-end gap-1 opacity-20"><span className="h-7 w-3 rounded-t bg-current" /><span className="h-12 w-3 rounded-t bg-current" /><span className="h-16 w-3 rounded-t bg-current" /><span className="h-20 w-3 rounded-t bg-current" /></div></Card>;
}

function EmptyTransactions({ hasAnyTransactions, onAdd, actionLabel }: { hasAnyTransactions: boolean; onAdd: () => void; actionLabel: string }) {
  return <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-white to-[#f5f9ff] px-5 py-8 text-center"><div className="relative grid h-32 w-40 place-items-center"><div className="absolute h-28 w-36 rounded-[50%] bg-[#e0f2fe]" /><div className="relative grid h-20 w-16 rotate-[-4deg] place-items-center rounded-xl border-4 border-[#93c5fd] bg-white shadow-[7px_8px_0_#bfdbfe]"><FileSearch2 className="h-9 w-9 text-[#2563eb]" /><span className="absolute -right-4 bottom-0 grid h-10 w-10 place-items-center rounded-full bg-[#2563eb] text-white shadow-md"><Search className="h-5 w-5" /></span></div><Sparkles className="absolute left-3 top-2 h-5 w-5 text-[#fbbf24]" /><Sparkles className="absolute right-2 top-8 h-4 w-4 text-[#60a5fa]" /></div><h3 className="mt-4 font-display text-lg font-extrabold tracking-[-0.03em] text-[#172554]">{hasAnyTransactions ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi.'}</h3><p className="mt-1 max-w-sm text-sm font-medium text-[#5b6f99]">{hasAnyTransactions ? 'Coba ubah kata kunci atau filter untuk melihat transaksi lain.' : 'Catat transaksi pertamamu untuk mulai mengatur keuangan.'}</p><button type="button" onClick={onAdd} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] transition hover:bg-[#1d4ed8]"><WalletCards className="h-4 w-4" /> {actionLabel}</button></div>;
}
