import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, ChevronDown, Download, FileSearch2, ListFilter, PlusCircle, Search, SlidersHorizontal, WalletCards, X } from 'lucide-react';
import { toast } from 'sonner';
import type { DashboardData, Transaction, WalletTransfer } from '@/lib/types';
import type { TransactionSection } from '@/app/views';
import { AddTransactionSheet, type SheetTab, type TxActions } from '@/components/add-transaction-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TransactionTable } from '@/components/transaction-table';
import { PaginationBar, usePagination } from '@/components/pagination-bar';
import { cn } from '@/lib/utils';
import { formatIDR } from '@/lib/format';
import {
  balanceAfterEach,
  buildTransactionsCsv,
  dailySeries,
  exportFileName,
  isPemasukanRiil,
  isTransfer,
  isPengeluaranRiil,
  matchesJenis,
  parseNominal,
  txEffect,
  type JenisFilter,
} from '@/lib/transaction-view';

/** Jumlah baris per halaman. Pilihannya ditampilkan di bawah tabel. */
const PAGE_SIZE_OPTIONS = [10, 25, 50];

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

const SECTION_HEADER: Record<TransactionSection, { title: string; subtitle: string }> = {
  all: { title: 'Semua Transaksi', subtitle: 'Lihat dan kelola seluruh transaksi keuangan Anda dengan mudah.' },
  income: { title: 'Pemasukan', subtitle: 'Riwayat uang masuk ke semua dompet Anda.' },
  expense: { title: 'Pengeluaran', subtitle: 'Riwayat uang keluar dari semua dompet Anda.' },
  transfer: { title: 'Transfer Antar-Dompet', subtitle: 'Pindah saldo antar dompet. Transfer tidak dihitung sebagai pemasukan atau pengeluaran.' },
};

