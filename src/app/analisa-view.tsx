import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  Inbox,
  Lightbulb,
  Loader2,
  PieChart as PieChartIcon,
  PiggyBank,
  Sparkles,
  Target,
  Trophy,
  TrendingDown,
  Wallet,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAnalisa } from '@/lib/use-analisa';
import { fetchAiAnalysis, saveAiReport, type AnalisaData } from '@/lib/data';
import type { MonthlyTrend } from '@/lib/types';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';

type Mode = 'bulan' | 'rentang' | 'tahun';
type ChangeKey = 'pemasukan' | 'pengeluaran' | 'net';
type Tone = 'blue' | 'red' | 'green' | 'purple';

interface TrendRow {
  bulan: string;
  pemasukan: number;
  pengeluaran: number;
  net: number;
}

const MODES: { id: Mode; label: string }[] = [
  { id: 'bulan', label: 'Satu bulan' },
  { id: 'rentang', label: 'Rentang bulan' },
  { id: 'tahun', label: 'Satu tahun' },
];

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const CARD = 'rounded-2xl border border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]';
const PALETTE = ['#2563eb', '#f59e0b', '#10b981', '#8b5cf6', '#f43f5e', '#14b8a6', '#64748b'];
const SAVINGS_TARGET = 20;

const TONE: Record<Tone, { card: string; icon: string; stroke: string }> = {
  blue: { card: 'border-[#bfdbfe] bg-gradient-to-br from-[#eff6ff] to-white', icon: 'bg-[#dbeafe] text-[#2563eb]', stroke: '#2563eb' },
  red: { card: 'border-[#fecdd3] bg-gradient-to-br from-[#fff1f2] to-white', icon: 'bg-[#ffe4e6] text-[#e11d48]', stroke: '#e11d48' },
  green: { card: 'border-[#bbf7d0] bg-gradient-to-br from-[#f0fdf4] to-white', icon: 'bg-[#dcfce7] text-[#16a34a]', stroke: '#16a34a' },
  purple: { card: 'border-[#e9d5ff] bg-gradient-to-br from-[#faf5ff] to-white', icon: 'bg-[#f3e8ff] text-[#7c3aed]', stroke: '#7c3aed' },
};

/* ---------- Helper tanggal (YYYY-MM) ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function ymLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTHS[m - 1] ?? ym} ${y}`;
}

function startOfMonth(ym: string): string {
  return `${ym}-01`;
}

function endOfMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${ym}-${pad(new Date(y, m, 0).getDate())}`;
}

/** Angka ringkas untuk sumbu grafik, misalnya "Rp 6 jt". */
function short(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)} M`;
  if (a >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1).replace('.0', '')} jt`;
  if (a >= 1_000) return `Rp ${Math.round(n / 1_000)} rb`;
  return `Rp ${Math.round(n)}`;
}

/** Nama kategori untuk tampilan. "Transfer" di sini berarti uang dari atau ke pihak luar dompet terdaftar. */
function labelKategori(k: string): string {
  return k === 'Transfer' ? 'Transfer pihak luar' : k;
}

/* ---------- Perhitungan ---------- */

function monthValue(t: MonthlyTrend, key: ChangeKey): number {
  if (key === 'net') return t.pemasukan - t.pengeluaran;
  return t[key];
}

/**
 * Perubahan dibanding bulan sebelumnya (persen). Hanya untuk mode satu bulan,
 * karena tren 6 bulan berakhir di bulan periode.
 */
