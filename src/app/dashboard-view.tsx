import { ArrowRight, BarChart3, CalendarCheck2, CircleDollarSign, Sparkles } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import { MetricCard } from '@/components/metric-card';
import { CashflowChart, CategoryDoughnut, BudgetRule } from '@/components/cashflow-charts';
import { TransactionListCard } from '@/components/transaction-list';
import { rangeSuffix, type DateRangeValue } from '@/lib/date-range';

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
  const period = rangeSuffix(dateRange);

  return (
    <div className="space-y-4">
      <WelcomeBanner />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard metric="balance" label="Total Saldo" value={data.totalSaldo} delta={4.2} loading={loading} />
        <MetricCard metric="income" label={`Pemasukan ${period}`} value={income} delta={income > 0 ? 4.2 : 0} loading={loading} />
        <MetricCard metric="expense" label={`Pengeluaran ${period}`} value={expense} delta={expense > 0 ? -3.1 : 0} loading={loading} />
        <MetricCard metric={net >= 0 ? 'savings' : 'expense'} label={`${net >= 0 ? 'Tabungan' : 'Defisit'} ${period}`} value={net} delta={savingsRate} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CashflowChart data={data.trenBulanan ?? []} loading={loading} />
        </div>
        <CategoryDoughnut categories={data.rekapKategori} loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <BudgetRule income={income} expense={expense} savings={net} balance={data.totalSaldo} loading={loading} />
        </div>
        <div className="lg:col-span-3">
          <TransactionListCard transactions={data.transaksi ?? []} loading={loading} limit={5} />
        </div>
      </div>
    </div>
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
