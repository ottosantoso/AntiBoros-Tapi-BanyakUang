import { useMemo, useState } from 'react';
import { Search, ArrowDownLeft, ArrowUpRight, Wallet2 } from 'lucide-react';
import type { DashboardData, TransactionType } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { TransactionList } from '@/components/transaction-list';
import { cn } from '@/lib/utils';
import { formatIDR } from '@/lib/format';

type Filter = 'all' | TransactionType;

export function TransactionsView({ data, loading }: { data: DashboardData; loading: boolean }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [wallet, setWallet] = useState<string>('all');

  const txs = data.transaksi ?? [];

  const wallets = useMemo(() => {
    const set = new Set(txs.map((t) => t.dompet));
    return Array.from(set);
  }, [txs]);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (filter !== 'all' && t.tipe !== filter) return false;
      if (wallet !== 'all' && t.dompet !== wallet) return false;
      if (query && !t.deskripsi.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [txs, filter, wallet, query]);

  const incomeTotal = filtered.filter((t) => t.tipe === 'Pemasukan').reduce((s, t) => s + t.nominal, 0);
  const expenseTotal = filtered.filter((t) => t.tipe === 'Pengeluaran').reduce((s, t) => s + t.nominal, 0);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-income-soft">
            <ArrowDownLeft className="h-5 w-5 text-income" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Pemasukan</p>
            {loading ? <Skeleton className="mt-1 h-6 w-28" /> : (
              <p className="font-display text-lg font-bold tnum text-income">{formatIDR(incomeTotal)}</p>
            )}
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-expense-soft">
            <ArrowUpRight className="h-5 w-5 text-expense" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Pengeluaran</p>
            {loading ? <Skeleton className="mt-1 h-6 w-28" /> : (
              <p className="font-display text-lg font-bold tnum text-expense">{formatIDR(expenseTotal)}</p>
            )}
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-balance-soft">
            <Wallet2 className="h-5 w-5 text-balance" strokeWidth={2.4} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Selisih Bersih</p>
            {loading ? <Skeleton className="mt-1 h-6 w-28" /> : (
              <p className={cn('font-display text-lg font-bold tnum', incomeTotal - expenseTotal >= 0 ? 'text-income' : 'text-expense')}>
                {formatIDR(incomeTotal - expenseTotal)}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['all', 'Pemasukan', 'Pengeluaran'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  filter === f
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f === 'all' ? 'Semua' : f}
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Cari deskripsi..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {wallets.length > 0 && (
            <select
              value={wallet}
              onChange={(e) => setWallet(e.target.value)}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Semua Dompet</option>
              {wallets.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {/* List */}
      <Card className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-display text-base font-bold tracking-tight">
            Riwayat Transaksi
          </h3>
          <span className="text-xs text-muted-foreground">{filtered.length} transaksi</span>
        </div>
        <TransactionList transactions={filtered} loading={loading} emptyHint="Coba ubah filter pencarian." />
      </Card>
    </div>
  );
}
