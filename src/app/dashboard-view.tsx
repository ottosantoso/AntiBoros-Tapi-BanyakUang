import { useEffect, useState } from 'react';
import { ArrowRight, BarChart3, CalendarCheck2, CircleDollarSign, Sparkles, Target } from 'lucide-react';
import { endOfMonth, format, isSameMonth, startOfMonth } from 'date-fns';
import type { DashboardData } from '@/lib/types';
import { MetricCard } from '@/components/metric-card';
import { CashflowChart, CategoryDoughnut } from '@/components/cashflow-charts';
import { TransactionListCard } from '@/components/transaction-list';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { rangeSuffix, type DateRangeValue } from '@/lib/date-range';
import { fetchBudgetData, type Goal } from '@/lib/data';
import { formatIDR } from '@/lib/format';

const SAVINGS_TARGET = 20;

interface Props {
  data: DashboardData;
  loading: boolean;
  dateRange: DateRangeValue;
}

/** Perubahan persen. Mengembalikan undefined bila pembanding nol, sehingga delta disembunyikan. */
function pctChange(cur: number, prev: number): number | undefined {
  if (prev === 0) return undefined;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/**
 * Perbandingan hanya valid jika rentang yang dipilih adalah bulan berjalan:
 * tren bulanan selalu berakhir di bulan berjalan, jadi pembanding yang benar
 * adalah bulan sebelumnya. Untuk rentang lain, delta tidak ditampilkan.
 */
function isCurrentMonthRange(r: DateRangeValue, now = new Date()): boolean {
  return Boolean(r.from && isSameMonth(r.from, now) && r.to && isSameMonth(r.to, now));
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
  const deltaNet = canCompare && prev ? pctChange(net, prevNet) : undefined;

  const goals = useGoals();

  return (
    <div className="space-y-4">
      <WelcomeBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard metric="balance" label="Total Saldo" value={data.totalSaldo} loading={loading} />
        <MetricCard metric="income" label={`Pemasukan ${period}`} value={income} delta={deltaIncome} loading={loading} />
        <MetricCard metric="expense" label={`Pengeluaran ${period}`} value={expense} delta={deltaExpense} loading={loading} />
        <MetricCard metric={net >= 0 ? 'savings' : 'expense'} label={`${net >= 0 ? 'Tabungan' : 'Defisit'} ${period}`} value={net} delta={deltaNet} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashflowChart data={data.trenBulanan ?? []} loading={loading} />
        </div>
        <CategoryDoughnut categories={data.rekapKategori} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <GoalCard goals={goals} rate={rate} loading={loading} />
        </div>
        <div className="lg:col-span-3">
          <TransactionListCard transactions={data.transaksi ?? []} loading={loading} limit={5} />
        </div>
      </div>
    </div>
  );
}

/** Daftar target tabungan dari tabel goals. Dimuat sekali saat dashboard dibuka. */
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

function GoalCard({ goals, rate, loading }: { goals: Goal[] | null; rate: number | null; loading: boolean }) {
  if (loading || goals === null) {
    return (
      <Card className="rounded-2xl border-[#dbeafe] bg-white p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-4 w-full" />
        <Skeleton className="mt-3 h-2 w-full" />
      </Card>
    );
  }

  // Target dengan tenggat terdekat lebih dulu; yang tanpa tenggat di bawah.
  const sorted = [...goals].sort((a, b) => (a.deadline ?? '9999-12-31').localeCompare(b.deadline ?? '9999-12-31'));
  const goal = sorted[0];
  const pct = goal && goal.target > 0 ? Math.min(Math.max((goal.terkumpul / goal.target) * 100, 0), 100) : 0;

  return (
    <Card className="flex h-full flex-col rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]" aria-hidden="true">
          <Target className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">Target Tabungan</h3>
          <p className="text-xs font-medium text-[#5b6f99]">Progres dari target yang kamu buat</p>
        </div>
      </div>

      {goal ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-bold text-[#172554]">{goal.nama}</span>
            <span className="shrink-0 text-sm font-extrabold text-[#2563eb]">{pct.toFixed(0)}%</span>
          </div>
          <p className="mt-1 text-xs font-medium text-[#5b6f99]">
            {formatIDR(goal.terkumpul)} dari {formatIDR(goal.target)}
            {goal.deadline ? ` · tenggat ${goal.deadline}` : ''}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#dbeafe]" aria-hidden="true">
            <span className="block h-full rounded-full bg-[#2563eb]" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">
          Belum ada target tabungan. Buat target di menu Budget.
        </p>
      )}

      <div className="mt-auto border-t border-[#e0f2fe] pt-4">
        <p className="text-xs font-bold text-[#31548a]">Rasio tabungan</p>
        <p className="mt-1 text-sm font-extrabold text-[#172554]">
          {rate === null
            ? 'Belum bisa dihitung, belum ada pemasukan'
            : `${rate.toFixed(0)}% dari pemasukan (target ${SAVINGS_TARGET}%)`}
        </p>
      </div>
    </Card>
  );
}

function WelcomeBanner() {
  return (
    <section className="relative min-h-[148px] overflow-hidden rounded-[20px] border border-[#bfdbfe] bg-gradient-to-r from-[#dff4ff] via-[#c9efff] to-[#e7f8ff] px-6 py-5 shadow-[0_8px_24px_rgba(30,64,175,0.08)] md:px-8">
      <div className="relative z-10 max-w-[520px]">
        <div className="mb-2 flex items-center gap-2 text-[#2563eb]">
          <Sparkles className="h-4 w-4" />
          <span className="text-[11px] font-extrabold uppercase tracking-[0.12em]">Hepeng History</span>
        </div>
        <h2 className="font-display text-[25px] font-extrabold leading-[1.08] tracking-[-0.04em] text-[#172554] md:text-[30px]">
          Kelola Keuangan,<br />Capai Tujuan Finansialmu!
        </h2>
        <p className="mt-2 text-xs font-semibold text-[#31548a] md:text-sm">Pantau pengeluaran, atur anggaran, dan wujudkan rencana masa depan.</p>
        <button type="button" className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#2563eb] px-4 py-2 text-xs font-extrabold text-white shadow-[0_7px_15px_rgba(37,99,235,0.22)] transition hover:bg-[#1d4ed8]">
          Lihat Detail <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] md:block">
        <div className="absolute -right-8 -top-10 h-44 w-44 rounded-full bg-white/35" />
        <div className="absolute right-20 top-8 h-24 w-24 rounded-full bg-[#bae6fd]/80" />
        <div className="absolute bottom-[-32px] right-24 h-32 w-32 rounded-full bg-[#93c5fd]/35" />
        <div className="absolute right-[34%] top-8 grid h-20 w-16 rotate-[-5deg] place-items-center rounded-lg border-4 border-[#64748b] bg-white shadow-[8px_10px_0_#bfdbfe]">
          <CalendarCheck2 className="h-9 w-9 text-[#2563eb]" strokeWidth={2.2} />
          <span className="absolute -top-4 left-2 h-5 w-2 rounded-full bg-[#1e40af]" /><span className="absolute -top-4 right-2 h-5 w-2 rounded-full bg-[#1e40af]" />
        </div>
        <div className="absolute bottom-7 right-[18%] grid h-14 w-14 place-items-center rounded-full bg-[#fbbf24] text-[#92400e] shadow-[0_7px_0_#d97706]">
          <CircleDollarSign className="h-8 w-8" strokeWidth={2.2} />
        </div>
        <div className="absolute right-7 top-10 rotate-[-10deg] text-[#2563eb]"><BarChart3 className="h-28 w-28" strokeWidth={1.9} /></div>
        <div className="absolute bottom-2 right-[-20px] h-10 w-64 rounded-[50%] bg-[#38bdf8]/40 blur-sm" />
      </div>
    </section>
  );
}
