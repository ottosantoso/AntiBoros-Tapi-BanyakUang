import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  ChevronLeft,
  ChevronRight,
  Download,
  Lightbulb,
  Loader2,
  Search,
  ShieldCheck,
  Timer,
  Users,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  fetchKesehatanAi,
  fetchLogAktivitas,
  fetchLogRingkasan,
  type LogAdmin,
  type LogRingkasan,
} from '@/lib/data';
import { cn } from '@/lib/utils';

const PER_HALAMAN = 10;
const RENTANG = [7, 30, 90] as const;
type Rentang = (typeof RENTANG)[number];

const LABEL_AKSI: Record<string, string> = {
  lihat_ringkasan: 'Melihat ringkasan',
  lihat_dashboard: 'Membuka dashboard',
  lihat_daftar_pengguna: 'Melihat daftar pengguna',
  nonaktifkan_pengguna: 'Menonaktifkan akun',
  aktifkan_pengguna: 'Mengaktifkan akun',
  ubah_password_pengguna: 'Mengubah password',
  kirim_reset_password: 'Mengirim reset password',
  hapus_pengguna: 'Menghapus pengguna',
  minta_akses_dukungan: 'Meminta akses dukungan',
  akses_dukungan_data: 'Membuka data dukungan',
  cabut_akses_dukungan: 'Mencabut akses dukungan',
  lihat_log_aktivitas: 'Membuka log',
  lihat_monitor_transaksi: 'Membuka monitoring transaksi',
  lihat_monitor_ai: 'Membuka monitoring AI',
  lihat_kesehatan_ai: 'Membuka kesehatan AI',
};