function changeOf(d: AnalisaData | null, mode: Mode, key: ChangeKey): number | null {
  if (!d || mode !== 'bulan' || d.tren.length < 2) return null;
  const cur = monthValue(d.tren[d.tren.length - 1], key);
  const prev = monthValue(d.tren[d.tren.length - 2], key);
  if (prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

function buildInsights(d: AnalisaData, mode: Mode): string[] {
  const out: string[] = [];
  const top = d.perKategori[0];
  if (top && d.pengeluaran > 0) {
    out.push(`Pengeluaran terbesar ada di kategori ${labelKategori(top.kategori)} (${top.persen.toFixed(0)}%). Pertimbangkan untuk mengurangi pengeluaran di kategori ini.`);
  }
  if (d.rasioTabungan === null) {
    if (d.pengeluaran > 0) out.push('Belum ada pemasukan pada periode ini, jadi rasio tabungan belum bisa dihitung.');
  } else if (d.rasioTabungan < 0) {
    out.push(`Pengeluaran melebihi pemasukan sebesar ${formatIDR(Math.abs(d.sisaBersih))}. Mulai dari kategori terbesar untuk dikurangi.`);
  } else if (d.rasioTabungan >= SAVINGS_TARGET) {
    out.push(`Kamu berhasil menabung ${d.rasioTabungan.toFixed(0)}% dari pemasukan. Target idealnya minimal ${SAVINGS_TARGET}%.`);
  } else {
    const kurang = Math.max((d.pemasukan * SAVINGS_TARGET) / 100 - d.sisaBersih, 0);
    out.push(`Kamu menabung ${d.rasioTabungan.toFixed(0)}% dari pemasukan. Target idealnya minimal ${SAVINGS_TARGET}%, butuh sekitar ${formatIDR(kurang)} lagi.`);
  }
  const cur = changeOf(d, mode, 'pengeluaran');
  if (cur !== null && cur < 0) {
    out.push(`Pengeluaran turun ${Math.abs(cur).toFixed(0)}% dibanding bulan sebelumnya. Lanjutkan kebiasaan ini!`);
  } else if (cur !== null && cur > 0) {
    out.push(`Pengeluaran naik ${cur.toFixed(0)}% dibanding bulan sebelumnya. Cek kembali kategori yang membengkak.`);
  }
  if (d.transfer.biayaAdmin > 0) {
    out.push(`Biaya admin transfer ${formatIDR(d.transfer.biayaAdmin)} dari ${d.transfer.jumlah} transfer antar-dompet.`);
  }
  return out.slice(0, 4);
}

/**
 * Saldo dompet sekarang diambil dari data dashboard yang dikirim lewat syncKey.
 * Dibaca dengan aman: kalau tidak ada, card rekonsiliasi tetap tampil tanpa angka saldo.
 */
function saldoDariSyncKey(syncKey: unknown): number | undefined {
  if (syncKey && typeof syncKey === 'object' && 'totalSaldo' in syncKey) {
    const v = Number((syncKey as { totalSaldo: unknown }).totalSaldo);
    return Number.isFinite(v) ? v : undefined;
  }
  return undefined;
}

/* ---------- Halaman ---------- */

export function AnalisaView({ onGoTransactions, syncKey }: { onGoTransactions: () => void; syncKey?: unknown }) {
  const nowYm = currentYm();
  const [mode, setMode] = useState<Mode>('bulan');
  const [ym, setYm] = useState(nowYm);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [from, setFrom] = useState(() => shiftYm(currentYm(), -2));
  const [to, setTo] = useState(() => currentYm());

  const range = useMemo(() => {
    if (mode === 'tahun') return { start: `${year}-01-01`, end: `${year}-12-31` };
    if (mode === 'rentang') {
      const a = from <= to ? from : to;
      const b = from <= to ? to : from;
      return { start: startOfMonth(a), end: endOfMonth(b) };
    }
    return { start: startOfMonth(ym), end: endOfMonth(ym) };
  }, [mode, ym, year, from, to]);

  const periodLabel =
    mode === 'tahun'
      ? `Tahun ${year}`
      : mode === 'rentang'
        ? `${ymLabel(from <= to ? from : to)} – ${ymLabel(from <= to ? to : from)}`
        : ymLabel(ym);

  const { data, status, error, reload } = useAnalisa(range, syncKey);
  const loading = status === 'loading';
  const d = status === 'error' ? null : data;
  const isEmpty = status === 'ready' && d !== null && d.pemasukan === 0 && d.pengeluaran === 0;
  const totalSaldo = saldoDariSyncKey(syncKey);

  const insights = useMemo(() => (d ? buildInsights(d, mode) : []), [d, mode]);
  const trendRows = useMemo<TrendRow[]>(
    () =>
      d
        ? d.tren.map((t) => ({
            bulan: t.bulan,
            pemasukan: t.pemasukan,
            pengeluaran: t.pengeluaran,
            net: t.pemasukan - t.pengeluaran,
          }))
        : [],
    [d],
  );

  const chgIncome = changeOf(d, mode, 'pemasukan');
  const chgExpense = changeOf(d, mode, 'pengeluaran');
  const chgNet = changeOf(d, mode, 'net');
  const net = d?.sisaBersih ?? 0;
  const ratio = d?.rasioTabungan ?? null;

  return (
    <div className="tabular-nums space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#5b6f99]">Pantau pengeluaran dan pahami keuanganmu lebih dalam</p>
        <button
          type="button"
          disabled
          title="Segera hadir"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-[#bfdbfe] bg-white px-4 text-xs font-extrabold text-[#31548a] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download Laporan
        </button>
      </div>

      <PeriodBar
        mode={mode}
        onMode={setMode}
        ym={ym}
        onYm={setYm}
        year={year}
        onYear={setYear}
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        nowYm={nowYm}
        label={periodLabel}
      />

      {status === 'error' && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Analisa belum bisa dimuat: {error ?? 'terjadi kesalahan.'} Coba lagi sebentar lagi.</span>
          </span>
          <button
            type="button"
            onClick={reload}
            className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline"
          >
            Coba lagi
          </button>
        </div>
      )}

      {isEmpty ? (
        <Card className={cn(CARD, 'flex flex-col items-center gap-3 py-10 text-center')}>
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#dbeafe] text-[#2563eb]">
            <Inbox className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">
              Belum ada transaksi di {periodLabel}
            </h3>
            <p className="mt-1 text-sm font-medium text-[#5b6f99]">
              Catat pemasukan dan pengeluaran dulu, lalu analisanya muncul di sini.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoTransactions}
            className="inline-flex h-11 items-center rounded-full bg-[#2563eb] px-5 text-xs font-extrabold text-white shadow-[0_7px_15px_rgba(37,99,235,0.22)] transition hover:bg-[#1d4ed8]"
          >
            Catat sekarang
          </button>
        </Card>
      ) : (
        status !== 'error' && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Pemasukan"
                display={d ? formatIDR(d.pemasukan) : ''}
                loading={loading}
                tone="blue"
                icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
                footer={<ChangeText value={chgIncome} goodWhenUp fallback="total pemasukan periode ini" />}
                spark={trendRows}
                sparkKey="pemasukan"
              />
              <KpiCard
                label="Pengeluaran"
                display={d ? formatIDR(d.pengeluaran) : ''}
                loading={loading}
                tone="red"
                icon={<TrendingDown className="h-5 w-5" aria-hidden="true" />}
                footer={<ChangeText value={chgExpense} goodWhenUp={false} fallback="total pengeluaran periode ini" />}
                spark={trendRows}
                sparkKey="pengeluaran"
              />
              <KpiCard
                label={net >= 0 ? 'Sisa Bersih' : 'Defisit'}
                display={d ? formatIDR(net) : ''}
                loading={loading}
                tone={net >= 0 ? 'green' : 'red'}
                icon={<PiggyBank className="h-5 w-5" aria-hidden="true" />}
                footer={<ChangeText value={chgNet} goodWhenUp fallback="pemasukan dikurangi pengeluaran" />}
                spark={trendRows}
                sparkKey="net"
              />
              <KpiCard
                label="Rasio Tabungan"
                display={loading ? '' : ratio === null ? '–' : `${ratio.toFixed(0)}%`}
                loading={loading}
                tone="purple"
                icon={<Target className="h-5 w-5" aria-hidden="true" />}
                footer={
                  <div>
                    <p className="text-xs font-medium text-[#5b6f99]">dari total pemasukan</p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ede9fe]" aria-hidden="true">
                      <span
                        className="block h-full rounded-full bg-[#7c3aed]"
                        style={{ width: `${ratio === null ? 0 : Math.min(Math.max(ratio, 0), 100)}%` }}
                      />
                    </div>
                  </div>
                }
              />
            </div>

            <RekonsiliasiCard data={d} loading={loading} totalSaldo={totalSaldo} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <TrendCard data={d} loading={loading} />
              </div>
              <div className="lg:col-span-2">
                <InsightCard
                  items={insights}
                  data={d}
                  periodLabel={periodLabel}
                  range={range}
                  loading={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <CategoryCard data={d} loading={loading} />
              <TopCard data={d} loading={loading} />
              <SummaryCard data={d} loading={loading} chgIncome={chgIncome} chgExpense={chgExpense} chgNet={chgNet} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <FlowCard data={d} loading={loading} />
              </div>
              <StatusCard data={d} loading={loading} />
            </div>
          </>
        )
      )}
    </div>
  );
}

