import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  CheckCircle2,
  Car,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  GraduationCap,
  Heart,
  PiggyBank,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Tag,
  Target,
  Trash2,
  Utensils,
  Wallet,
  Wifi,
  Zap,
} from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  NON_REAL_KATEGORI,
  deleteBudgetRow,
  deleteGoalRow,
  fetchBudgetData,
  insertGoal,
  updateGoalRow,
  upsertBudgetLimit,
  type BudgetData,
  type Budgeting,
  type Goal,
  type Subkategori,
} from '@/lib/data';
import { formatIDR, toISODate } from '@/lib/format';
import { cn } from '@/lib/utils';

const RULE: { key: Budgeting; label: string; pct: number; bar: string }[] = [
  { key: 'Kebutuhan', label: 'Kebutuhan', pct: 50, bar: 'bg-[#059669]' },
  { key: 'Keinginan', label: 'Keinginan', pct: 30, bar: 'bg-[#f59e0b]' },
  { key: 'Tabungan', label: 'Tabungan', pct: 20, bar: 'bg-[#2563eb]' },
];

const PALETTE = ['#2563eb', '#f97316', '#059669', '#8b5cf6', '#06b6d4', '#e11d48', '#94a3b8'];

/** Jumlah baris di tampilan ringkas, dan jumlah baris per halaman di Lihat Semua. */
const PREVIEW_COUNT = 6;
const PAGE_SIZE = 10;

const ICON_RULES: [RegExp, LucideIcon][] = [
  [/makan|jajan|kopi/i, Utensils],
  [/transport|bensin|parkir|tol|ojek|angkutan/i, Car],
  [/tagihan|listrik|air|gas|utilitas/i, Zap],
  [/internet|paket|wifi/i, Wifi],
  [/kesehatan|obat|dokter/i, Heart],
  [/pendidikan|kursus|sekolah/i, GraduationCap],
  [/belanja|pakaian|gadget/i, ShoppingBag],
  [/hiburan|game|wisata/i, Gamepad2],
];

const parseRp = (s: string) => Number(s.replace(/\D/g, '')) || 0;
const rpJt = (n: number) => (n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 2 }) + ' jt';
const iconFor = (nama: string): LucideIcon => ICON_RULES.find(([re]) => re.test(nama))?.[1] ?? Tag;

