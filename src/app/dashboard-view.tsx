import { TrendingUp, Flame, Sparkles } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import { MetricCard } from '@/components/metric-card';
import { CashflowChart, CategoryDoughnut, BudgetRule } from '@/components/cashflow-charts';
import { TransactionListCard } from '@/components/transaction-list';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatIDR, formatIDRCompact } from '@/lib/format';
import { rangeSuffix, isAllTime, type DateRangeValue } from '@/lib/date-range';
import { cn } from '@/lib/utils';

interface Props {
  data: DashboardData;
  loading: boolean;
  dateRange: DateRangeValue;
}

export function DashboardView({ data, loading, dateRange }: Props) {
  const income = data.pemasukanBulanIni;
  const expense = data.pengeluaranBulanIni;
  const net = data.tabunganBulanIni ?? income - expense;
  const savingsRate = income > 0 ? (net / income) * 100 : 0;

  // demo deltas so the cards look alive even without history
  const deltaBalance = 4.2;
  const deltaIncome = income > 0 ? 1.8 : 0;
  const deltaExpense = expense > 0 ? -3.1 : 0;

  const period = rangeSuffix(dateRange);
  const allTime = isAllTime(dateRange);
  const incomeLabel = `Pemasukan ${period}`;
  const expenseLabel = `Pengeluaran ${period}`;
  const netLabel = net >= 0 ? `Tabungan ${period}` : `Defisit ${period}`;
  const topExpensesHint = allTime ? 'Paling besar sepanjang waktu' : `Paling besar ${period}`;
  const savingsHint = allTime
    ? 'Seluruh periode tercatat'
    : savingsRate >= 20
      ? 'Sangat sehat — di atas panduan 20%.'
      : savingsRate > 0
        ? 'Cukup baik — tingkatkan menuju 20%.'
        : 'Pengeluaran melebihi pemasukan periode ini.';

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard metric="balance" label="Total Saldo" value={data.totalSaldo} delta={deltaBalance} loading={loading} />
        <MetricCard metric="income" label={incomeLabel} value={income} delta={deltaIncome} loading={loading} />
        <MetricCard metric="expense" label={expenseLabel} value={expense} delta={deltaExpense} loading={loading} />
        <MetricCard
          metric={net >= 0 ? 'savings' : 'expense'}
          label={netLabel}
          value={net}
          delta={savingsRate}
          loading={loading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashflowChart data={data.trenBulanan ?? []} loading={loading} />
        </div>
        <CategoryDoughnut categories={data.rekapKategori} loading={loading} />
      </div>

      {/* Budget + top expenses */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BudgetRule income={income} expense={expense} savings={net} loading={loading} />
        </div>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold tracking-tight">Top Pengeluaran</h3>
              <p className="text-xs text-muted-foreground">{topExpensesHint}</p>
            </div>
            <Flame className="h-5 w-5 text-expense" />
          </div>
          {loading ? (
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : data.topPengeluaran.length ? (
            <div className="mt-4 space-y-2">
              {data.topPengeluaran.slice(0, 5).map((t, i) => (
                <div
                  key={`${t.deskripsi}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 px-3 py-2.5"
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-expense-soft text-xs font-bold text-expense">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{t.deskripsi}</span>
                  <span className="shrink-0 text-sm font-semibold tnum text-expense">{formatIDRCompact(t.nominal)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/40" />
              <p className="mt-2 text-sm text-muted-foreground">Belum ada pengeluaran besar.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Recent transactions + savings highlight */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TransactionListCard transactions={data.transaksi ?? []} loading={loading} limit={6} />
        </div>
        <Card className="flex flex-col justify-between overflow-hidden p-0">
          <div className="bg-gradient-to-br from-income/90 to-success p-5 text-white">
            <div className="flex items-center gap-2 text-white/80">
              <TrendingUp className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-wider">Rasio Tabungan</span>
            </div>
            <p className="mt-2 font-display text-4xl font-bold tnum">{savingsRate.toFixed(0)}%</p>
            <p className="mt-1 text-sm text-white/80">{savingsHint}</p>
          </div>
          <div className="space-y-3 p-5">
            <Row label="Pemasukan" value={formatIDR(income)} valueClass="text-income" />
            <Row label="Pengeluaran" value={formatIDR(expense)} valueClass="text-expense" />
            <div className="h-px bg-border" />
            <Row
              label={net >= 0 ? `Tabungan ${period}` : `Defisit ${period}`}
              value={`${net >= 0 ? '+ ' : '- '}${formatIDR(Math.abs(net))}`}
              valueClass={net >= 0 ? 'text-income' : 'text-expense'}
              bold
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass,
  bold,
}: {
  label: string;
  value: string;
  valueClass?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-sm', bold ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className={cn('text-sm tnum', bold ? 'font-bold' : 'font-semibold', valueClass ?? 'text-foreground')}>{value}</span>
    </div>
  );
}
