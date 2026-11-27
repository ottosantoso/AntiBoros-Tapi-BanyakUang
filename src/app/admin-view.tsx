import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Bot,
  Clock,
  Database,
  Loader2,
  Receipt,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchAdminDashboard, type AdminDashboard } from '@/lib/data';
import type { AdminSection } from '@/app/views';
import { cn } from '@/lib/utils';

const RENTANG = [7, 30, 90] as const;

const JUDUL_SECTION: Record<AdminSection, string> = {
  dashboard: 'Dashboard Admin',
  pengguna: 'Manajemen Pengguna',
  transaksi: 'Monitoring Transaksi',
  ai: 'Monitoring AI',
  kategori: 'Manajemen Kategori',
  log: 'Log Aktivitas',
  sistem: 'Manajemen Sistem',
  notifikasi: 'Notifikasi Sistem',
};

const LABEL_AKSI_TX: Record<string, string> = {
  insert: 'Menambah transaksi',
  update: 'Mengubah transaksi',
  delete: 'Menghapus transaksi',
};

const LABEL_AKSI_ADMIN: Record<string, string> = {
  lihat_ringkasan: 'Melihat ringkasan',
  lihat_dashboard: 'Membuka dashboard',
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function rupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function waktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function tanggalPendek(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}` : iso;
}

/** Nama untuk ditampilkan. Kalau server tidak mengirim nama (peran analyst), pakai ID singkat. */
function labelPengguna(nama: string | null, idSingkat: string): string {
  return nama ?? `ID ${idSingkat}`;
}

export function AdminView({ section }: { section: AdminSection }) {
  return (
    <div className="mx-auto max-w-[1280px] space-y-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-tight">{JUDUL_SECTION[section]}</h2>
          <p className="text-sm text-muted-foreground">
            Hanya angka agregat dan aktivitas. Setiap pembukaan halaman ini dicatat di log admin.
          </p>
        </div>
      </div>

      {section === 'dashboard' ? (
        <DashboardAdmin />
      ) : (
        <Card className="grid place-items-center gap-2 p-10 text-center">
          <p className="font-display text-base font-bold">Segera hadir</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Menu {JUDUL_SECTION[section]} sedang disiapkan. Ringkasannya ada di Dashboard Admin.
          </p>
        </Card>
      )}
    </div>
  );
}

function DashboardAdmin() {
  const [hari, setHari] = useState<(typeof RENTANG)[number]>(30);
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [latensi, setLatensi] = useState<number | null>(null);

  const muat = useCallback(async () => {
    setLoading(true);
    const selesai = new Date();
    const mulai = new Date();
    mulai.setDate(selesai.getDate() - (hari - 1));
    const t0 = performance.now();
    const res = await fetchAdminDashboard(ymd(mulai), ymd(selesai));
    setLatensi(Math.round(performance.now() - t0));
    setData(res.data);
    setError(res.error);
    setLoading(false);
  }, [hari]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const kpi = data?.kpi;
  const totalPengguna = kpi?.totalPengguna ?? 0;

  const kartu = [
    { label: 'Total pengguna', value: kpi?.totalPengguna ?? 0, hint: 'Akun terdaftar', icon: Users, tone: 'bg-primary/10 text-primary', fmt: false },
    { label: 'Pengguna aktif', value: kpi?.penggunaAktif ?? 0, hint: `Masuk dalam ${hari} hari`, icon: Activity, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', fmt: false },
    { label: 'Total transaksi', value: kpi?.totalTransaksi ?? 0, hint: `Dicatat dalam ${hari} hari`, icon: Receipt, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400', fmt: false },
    { label: 'Pemasukan', value: kpi?.pemasukan ?? 0, hint: 'Agregat, tanpa data pribadi', icon: TrendingUp, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', fmt: true },
    { label: 'Pengeluaran', value: kpi?.pengeluaran ?? 0, hint: 'Agregat, tanpa data pribadi', icon: TrendingDown, tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', fmt: true },
  ];

  const tren = (data?.trenHarian ?? []).map((t) => ({ ...t, label: tanggalPendek(t.tanggal) }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
        <Button type="button" variant="outline" size="sm" onClick={() => void muat()} disabled={loading} className="gap-1.5">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Muat ulang
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Gagal memuat dashboard: {error}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {kartu.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center gap-3">
              <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', k.tone)}>
                <k.icon className="h-4 w-4" strokeWidth={2.2} />
              </span>
              <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{k.label}</p>
            </div>
            <p className="mt-3 truncate font-display text-xl font-extrabold tabular-nums text-foreground sm:text-2xl">
              {loading && !data ? '…' : k.fmt ? rupiah(k.value) : k.value.toLocaleString('id-ID')}
            </p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">{k.hint}</p>
          </Card>
        ))}
      </div>

      {/* Tren + Aktivitas */}
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold">Tren penggunaan aplikasi</h3>
              <p className="text-xs text-muted-foreground">Transaksi dan pengguna aktif per hari</p>
            </div>
          </div>
          <div className="h-[240px] w-full min-w-0">
            {tren.length === 0 ? (
              <EmptyState teks="Belum ada data pada rentang ini." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={tren} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="admin-tx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 12 }}
                    formatter={(v: number, name: string) => [v.toLocaleString('id-ID'), name === 'transaksi' ? 'Transaksi' : 'Pengguna aktif']}
                  />
                  <Area type="monotone" dataKey="transaksi" stroke="#3b82f6" strokeWidth={2} fill="url(#admin-tx)" />
                  <Area type="monotone" dataKey="pengguna" stroke="#10b981" strokeWidth={2} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Aktivitas terbaru</h3>
          <p className="mb-3 text-xs text-muted-foreground">Tanpa nominal, hanya jenis aksi</p>
          <ul className="max-h-[280px] divide-y divide-border overflow-y-auto">
            {(data?.aktivitasTerbaru ?? []).length === 0 && <EmptyState teks="Belum ada aktivitas." />}
            {(data?.aktivitasTerbaru ?? []).map((a, i) => (
              <li key={`${a.waktu}-${i}`} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{LABEL_AKSI_TX[a.aksi] ?? a.aksi}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {labelPengguna(a.nama, a.idSingkat)}
                    {a.email ? ` · ${a.email}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{waktu(a.waktu)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Fitur + Teraktif */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Penggunaan fitur utama</h3>
          <p className="mb-4 text-xs text-muted-foreground">Persentase pengguna yang pernah memakai fitur</p>
          <div className="space-y-3.5">
            {(data?.fitur ?? []).map((f) => {
              const persen = totalPengguna > 0 ? Math.round((f.pengguna / totalPengguna) * 100) : 0;
              return (
                <div key={f.fitur}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold">{f.fitur}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {f.pengguna} pengguna · {persen}%
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${persen}%` }} />
                  </div>
                </div>
              );
            })}
            {!data && <EmptyState teks={loading ? 'Memuat…' : 'Tidak ada data.'} />}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Pengguna teraktif</h3>
          <p className="mb-3 text-xs text-muted-foreground">Berdasarkan jumlah transaksi dalam rentang</p>
          <ol className="divide-y divide-border">
            {(data?.penggunaTeraktif ?? []).length === 0 && <EmptyState teks="Belum ada transaksi pada rentang ini." />}
            {(data?.penggunaTeraktif ?? []).map((p, i) => (
              <li key={p.idSingkat} className="flex items-center gap-3 py-2.5">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-extrabold tabular-nums">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{labelPengguna(p.nama, p.idSingkat)}</p>
                  {p.nama && <p className="truncate text-[11px] text-muted-foreground">ID {p.idSingkat}</p>}
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums">{p.jumlah.toLocaleString('id-ID')} trx</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* Kategori + Log + Status */}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Distribusi pengeluaran</h3>
          <p className="mb-3 text-xs text-muted-foreground">Kategori terbesar dalam rentang</p>
          <ul className="space-y-2.5">
            {(data?.kategori ?? []).length === 0 && <EmptyState teks="Belum ada pengeluaran." />}
            {(data?.kategori ?? []).map((k) => {
              const max = data?.kategori[0]?.total || 1;
              return (
                <li key={k.kategori}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold">{k.kategori}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{rupiah(k.total)}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round((k.total / max) * 100)}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Log sistem</h3>
          <p className="mb-3 text-xs text-muted-foreground">Aktivitas admin terbaru</p>
          <ul className="max-h-[260px] divide-y divide-border overflow-y-auto">
            {(data?.logAdmin ?? []).length === 0 && <EmptyState teks="Belum ada log." />}
            {(data?.logAdmin ?? []).map((l, i) => (
              <li key={`${l.waktu}-${i}`} className="py-2.5">
                <p className="text-sm font-semibold">{LABEL_AKSI_ADMIN[l.aksi] ?? l.aksi}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.admin} · {waktu(l.waktu)}
                </p>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Status layanan</h3>
          <p className="mb-3 text-xs text-muted-foreground">Dicek saat halaman dibuka</p>
          <ul className="space-y-3 text-sm">
            <StatusBaris
              icon={<Database className="h-4 w-4" />}
              label="Database"
              status={error ? 'Gangguan' : data ? 'Normal' : 'Memeriksa'}
              ok={!error && !!data}
              detail={latensi !== null ? `${latensi} ms` : undefined}
            />
            <StatusBaris
              icon={<Activity className="h-4 w-4" />}
              label="API"
              status={error ? 'Gangguan' : data ? 'Normal' : 'Memeriksa'}
              ok={!error && !!data}
              detail={latensi !== null ? `${latensi} ms` : undefined}
            />
            <StatusBaris icon={<Bot className="h-4 w-4" />} label="Layanan AI" status="Belum dipantau" ok={null} />
            <StatusBaris icon={<Receipt className="h-4 w-4" />} label="Backup" status="Catat manual" ok={null} />
          </ul>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            Paket Supabase gratis tidak punya backup otomatis dan pemantauan uptime. Lakukan ekspor berkala.
          </p>
        </Card>
      </div>
    </div>
  );
}

function StatusBaris({
  icon,
  label,
  status,
  ok,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  ok: boolean | null;
  detail?: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 font-semibold">{label}</span>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-bold',
          ok === true && 'text-emerald-600 dark:text-emerald-400',
          ok === false && 'text-rose-600 dark:text-rose-400',
          ok === null && 'text-muted-foreground',
        )}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            ok === true && 'bg-emerald-500',
            ok === false && 'bg-rose-500',
            ok === null && 'bg-muted-foreground/50',
          )}
        />
        {status}
        {detail && <span className="font-medium text-muted-foreground">· {detail}</span>}
      </span>
    </li>
  );
}

function EmptyState({ teks }: { teks: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{teks}</p>;
}