function periodeBulanIni() {
  const now = new Date();
  return {
    start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

const labelBulanIni = () => new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

function ProgressBar({ value, className }: { value: number; className: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className={cn('h-full rounded-full transition-all', className)} style={{ width: `${width}%` }} />
    </div>
  );
}

export function BudgetView({ onOpenInsight }: { onOpenInsight?: () => void }) {
  const [range] = useState(periodeBulanIni);
  const [data, setData] = useState<BudgetData | null>(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);

  const reload = useCallback(async () => {
    const res = await fetchBudgetData(range);
    if (res.error) toast.error('Gagal memuat budget', { description: res.error });
    setData(res);
  }, [range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const view = useMemo(() => {
    if (!data) return null;
    const limitBy = new Map(data.budgets.map((b) => [b.subkategoriId, b]));
    const pengeluaran = data.subkategori.filter(
      (s: Subkategori) => s.jenis === 'Pengeluaran' && !NON_REAL_KATEGORI.has(s.kategori),
    );
    const rows = pengeluaran.map((s) => ({
      sub: s,
      spent: data.spentBySubkat[s.id] ?? 0,
      limit: limitBy.get(s.id) ?? null,
    }));

    const budgeted = rows.filter((r) => r.limit);
    const totalLimit = budgeted.reduce((a, r) => a + (r.limit?.limit ?? 0), 0);
    const spentBudgeted = budgeted.reduce((a, r) => a + r.spent, 0);
    const overBudget = budgeted.some((r) => r.spent > (r.limit?.limit ?? 0));

    const perKat = new Map<string, number>();
    rows.forEach((r) => {
      if (r.spent > 0) perKat.set(r.sub.kategori, (perKat.get(r.sub.kategori) ?? 0) + r.spent);
    });
    const slices = [...perKat.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([nama, value], i) => ({ nama, value, color: PALETTE[i % PALETTE.length] }));

    const bars = budgeted.map((r) => ({
      nama: r.sub.nama,
      anggaran: r.limit?.limit ?? 0,
      realisasi: r.spent,
    }));

    const actual: Record<Budgeting, number> = { Kebutuhan: 0, Keinginan: 0, Tabungan: 0 };
    rows.forEach((r) => {
      if (r.sub.budgeting) actual[r.sub.budgeting] += r.spent;
    });

    return { rows, budgeted, totalLimit, spentBudgeted, overBudget, slices, bars, actual };
  }, [data]);

  if (!data || !view) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const pctUsed = view.totalLimit > 0 ? Math.round((view.spentBudgeted / view.totalLimit) * 100) : 0;
  const sisa = view.totalLimit - view.spentBudgeted;
  const sliceTotal = view.slices.reduce((a, s) => a + s.value, 0);
  const limitBy = new Map(data.budgets.map((b) => [b.subkategoriId, b]));

  // Daftar batas: pencarian menyaring semua subkategori. Tanpa pencarian, tampilan ringkas
  // menampilkan sebagian; "Lihat Semua" membuka daftar lengkap dengan paginasi.
  const keyword = query.trim().toLowerCase();
  const filtered = view.rows.filter((r) => r.sub.nama.toLowerCase().includes(keyword));
  const isSearching = keyword.length > 0;
  const expanded = showAll || isSearching;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = expanded
    ? filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : filtered.slice(0, PREVIEW_COUNT);
  const rangeStart = expanded ? (safePage - 1) * PAGE_SIZE + 1 : 1;
  const rangeEnd = expanded ? Math.min(safePage * PAGE_SIZE, filtered.length) : Math.min(PREVIEW_COUNT, filtered.length);

  return (
    <div className="mx-auto grid w-full min-w-0 max-w-[1200px] gap-4 md:gap-5">
      <Card className="flex items-center justify-between gap-3 rounded-2xl border-border bg-gradient-to-r from-sky-50 to-blue-50 p-4 md:p-6 dark:from-slate-900 dark:to-slate-800">
        <div className="flex min-w-0 items-center gap-3">
          <span className="hidden h-14 w-14 shrink-0 place-items-center rounded-2xl bg-card shadow-sm sm:grid">
            <Target className="h-8 w-8 text-blue-600" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-base font-extrabold text-foreground md:text-xl">Kelola Budget, Capai Tujuan Finansialmu!</h1>
            <p className="text-sm text-muted-foreground">Atur anggaran bulanan dan pantau penggunaannya dengan mudah.</p>
          </div>
        </div>
        {onOpenInsight ? (
          <Button variant="outline" onClick={onOpenInsight} className="shrink-0 gap-2">
            <Sparkles className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Lihat Insight AI</span>
            <span className="sm:hidden">Insight</span>
          </Button>
        ) : null}
      </Card>

      <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard icon={Wallet} tone="blue" label="Total Anggaran Bulan Ini" value={formatIDR(view.totalLimit)} footer={labelBulanIni()} />
        <StatCard
          icon={Target}
          tone="green"
          label="Sudah Digunakan"
          value={formatIDR(view.spentBudgeted)}
          footer={
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <ProgressBar value={pctUsed} className={barColor(pctUsed)} />
              </div>
              <span className="text-sm font-semibold tnum">{pctUsed}%</span>
            </div>
          }
        />
        <StatCard
          icon={Wallet}
          tone="rose"
          label="Sisa Anggaran"
          value={<span className={sisa < 0 ? 'text-[#e11d48]' : undefined}>{formatIDR(sisa)}</span>}
        />
        <StatCard
          icon={CheckCircle2}
          tone="violet"
          label="Status Budget"
          value={
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold',
                view.overBudget ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700',
              )}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              {view.overBudget ? 'Ada yang lewat batas' : 'Dalam Batas'}
            </span>
          }
        />
      </section>

      <section className="grid min-w-0 gap-4 lg:grid-cols-5">
        <Card className="min-w-0 rounded-2xl border-border p-4 md:p-5 lg:col-span-3">
          <h2 className="mb-1 text-base font-extrabold text-foreground">Anggaran vs Realisasi</h2>
          <p className="mb-3 text-xs text-muted-foreground">Per subkategori yang sudah punya batas bulan ini</p>
          {view.bars.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Atur batas di bawah untuk melihat grafik.</p>
          ) : (
            <>
              <div className="flex justify-center gap-4 pb-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#93c5fd]" aria-hidden />Anggaran</span>
                <span className="inline-flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-[#1d4ed8]" aria-hidden />Realisasi</span>
              </div>
              <div className="h-64 w-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={view.bars} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }} barGap={3}>
                    <XAxis type="number" tickFormatter={(v: number) => rpJt(v)} tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis type="category" dataKey="nama" width={96} tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip formatter={(v: number) => formatIDR(v)} />
                    <Bar dataKey="anggaran" fill="#93c5fd" radius={[0, 4, 4, 0]} maxBarSize={14} />
                    <Bar dataKey="realisasi" fill="#1d4ed8" radius={[0, 4, 4, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </Card>

        <Card className="min-w-0 rounded-2xl border-border p-4 md:p-5 lg:col-span-2">
          <h2 className="mb-3 text-base font-extrabold text-foreground">Distribusi Pengeluaran</h2>
          {view.slices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pengeluaran bulan ini.</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col xl:flex-row">
              <div className="relative h-44 w-44 shrink-0">
                <PieChart width={176} height={176}>
                  <Pie data={view.slices} dataKey="value" nameKey="nama" innerRadius={52} outerRadius={80} paddingAngle={2} stroke="none">
                    {view.slices.map((s) => (
                      <Cell key={s.nama} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                  <div>
                    <p className="text-base font-bold tnum">{rpJt(sliceTotal)}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>
              <ul className="w-full min-w-0 flex-1 space-y-2">
                {view.slices.map((s) => {
                  const share = sliceTotal ? Math.round((s.value / sliceTotal) * 100) : 0;
                  return (
                    <li key={s.nama} className="flex items-center gap-2 text-sm">
                      <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{s.nama}</span>
                      <span className="w-9 text-right tnum text-muted-foreground">{share}%</span>
                      <span className="w-28 text-right font-medium tnum">{formatIDR(s.value)}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </Card>
      </section>

      <Card className="rounded-2xl border-border p-4 md:p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-foreground">Aturan 50/30/20</h2>
            <p className="text-xs text-muted-foreground">Dihitung dari pemasukan bulan ini</p>
          </div>
          <p className="text-sm font-bold tnum text-foreground">Pemasukan {formatIDR(data.pemasukan)}</p>
        </div>
        <div className="grid gap-3 md:grid-cols-3 md:gap-4">
          {RULE.map((r) => {
            const target = (data.pemasukan * r.pct) / 100;
            const actual = view.actual[r.key];
            const persen = target > 0 ? Math.round((actual / target) * 100) : 0;
            return (
              <div key={r.key} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{r.label} ({r.pct}%)</span>
                  <span className="tnum text-muted-foreground">{persen}%</span>
                </div>
                <p className="mt-2 text-sm font-extrabold tnum">{formatIDR(actual)}</p>
                <p className="text-[11px] text-muted-foreground">Target {formatIDR(target)}</p>
                <div className="mt-3">
                  <ProgressBar value={persen} className={r.bar} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-2xl border-border p-4 md:p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-extrabold text-foreground">
              <Target className="h-5 w-5 text-blue-600" aria-hidden /> Batas per Subkategori
            </h2>
            <p className="text-xs text-muted-foreground">Atur batas bulanan. Pengeluaran bulan ini dihitung otomatis.</p>
          </div>
          <label className="relative w-full md:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <span className="sr-only">Cari subkategori</span>
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari subkategori..."
              className="pl-9"
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {view.rows.length === 0 ? 'Belum ada subkategori pengeluaran.' : 'Subkategori tidak ditemukan.'}
          </p>
        ) : (
          <>
            <div className="grid gap-x-6 xl:grid-cols-2">
              {visible.map((r) => (
                <BudgetRow
                  key={r.sub.id}
                  sub={r.sub}
                  spent={r.spent}
                  budgetId={limitBy.get(r.sub.id)?.id ?? null}
                  limit={limitBy.get(r.sub.id)?.limit ?? null}
                  onChanged={reload}
                />
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                Menampilkan {rangeStart}–{rangeEnd} dari {filtered.length} subkategori
              </p>

              {expanded && totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(1, safePage - 1))}
                    disabled={safePage <= 1}
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[88px] text-center text-xs font-semibold tnum">
                    Hal. {safePage} dari {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage >= totalPages}
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}

              {!isSearching && filtered.length > PREVIEW_COUNT ? (
                showAll ? (
                  <Button variant="ghost" size="sm" onClick={() => { setShowAll(false); setPage(1); }}>
                    Tutup daftar
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                    Lihat Semua ({filtered.length})
                  </Button>
                )
              ) : null}
            </div>
          </>
        )}
      </Card>

      <GoalsCard goals={data.goals} onChanged={reload} />
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  footer,
}: {
  icon: LucideIcon;
  tone: 'blue' | 'green' | 'rose' | 'violet';
  label: string;
  value: ReactNode;
  footer?: ReactNode;
}) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950',
    green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-950',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950',
  }[tone];
  return (
    <Card className="flex min-w-0 flex-col gap-3 rounded-2xl border-border p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', toneClass)} aria-hidden>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
          <p className="truncate text-base font-extrabold tnum sm:text-xl">{value}</p>
        </div>
      </div>
      {footer ? <div className="text-xs text-muted-foreground">{footer}</div> : null}
    </Card>
  );
}

function BudgetRow({
  sub,
  spent,
  budgetId,
  limit,
  onChanged,
}: {
  sub: Subkategori;
  spent: number;
  budgetId: string | null;
  limit: number | null;
  onChanged: () => Promise<void>;
}) {
  const [value, setValue] = useState(limit ? String(limit) : '');
  const [saving, setSaving] = useState(false);
  const Icon = iconFor(sub.nama);

  useEffect(() => {
    setValue(limit ? String(limit) : '');
  }, [limit]);

  const save = async () => {
    const n = parseRp(value);
    if (n <= 0) {
      toast.error('Batas harus lebih dari 0');
      return;
    }
    setSaving(true);
    const res = await upsertBudgetLimit(sub.id, n);
    setSaving(false);
    if (!res.success) {
      toast.error('Gagal menyimpan batas', { description: res.error ?? undefined });
      return;
    }
    toast.success(`Batas ${sub.nama} disimpan`);
    await onChanged();
  };

  const remove = async () => {
    if (!budgetId) return;
    const res = await deleteBudgetRow(budgetId);
    if (!res.success) {
      toast.error('Gagal menghapus batas', { description: res.error ?? undefined });
      return;
    }
    toast.success(`Batas ${sub.nama} dihapus`);
    await onChanged();
  };

  const persen = limit ? Math.round((spent / limit) * 100) : 0;

  return (
    <div className="flex flex-col gap-3 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted" aria-hidden>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-bold text-foreground">{sub.nama}</span>
            {sub.budgeting ? (
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{sub.budgeting}</span>
            ) : null}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Terpakai <span className="tnum">{formatIDR(spent)}</span>
          </p>
        </div>
        {limit ? (
          <div className="flex w-24 shrink-0 items-center gap-2 sm:w-28">
            <div className="flex-1">
              <ProgressBar value={persen} className={barColor(persen)} />
            </div>
            <span className="w-9 text-right text-xs tnum">{persen}%</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          placeholder="Rp 500.000"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Batas bulanan ${sub.nama}`}
          className="w-full sm:w-36"
        />
        <Button size="sm" onClick={save} disabled={saving}>
          Simpan
        </Button>
        {budgetId ? (
          <Button size="icon" variant="ghost" onClick={remove} aria-label={`Hapus batas ${sub.nama}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function GoalsCard({ goals, onChanged }: { goals: Goal[]; onChanged: () => Promise<void> }) {
  const [nama, setNama] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const n = parseRp(target);
    if (!nama.trim() || n <= 0) {
      toast.error('Isi nama dan target (lebih dari 0)');
      return;
    }
    setSaving(true);
    const res = await insertGoal({ nama: nama.trim(), target: n, deadline: deadline || null });
    setSaving(false);
    if (!res.success) {
      toast.error('Gagal menambah target', { description: res.error ?? undefined });
      return;
    }
    setNama('');
    setTarget('');
    setDeadline('');
    toast.success('Target tabungan ditambahkan');
    await onChanged();
  };

  return (
    <Card className="rounded-2xl border-border p-4 md:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dcfce7] text-[#059669]">
          <PiggyBank className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-extrabold text-foreground">Target Tabungan</h2>
          <p className="text-xs text-muted-foreground">Isi jumlah terkumpul secara manual setiap kali menabung.</p>
        </div>
      </div>

      <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_180px_auto]">
        <Input placeholder="Nama target" value={nama} onChange={(e) => setNama(e.target.value)} aria-label="Nama target" />
        <Input inputMode="numeric" placeholder="Target (Rp)" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target" />
        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Deadline" />
        <Button onClick={add} disabled={saving}>
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      </div>

      {goals.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada target tabungan.</p>
      ) : (
        <div className="divide-y divide-border">
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} onChanged={onChanged} />
          ))}
        </div>
      )}
    </Card>
  );
}

function GoalRow({ goal, onChanged }: { goal: Goal; onChanged: () => Promise<void> }) {
  const [terkumpul, setTerkumpul] = useState(String(goal.terkumpul));
  const persen = goal.target > 0 ? Math.round((goal.terkumpul / goal.target) * 100) : 0;

  useEffect(() => {
    setTerkumpul(String(goal.terkumpul));
  }, [goal.terkumpul]);

  const saveTerkumpul = async () => {
    const n = parseRp(terkumpul);
    const res = await updateGoalRow(goal.id, { terkumpul: n });
    if (!res.success) {
      toast.error('Gagal memperbarui', { description: res.error ?? undefined });
      return;
    }
    toast.success(`Terkumpul ${goal.nama} diperbarui`);
    await onChanged();
  };

  const remove = async () => {
    const res = await deleteGoalRow(goal.id);
    if (!res.success) {
      toast.error('Gagal menghapus target', { description: res.error ?? undefined });
      return;
    }
    toast.success('Target dihapus');
    await onChanged();
  };

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">{goal.nama}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatIDR(goal.terkumpul)} / {formatIDR(goal.target)} · {persen}%
          {goal.deadline ? ` · sampai ${goal.deadline}` : ''}
        </p>
        <div className="mt-2">
          <ProgressBar value={persen} className="bg-[#2563eb]" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={terkumpul}
          onChange={(e) => setTerkumpul(e.target.value)}
          aria-label={`Terkumpul ${goal.nama}`}
          className="w-full sm:w-36"
        />
        <Button size="sm" variant="outline" onClick={saveTerkumpul}>
          Perbarui
        </Button>
        <Button size="icon" variant="ghost" onClick={remove} aria-label={`Hapus ${goal.nama}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function barColor(pct: number) {
  if (pct >= 100) return 'bg-[#e11d48]';
  if (pct >= 80) return 'bg-[#f59e0b]';
  return 'bg-[#059669]';
}
