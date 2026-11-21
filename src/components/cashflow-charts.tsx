import { useEffect, useState } from 'react';
import { Area, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { MonthlyTrend } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatIDR, formatIDRCompact } from '@/lib/format';
import { BarChart3, CircleDollarSign, Goal, PieChart as PieChartIcon } from 'lucide-react';

interface ChartPoint { bulan: string; pemasukan: number; pengeluaran: number }
interface TooltipPayload { name: string; value: number; color: string; dataKey: string }

function useChartColors() {
  const [colors, setColors] = useState({ income: '#10b981', expense: '#f43f5e' });
  useEffect(() => {
    const read = () => {
      const styles = getComputedStyle(document.documentElement);
      const income = styles.getPropertyValue('--income').trim();
      const expense = styles.getPropertyValue('--expense').trim();
      setColors({ income: income ? `hsl(${income})` : '#10b981', expense: expense ? `hsl(${expense})` : '#f43f5e' });
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

function CashflowTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl border border-[#dbeafe] bg-white p-3 text-xs shadow-xl"><p className="mb-1.5 font-extrabold text-[#172554]">{label}</p>{payload.map((item) => <div key={item.dataKey} className="flex items-center gap-2 py-0.5"><span className="h-2 w-2 rounded-full" style={{ background: item.color }} /><span className="text-[#5b6f99]">{item.dataKey === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</span><span className="ml-auto font-bold tnum text-[#172554]">{formatIDR(item.value)}</span></div>)}</div>;
}

export function CashflowChart({ data, loading }: { data: MonthlyTrend[]; loading?: boolean }) {
  const colors = useChartColors();
  const points: ChartPoint[] = data.length ? data : Array.from({ length: 6 }, (_, i) => ({ bulan: `B${i + 1}`, pemasukan: 0, pengeluaran: 0 }));

  if (loading) return <Card className="rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]"><Skeleton className="h-5 w-40" /><Skeleton className="mt-1 h-4 w-56" /><Skeleton className="mt-5 h-64 w-full rounded-xl" /></Card>;

  return (
    <Card className="rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]"><BarChart3 className="h-5 w-5" /></span><div><h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">Arus Kas</h3><p className="text-xs font-medium text-[#5b6f99]">Pemasukan vs Pengeluaran — 6 bulan terakhir</p></div></div>
        <div className="flex items-center gap-4 text-xs font-bold text-[#172554]"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" /> Pemasukan</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]" /> Pengeluaran</span></div>
      </div>
      <div className="mt-4 h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <defs><linearGradient id="incomeArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.income} stopOpacity={0.18} /><stop offset="100%" stopColor={colors.income} stopOpacity={0} /></linearGradient><linearGradient id="expenseArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={colors.expense} stopOpacity={0.14} /><stop offset="100%" stopColor={colors.expense} stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" vertical opacity={0.8} />
            <XAxis dataKey="bulan" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#31548a', fontWeight: 600 }} />
            <YAxis tickFormatter={(value) => formatIDRCompact(Number(value))} tickLine={false} axisLine={false} width={62} tick={{ fontSize: 10, fill: '#31548a', fontWeight: 600 }} />
            <Tooltip cursor={{ stroke: '#93c5fd', strokeWidth: 1 }} content={<CashflowTooltip />} />
            <Area type="monotone" dataKey="pemasukan" stroke="none" fill="url(#incomeArea)" />
            <Area type="monotone" dataKey="pengeluaran" stroke="none" fill="url(#expenseArea)" />
            <Line type="monotone" dataKey="pemasukan" stroke={colors.income} strokeWidth={2.5} dot={{ r: 4, fill: colors.income, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="pengeluaran" stroke={colors.expense} strokeWidth={2.5} dot={{ r: 4, fill: colors.expense, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

interface CategorySlice { name: string; value: number; color: string }
const PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#a5b4fc', '#f43f5e', '#14b8a6', '#64748b'];

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { color: string } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return <div className="rounded-xl border border-[#dbeafe] bg-white p-3 text-xs shadow-xl"><div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: item.payload.color }} /><span className="font-extrabold text-[#172554]">{item.name}</span></div><p className="mt-1.5 font-bold tnum text-[#172554]">{formatIDR(item.value)}</p></div>;
}

export function CategoryDoughnut({ categories, loading }: { categories: Record<string, number>; loading?: boolean }) {
  const slices: CategorySlice[] = Object.entries(categories).map(([name, value]) => ({ name, value: Number(value) || 0, color: '' })).sort((a, b) => b.value - a.value).map((slice, index) => ({ ...slice, color: PALETTE[index % PALETTE.length] }));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (loading) return <Card className="rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]"><Skeleton className="h-5 w-44" /><Skeleton className="mt-1 h-4 w-56" /><div className="mt-5 flex flex-col items-center gap-6 sm:flex-row"><Skeleton className="h-44 w-44 rounded-full" /><div className="flex-1 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-5 w-full" />)}</div></div></Card>;
  if (!slices.length) return <Card className="flex h-full items-center justify-center rounded-2xl border-[#dbeafe] bg-white p-8 text-center shadow-[0_6px_18px_rgba(30,64,175,0.06)]"><p className="text-sm font-semibold text-[#5b6f99]">Belum ada pengeluaran bulan ini.</p></Card>;

  return (
    <Card className="rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]"><PieChartIcon className="h-5 w-5" /></span><div><h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">Pengeluaran per Kategori</h3><p className="text-xs font-medium text-[#5b6f99]">Distribusi belanja bulan ini</p></div></div>
      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:gap-2">
        <div className="relative h-44 w-44 shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={slices} dataKey="value" nameKey="name" innerRadius={51} outerRadius={78} paddingAngle={2} stroke="none" cornerRadius={5}>{slices.map((slice) => <Cell key={slice.name} fill={slice.color} />)}</Pie><Tooltip content={<PieTooltip />} /></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="text-[10px] font-bold uppercase tracking-wider text-[#5b6f99]">Total</span><span className="font-display text-sm font-extrabold tnum text-[#172554]">{formatIDRCompact(total)}</span></div></div>
        <div className="w-full flex-1 space-y-2">{slices.slice(0, 5).map((slice) => { const percent = total ? (slice.value / total) * 100 : 0; return <div key={slice.name} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} /><span className="min-w-0 flex-1 truncate font-semibold text-[#172554]">{slice.name}</span><span className="font-bold tnum text-[#172554]">{percent.toFixed(0)}%</span></div>; })}</div>
      </div>
    </Card>
  );
}

export function BudgetRule({ income, expense, savings, balance, loading }: { income: number; expense: number; savings: number; balance: number; loading?: boolean }) {
  const goal = 50_000_000;
  const collected = Math.max(balance, 0);
  const progress = Math.min((collected / goal) * 100, 100);
  if (loading) return <Card className="rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]"><Skeleton className="h-5 w-44" /><Skeleton className="mt-1 h-4 w-56" /><Skeleton className="mt-6 h-3 w-full rounded-full" /><Skeleton className="mt-5 h-5 w-64" /></Card>;
  return <Card className="relative overflow-hidden rounded-2xl border-[#dbeafe] bg-gradient-to-br from-white to-[#e0f2fe] p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]"><div className="relative z-10 flex items-start justify-between"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fecdd3] text-[#e11d48]"><Goal className="h-5 w-5" /></span><div><h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">Tujuan Keuangan</h3><p className="text-xs font-medium text-[#5b6f99]">Menuju target tabungan Rp 50.000.000</p></div></div><span className="rounded-full bg-[#dbeafe] px-2.5 py-1 text-xs font-extrabold text-[#2563eb]">{progress.toFixed(0)}%</span></div><div className="relative z-10 mt-6 h-3 overflow-hidden rounded-full bg-[#dbeafe]"><span className="block h-full rounded-full bg-gradient-to-r from-[#38bdf8] to-[#2563eb] transition-all duration-700" style={{ width: `${progress}%` }} /></div><div className="relative z-10 mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-bold text-[#31548a]"><span>Terkumpul: <strong className="text-[#172554]">{formatIDR(collected)}</strong></span><span>Sisa: <strong className="text-[#172554]">{formatIDR(Math.max(goal - collected, 0))}</strong></span></div><div className="pointer-events-none absolute -bottom-5 right-3 text-[#f59e0b]/80"><CircleDollarSign className="h-24 w-24" strokeWidth={1.3} /></div><span className="sr-only">Pemasukan {income}, pengeluaran {expense}, tabungan {savings}</span></Card>;
}