const JENIS_OPTIONS: { value: JenisFilter; label: string }[] = [
  { value: 'all', label: 'Semua Jenis' },
  { value: 'Pemasukan', label: 'Pemasukan' },
  { value: 'Pengeluaran', label: 'Pengeluaran' },
  { value: 'Transfer', label: 'Transfer' },
];

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

  const [jenis, setJenis] = useState<JenisFilter>('all');
  const [kategori, setKategori] = useState('all');
  const [wallet, setWallet] = useState('all');
  const [query, setQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minNominal, setMinNominal] = useState('');
  const [maxNominal, setMaxNominal] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pageSize, setPageSize] = useState(10);

  const allTransactions = useMemo(() => data.transaksi ?? [], [data.transaksi]);
  // Transaksi yang sedang menunggu penghapusan disembunyikan dari tampilan, tapi tetap dihitung untuk saldo.
  const transactions = useMemo(
    () => allTransactions.filter((t) => !t.id || !hiddenIds.has(t.id)),
    [allTransactions, hiddenIds],
  );
  const balances = useMemo(() => balanceAfterEach(allTransactions, data.dompet), [allTransactions, data.dompet]);
  const walletNames = useMemo(
    () => Array.from(new Set(allTransactions.map((t) => t.dompet))).filter(Boolean).sort(),
    [allTransactions],
  );
  const categoryNames = useMemo(
    () => Array.from(new Set(allTransactions.filter((t) => !isTransfer(t) && t.kategori).map((t) => t.kategori as string))).sort(),
    [allTransactions],
  );

  // Di submenu Pemasukan/Pengeluaran, jenis sudah ditentukan oleh menu.
  const effectiveJenis: JenisFilter =
    txSection === 'income' ? 'Pemasukan' : txSection === 'expense' ? 'Pengeluaran' : jenis;
  const minValue = parseNominal(minNominal);
  const maxValue = parseNominal(maxNominal);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (!matchesJenis(tx, effectiveJenis)) return false;
      if (kategori !== 'all' && tx.kategori !== kategori) return false;
      if (wallet !== 'all' && tx.dompet !== wallet) return false;
      if (fromDate && tx.tanggal < fromDate) return false;
      if (toDate && tx.tanggal > toDate) return false;
      if (minValue !== null && tx.nominal < minValue) return false;
      if (maxValue !== null && tx.nominal > maxValue) return false;
      if (search && !`${tx.deskripsi} ${tx.kategori ?? ''} ${tx.dompet}`.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [effectiveJenis, fromDate, kategori, maxValue, minValue, query, toDate, transactions, wallet]);

  // Ringkasan mengikuti filter yang aktif. Pemasukan dan pengeluaran riil saja: koreksi saldo dan sisi transfer
  // antar dompet tidak masuk. Total transfer antar dompet diambil dari wallet_transfers (dengan filter tanggal dan dompet).
  const transferRows = useMemo(
    () =>
      transfers.filter((tr) => {
        if (fromDate && tr.tanggal < fromDate) return false;
        if (toDate && tr.tanggal > toDate) return false;
        if (wallet !== 'all' && tr.fromWallet !== wallet && tr.toWallet !== wallet) return false;
        return true;
      }),
    [transfers, fromDate, toDate, wallet],
  );

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    for (const tx of filtered) {
      if (isPemasukanRiil(tx)) {
        income += tx.nominal;
        incomeCount += 1;
      } else if (isPengeluaranRiil(tx)) {
        expense += tx.nominal;
        expenseCount += 1;
      }
    }
    const transfer = transferRows.reduce((sum, tr) => sum + tr.nominal, 0);
    return { income, expense, net: income - expense, transfer, incomeCount, expenseCount, transferCount: transferRows.length };
  }, [filtered, transferRows]);

  const series = useMemo(
    () => ({
      income: dailySeries(filtered.filter(isPemasukanRiil), (t) => t.nominal),
      expense: dailySeries(filtered.filter(isPengeluaranRiil), (t) => t.nominal),
      net: dailySeries(filtered.filter((t) => isPemasukanRiil(t) || isPengeluaranRiil(t)), txEffect),
      transfer: dailySeries(
        transferRows.map((tr) => ({ tanggal: tr.tanggal, nominal: tr.nominal }) as Transaction),
        (t) => t.nominal,
      ),
    }),
    [filtered, transferRows],
  );

  // Halaman kembali ke 1 setiap filter atau jumlah baris per halaman berubah.
  const filterKey = [effectiveJenis, kategori, wallet, fromDate, toDate, minNominal, maxNominal, query, pageSize].join('|');
  const tablePage = usePagination(filtered, pageSize, filterKey);

  const activeFilterCount = [
    effectiveJenis !== 'all' && txSection === 'all',
    kategori !== 'all',
    wallet !== 'all',
    Boolean(fromDate),
    Boolean(toDate),
    Boolean(minNominal),
    Boolean(maxNominal),
  ].filter(Boolean).length;
  const hasAnyFilter = activeFilterCount > 0 || Boolean(query);

  function clearFilters() {
    setJenis('all');
    setKategori('all');
    setWallet('all');
    setQuery('');
    setFromDate('');
    setToDate('');
    setMinNominal('');
    setMaxNominal('');
  }

  const actions = SECTION_ACTIONS[txSection];
  const defaultTab: SheetTab = actions[0].tab;
  const header = SECTION_HEADER[txSection];

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

  function exportCsv() {
    const blob = new Blob([buildTransactionsCsv(filtered, balances)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFileName();
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Banner halaman */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#dbeafe] bg-gradient-to-r from-[#eff6ff] via-white to-[#f8fbff] p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#dbeafe] text-[#2563eb]">
            <ListFilter className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-xl font-extrabold tracking-[-0.03em] text-[#172554] md:text-2xl">{header.title}</h1>
            <p className="mt-0.5 text-sm font-medium text-[#5b6f99]">{header.subtitle}</p>
          </div>
        </div>
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
          {txSection !== 'transfer' && (
            <Button
              size="sm"
              variant="outline"
              onClick={exportCsv}
              disabled={loading || filtered.length === 0}
              className="h-10 gap-2 rounded-full border-[#2563eb] bg-white px-4 font-bold text-[#2563eb] hover:bg-[#eff6ff]"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {txSection === 'transfer' ? (
        <TransferList transfers={transfers} loading={loading} onAdd={() => openCreate('Transfer')} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Total Pemasukan"
              value={summary.income}
              hint={`${summary.incomeCount} transaksi`}
              icon={ArrowDownLeft}
              tone="income"
              series={series.income}
              loading={loading}
            />
            <StatCard
              label="Total Pengeluaran"
              value={summary.expense}
              hint={`${summary.expenseCount} transaksi`}
              icon={ArrowUpRight}
              tone="expense"
              series={series.expense}
              loading={loading}
            />
            <StatCard
              label="Saldo Bersih"
              value={summary.net}
              hint="Pemasukan dikurangi pengeluaran"
              icon={ListFilter}
              tone="net"
              series={series.net}
              loading={loading}
            />
            <StatCard
              label="Total Transfer"
              value={summary.transfer}
              hint={`${summary.transferCount} transfer antar dompet`}
              icon={ArrowLeftRight}
              tone="transfer"
              series={series.transfer}
              loading={loading}
            />
            <StatCard
              label="Sisa Saldo Semua Dompet"
              value={data.totalSaldo}
              hint="Saldo dompet aktif saat ini"
              icon={WalletCards}
              tone="net"
              series={series.net}
              loading={loading}
            />
          </div>

          <Card className="rounded-2xl border-[#dbeafe] bg-white p-3 shadow-[0_6px_18px_rgba(30,64,175,0.06)] md:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b7da4]" />
                <Input
                  aria-label="Cari transaksi"
                  placeholder="Cari transaksi (nama, kategori, atau dompet)..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-10 rounded-full border-[#dbeafe] bg-[#f8fbff] pl-10 pr-10 text-sm font-medium text-[#172554] placeholder:text-[#7d8eaf]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Kosongkan pencarian"
                    className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-[#6b7da4] hover:bg-[#eff6ff]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {txSection === 'all' && (
                  <ChipSelect
                    ariaLabel="Filter jenis"
                    value={jenis}
                    onChange={(value) => setJenis(value as JenisFilter)}
                    active={jenis !== 'all'}
                    options={JENIS_OPTIONS}
                  />
                )}
                <ChipSelect
                  ariaLabel="Filter kategori"
                  value={kategori}
                  onChange={setKategori}
                  active={kategori !== 'all'}
                  options={[{ value: 'all', label: 'Semua Kategori' }, ...categoryNames.map((name) => ({ value: name, label: name }))]}
                />
                <ChipSelect
                  ariaLabel="Filter dompet"
                  value={wallet}
                  onChange={setWallet}
                  active={wallet !== 'all'}
                  options={[{ value: 'all', label: 'Semua Dompet' }, ...walletNames.map((name) => ({ value: name, label: name }))]}
                />
                <button
                  type="button"
                  onClick={() => setDateOpen((open) => !open)}
                  aria-expanded={dateOpen}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-extrabold transition',
                    dateOpen || fromDate || toDate ? 'border-[#93c5fd] bg-[#e0f2fe] text-[#1d4ed8]' : 'border-[#dbeafe] bg-white text-[#172554] hover:bg-[#eff6ff]',
                  )}
                >
                  <CalendarDays className="h-4 w-4" />
                  Rentang Tanggal
                </button>
                <button
                  type="button"
                  onClick={() => setMoreOpen((open) => !open)}
                  aria-expanded={moreOpen}
                  className={cn(
                    'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-extrabold transition',
                    moreOpen || minNominal || maxNominal ? 'border-[#93c5fd] bg-[#e0f2fe] text-[#1d4ed8]' : 'border-[#dbeafe] bg-white text-[#172554] hover:bg-[#eff6ff]',
                  )}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Filter Lanjutan
                </button>
              </div>
            </div>

            {dateOpen && (
              <div className="mt-3 grid gap-3 border-t border-[#e7eef9] pt-3 sm:grid-cols-2">
                <DateField label="Dari tanggal" value={fromDate} onChange={setFromDate} />
                <DateField label="Sampai tanggal" value={toDate} onChange={setToDate} />
              </div>
            )}
            {moreOpen && (
              <div className="mt-3 grid gap-3 border-t border-[#e7eef9] pt-3 sm:grid-cols-2">
                <NominalField label="Nominal minimum" value={minNominal} onChange={setMinNominal} />
                <NominalField label="Nominal maksimum" value={maxNominal} onChange={setMaxNominal} />
              </div>
            )}
            {hasAnyFilter && (
              <button type="button" onClick={clearFilters} className="mt-3 inline-flex items-center gap-1 text-xs font-extrabold text-[#2563eb] hover:text-[#1d4ed8]">
                Hapus semua filter ({activeFilterCount + (query ? 1 : 0)}) <X className="h-3.5 w-3.5" />
              </button>
            )}
          </Card>

          <Card className="overflow-hidden rounded-2xl border-[#dbeafe] bg-white p-4 shadow-[0_6px_18px_rgba(30,64,175,0.06)] md:p-5">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]">
                  <ListFilter className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">Riwayat Transaksi</h2>
                  <p className="text-xs font-medium text-[#5b6f99]">{loading ? 'Memuat transaksi...' : `${filtered.length} transaksi ditemukan`}</p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-[#5b6f99]">
                Tampilkan per halaman
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  aria-label="Jumlah baris per halaman"
                  className="h-8 rounded-lg border border-[#dbeafe] bg-white px-2 text-xs font-extrabold text-[#172554] outline-none focus:border-[#93c5fd]"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Skeleton key={index} className="h-12 w-full rounded-xl" />
                ))}
              </div>
            ) : filtered.length ? (
              <TransactionTable rows={tablePage.pageItems} balances={balances} onEdit={openEdit} onDelete={handleDelete} />
            ) : (
              <EmptyTransactions hasAnyTransactions={transactions.length > 0} onAdd={() => openCreate(defaultTab)} actionLabel={actions[0].label} />
            )}

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

