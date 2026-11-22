import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Lightbulb,
  PieChart as PieChartIcon,
  PiggyBank,
  Trophy,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MetricCard } from '@/components/metric-card';
import { CashflowChart } from '@/components/cashflow-charts';
import { useAnalisa } from '@/lib/use-analisa';
import { fetchAiAnalysis, type AnalisaData } from '@/lib/data';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';

type Mode = 'bulan' | 'rentang' | 'tahun';

const MODES: { id: Mode; label: string }[] = [
  { id: 'bulan', label: 'Satu bulan' },
  { id: 'rentang', label: 'Rentang bulan' },
  { id: 'tahun', label: 'Satu tahun' },
];

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const CARD = 'rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]';
const PALETTE = ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#a5b4fc', '#f43f5e', '#14b8a6', '#64748b'];
const SAVINGS_TARGET = 20;

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

function formatDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${(MONTHS[m - 1] ?? '').slice(0, 3)} ${y}`;
}

/* ---------- Insight otomatis (aturan sederhana, bukan AI) ---------- */

function buildInsights(d: AnalisaData, mode: Mode): string[] {
  const out: string[] = [];
  const top = d.perKategori[0];
  if (top && d.pengeluaran > 0) {
    out.push(`${top.kategori} jadi pengeluaran terbesar: ${formatIDR(top.total)} (${top.persen.toFixed(0)}% dari total pengeluaran).`);
  }
  if (d.rasioTabungan === null) {
    if (d.pengeluaran > 0) out.push('Belum ada pemasukan pada periode ini, jadi rasio tabungan belum bisa dihitung.');
  } else if (d.rasioTabungan < 0) {
    out.push(`Pengeluaran melebihi pemasukan sebesar ${formatIDR(Math.abs(d.sisaBersih))}. Mulai dari kategori terbesar untuk dikurangi.`);
  } else if (d.rasioTabungan >= SAVINGS_TARGET) {
    out.push(`Rasio tabungan ${d.rasioTabungan.toFixed(0)}%, sudah di atas target ${SAVINGS_TARGET}%.`);
  } else {
    const kurang = Math.max((d.pemasukan * SAVINGS_TARGET) / 100 - d.sisaBersih, 0);
    out.push(`Rasio tabungan ${d.rasioTabungan.toFixed(0)}%, masih di bawah target ${SAVINGS_TARGET}%. Butuh sekitar ${formatIDR(kurang)} lagi untuk mencapainya.`);
  }
  if (mode === 'bulan' && d.tren.length >= 2) {
    const cur = d.tren[d.tren.length - 1];
    const prev = d.tren[d.tren.length - 2];
    if (prev.pengeluaran > 0) {
      const diff = ((cur.pengeluaran - prev.pengeluaran) / prev.pengeluaran) * 100;
      out.push(`Pengeluaran ${diff >= 0 ? 'naik' : 'turun'} ${Math.abs(diff).toFixed(0)}% dibanding bulan sebelumnya.`);
    }
  }
  if (d.transfer.biayaAdmin > 0) {
    out.push(`Biaya admin transfer ${formatIDR(d.transfer.biayaAdmin)} dari ${d.transfer.jumlah} transfer antar-dompet.`);
  }
  return out.slice(0, 5);
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

  const net = d?.sisaBersih ?? 0;
  const insights = useMemo(() => (d ? buildInsights(d, mode) : []), [d, mode]);

  return (
    <div className="tabular-nums space-y-4">
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
              <MetricCard metric="income" label="Pemasukan" value={d?.pemasukan ?? 0} loading={loading} />
              <MetricCard metric="expense" label="Pengeluaran" value={d?.pengeluaran ?? 0} loading={loading} />
              <MetricCard
                metric={net >= 0 ? 'savings' : 'expense'}
                label={net >= 0 ? 'Sisa Bersih' : 'Defisit'}
                value={net}
                loading={loading}
              />
              <RatioCard ratio={d?.rasioTabungan ?? null} loading={loading} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <CashflowChart data={d?.tren ?? []} loading={loading} />
              </div>
              <InsightCard items={insights} loading={loading} />
            </div>

            <AiInsightCard data={d} periodLabel={periodLabel} loading={loading} />

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <CategoryCard data={d} loading={loading} />
              <TopCard data={d} loading={loading} />
            </div>

            <FlowCard data={d} loading={loading} />
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
    <Card className={cn(CARD, 'space-y-3')}>
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

/* ---------- Kartu-kartu ---------- */

function SectionHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]" aria-hidden="true">
        {icon}
      </span>
      <div>
        <h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">{title}</h3>
        <p className="text-xs font-medium text-[#5b6f99]">{subtitle}</p>
      </div>
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

function RatioCard({ ratio, loading }: { ratio: number | null; loading: boolean }) {
  if (loading) {
    return (
      <Card className="rounded-2xl border-[#dbeafe] bg-white p-4 shadow-[0_6px_18px_rgba(30,64,175,0.06)]">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <Skeleton className="mt-4 h-3 w-28" />
        <Skeleton className="mt-2 h-8 w-24" />
        <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
      </Card>
    );
  }
  const status =
    ratio === null
      ? 'Belum ada pemasukan'
      : ratio < 0
        ? 'Defisit: pengeluaran melebihi pemasukan'
        : ratio < SAVINGS_TARGET
          ? `Di bawah target ${SAVINGS_TARGET}%`
          : `Sesuai target ${SAVINGS_TARGET}%`;
  const width = ratio === null ? 0 : Math.min(Math.max(ratio, 0), 100);
  return (
    <Card className="rounded-2xl border border-[#ddd6fe] bg-[#f3e8ff] p-4 shadow-[0_6px_18px_rgba(30,64,175,0.06)]">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#ddd6fe]">
        <PiggyBank className="h-5 w-5 text-[#6d28d9]" strokeWidth={2.4} aria-hidden="true" />
      </div>
      <p className="mt-3 text-[13px] font-bold text-[#172554]">Rasio Tabungan</p>
      <p className="mt-1 font-display text-[25px] font-extrabold tracking-[-0.03em] tnum text-[#4c1d95]">
        {ratio === null ? '–' : `${ratio.toFixed(0)}%`}
      </p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#ddd6fe]" aria-hidden="true">
        <span className="block h-full rounded-full bg-[#7c3aed]" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-2 text-[11px] font-bold text-[#4c1d95]">{status}</p>
    </Card>
  );
}

function InsightCard({ items, loading }: { items: string[]; loading: boolean }) {
  if (loading) return <CardSkeleton rows={4} />;
  return (
    <Card className={CARD}>
      <SectionHeader icon={<Lightbulb className="h-5 w-5" />} title="Insight" subtitle="Dihitung otomatis dari datamu" />
      {items.length ? (
        <ul className="mt-4 space-y-3">
          {items.map((text, i) => (
            <li key={i} className="flex gap-2 text-sm font-medium leading-relaxed text-[#172554]">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" aria-hidden="true" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Belum cukup data untuk membuat insight.</p>
      )}
    </Card>
  );
}

function CategoryCard({ data, loading }: { data: AnalisaData | null; loading: boolean }) {
  if (loading || !data) return <CardSkeleton rows={5} />;
  const rows = data.perKategori.slice(0, 8);
  return (
    <Card className={CARD}>
      <SectionHeader icon={<PieChartIcon className="h-5 w-5" />} title="Pengeluaran per Kategori" subtitle="Diurutkan dari yang terbesar" />
      {rows.length ? (
        <ul className="mt-4 space-y-3">
          {rows.map((row, i) => (
            <li key={row.kategori}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate font-bold text-[#172554]">{row.kategori}</span>
                <span className="shrink-0 font-bold tnum text-[#172554]">
                  {formatIDR(row.total)} · {row.persen.toFixed(0)}%
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#e0f2fe]" aria-hidden="true">
                <span
                  className="block h-full rounded-full"
                  style={{ width: `${Math.min(row.persen, 100)}%`, background: PALETTE[i % PALETTE.length] }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Tidak ada pengeluaran pada periode ini.</p>
      )}
    </Card>
  );
}

function TopCard({ data, loading }: { data: AnalisaData | null; loading: boolean }) {
  if (loading || !data) return <CardSkeleton rows={5} />;
  return (
    <Card className={CARD}>
      <SectionHeader icon={<Trophy className="h-5 w-5" />} title="Top 5 Pengeluaran" subtitle="Transaksi terbesar di periode ini" />
      {data.topPengeluaran.length ? (
        <ol className="mt-4 divide-y divide-[#e0f2fe]">
          {data.topPengeluaran.map((item, i) => (
            <li key={item.id || i} className="flex items-center gap-3 py-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#dbeafe] text-xs font-extrabold text-[#2563eb]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#172554]">{item.deskripsi}</p>
                <p className="truncate text-xs font-medium text-[#5b6f99]">
                  {item.kategori} · {formatDay(item.tanggal)}
                </p>
              </div>
              <span className="shrink-0 text-sm font-extrabold tnum text-[#be123c]">- {formatIDR(item.nominal)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">Tidak ada pengeluaran pada periode ini.</p>
      )}
    </Card>
  );
}

function FlowCard({ data, loading }: { data: AnalisaData | null; loading: boolean }) {
  if (loading || !data) return <CardSkeleton rows={3} />;

  const H = 220;
  const TOP = 8;
  const LX = 150; // kolom sumber pemasukan
  const CX = 330; // simpul pusat
  const RX = 510; // kolom pengeluaran dan sisa
  const NW = 12;
  const sisaPos = Math.max(data.sisaBersih, 0);
  const outTotal = data.pengeluaran + sisaPos;
  const scaleBase = Math.max(data.pemasukan, outTotal);

  const sources = data.sumberPemasukan.filter((s) => s.total > 0).slice(0, 6);
  const expense = data.perKategori.slice(0, 5).map((k, i) => ({
    label: k.kategori,
    value: k.total,
    color: PALETTE[i % PALETTE.length],
  }));
  const restExp = data.perKategori.slice(5).reduce((sum, k) => sum + k.total, 0);
  if (restExp > 0) expense.push({ label: 'Lainnya', value: restExp, color: '#94a3b8' });
  if (sisaPos > 0) expense.push({ label: 'Sisa (tabungan)', value: sisaPos, color: '#16a34a' });

  const scale = scaleBase > 0 ? H / scaleBase : 0;
  const ribbon = (x0: number, x1: number, a0: number, a1: number, b0: number, b1: number) => {
    const xm = (x0 + x1) / 2;
    return `M${x0},${a0} C${xm},${a0} ${xm},${b0} ${x1},${b0} L${x1},${b1} C${xm},${b1} ${xm},${a1} ${x0},${a1} Z`;
  };

  // Sumber pemasukan -> pusat
  let yl = TOP;
  let cIn = TOP;
  const inNodes = sources.map((s, i) => {
    const h = s.total * scale;
    const node = { ...s, y: yl, h, color: PALETTE[(i + 3) % PALETTE.length] };
    const path = ribbon(LX + NW, CX, yl, yl + h, cIn, cIn + h);
    cIn += h;
    yl += h + 4;
    return { node, path };
  });

  // Pusat -> pengeluaran dan sisa
  let cOut = TOP;
  let yr = TOP;
  const outNodes = expense.map((e) => {
    const h = e.value * scale;
    const node = { ...e, y: yr, h };
    const path = ribbon(CX + NW, RX, cOut, cOut + h, yr, yr + h);
    cOut += h;
    yr += h + 4;
    return { node, path };
  });

  const centerH = scaleBase * scale;
  const hasFlow = scaleBase > 0;
  const svgH = TOP * 2 + H + 4;

  return (
    <Card className={CARD}>
      <SectionHeader
        icon={<ArrowLeftRight className="h-5 w-5" />}
        title="Aliran Dana"
        subtitle="Dari sumber pemasukan ke pengeluaran dan sisa"
      />

      {hasFlow ? (
        <>
          <svg
            viewBox={`0 0 680 ${svgH}`}
            className="mt-4 hidden h-auto w-full sm:block"
            role="img"
            aria-label={`Aliran dana: pemasukan ${formatIDR(data.pemasukan)}, pengeluaran ${formatIDR(data.pengeluaran)}, sisa ${formatIDR(data.sisaBersih)}`}
          >
            {inNodes.map(({ node, path }) => (
              <path key={`in-${node.kategori}`} d={path} fill={node.color} opacity={0.35}>
                <title>{`${node.kategori}: ${formatIDR(node.total)}`}</title>
              </path>
            ))}
            {outNodes.map(({ node, path }) => (
              <path key={`out-${node.label}`} d={path} fill={node.color} opacity={0.35}>
                <title>{`${node.label}: ${formatIDR(node.value)}`}</title>
              </path>
            ))}

            {inNodes.map(({ node }) => (
              <rect key={`inn-${node.kategori}`} x={LX} y={node.y} width={NW} height={Math.max(node.h, 2)} fill={node.color} rx={2} />
            ))}
            <rect x={CX} y={TOP} width={NW} height={Math.max(centerH, 2)} fill="#0b1f3a" rx={2} />
            {outNodes.map(({ node }) => (
              <rect key={`outn-${node.label}`} x={RX} y={node.y} width={NW} height={Math.max(node.h, 2)} fill={node.color} rx={2} />
            ))}

            {inNodes.map(({ node }) =>
              node.h >= 14 ? (
                <text key={`inl-${node.kategori}`} x={LX - 8} y={node.y + node.h / 2} textAnchor="end" dominantBaseline="middle" className="fill-[#172554] text-[11px] font-semibold">
                  {truncate(node.kategori, 20)}
                </text>
              ) : null,
            )}
            <text x={CX + NW / 2} y={TOP + centerH + 16} textAnchor="middle" className="fill-[#172554] text-[11px] font-bold">
              Total
            </text>
            {outNodes.map(({ node }) =>
              node.h >= 14 ? (
                <text key={`outl-${node.label}`} x={RX + NW + 8} y={node.y + node.h / 2} dominantBaseline="middle" className="fill-[#172554] text-[11px] font-semibold">
                  {truncate(node.label, 20)}
                </text>
              ) : null,
            )}
          </svg>

          <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
            {expense.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate font-semibold text-[#172554]">{s.label}</span>
                <span className="font-bold text-[#172554]">{formatIDR(s.value)}</span>
                <span className="w-10 text-right font-bold text-[#5b6f99]">{((s.value / Math.max(data.pemasukan, 1)) * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
          {data.pengeluaran > data.pemasukan && (
            <p className="mt-3 text-xs font-bold text-[#be123c]">
              Pengeluaran melebihi pemasukan di periode ini, jadi tidak ada sisa.
            </p>
          )}
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
                <span className="min-w-0 truncate font-semibold text-[#172554]">{s.kategori}</span>
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

      <span className="sr-only">
        Ringkasan: pemasukan {formatIDR(data.pemasukan)}, pengeluaran {formatIDR(data.pengeluaran)}.
      </span>
    </Card>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/* ---------- Insight AI ---------- */

type AiState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; insights: string[]; hemat: string[] }
  | { status: 'error'; message: string };

function AiInsightCard({ data, periodLabel, loading }: { data: AnalisaData | null; periodLabel: string; loading: boolean }) {
  const [state, setState] = useState<AiState>({ status: 'idle' });

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
    setState({ status: 'ready', insights: res.data.insights, hemat: res.data.hemat });
  };

  const hasNoData = data.pengeluaran === 0 && data.pemasukan === 0;

  return (
    <Card className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <SectionHeader icon={<Sparkles className="h-5 w-5" />} title="Insight AI" subtitle="Dibuat AI dari ringkasan angka periode ini" />
        {state.status !== 'loading' && (
          <button
            type="button"
            onClick={run}
            disabled={hasNoData}
            className="shrink-0 rounded-full bg-[#2563eb] px-3 py-1.5 text-xs font-extrabold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {state.status === 'ready' ? 'Perbarui' : 'Buat insight'}
          </button>
        )}
      </div>

      {state.status === 'idle' && (
        <p className="mt-4 text-sm font-medium text-[#5b6f99]">
          {hasNoData
            ? 'Belum ada transaksi di periode ini, jadi AI belum punya data untuk dianalisa.'
            : 'Tekan "Buat insight" untuk meminta AI membaca ringkasan periode ini. Hanya angka ringkasan yang dikirim, bukan deskripsi transaksi.'}
        </p>
      )}

      {state.status === 'loading' && (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-sm font-semibold text-[#31548a]">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> AI sedang membaca ringkasan...
          </p>
          <Skeleton className="h-4 w-11/12 bg-[#dbeafe]" />
          <Skeleton className="h-4 w-8/12 bg-[#dbeafe]" />
        </div>
      )}

      {state.status === 'error' && (
        <div className="mt-4 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-sm">
          <p className="font-semibold text-[#92400e]">{state.message}</p>
          <p className="mt-1 text-xs text-[#92400e]">Ringkasan angka di atas tetap bisa dipakai.</p>
          <button type="button" onClick={run} className="mt-2 text-xs font-extrabold text-[#1d4ed8] underline underline-offset-2">
            Coba lagi
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <div className="mt-4 space-y-5">
          {state.insights.length > 0 ? (
            <ul className="space-y-3">
              {state.insights.map((text, i) => (
                <li key={i} className="flex gap-2 text-sm font-medium leading-relaxed text-[#172554]">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" aria-hidden="true" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm font-medium text-[#5b6f99]">AI belum menemukan insight dari data ini.</p>
          )}

          {state.hemat.length > 0 && (
            <div className="border-t border-[#e0f2fe] pt-4">
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
        </div>
      )}
    </Card>
  );
}
