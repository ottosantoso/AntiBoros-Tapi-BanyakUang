import { ArrowDownLeft, ArrowUpRight, Inbox } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatIDR, formatDateRelative } from '@/lib/format';
import { walletGlyph } from '@/lib/wallets';

function categoryFromDesc(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('gaji') || d.includes('freelance') || d.includes('penjualan')) return 'Pemasukan';
  if (d.includes('kopi') || d.includes('makan')) return 'Makan & Minum';
  if (d.includes('gojek') || d.includes('bensin') || d.includes('transport')) return 'Transportasi';
  if (d.includes('belanja')) return 'Belanja';
  if (d.includes('netflix') || d.includes('hiburan')) return 'Hiburan';
  return 'Lainnya';
}

export function TransactionRow({ tx, divider = true }: { tx: Transaction; divider?: boolean }) {
  const income = tx.tipe === 'Pemasukan';
  const category = tx.kategori ?? categoryFromDesc(tx.deskripsi);
  return (
    <div className={cn('flex items-center gap-3 py-3', divider && 'border-t border-border/60 first:border-t-0')}>
      <div
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold',
          income ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense',
        )}
      >
        {income ? <ArrowDownLeft className="h-4 w-4" strokeWidth={2.6} /> : <ArrowUpRight className="h-4 w-4" strokeWidth={2.6} />}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{tx.deskripsi}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-1.5 py-0.5 font-medium">
            {walletGlyph(tx.dompet) || '•'} {tx.dompet}
          </span>
          <span className="truncate">{category}</span>
          <span className="text-muted-foreground/50">•</span>
          <span>{formatDateRelative(tx.tanggal)}</span>
        </div>
      </div>

      <div className={cn('shrink-0 text-sm font-semibold tnum', income ? 'text-income' : 'text-expense')}>
        {income ? '+' : '-'} {formatIDR(tx.nominal)}
      </div>
    </div>
  );
}

export function TransactionList({
  transactions,
  loading,
  limit,
  emptyHint,
}: {
  transactions: Transaction[];
  loading?: boolean;
  limit?: number;
  emptyHint?: string;
}) {
  if (loading) {
    return (
      <div className="space-y-1">
        {Array.from({ length: limit ?? 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    );
  }

  const list = limit ? transactions.slice(0, limit) : transactions;

  if (!list.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="h-9 w-9 text-muted-foreground/40" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">Belum ada transaksi.</p>
        <p className="text-xs text-muted-foreground/70">{emptyHint ?? 'Tambahkan transaksi pertama Anda.'}</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {list.map((tx, i) => (
        <TransactionRow key={`${tx.tanggal}-${tx.deskripsi}-${i}`} tx={tx} divider={false} />
      ))}
    </div>
  );
}

export function TransactionListCard({
  transactions,
  loading,
  limit = 6,
}: {
  transactions: Transaction[];
  loading?: boolean;
  limit?: number;
}) {
  return (
    <Card className="p-5">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-bold tracking-tight">Transaksi Terbaru</h3>
          <p className="text-xs text-muted-foreground">Aktivitas terkini</p>
        </div>
      </div>
      <TransactionList transactions={transactions} loading={loading} limit={limit} />
    </Card>
  );
}