function ChipSelect({
  value,
  onChange,
  options,
  active,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  active: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'h-10 max-w-[200px] appearance-none rounded-full border py-0 pl-4 pr-9 text-xs font-extrabold outline-none transition focus:border-[#93c5fd]',
          active ? 'border-[#93c5fd] bg-[#e0f2fe] text-[#1d4ed8]' : 'border-[#dbeafe] bg-white text-[#172554] hover:bg-[#eff6ff]',
        )}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#2563eb]" />
    </div>
  );
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 text-xs font-extrabold text-[#31548a]">
      {label}
      <div className="relative">
        <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2563eb]" />
        <input
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-full rounded-xl border border-[#dbeafe] bg-[#f8fbff] pl-9 pr-3 text-sm font-bold text-[#172554] outline-none focus:border-[#93c5fd]"
        />
      </div>
    </label>
  );
}

function NominalField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5 text-xs font-extrabold text-[#31548a]">
      {label}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-[#2563eb]">Rp</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="0"
          className="h-10 w-full rounded-xl border border-[#dbeafe] bg-[#f8fbff] pl-9 pr-3 text-sm font-bold tnum text-[#172554] outline-none focus:border-[#93c5fd]"
        />
      </div>
    </label>
  );
}

const TONE_STYLE = {
  income: { card: 'border-[#bfdbfe] bg-gradient-to-br from-white to-[#eff6ff]', icon: 'bg-[#dbeafe] text-[#2563eb]', stroke: '#2563eb', value: 'text-[#172554]' },
  expense: { card: 'border-[#fecdd3] bg-gradient-to-br from-white to-[#fff1f2]', icon: 'bg-[#ffe4e6] text-[#e11d48]', stroke: '#e11d48', value: 'text-[#172554]' },
  net: { card: 'border-[#a7f3d0] bg-gradient-to-br from-white to-[#ecfdf5]', icon: 'bg-[#d1fae5] text-[#059669]', stroke: '#059669', value: 'text-[#047857]' },
  transfer: { card: 'border-[#ddd6fe] bg-gradient-to-br from-white to-[#f5f3ff]', icon: 'bg-[#ede9fe] text-[#7c3aed]', stroke: '#7c3aed', value: 'text-[#172554]' },
} as const;

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  series,
  loading,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof ArrowDownLeft;
  tone: keyof typeof TONE_STYLE;
  series: number[];
  loading: boolean;
}) {
  const style = TONE_STYLE[tone];
  const negative = tone === 'net' && value < 0;
  return (
    <Card className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-[0_6px_18px_rgba(30,64,175,0.06)]', style.card)}>
      <div className="flex items-start justify-between gap-2">
        <span className={cn('grid h-10 w-10 place-items-center rounded-xl', style.icon)}>
          <Icon className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <span className="truncate rounded-full bg-white/70 px-2.5 py-1 text-[11px] font-extrabold text-[#5b6f99]">{hint}</span>
      </div>
      <p className="mt-3 text-xs font-bold text-[#172554]">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-8 w-32" />
      ) : (
        <p className={cn('mt-1 font-display text-[22px] font-extrabold tracking-[-0.04em] tnum md:text-[25px]', negative ? 'text-[#be123c]' : style.value)}>
          {formatIDR(value)}
        </p>
      )}
      <Sparkline values={series} stroke={style.stroke} />
    </Card>
  );
}