/* ---------- Pemilih periode ---------- */

function PeriodBar({
  mode,
  onMode,
  ym,
  onYm,
  year,
  onYear,
  from,
  to,
  onFrom,
  onTo,
  nowYm,
  label,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  ym: string;
  onYm: (v: string) => void;
  year: number;
  onYear: (v: number) => void;
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  nowYm: string;
  label: string;
}) {
  const nowYear = Number(nowYm.slice(0, 4));
  const inputClass =
    'h-11 rounded-xl border border-[#bfdbfe] bg-white px-3 text-sm font-semibold text-[#172554] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]';

  return (
    <Card className={cn(CARD, 'flex flex-wrap items-center justify-between gap-3 p-4')}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Pilih jenis periode">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={active}
              onClick={() => onMode(m.id)}
              className={cn(
                'h-11 rounded-full px-4 text-xs font-extrabold transition',
                active
                  ? 'bg-[#2563eb] text-white shadow-[0_7px_15px_rgba(37,99,235,0.22)]'
                  : 'border border-[#bfdbfe] bg-white text-[#31548a] hover:bg-[#eff6ff]',
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {mode === 'bulan' && (
          <>
            <StepButton label="Bulan sebelumnya" onClick={() => onYm(shiftYm(ym, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </StepButton>
            <span className="min-w-[150px] text-center font-display text-sm font-extrabold text-[#172554]">{label}</span>
            <StepButton label="Bulan berikutnya" onClick={() => onYm(shiftYm(ym, 1))} disabled={ym >= nowYm}>
              <ChevronRight className="h-4 w-4" />
            </StepButton>
          </>
        )}
        {mode === 'tahun' && (
          <>
            <StepButton label="Tahun sebelumnya" onClick={() => onYear(year - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </StepButton>
            <span className="min-w-[150px] text-center font-display text-sm font-extrabold text-[#172554]">{label}</span>
            <StepButton label="Tahun berikutnya" onClick={() => onYear(year + 1)} disabled={year >= nowYear}>
              <ChevronRight className="h-4 w-4" />
            </StepButton>
          </>
        )}
        {mode === 'rentang' && (
          <>
            <label className="flex items-center gap-2 text-xs font-bold text-[#31548a]">
              Dari
              <input
                type="month"
                value={from}
                max={nowYm}
                onChange={(e) => e.target.value && onFrom(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-[#31548a]">
              Sampai
              <input
                type="month"
                value={to}
                max={nowYm}
                onChange={(e) => e.target.value && onTo(e.target.value)}
                className={inputClass}
              />
            </label>
          </>
        )}
      </div>
    </Card>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid h-11 w-11 place-items-center rounded-full border border-[#bfdbfe] bg-white text-[#31548a] transition hover:bg-[#eff6ff] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/* ---------- Komponen kecil ---------- */

function ChangeText({
  value,
  goodWhenUp,
  fallback,
}: {
  value: number | null;
  goodWhenUp: boolean;
  fallback: string;
}) {
  if (value === null) return <p className="text-xs font-medium text-[#5b6f99]">{fallback}</p>;
  const up = value >= 0;
  const good = goodWhenUp ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className={cn('flex items-center gap-1 text-xs font-bold', good ? 'text-[#16a34a]' : 'text-[#e11d48]')}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {`${up ? '+' : ''}${value.toFixed(0)}% dari periode sebelumnya`}
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
  spark?: TrendRow[];
  sparkKey?: ChangeKey;
}) {
  const t = TONE[tone];
  const sparkData = spark && sparkKey ? spark.map((r) => ({ v: r[sparkKey] })) : [];
  return (
    <Card className={cn('flex flex-col overflow-hidden p-5', t.card)}>
      <div className="flex items-center gap-3">
        <span className={cn('grid h-10 w-10 place-items-center rounded-xl', t.icon)}>{icon}</span>
        <p className="text-sm font-bold text-[#172554]">{label}</p>
      </div>
      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-8 w-40" />
        ) : (
          <p className="font-display text-2xl font-extrabold tracking-[-0.02em] text-[#172554]">{display}</p>
        )}
      </div>
      <div className="mt-2">{loading ? <Skeleton className="h-4 w-48" /> : footer}</div>
      {sparkData.length > 0 && !loading && (
        <div className="mt-3 h-14" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${tone}-${sparkKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={t.stroke} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={t.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={t.stroke} strokeWidth={2} fill={`url(#spark-${tone}-${sparkKey})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  right,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">{title}</h3>
          <p className="text-xs font-medium text-[#5b6f99]">{subtitle}</p>
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

/* ---------- Kartu-kartu ---------- */

/**
 * Menghubungkan saldo dompet dengan angka Analisa. Saldo adalah stok (uang yang ada sekarang),
 * Analisa adalah arus (uang yang masuk dan keluar di periode ini). Koreksi saldo menaikkan saldo
 * dompet, tapi bukan pemasukan.
 */
function RekonsiliasiCard({
  data,
  loading,
  totalSaldo,
}: {
  data: AnalisaData | null;
  loading: boolean;
  totalSaldo: number | undefined;
}) {
  if (loading || !data) return <CardSkeleton rows={2} />;
  const koreksi = data.penyesuaian.masuk - data.penyesuaian.keluar;
  return (
    <Card className={CARD}>
      <SectionHeader
        icon={<Wallet className="h-5 w-5" />}
        title="Saldo dompet dan analisa"
        subtitle="Saldo adalah uang yang ada sekarang. Analisa hanya menghitung arus periode ini."
      />
      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <RekonItem label="Saldo dompet sekarang" value={totalSaldo !== undefined ? formatIDR(totalSaldo) : '–'} />
        <RekonItem label="Pemasukan periode" value={formatIDR(data.pemasukan)} />
        <RekonItem label="Pengeluaran periode" value={formatIDR(data.pengeluaran)} />
        <RekonItem
          label="Koreksi saldo periode"
          value={`${koreksi >= 0 ? '+' : '−'} ${formatIDR(Math.abs(koreksi))}`}
          hint="tidak dihitung sebagai pemasukan"
        />
      </dl>
      <p className="mt-4 text-xs font-medium text-[#5b6f99]">
        Saldo dompet = saldo awal + semua pemasukan (termasuk koreksi) − semua pengeluaran ± transfer antar dompet.
      </p>
    </Card>
  );
}

function RekonItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-[#f5f8ff] p-3">
      <dt className="text-xs font-bold text-[#5b6f99]">{label}</dt>
      <dd className="mt-1 font-display text-base font-extrabold text-[#172554]">{value}</dd>
      {hint && <p className="mt-0.5 text-[11px] font-medium text-[#5b6f99]">{hint}</p>}
    </div>
  );
}

function TrendCard({ data, loading }: { data: AnalisaData | null; loading: boolean }) {
  if (loading || !data) return <CardSkeleton rows={5} />;
  const points = data.tren.map((t) => ({ bulan: t.bulan, Pemasukan: t.pemasukan, Pengeluaran: t.pengeluaran }));
  return (
    <Card className={CARD}>
      <SectionHeader
        icon={<Activity className="h-5 w-5" />}
        title="Tren Keuangan"
        subtitle="Pemasukan dan pengeluaran 6 bulan terakhir"
        right={
          <div className="hidden items-center gap-3 text-xs font-bold text-[#31548a] sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2563eb]" aria-hidden="true" />
              Pemasukan
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#e11d48]" aria-hidden="true" />
              Pengeluaran
            </span>
          </div>
        }
      />
      <div className="mt-4 h-64" role="img" aria-label="Grafik tren pemasukan dan pengeluaran 6 bulan terakhir">
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
      <p className="mt-2 text-xs font-medium text-[#5b6f99] sm:hidden">
        Biru: pemasukan. Merah: pengeluaran.
      </p>
    </Card>
  );
}

type InsightState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; insights: string[]; hemat: string[] }
  | { status: 'error'; message: string };

function InsightCard({
  items,
  data,
  periodLabel,
  range,
  loading,
}: {
  items: string[];
  data: AnalisaData | null;
  periodLabel: string;
  range: { start: string; end: string };
  loading: boolean;
}) {
  const [state, setState] = useState<InsightState>({ status: 'idle' });

  // Hasil AI hanya berlaku untuk periode yang sedang tampil.
  useEffect(() => {
    setState({ status: 'idle' });
  }, [periodLabel]);

  if (loading || !data) return <CardSkeleton rows={4} />;

  const run = async () => {
    setState({ status: 'loading' });
    const res = await fetchAiAnalysis({ periode: periodLabel, data });
    if (res.error || !res.data) {
      setState({ status: 'error', message: res.error ?? 'AI belum bisa membuat insight.' });
      return;
    }
    // Simpan ke riwayat AI. Kalau gagal, insight tetap tampil di layar.
    const saved = await saveAiReport({
      kind: 'analisa',
      periodStart: range.start,
      periodEnd: range.end,
      metrics: {
        pemasukan: data.pemasukan,
        pengeluaran: data.pengeluaran,
        sisaBersih: data.sisaBersih,
        rasioTabungan: data.rasioTabungan,
      },
      narrative: res.data,
    });
    if (!saved.success) {
      toast.warning('Insight tampil, tapi gagal disimpan ke riwayat', { description: saved.error ?? undefined });
    }
    setState({ status: 'ready', insights: res.data.insights, hemat: res.data.hemat });
  };

  const hasNoData = data.pengeluaran === 0 && data.pemasukan === 0;

  return (
    <Card className={cn(CARD, 'flex h-full flex-col')}>
      <SectionHeader icon={<Lightbulb className="h-5 w-5" />} title="Insight Keuangan" subtitle="Dibaca dari angka periode ini" />

      {items.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {items.map((text, i) => (
            <li key={i} className="flex gap-3 text-sm font-medium leading-relaxed text-[#172554]">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#eff6ff] text-[#2563eb]" aria-hidden="true">
                <Sparkles className="h-3.5 w-3.5" />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Belum cukup data untuk membuat insight.</p>
      )}

      <div className="mt-auto border-t border-[#e0f2fe] pt-4">
        {state.status === 'idle' && (
          <button
            type="button"
            onClick={run}
            disabled={hasNoData}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[#2563eb] px-4 text-xs font-extrabold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {hasNoData ? 'Belum ada data untuk AI' : 'Buat insight AI'}
          </button>
        )}

        {state.status === 'loading' && (
          <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-semibold text-[#31548a]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> AI sedang membaca ringkasan...
          </p>
        )}

        {state.status === 'error' && (
          <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-sm">
            <p className="font-semibold text-[#92400e]">{state.message}</p>
            <p className="mt-1 text-xs text-[#92400e]">Ringkasan angka di atas tetap bisa dipakai.</p>
            <button type="button" onClick={run} className="mt-2 text-xs font-extrabold text-[#1d4ed8] underline underline-offset-2">
              Coba lagi
            </button>
          </div>
        )}

        {state.status === 'ready' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wider text-[#5b6f99]">Insight AI</p>
              {state.insights.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {state.insights.map((text, i) => (
                    <li key={i} className="flex gap-2 text-sm font-medium leading-relaxed text-[#172554]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" aria-hidden="true" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm font-medium text-[#5b6f99]">AI belum menemukan insight dari data ini.</p>
              )}
            </div>
            {state.hemat.length > 0 && (
              <div>
                <p className="text-xs font-extrabold uppercase tracking-wider text-[#5b6f99]">Saran hemat</p>
                <ul className="mt-2 space-y-2">
                  {state.hemat.map((text, i) => (
                    <li key={i} className="flex gap-2 text-sm font-medium leading-relaxed text-[#172554]">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16a34a]" aria-hidden="true" />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button type="button" onClick={run} className="text-xs font-extrabold text-[#1d4ed8] underline underline-offset-2">
              Perbarui
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}

function CategoryCard({ data, loading }: { data: AnalisaData | null; loading: boolean }) {
  if (loading || !data) return <CardSkeleton rows={5} />;

  const segs = data.perKategori.slice(0, 4).map((k, i) => ({
    name: labelKategori(k.kategori),
    value: k.total,
    persen: k.persen,
    color: PALETTE[i % PALETTE.length],
  }));
  const rest = data.perKategori.slice(4);
  const restTotal = rest.reduce((s, k) => s + k.total, 0);
  const restPersen = rest.reduce((s, k) => s + k.persen, 0);
  if (restTotal > 0) segs.push({ name: 'Lainnya', value: restTotal, persen: restPersen, color: '#94a3b8' });

  return (
    <Card className={CARD}>
      <SectionHeader icon={<PieChartIcon className="h-5 w-5" />} title="Pengeluaran per Kategori" subtitle="Distribusi pengeluaran periode ini" />
      {segs.length ? (
        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-40 w-40 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={segs} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} stroke="none">
                  {segs.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <p className="text-[11px] font-bold text-[#5b6f99]">Total</p>
                <p className="text-xs font-extrabold text-[#172554]">{formatIDR(data.pengeluaran)}</p>
              </div>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2">
            {segs.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-bold text-[#172554]">{s.name}</span>
                <span className="font-extrabold text-[#172554]">{s.persen.toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Tidak ada pengeluaran pada periode ini.</p>
      )}
    </Card>
  );
}

function TopCard({ data, loading }: { data: AnalisaData | null; loading: boolean }) {
  if (loading || !data) return <CardSkeleton rows={5} />;
  const rows = data.perKategori.slice(0, 5);
  return (
    <Card className={CARD}>
      <SectionHeader icon={<Trophy className="h-5 w-5" />} title="Top 5 Pengeluaran" subtitle="Kategori dengan pengeluaran terbesar" />
      {rows.length ? (
        <ol className="mt-4 space-y-3">
          {rows.map((row, i) => (
            <li key={row.kategori}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eff6ff] text-[10px] font-extrabold text-[#2563eb]">
                    {i + 1}
                  </span>
                  <span className="min-w-0 truncate font-bold text-[#172554]">{labelKategori(row.kategori)}</span>
                </span>
                <span className="shrink-0 font-extrabold text-[#172554]">
                  {formatIDR(row.total)} <span className="text-[#5b6f99]">{row.persen.toFixed(1)}%</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#e0f2fe]" aria-hidden="true">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.min(row.persen, 100)}%`, background: PALETTE[i % PALETTE.length] }}
                />
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Tidak ada pengeluaran pada periode ini.</p>
      )}
    </Card>
  );
}

function SummaryCard({
  data,
  loading,
  chgIncome,
  chgExpense,
  chgNet,
}: {
  data: AnalisaData | null;
  loading: boolean;
  chgIncome: number | null;
  chgExpense: number | null;
  chgNet: number | null;
}) {
  if (loading || !data) return <CardSkeleton rows={5} />;
  const target = Math.round((data.pemasukan * SAVINGS_TARGET) / 100);
  const pct = target > 0 ? Math.min(Math.max(data.sisaBersih / target, 0), 1) * 100 : 0;
  return (
    <Card className={CARD}>
      <SectionHeader icon={<ClipboardList className="h-5 w-5" />} title="Ringkasan Periode" subtitle="Angka utama periode ini" />
      <dl className="mt-4 space-y-3">
        <SummaryRow label="Pemasukan" value={formatIDR(data.pemasukan)} change={<ChangeText value={chgIncome} goodWhenUp fallback="" />} />
        <SummaryRow label="Pengeluaran" value={formatIDR(data.pengeluaran)} change={<ChangeText value={chgExpense} goodWhenUp={false} fallback="" />} />
        <SummaryRow label="Sisa Bersih" value={formatIDR(data.sisaBersih)} change={<ChangeText value={chgNet} goodWhenUp fallback="" />} />
      </dl>
      <div className="mt-5 rounded-xl bg-[#f5f8ff] p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-[#31548a]">
          <Target className="h-4 w-4" aria-hidden="true" /> Target tabungan {SAVINGS_TARGET}% dari pemasukan
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="font-display text-base font-extrabold text-[#172554]">
            {target > 0 ? formatIDR(target) : 'Belum ada pemasukan'}
          </span>
          <span className="text-sm font-extrabold text-[#2563eb]">{target > 0 ? `${pct.toFixed(0)}%` : '–'}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#dbeafe]" aria-hidden="true">
          <span className="block h-full rounded-full bg-[#2563eb]" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Card>
  );
}

function SummaryRow({ label, value, change }: { label: string; value: string; change: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#eef2ff] pb-3 last:border-0 last:pb-0">
      <div>
        <dt className="text-sm font-bold text-[#172554]">{label}</dt>
        <dd className="mt-0.5">{change}</dd>
      </div>
      <span className="font-display text-sm font-extrabold text-[#172554]">{value}</span>
    </div>
  );
}

function FlowCard({ data, loading }: { data: AnalisaData | null; loading: boolean }) {
  if (loading || !data) return <CardSkeleton rows={3} />;
  const total = data.pemasukan + data.pengeluaran;
  const incomeShare = total > 0 ? (data.pemasukan / total) * 100 : 0;
  const expenseShare = total > 0 ? 100 - incomeShare : 0;

  return (
    <Card className={CARD}>
      <SectionHeader icon={<Activity className="h-5 w-5" />} title="Aliran Dana" subtitle="Perbandingan pemasukan dan pengeluaran periode ini" />

      {total > 0 ? (
        <>
          <div className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-[#e0f2fe]" role="img" aria-label={`Pemasukan ${incomeShare.toFixed(0)}%, pengeluaran ${expenseShare.toFixed(0)}%`}>
            <span className="block h-full bg-[#3b82f6]" style={{ width: `${incomeShare}%` }} />
            <span className="block h-full bg-[#f43f5e]" style={{ width: `${expenseShare}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
            <span className="flex items-center gap-2 text-[#172554]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" aria-hidden="true" />
              Pemasukan {formatIDR(data.pemasukan)} ({incomeShare.toFixed(0)}%)
            </span>
            <span className="flex items-center gap-2 text-[#172554]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#f43f5e]" aria-hidden="true" />
              Pengeluaran {formatIDR(data.pengeluaran)} ({expenseShare.toFixed(0)}%)
            </span>
          </div>
        </>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Belum ada pemasukan maupun pengeluaran.</p>
      )}

      {data.sumberPemasukan.length > 0 && (
        <div className="mt-5 border-t border-[#e0f2fe] pt-4">
          <p className="text-xs font-extrabold uppercase tracking-wider text-[#5b6f99]">Sumber pemasukan</p>
          <ul className="mt-2 space-y-1.5">
            {data.sumberPemasukan.map((s) => (
              <li key={s.kategori} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-semibold text-[#172554]">{labelKategori(s.kategori)}</span>
                <span className="shrink-0 font-bold text-[#047857]">+ {formatIDR(s.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.transfer.jumlah > 0 && (
        <p className="mt-4 rounded-xl bg-[#e0f2fe] px-3 py-2 text-xs font-semibold text-[#31548a]">
          {data.transfer.jumlah} transfer antar-dompet senilai {formatIDR(data.transfer.total)} tidak dihitung sebagai
          pemasukan atau pengeluaran.
        </p>
      )}
    </Card>
  );
}

function StatusCard({ data, loading }: { data: AnalisaData | null; loading: boolean }) {
  if (loading || !data) return <CardSkeleton rows={3} />;

  let tone: 'ok' | 'warn' | 'bad' = 'ok';
  let text = 'Kamu masih dalam kondisi keuangan yang sehat!';
  if (data.pemasukan === 0 && data.pengeluaran > 0) {
    tone = 'warn';
    text = 'Belum ada pemasukan di periode ini, jadi kondisi keuanganmu belum bisa dinilai.';
  } else if (data.pengeluaran > data.pemasukan) {
    tone = 'bad';
    text = 'Pengeluaran melebihi pemasukan. Mulai dari kategori terbesar untuk dikurangi.';
  } else if (data.rasioTabungan !== null && data.rasioTabungan < SAVINGS_TARGET) {
    tone = 'warn';
    text = `Rasio tabungan masih di bawah target ${SAVINGS_TARGET}%. Masih bisa dikejar.`;
  }

  const styles = {
    ok: { box: 'border-[#bbf7d0] bg-[#f0fdf4]', icon: 'bg-[#16a34a] text-white', Icon: CheckCircle2 },
    warn: { box: 'border-[#fde68a] bg-[#fffbeb]', icon: 'bg-[#f59e0b] text-white', Icon: AlertTriangle },
    bad: { box: 'border-[#fecdd3] bg-[#fff1f2]', icon: 'bg-[#e11d48] text-white', Icon: AlertTriangle },
  }[tone];

  return (
    <Card className={cn('flex h-full items-center gap-4 p-5', styles.box)}>
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full', styles.icon)} aria-hidden="true">
        <styles.Icon className="h-5 w-5" />
      </span>
      <p className="text-sm font-bold leading-relaxed text-[#172554]">{text}</p>
    </Card>
  );
}
