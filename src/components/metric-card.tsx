import { ArrowDownLeft, ArrowUpRight, PiggyBank, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
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

const STYLES: Record<Metric, { icon: typeof Wallet; card: string; iconBg: string; iconColor: string; valueClass: string; line: string }> = {
  balance: {
    icon: Wallet,
    card: 'border-[#93c5fd] bg-[#e0f2fe]',
    iconBg: 'bg-[#bfdbfe]',
    iconColor: 'text-[#0284c7]',
    valueClass: 'text-[#172554]',
    line: '#0284c7',
  },
  income: {
    icon: ArrowDownLeft,
    card: 'border-[#a7f3d0] bg-[#dcfce7]',
    iconBg: 'bg-[#86efac]',
    iconColor: 'text-[#047857]',
    valueClass: 'text-[#172554]',
    line: '#10b981',
  },
  expense: {
    icon: ArrowUpRight,
    card: 'border-[#fecdd3] bg-[#ffe4e6]',
    iconBg: 'bg-[#fda4af]',
    iconColor: 'text-[#be123c]',
    valueClass: 'text-[#172554]',
    line: '#f43f5e',
  },
  savings: {
    icon: PiggyBank,
    card: 'border-[#ddd6fe] bg-[#f3e8ff]',
    iconBg: 'bg-[#ddd6fe]',
    iconColor: 'text-[#6d28d9]',
    valueClass: 'text-[#4c1d95]',
    line: '#8b5cf6',
  },
};

export function MetricCard({ metric, label, value, delta, loading }: Props) {
  const style = STYLES[metric];
  const Icon = style.icon;
  const positive = (delta ?? 0) >= 0;

  if (loading) {
    return (
      <Card className="rounded-2xl border-[#dbeafe] bg-white p-4 shadow-[0_6px_18px_rgba(30,64,175,0.06)]">
        <div className="flex items-start justify-between"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-6 w-16 rounded-full" /></div>
        <Skeleton className="mt-4 h-3 w-28" /><Skeleton className="mt-2 h-8 w-40" /><Skeleton className="mt-4 h-1.5 w-full rounded-full" />
      </Card>
    );
  }

  return (
    <Card className={cn('group relative overflow-hidden rounded-2xl border p-4 shadow-[0_6px_18px_rgba(30,64,175,0.06)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(30,64,175,0.12)]', style.card)}>
      <div className="flex items-start justify-between">
        <div className={cn('grid h-10 w-10 place-items-center rounded-xl', style.iconBg)}>
          <Icon className={cn('h-5 w-5', style.iconColor)} strokeWidth={2.4} />
        </div>
        {typeof delta === 'number' && (
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold', positive ? 'bg-[#bbf7d0] text-[#047857]' : 'bg-[#fecdd3] text-[#be123c]')}>
            {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {formatPercent(delta)}
          </span>
        )}
      </div>
      <p className="mt-3 text-[13px] font-bold text-[#172554]">{label}</p>
      <p className={cn('mt-1 font-display text-[25px] font-extrabold tracking-[-0.03em] tnum', style.valueClass)}>{formatIDR(value)}</p>
      <Sparkline color={style.line} />
    </Card>
  );
}

function Sparkline({ color }: { color: string }) {
  return (
    <svg className="mt-3 h-6 w-full overflow-visible" viewBox="0 0 180 24" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 18 C16 17 18 20 31 16 S48 18 61 13 S77 16 91 12 S105 16 119 9 S134 13 146 6 S162 10 180 3" fill="none" stroke={color} strokeLinecap="round" strokeWidth="2" />
      <path d="M0 19 C16 18 18 21 31 17 S48 19 61 14 S77 17 91 13 S105 17 119 10 S134 14 146 7 S162 11 180 4" fill="none" stroke={color} strokeLinecap="round" strokeOpacity="0.14" strokeWidth="7" />
    </svg>
  );
}

export function MetricsSkeleton() {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <MetricCard key={i} metric="balance" label="" value={0} loading />)}</div>;
}