/** Grafik garis kecil dari data nyata (kumulatif per tanggal). Tanpa data cukup, tampil garis datar. */
function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const width = 120;
  const height = 36;
  const points = values.length >= 2 ? values : [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const path = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((v - min) / span) * (height - 4) - 2;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="mt-2 h-9 w-full opacity-70" aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TransferList({ transfers, loading, onAdd }: { transfers: WalletTransfer[]; loading: boolean; onAdd: () => void }) {
  const transferPage = usePagination(transfers, 20, '');
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

function EmptyTransactions({ hasAnyTransactions, onAdd, actionLabel }: { hasAnyTransactions: boolean; onAdd: () => void; actionLabel: string }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-white to-[#f5f9ff] px-5 py-8 text-center">
      <span className="grid h-16 w-16 place-items-center rounded-2xl bg-[#e0f2fe] text-[#2563eb]">
        <FileSearch2 className="h-8 w-8" />
      </span>
      <h3 className="mt-4 font-display text-lg font-extrabold tracking-[-0.03em] text-[#172554]">
        {hasAnyTransactions ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi.'}
      </h3>
      <p className="mt-1 max-w-sm text-sm font-medium text-[#5b6f99]">
        {hasAnyTransactions ? 'Coba ubah kata kunci atau filter untuk melihat transaksi lain.' : 'Catat transaksi pertamamu untuk mulai mengatur keuangan.'}
      </p>
      {!hasAnyTransactions && (
        <button type="button" onClick={onAdd} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] transition hover:bg-[#1d4ed8]">
          <WalletCards className="h-4 w-4" /> {actionLabel}
        </button>
      )}
    </div>
  );
}
