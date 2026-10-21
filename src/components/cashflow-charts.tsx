import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthlyTrend } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatIDR, formatIDRCompact } from '@/lib/format';
import { cn } from '@/lib/utils';

interface ChartPoint {
  bulan: string;
  pemasukan: number;
  pengeluaran: number;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

function useChartColors() {
  const [colors, setColors] = useState({ income: '#10b981', expense: '#f43f5e' });
  useEffect(() => {
    const read = () => {
      const cs = getComputedStyle(document.documentElement);
      const income = cs.getPropertyValue('--income').trim();
      const expense = cs.getPropertyValue('--expense').trim();
      setColors({
        income: income ? `hsl(${income})` : '#10b981',
        expense: expense ? `hsl(${expense})` : '#f43f5e',
      });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

function CashflowTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-border bg-popover/95 p-3 text-xs shadow-xl backdrop-blur-md">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">
            {p.dataKey === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}
          </span>
          <span className="ml-auto font-semibold tnum text-foreground">{formatIDR(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function CashflowChart({ data, loading }: { data: MonthlyTrend[]; loading?: boolean }) {
  const colors = useChartColors();
  const points: ChartPoint[] = data.length
    ? data
    : Array.from({ length: 6 }, (_, i) => ({ bulan: `B${i + 1}`, pemasukan: 0, pengeluaran: 0 }));

  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-1 h-4 w-56" />
        <Skeleton className="mt-5 h-64 w-full rounded-xl" />
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold tracking-tight">Arus Kas</h3>
          <p className="text-xs text-muted-foreground">Pemasukan vs Pengeluaran — 6 bulan terakhir</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-income" /> Pemasukan
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-expense" /> Pengeluaran
          </span>
        </div>
      </div>

      <div className="mt-5 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} barGap={6} barCategoryGap="22%" margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.income} stopOpacity={1} />
                <stop offset="100%" stopColor={colors.income} stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="expenseBar" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.expense} stopOpacity={1} />
                <stop offset="100%" stopColor={colors.expense} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.5} />
            <XAxis
              dataKey="bulan"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              tickFormatter={(v) => formatIDRCompact(Number(v))}
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            />
            <Tooltip cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4, radius: 8 }} content={<CashflowTooltip />} />
            <Bar dataKey="pemasukan" fill="url(#incomeBar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            <Bar dataKey="pengeluaran" fill="url(#expenseBar)" radius={[6, 6, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ---------- Category doughnut ---------- */

interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

const PALETTE = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--chart-6))',
  'hsl(var(--chart-7))',
  'hsl(var(--chart-8))',
];

function PieTooltip({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { color: string } }[];
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-border bg-popover/95 p-3 text-xs shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.payload.color }} />
        <span className="font-semibold text-foreground">{p.name}</span>
      </div>
      <p className="mt-1.5 font-semibold tnum text-foreground">{formatIDR(p.value)}</p>
    </div>
  );
}

export function CategoryDoughnut({
  categories,
  loading,
}: {
  categories: Record<string, number>;
  loading?: boolean;
}) {
  const slices: CategorySlice[] = Object.entries(categories)
    .map(([name, value]) => ({ name, value: Number(value) || 0 }))
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }));

  const total = slices.reduce((s, x) => s + x.value, 0);

  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-1 h-4 w-56" />
        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
          <Skeleton className="h-44 w-44 rounded-full" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!slices.length) {
    return (
      <Card className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">Belum ada pengeluaran bulan ini.</p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div>
        <h3 className="font-display text-base font-bold tracking-tight">Pengeluaran per Kategori</h3>
        <p className="text-xs text-muted-foreground">Distribusi belanja bulan ini</p>
      </div>

      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row">
        <div className="relative h-44 w-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={2}
                stroke="none"
                cornerRadius={6}
              >
                {slices.map((s) => (
                  <Cell key={s.name} fill={s.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total</span>
            <span className="font-display text-base font-bold tnum">{formatIDRCompact(total)}</span>
          </div>
        </div>

        <div className="w-full flex-1 space-y-2.5">
          {slices.slice(0, 6).map((s) => {
            const pct = total ? (s.value / total) * 100 : 0;
            return (
              <div key={s.name} className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{s.name}</span>
                <span className="text-xs font-medium tnum text-muted-foreground">{pct.toFixed(0)}%</span>
                <span className="w-20 text-right text-sm font-semibold tnum text-foreground">
                  {formatIDRCompact(s.value)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

/* ---------- 50/30/20 budget rule ---------- */

interface BudgetBucket {
  key: 'needs' | 'wants' | 'savings';
  label: string;
  desc: string;
  ideal: number;
  actual: number;
  color: string;
  soft: string;
  icon: React.ReactNode;
}

export function BudgetRule({
  income,
  expense,
  savings,
  loading,
}: {
  income: number;
  expense: number;
  savings: number;
  loading?: boolean;
}) {
  const needs = Math.min(expense, income * 0.5);
  const wants = Math.max(expense - needs, 0);
  const buckets: BudgetBucket[] = [
    {
      key: 'needs',
      label: 'Kebutuhan',
      desc: 'Sewa, makan, transport',
      ideal: 50,
      actual: income > 0 ? (needs / income) * 100 : 0,
      color: 'bg-balance',
      soft: 'bg-balance-soft',
      icon: <span className="text-balance">50%</span>,
    },
    {
      key: 'wants',
      label: 'Keinginan',
      desc: 'Hiburan, belanja, jajan',
      ideal: 30,
      actual: income > 0 ? (wants / income) * 100 : 0,
      color: 'bg-chart-3',
      soft: 'bg-savings-soft',
      icon: <span className="text-savings">30%</span>,
    },
    {
      key: 'savings',
      label: 'Tabungan',
      desc: 'Investasi & dana darurat',
      ideal: 20,
      actual: income > 0 ? (savings / income) * 100 : 0,
      color: 'bg-income',
      soft: 'bg-income-soft',
      icon: <span className="text-income">20%</span>,
    },
  ];

  if (loading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-1 h-4 w-56" />
        <div className="mt-5 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-base font-bold tracking-tight">Aturan 50/30/20</h3>
          <p className="text-xs text-muted-foreground">Proporsi belanja vs tabungan</p>
        </div>
        <span className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Panduan
        </span>
      </div>

      <div className="mt-5 space-y-4">
        {buckets.map((b) => {
          const over = b.actual > b.ideal + 2;
          const pct = Math.min(b.actual, 100);
          return (
            <div key={b.key}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{b.label}</span>
                  <span className="text-xs text-muted-foreground">{b.desc}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-medium', over ? 'text-expense' : 'text-muted-foreground')}>
                    {b.actual.toFixed(0)}%
                  </span>
                  <span className="text-xs text-muted-foreground">/ {b.icon}</span>
                </div>
              </div>
              <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
                {/* ideal marker */}
                <span
                  className="absolute top-1/2 z-10 h-4 w-0.5 -translate-y-1/2 rounded-full bg-foreground/30"
                  style={{ left: `${b.ideal}%` }}
                />
                <span
                  className={cn('h-full rounded-full transition-all duration-700', b.color)}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/30" />
        <span>
          Garis putus menandai target ideal. Warna bar menunjukkan proporsi nyata dari pemasukan bulan ini.
        </span>
      </div>
    </Card>
  );
}
