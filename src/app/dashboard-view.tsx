import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, Lightbulb, PiggyBank, Sparkles, Target, TrendingDown, Wallet, PieChart as PieChartIcon, Activity } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { endOfMonth, format, isSameMonth, startOfMonth } from 'date-fns';
import type { DashboardData, MonthlyTrend, Transaction } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { rangeSuffix, type DateRangeValue } from '@/lib/date-range';
import { fetchBudgetData, type Goal } from '@/lib/data';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';

const SAVINGS_TARGET = 20;
const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#f43f5e', '#14b8a6', '#64748b'];
const CARD = 'rounded-2xl border border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]';
const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

type Tone = 'blue' | 'green' | 'red' | 'purple';
const TONE: Record<Tone, { card: string; icon: string; stroke: string }> = {
  blue: { card: 'border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-white', icon: 'bg-[#dbeafe] text-[#2563eb]', stroke: '#2563eb' },
  green: { card: 'border-[#bbf7d0] bg-gradient-to-br from-[#f0fdf4] to-white', icon: 'bg-[#dcfce7] text-[#16a34a]', stroke: '#16a34a' },
  red: { card: 'border-[#fecdd3] bg-gradient-to-br from-[#fff1f2] to-white', icon: 'bg-[#ffe4e6] text-[#e11d48]', stroke: '#e11d48' },
  purple: { card: 'border-[#e9d5ff] bg-gradient-to-br from-[#faf5ff] to-white', icon: 'bg-[#f3e8ff] text-[#7c3aed]', stroke: '#7c3aed' },
};

interface Props {
  data: DashboardData;
  loading: boolean;
  dateRange: DateRangeValue;
}

