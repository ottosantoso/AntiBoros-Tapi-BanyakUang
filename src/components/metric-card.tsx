import { ArrowDownLeft, ArrowUpRight, Wallet, PiggyBank, TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatIDR, formatPercent } from '@/lib/format';

type Metric = 'balance' | 'income' | 'expense' | 'savings';

interface Props {
  metric: Metric;
  label: string;
  value: number;
  delta?: number;
  loading?: boolean;
}

const STYLES: Record<
  Metric,
  {
    icon: typeof Wallet;
    iconBg: string;
    iconColor: string;
    valueClass: string;
    sparkClass: string;
    ring: string;
  }
> = {
  balance: {
    icon: Wallet,
    iconBg: 'bg-balance-soft',
    iconColor: 'text-balance',
    valueClass: 'gradient-text-balance',
    sparkClass: 'bg-balance',
    ring: 'group-hover:border-balance/40',
  },
  income: {
    icon: ArrowDownLeft,
    iconBg: 'bg-income-soft',
    iconColor: 'text-income',
    valueClass: 'gradient-text-income',
    sparkClass: 'bg-income',
    ring: 'group-hover:border-income/40',
  },
  expense: {
    icon: ArrowUpRight,
    iconBg: 'bg-expense-soft',
    iconColor: 'text-expense',
    valueClass: 'gradient-text-expense',
    sparkClass: 'bg-expense',
    ring: 'group-hover:border-expense/40',
  },
  savings: {
    icon: PiggyBank,
    iconBg: 'bg-savings-soft',
    iconColor: 'text-savings',
    valueClass: 'text-savings',
    sparkClass: 'bg-savings',
    ring: 'group-hover:border-savings/40',
  },
};

export function MetricCard({ metric, label, value, delta, loading }: Props) {
  const s = STYLES[metric];
  const Icon = s.icon;
  const positive = (delta ?? 0) >= 0;

  if (loading) {
    return (
      <Card className="lift border-border/60 p-5">
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>
        <Skeleton className="mt-4 h-3 w-24" />
        <Skeleton className="mt-2 h-8 w-40" />
        <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
      </Card>
    );
  }

  return (
    <Card className={cn('lift group border-border/60 p-5 transition-colors', s.ring)}>
      <div className="flex items-start justify-between">
        <div className={cn('grid h-10 w-10 place-items-center rounded-xl', s.iconBg)}>
          <Icon className={cn('h-5 w-5', s.iconColor)} strokeWidth={2.4} />
        </div>
        {typeof delta === 'number' && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              positive ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense',
            )}
          >
            {metric === 'expense' ? (
              positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />
            ) : positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {formatPercent(delta)}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm font-medium text-muted-foreground">{label}</p>
      <p className={cn('mt-1 font-display text-2xl font-bold tracking-tight tnum', s.valueClass)}>
        {formatIDR(value)}
      </p>

      {/* mini sparkline bar */}
      <div className="mt-4 flex h-1.5 items-end gap-1">
        {[40, 65, 45, 80, 55, 70, 90].map((h, i) => (
          <span
            key={i}
            className={cn('flex-1 rounded-full opacity-70 transition-all duration-500', s.sparkClass)}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </Card>
  );
}

export function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <MetricCard key={i} metric="balance" label="" value={0} loading />
      ))}
    </div>
  );
}