const MODUL: { value: string; label: string; tone: string }[] = [
  { value: 'Pengguna', label: 'Pengguna', tone: 'bg-primary/10 text-primary' },
  { value: 'Dukungan', label: 'Dukungan', tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  { value: 'Transaksi', label: 'Transaksi', tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  { value: 'AI', label: 'AI', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { value: 'Log', label: 'Log', tone: 'bg-muted text-muted-foreground' },
  { value: 'Dashboard', label: 'Dashboard', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { value: 'Lainnya', label: 'Lainnya', tone: 'bg-muted text-muted-foreground' },
];
const TONE_MODUL: Record<string, string> = Object.fromEntries(MODUL.map((m) => [m.value, m.tone]));

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rentangTanggal(hari: Rentang): { mulai: string; selesai: string } {
  const selesai = new Date();
  const mulai = new Date();
  mulai.setDate(selesai.getDate() - (hari - 1));
  return { mulai: ymd(mulai), selesai: ymd(selesai) };
}

/** Hari berurutan dari mulai sampai selesai. Hari tanpa data diisi 0. */
function isiHari(mulai: string, selesai: string, perHari: LogRingkasan['perHari']) {
  const map = new Map(perHari.map((p) => [p.tanggal, p]));
  const out: { tanggal: string; label: string; total: number; akun: number }[] = [];
  const cur = new Date(`${mulai}T00:00:00`);
  const akhir = new Date(`${selesai}T00:00:00`);
  while (cur <= akhir) {
    const t = ymd(cur);
    const p = map.get(t);
    const [, m, d] = t.split('-');
    out.push({ tanggal: t, label: `${d}/${m}`, total: p?.total ?? 0, akun: p?.akun ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function waktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function labelAksi(aksi: string): string {
  return LABEL_AKSI[aksi] ?? aksi;
}

function labelPengguna(l: LogAdmin): string {
  return l.admin ?? `ID ${l.adminIdSingkat}`;
}

function escapeCsv(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function unduhCsv(items: LogAdmin[]) {
  const baris = [
    ['Waktu', 'Admin', 'Modul', 'Aksi', 'Target'].join(','),
    ...items.map((l) =>
      [
        escapeCsv(new Date(l.waktu).toISOString()),
        escapeCsv(labelPengguna(l)),
        escapeCsv(l.modul),
        escapeCsv(labelAksi(l.aksi)),
        escapeCsv(l.targetIdSingkat ?? ''),
      ].join(','),
    ),
  ];
  const blob = new Blob(['﻿' + baris.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `log-aktivitas-${ymd(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function KartuKpi({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  tone,
  spark,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint: string;
  delta: number | null;
  tone: string;
  spark?: React.ReactNode;
}) {
  const naik = delta !== null && delta >= 0;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-3">
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', tone)}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-display text-2xl font-extrabold tabular-nums">{value}</p>
          {delta !== null ? (
            <p className={cn('mt-1 flex items-center gap-1 text-[11px] font-semibold', naik ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {naik ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(delta)}% dari periode sebelumnya
            </p>
          ) : (
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>
          )}
        </div>
        {spark && <div className="h-10 w-24 shrink-0">{spark}</div>}
      </div>
    </Card>
  );
}

function Sparkline({ data, dataKey, warna, id }: { data: { [k: string]: string | number }[]; dataKey: string; warna: string; id: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={warna} stopOpacity={0.3} />
            <stop offset="100%" stopColor={warna} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={warna} strokeWidth={2} fill={`url(#${id})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AdminLogView() {
  const [hari, setHari] = useState<Rentang>(30);
  const [aksi, setAksi] = useState('');
  const [modul, setModul] = useState('');
  const [inputCari, setInputCari] = useState('');
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(0);

  const [ringkas, setRingkas] = useState<LogRingkasan | null>(null);
  const [latensi, setLatensi] = useState<number | null>(null);
  const [items, setItems] = useState<LogAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRingkas, setLoadingRingkas] = useState(true);
  const [loadingDaftar, setLoadingDaftar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { mulai, selesai } = useMemo(() => rentangTanggal(hari), [hari]);

  // Pencarian diberi jeda supaya tidak memanggil server setiap ketukan
  useEffect(() => {
    const t = setTimeout(() => {
      setCari(inputCari.trim());
      setHalaman(0);
    }, 300);
    return () => clearTimeout(t);
  }, [inputCari]);

  useEffect(() => {
    setHalaman(0);
  }, [hari, aksi, modul]);

  // Angka ringkasan dan latensi AI: hanya berubah saat rentang berubah
  useEffect(() => {
    let aktif = true;
    setLoadingRingkas(true);
    void Promise.all([fetchLogRingkasan(mulai, selesai), fetchKesehatanAi(mulai, selesai)]).then(([r, k]) => {
      if (!aktif) return;
      setRingkas(r.data);
      setLatensi(k.data?.rataLatensi ?? null);
      setError(r.error ?? k.error);
      setLoadingRingkas(false);
    });
    return () => {
      aktif = false;
    };
  }, [mulai, selesai]);

  // Daftar log: mengikuti filter dan halaman
  useEffect(() => {
    let aktif = true;
    setLoadingDaftar(true);
    void fetchLogAktivitas(
      { mulai, selesai, aksi: aksi || null, modul: modul || null, cari: cari || null },
      halaman * PER_HALAMAN,
      PER_HALAMAN,
    ).then((r) => {
      if (!aktif) return;
      setItems(r.data?.items ?? []);
      setTotal(r.data?.total ?? 0);
      setError(r.error);
      setLoadingDaftar(false);
    });
    return () => {
      aktif = false;
    };
  }, [mulai, selesai, aksi, modul, cari, halaman]);

  const harian = useMemo(() => (ringkas ? isiHari(mulai, selesai, ringkas.perHari) : []), [ringkas, mulai, selesai]);

  const totalHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));
  const dari = total === 0 ? 0 : halaman * PER_HALAMAN + 1;
  const sampai = Math.min(total, (halaman + 1) * PER_HALAMAN);

  const persenNaik =
    ringkas && ringkas.totalSebelumnya > 0
      ? Math.round(((ringkas.total - ringkas.totalSebelumnya) / ringkas.totalSebelumnya) * 100)
      : null;
  const aksiTop = ringkas?.aksiTerbanyak[0];

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuKpi
          icon={Activity}
          label="Total aktivitas"
          value={(ringkas?.total ?? 0).toLocaleString('id-ID')}
          hint="Dalam rentang"
          delta={persenNaik}
          tone="bg-primary/10 text-primary"
          spark={ringkas && <Sparkline data={harian} dataKey="total" warna="#3b82f6" id="spark-total" />}
        />
        <KartuKpi
          icon={Users}
          label="Admin aktif"
          value={(ringkas?.adminAktif ?? 0).toLocaleString('id-ID')}
          hint="Admin yang bertindak"
          delta={null}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <KartuKpi
          icon={ShieldCheck}
          label="Akun disentuh"
          value={(ringkas?.akunDisentuh ?? 0).toLocaleString('id-ID')}
          hint="Akun pengguna yang diubah"
          delta={null}
          tone="bg-rose-500/10 text-rose-600 dark:text-rose-400"
          spark={ringkas && <Sparkline data={harian} dataKey="akun" warna="#f43f5e" id="spark-akun" />}
        />
        <KartuKpi
          icon={Timer}
          label="Rata-rata latensi AI"
          value={latensi !== null ? `${latensi} ms` : '-'}
          hint="Panggilan AI, rentang ini"
          delta={null}
          tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Gagal memuat log: {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={inputCari}
            onChange={(e) => setInputCari(e.target.value)}
            placeholder="Cari aksi, admin, atau ID…"
            aria-label="Cari log"
            className="pl-9"
          />
        </div>
        <div role="group" aria-label="Rentang waktu" className="inline-flex rounded-xl border border-border bg-card p-1">
          {RENTANG.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setHari(r)}
              aria-pressed={hari === r}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold transition',
                hari === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r} hari
            </button>
          ))}
        </div>
        <select
          aria-label="Filter aksi"
          value={aksi}
          onChange={(e) => setAksi(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Semua aksi</option>
          {Object.keys(LABEL_AKSI).map((k) => (
            <option key={k} value={k}>{LABEL_AKSI[k]}</option>
          ))}
        </select>
        <select
          aria-label="Filter modul"
          value={modul}
          onChange={(e) => setModul(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Semua modul</option>
          {MODUL.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <Button type="button" variant="outline" onClick={() => unduhCsv(items)} disabled={items.length === 0} className="gap-2">
          <Download className="h-4 w-4" /> Export halaman (CSV)
        </Button>
      </div>

      {/* Tabel */}
      <Card className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Modul</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((l, i) => (
                <tr key={`${l.waktu}-${i}`} className="transition hover:bg-accent/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground">{waktu(l.waktu)}</td>
                  <td className="px-4 py-3 font-semibold">{labelPengguna(l)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold', TONE_MODUL[l.modul] ?? TONE_MODUL.Lainnya)}>{l.modul}</span>
                  </td>
                  <td className="px-4 py-3">{labelAksi(l.aksi)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.targetIdSingkat ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-border md:hidden">
          {items.map((l, i) => (
            <li key={`${l.waktu}-${i}`} className="space-y-1 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold">{labelAksi(l.aksi)}</p>
                <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold', TONE_MODUL[l.modul] ?? TONE_MODUL.Lainnya)}>{l.modul}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {labelPengguna(l)} · {waktu(l.waktu)}
                {l.targetIdSingkat ? ` · target ${l.targetIdSingkat}` : ''}
              </p>
            </li>
          ))}
        </ul>

        {loadingDaftar && (
          <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </p>
        )}
        {!loadingDaftar && items.length === 0 && !error && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada log yang cocok dengan filter ini.</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <p>{total === 0 ? 'Tidak ada data' : `Menampilkan ${dari}–${sampai} dari ${total.toLocaleString('id-ID')} aktivitas`}</p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setHalaman((h) => Math.max(0, h - 1))} disabled={halaman === 0 || loadingDaftar} aria-label="Halaman sebelumnya">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="tabular-nums">Halaman {halaman + 1} / {totalHalaman}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHalaman((h) => Math.min(totalHalaman - 1, h + 1))}
              disabled={halaman + 1 >= totalHalaman || loadingDaftar}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Grafik + insight */}
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold">Grafik aktivitas</h3>
              <p className="text-xs text-muted-foreground">Aktivitas admin per hari dalam rentang</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Aktivitas</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Akun disentuh</span>
            </div>
          </div>
          <div className="h-[260px] w-full min-w-0">
            {loadingRingkas && !ringkas ? (
              <p className="py-16 text-center text-sm text-muted-foreground">Memuat…</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={harian} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="grafik-total" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number, name: string) => [v.toLocaleString('id-ID'), name === 'total' ? 'Aktivitas' : 'Akun disentuh']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#grafik-total)" />
                  <Area type="monotone" dataKey="akun" stroke="#f43f5e" strokeWidth={2} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h3 className="font-display text-sm font-bold">Insight</h3>
            </div>
            <Bot className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          </div>
          {ringkas ? (
            <ul className="space-y-3 text-sm">
              <li className="rounded-xl bg-muted/50 p-3">
                {ringkas.total === 0
                  ? 'Belum ada aktivitas pada rentang ini.'
                  : ringkas.totalSebelumnya === 0
                    ? `Ada ${ringkas.total.toLocaleString('id-ID')} aktivitas. Belum ada pembanding dari periode sebelumnya.`
                    : `Aktivitas ${persenNaik !== null && persenNaik >= 0 ? 'naik' : 'turun'} ${Math.abs(persenNaik ?? 0)}% dibanding periode sebelumnya.`}
              </li>
              {aksiTop && (
                <li className="rounded-xl bg-muted/50 p-3">
                  Aksi terbanyak: <span className="font-semibold">{labelAksi(aksiTop.aksi)}</span> ({aksiTop.jumlah.toLocaleString('id-ID')}×).
                </li>
              )}
              {ringkas.akunDisentuh > 0 && (
                <li className="rounded-xl bg-muted/50 p-3">
                  {ringkas.akunDisentuh.toLocaleString('id-ID')} akun pengguna diubah atau dibuka oleh admin dalam rentang ini.
                </li>
              )}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Angka ini dihitung dari log admin. Membuka halaman admin juga ikut tercatat sebagai aktivitas.
          </p>
        </Card>
      </div>
    </div>
  );
}