/** Perubahan persen. Undefined bila pembanding nol, sehingga delta disembunyikan. */
function pctChange(cur: number, prev: number): number | undefined {
  if (prev === 0) return undefined;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** Perbandingan hanya valid bila rentang yang dipilih adalah bulan berjalan. */
function isCurrentMonthRange(r: DateRangeValue, now = new Date()): boolean {
  return Boolean(r.from && isSameMonth(r.from, now) && r.to && isSameMonth(r.to, now));
}

function short(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (a >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace('.0', '')} jt`;
  if (a >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return `Rp ${Math.round(n)}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

export function DashboardView({ data, loading, dateRange }: Props) {
  const income = data.pemasukanBulanIni;
  const expense = data.pengeluaranBulanIni;
  const net = data.tabunganBulanIni ?? income - expense;
  const rate = income > 0 ? (net / income) * 100 : null;
  const period = rangeSuffix(dateRange);

  const trend = data.trenBulanan ?? [];
  const prev = trend.length >= 2 ? trend[trend.length - 2] : undefined;
  const canCompare = isCurrentMonthRange(dateRange) && prev !== undefined;
  const prevNet = prev ? prev.pemasukan - prev.pengeluaran : 0;
  const deltaIncome = canCompare && prev ? pctChange(income, prev.pemasukan) : undefined;
  const deltaExpense = canCompare && prev ? pctChange(expense, prev.pengeluaran) : undefined;

  const goals = useGoals();

  return (
    <div className="tabular-nums space-y-5">
      <Banner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total Saldo"
          display={loading ? '' : formatIDR(data.totalSaldo)}
          loading={loading}
          tone="blue"
          icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
          footer={<Delta value={undefined} goodWhenUp fallback="saldo semua dompet aktif" />}
        />
        <KpiCard
          label={`Total Pemasukan ${period}`}
          display={loading ? '' : formatIDR(income)}
          loading={loading}
          tone="green"
          icon={<ArrowDownLeft className="h-5 w-5" aria-hidden="true" />}
          footer={<Delta value={deltaIncome} goodWhenUp fallback="belum ada pembanding" />}
          spark={trend}
          sparkKey="pemasukan"
        />
        <KpiCard
          label={`Total Pengeluaran ${period}`}
          display={loading ? '' : formatIDR(expense)}
          loading={loading}
          tone="red"
          icon={<TrendingDown className="h-5 w-5" aria-hidden="true" />}
          footer={<Delta value={deltaExpense} goodWhenUp={false} fallback="belum ada pembanding" />}
          spark={trend}
          sparkKey="pengeluaran"
        />
        <KpiCard
          label="Rasio Tabungan"
          display={loading ? '' : rate === null ? '–' : `${rate.toFixed(0)}%`}
          loading={loading}
          tone="purple"
          icon={<PiggyBank className="h-5 w-5" aria-hidden="true" />}
          footer={
            <div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#ede9fe]" aria-hidden="true">
                <span className="block h-full rounded-full bg-[#7c3aed]" style={{ width: `${rate === null ? 0 : Math.min(Math.max(rate, 0), 100)}%` }} />
              </div>
              <p className="mt-1.5 text-xs font-bold text-[#5b6f99]">Target {SAVINGS_TARGET}%</p>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashflowCard trend={trend} loading={loading} />
        </div>
        <SummaryCard income={income} expense={expense} net={net} rate={rate} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CategoryCard rekap={data.rekapKategori} loading={loading} />
        <RecentCard transactions={data.transaksi ?? []} loading={loading} />
        <GoalCard goals={goals} loading={loading} />
      </div>
    </div>
  );
}

/** Daftar target tabungan dari tabel goals. Dimuat saat dashboard dibuka. */
function useGoals(): Goal[] | null {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  useEffect(() => {
    let active = true;
    const now = new Date();
    fetchBudgetData({
      start: format(startOfMonth(now), 'yyyy-MM-dd'),
      end: format(endOfMonth(now), 'yyyy-MM-dd'),
    }).then((res) => {
      if (active) setGoals(res.goals);
    });
    return () => {
      active = false;
    };
  }, []);
  return goals;
}

/* ---------- Banner sapaan ---------- */

function Banner() {
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-[#bfdbfe] bg-gradient-to-r from-[#dbeafe] via-[#e0f2fe] to-[#eff6ff] px-6 py-6 shadow-[0_8px_24px_rgba(30,64,175,0.08)] md:px-8">
      <div className="relative z-10 max-w-[560px]">
        <h2 className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-[#172554] md:text-[30px]">
          Halo! <span aria-hidden="true">👋</span>
        </h2>
        <p className="mt-1 text-sm font-semibold text-[#31548a]">
          Kelola keuanganmu dengan lebih mudah dan terarah ✨
        </p>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[40%] md:block" aria-hidden="true">
        <div className="absolute right-10 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/50" />
        <div className="absolute right-28 top-6 h-16 w-16 rounded-full bg-[#fde68a]/70" />
        <div className="absolute bottom-0 right-0 h-16 w-72 rounded-[50%] bg-[#93c5fd]/40 blur-sm" />
      </div>
    </section>
  );
}

/* ---------- KPI ---------- */

function Delta({ value, goodWhenUp, fallback }: { value: number | undefined; goodWhenUp: boolean; fallback: string }) {
  if (value === undefined) return <p className="text-xs font-medium text-[#5b6f99]">{fallback}</p>;
  const up = value >= 0;
  const good = goodWhenUp ? up : !up;
  return (
    <p className={cn('text-xs font-bold', good ? 'text-[#16a34a]' : 'text-[#e11d48]')}>
      {`${up ? '↑ +' : '↓ '}${value.toFixed(0)}% dari bulan lalu`}
    </p>
  );
}

function KpiCard({
  label,
  display,
  loading,
  tone,
  icon,
  footer,
  spark,
  sparkKey,
}: {
  label: string;
  display: string;
  loading: boolean;
  tone: Tone;
  icon: ReactNode;
  footer: ReactNode;
  spark?: MonthlyTrend[];
  sparkKey?: 'pemasukan' | 'pengeluaran';
}) {
  const t = TONE[tone];
  const sparkData = spark && sparkKey ? spark.map((r) => ({ v: r[sparkKey] })) : [];
  return (
    <Card className={cn('flex flex-col overflow-hidden p-5', t.card)}>
      <div className="flex items-center gap-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', t.icon)}>{icon}</span>
        <p className="min-w-0 truncate text-sm font-bold text-[#172554]">{label}</p>
      </div>
      <div className="mt-3">
        {loading ? <Skeleton className="h-8 w-40" /> : <p className="font-display text-2xl font-extrabold tracking-[-0.02em] text-[#172554]">{display}</p>}
      </div>
      <div className="mt-2">{loading ? <Skeleton className="h-4 w-48" /> : footer}</div>
      {sparkData.length > 0 && !loading && (
        <div className="mt-3 h-12" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`dash-spark-${tone}-${sparkKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.stroke} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={t.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={t.stroke} strokeWidth={2} fill={`url(#dash-spark-${tone}-${sparkKey})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* ---------- Kartu-kartu ---------- */

function SectionHeader({ icon, title, subtitle, right }: { icon: ReactNode; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">{title}</h3>
          {subtitle && <p className="text-xs font-medium text-[#5b6f99]">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function CardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Card className={CARD}>
      <Skeleton className="h-5 w-44" />
      <Skeleton className="mt-1 h-4 w-56" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    </Card>
  );
}

function CashflowCard({ trend, loading }: { trend: MonthlyTrend[]; loading: boolean }) {
  if (loading) return <CardSkeleton rows={5} />;
  const points = trend.map((t) => ({ bulan: t.bulan, Pemasukan: t.pemasukan, Pengeluaran: t.pengeluaran }));
  return (
    <Card className={CARD}>
      <SectionHeader
        icon={<Activity className="h-5 w-5" />}
        title="Arus Kas Bulanan"
        subtitle="6 bulan terakhir"
        right={
          <div className="hidden items-center gap-3 text-xs font-bold text-[#31548a] sm:flex">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" aria-hidden="true" />Pemasukan</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#e11d48]" aria-hidden="true" />Pengeluaran</span>
          </div>
        }
      />
      <div className="mt-4 h-64" role="img" aria-label="Grafik arus kas pemasukan dan pengeluaran 6 bulan terakhir">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
            <XAxis dataKey="bulan" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tickFormatter={(v) => short(Number(v))} tickLine={false} axisLine={false} width={72} tick={{ fontSize: 11, fill: '#64748b' }} />
            <Tooltip formatter={(v) => formatIDR(Number(v))} />
            <Line type="monotone" dataKey="Pemasukan" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="Pengeluaran" stroke="#e11d48" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function SummaryCard({ income, expense, net, rate, loading }: { income: number; expense: number; net: number; rate: number | null; loading: boolean }) {
  if (loading) return <CardSkeleton rows={4} />;
  const sisa = Math.max(net, 0);
  const pengeluaranPart = income > 0 ? Math.min(expense, income) : 0;
  const segs = [
    { name: 'Pengeluaran', value: pengeluaranPart, color: '#f43f5e' },
    { name: 'Sisa / tabungan', value: sisa, color: '#10b981' },
  ].filter((s) => s.value > 0);

  let tone: 'ok' | 'warn' | 'bad' | 'none' = 'none';
  let message = 'Belum ada pemasukan bulan ini, jadi kondisi keuangan belum bisa dinilai.';
  if (rate !== null) {
    if (rate < 0) {
      tone = 'bad';
      message = 'Pengeluaran melebihi pemasukan bulan ini. Cek kategori terbesar di bawah.';
    } else if (rate < SAVINGS_TARGET) {
      tone = 'warn';
      message = `Rasio tabungan masih di bawah target ${SAVINGS_TARGET}%. Masih bisa dikejar.`;
    } else {
      tone = 'ok';
      message = `Keuanganmu bulan ini dalam kondisi sehat! Kamu sudah menabung ${rate.toFixed(0)}% dari pemasukan.`;
    }
  }
  const box = { ok: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]', warn: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]', bad: 'border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]', none: 'border-[#dbeafe] bg-[#f5f8ff] text-[#31548a]' }[tone];

  return (
    <Card className={cn(CARD, 'flex flex-col')}>
      <SectionHeader icon={<PieChartIcon className="h-5 w-5" />} title="Ringkasan Keuangan" />
      {segs.length > 0 ? (
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segs} dataKey="value" nameKey="name" innerRadius={50} outerRadius={76} paddingAngle={2} stroke="none">
                  {segs.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[11px] font-bold text-[#5b6f99]">Sisa</p>
                <p className="text-xs font-extrabold text-[#172554]">{formatIDR(sisa)}</p>
              </div>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-3 text-xs">
            <li>
              <p className="flex items-center gap-2 font-bold text-[#172554]"><span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]" aria-hidden="true" />Pengeluaran</p>
              <p className="mt-0.5 pl-4.5 font-extrabold text-[#172554]">{formatIDR(expense)}</p>
            </li>
            <li>
              <p className="flex items-center gap-2 font-bold text-[#172554]"><span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" aria-hidden="true" />Tabungan</p>
              <p className="mt-0.5 pl-4.5 font-extrabold text-[#172554]">{formatIDR(sisa)}</p>
            </li>
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Belum ada transaksi bulan ini.</p>
      )}
      <div className={cn('mt-auto rounded-xl border px-3 py-2.5 text-xs font-bold leading-relaxed', box)}>{message}</div>
    </Card>
  );
}

function CategoryCard({ rekap, loading }: { rekap: Record<string, number>; loading: boolean }) {
  if (loading) return <CardSkeleton rows={5} />;
  const entries = Object.entries(rekap).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const top = entries.slice(0, 5);
  const restTotal = entries.slice(5).reduce((s, [, v]) => s + v, 0);
  const segs = top.map(([name, value], i) => ({ name, value, color: PALETTE[i % PALETTE.length] }));
  if (restTotal > 0) segs.push({ name: 'Lainnya', value: restTotal, color: '#94a3b8' });

  return (
    <Card className={CARD}>
      <SectionHeader icon={<Lightbulb className="h-5 w-5" />} title="Pengeluaran per Kategori" />
      {segs.length ? (
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segs} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={2} stroke="none">
                  {segs.map((s) => <Cell key={s.name} fill={s.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[11px] font-bold text-[#5b6f99]">Total</p>
                <p className="text-[11px] font-extrabold text-[#172554]">{formatIDR(total)}</p>
              </div>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2">
            {segs.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-bold text-[#172554]">{s.name}</span>
                <span className="font-extrabold text-[#172554]">{total > 0 ? ((s.value / total) * 100).toFixed(1) : '0'}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Belum ada pengeluaran bulan ini.</p>
      )}
    </Card>
  );
}

function RecentCard({ transactions, loading }: { transactions: Transaction[]; loading: boolean }) {
  if (loading) return <CardSkeleton rows={5} />;
  const rows = transactions.slice(0, 5);
  return (
    <Card className={CARD}>
      <SectionHeader icon={<ArrowUpRight className="h-5 w-5" />} title="Transaksi Terbaru" />
      {rows.length ? (
        <ul className="mt-4 divide-y divide-[#e0f2fe]">
          {rows.map((t, i) => {
            const income = t.tipe === 'Pemasukan';
            return (
              <li key={t.id ?? i} className="flex items-center gap-3 py-2.5">
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', income ? 'bg-[#dcfce7] text-[#16a34a]' : 'bg-[#ffe4e6] text-[#e11d48]')} aria-hidden="true">
                  {income ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-[#172554]">{t.deskripsi}</p>
                  <p className="truncate text-xs font-medium text-[#5b6f99]">
                    {t.kategori ?? 'Tanpa kategori'} · {fmtDate(t.tanggal)}
                  </p>
                </div>
                <span className={cn('shrink-0 text-sm font-extrabold', income ? 'text-[#16a34a]' : 'text-[#e11d48]')}>
                  {income ? '+' : '-'} {formatIDR(t.nominal)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Belum ada transaksi di periode ini.</p>
      )}
    </Card>
  );
}

function GoalCard({ goals, loading }: { goals: Goal[] | null; loading: boolean }) {
  if (loading || goals === null) return <CardSkeleton rows={3} />;
  const sorted = [...goals].sort((a, b) => (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31'));
  const goal = sorted[0];
  const pct = goal && goal.target > 0 ? Math.min(Math.max((goal.terkumpul / goal.target) * 100, 0), 100) : 0;
  return (
    <Card className={cn(CARD, 'flex flex-col')}>
      <SectionHeader icon={<Target className="h-5 w-5" />} title="Target Tabungan" subtitle="Progres dari target yang kamu buat" />
      {goal ? (
        <div className="mt-4 flex flex-1 flex-col">
          <div className="rounded-xl bg-[#eff6ff] p-4">
            <p className="truncate text-sm font-bold text-[#172554]">{goal.nama}</p>
            <div className="mt-1 flex items-baseline justify-between gap-3">
              <span className="font-display text-base font-extrabold text-[#172554]">{formatIDR(goal.terkumpul)}</span>
              <span className="text-xs font-semibold text-[#5b6f99]">dari {formatIDR(goal.target)}</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#dbeafe]" aria-hidden="true">
              <span className="block h-full rounded-full bg-[#2563eb]" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-right text-sm font-extrabold text-[#2563eb]">{pct.toFixed(0)}%</p>
          </div>
          <p className="mt-auto pt-3 text-xs font-semibold text-[#5b6f99]">
            {goal.deadline ? `Tenggat ${fmtDate(goal.deadline)}` : 'Tanpa tenggat'}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Belum ada target tabungan. Buat target di menu Budget.</p>
      )}
    </Card>
  );
}
