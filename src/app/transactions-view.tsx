import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, FileSearch2, Filter, ListFilter, Search, Sparkles, WalletCards, X } from 'lucide-react';
import type { DashboardData, TransactionType } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TransactionList } from '@/components/transaction-list';
import { cn } from '@/lib/utils';
import { formatIDR } from '@/lib/format';

type Filter = 'all' | TransactionType;

export function TransactionsView({ data, loading, onAdd }: { data: DashboardData; loading: boolean; onAdd: () => void }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [wallet, setWallet] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const transactions = data.transaksi ?? [];
  const wallets = useMemo(() => Array.from(new Set(transactions.map((transaction) => transaction.dompet))).filter(Boolean), [transactions]);
  const activeAdvancedFilters = [wallet !== 'all', Boolean(fromDate), Boolean(toDate)].filter(Boolean).length;

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return transactions.filter((transaction) => {
      if (filter !== 'all' && transaction.tipe !== filter) return false;
      if (wallet !== 'all' && transaction.dompet !== wallet) return false;
      if (fromDate && transaction.tanggal < fromDate) return false;
      if (toDate && transaction.tanggal > toDate) return false;
      if (search && !`${transaction.deskripsi} ${transaction.kategori ?? ''}`.toLowerCase().includes(search)) return false;
      return true;
    });
  }, [filter, fromDate, query, toDate, transactions, wallet]);

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Total Pemasukan" value={incomeTotal} icon={ArrowDownLeft} className="border-[#93c5fd] bg-[#e0f2fe]" iconClass="bg-[#bfdbfe] text-[#0284c7]" valueClass="text-[#172554]" loading={loading} />
        <SummaryCard label="Total Pengeluaran" value={expenseTotal} icon={ArrowUpRight} className="border-[#fecdd3] bg-[#ffe4e6]" iconClass="bg-[#fda4af] text-[#be123c]" valueClass="text-[#172554]" loading={loading} />
        <SummaryCard label="Selisih Bersih" value={netTotal} icon={ListFilter} className="border-[#a7f3d0] bg-[#dcfce7]" iconClass="bg-[#86efac] text-[#047857]" valueClass={netTotal >= 0 ? 'text-[#047857]' : 'text-[#be123c]'} loading={loading} />
      </div>

      <Card className="rounded-2xl border-[#dbeafe] bg-white p-3 shadow-[0_6px_18px_rgba(30,64,175,0.06)] md:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex shrink-0 rounded-full bg-[#eff6ff] p-1">
            {(['all', 'Pemasukan', 'Pengeluaran'] as Filter[]).map((item) => (
              <button key={item} type="button" onClick={() => setFilter(item)} className={cn('rounded-full px-4 py-2 text-xs font-extrabold transition-all', filter === item ? 'bg-[#2563eb] text-white shadow-[0_5px_12px_rgba(37,99,235,0.2)]' : 'text-[#31548a] hover:bg-white')}>
                {item === 'all' ? 'Semua' : item}
              </button>
            ))}
          </div>
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
        {loading ? <TransactionList transactions={filtered} loading limit={5} /> : filtered.length ? <div className="overflow-x-auto"><div className="min-w-[680px]"><div className="grid grid-cols-[minmax(86px,1fr)_minmax(130px,1.5fr)_minmax(105px,1fr)_auto] gap-3 border-b border-[#dbeafe] pb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#5b6f99]"><span>Tanggal</span><span>Keterangan</span><span>Kategori</span><span className="text-right">Nominal</span></div><TransactionList transactions={filtered} limit={10} /></div></div> : <EmptyTransactions hasAnyTransactions={transactions.length > 0} onAdd={onAdd} />}
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, className, iconClass, valueClass, loading }: { label: string; value: number; icon: typeof ArrowDownLeft; className: string; iconClass: string; valueClass: string; loading: boolean }) {
  return <Card className={cn('relative overflow-hidden rounded-2xl border p-4 shadow-[0_6px_18px_rgba(30,64,175,0.06)]', className)}><div className="flex items-start justify-between"><span className={cn('grid h-10 w-10 place-items-center rounded-xl', iconClass)}><Icon className="h-5 w-5" strokeWidth={2.4} /></span><span className="rounded-full bg-white/65 px-2.5 py-1 text-[11px] font-extrabold text-[#2563eb]">+0.0%</span></div><p className="mt-3 text-xs font-bold text-[#172554]">{label}</p>{loading ? <Skeleton className="mt-1 h-8 w-32" /> : <p className={cn('mt-1 font-display text-[25px] font-extrabold tracking-[-0.04em] tnum', valueClass)}>{formatIDR(value)}</p>}<div className="pointer-events-none absolute -bottom-3 right-3 flex items-end gap-1 opacity-20"><span className="h-7 w-3 rounded-t bg-current" /><span className="h-12 w-3 rounded-t bg-current" /><span className="h-16 w-3 rounded-t bg-current" /><span className="h-20 w-3 rounded-t bg-current" /></div></Card>;
}

function EmptyTransactions({ hasAnyTransactions, onAdd }: { hasAnyTransactions: boolean; onAdd: () => void }) {
  return <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-white to-[#f5f9ff] px-5 py-8 text-center"><div className="relative grid h-32 w-40 place-items-center"><div className="absolute h-28 w-36 rounded-[50%] bg-[#e0f2fe]" /><div className="relative grid h-20 w-16 rotate-[-4deg] place-items-center rounded-xl border-4 border-[#93c5fd] bg-white shadow-[7px_8px_0_#bfdbfe]"><FileSearch2 className="h-9 w-9 text-[#2563eb]" /><span className="absolute -right-4 bottom-0 grid h-10 w-10 place-items-center rounded-full bg-[#2563eb] text-white shadow-md"><Search className="h-5 w-5" /></span></div><Sparkles className="absolute left-3 top-2 h-5 w-5 text-[#fbbf24]" /><Sparkles className="absolute right-2 top-8 h-4 w-4 text-[#60a5fa]" /></div><h3 className="mt-4 font-display text-lg font-extrabold tracking-[-0.03em] text-[#172554]">{hasAnyTransactions ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi.'}</h3><p className="mt-1 max-w-sm text-sm font-medium text-[#5b6f99]">{hasAnyTransactions ? 'Coba ubah kata kunci atau filter untuk melihat transaksi lain.' : 'Catat pemasukan atau pengeluaran pertamamu untuk mulai mengatur keuangan.'}</p><button type="button" onClick={onAdd} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] transition hover:bg-[#1d4ed8]"><WalletCards className="h-4 w-4" /> Tambah Transaksi</button></div>;
}
