import { useEffect, useState } from 'react';
import { Activity, ArrowLeftRight, Bot, Clock, Loader2, Receipt, RefreshCw, ScanLine, Trash2 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  fetchKesehatanAi,
  fetchMonitorAi,
  fetchMonitorTransaksi,
  type KesehatanAi,
  type MonitorAi,
  type MonitorTransaksi,
} from '@/lib/data';
import { cn } from '@/lib/utils';

const RENTANG = [7, 30, 90] as const;
type Rentang = (typeof RENTANG)[number];

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

function rupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function tanggalPendek(iso: string): string {
  const [, m, d] = iso.split('-');
  return m && d ? `${d}/${m}` : iso;
}

const LABEL_TIPE: Record<string, string> = { Pemasukan: 'Pemasukan', Pengeluaran: 'Pengeluaran' };
const LABEL_SCAN: Record<string, string> = { struk: 'Struk', mutasi: 'Mutasi bank' };
const LABEL_STATUS: Record<string, string> = {
  draft: 'Draf',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
  simpan: 'Disimpan',
};

/** Komponen bersama: pilihan rentang + tombol muat ulang. */
function ToolbarRentang({ hari, onChange, onRefresh, loading }: {
  hari: Rentang;
  onChange: (h: Rentang) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Rentang waktu" className="inline-flex rounded-xl border border-border bg-card p-1">
        {RENTANG.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
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
      <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="gap-1.5">
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        Muat ulang
      </Button>
    </div>
  );
}

function KartuAngka({ icon: Icon, label, value, hint, tone }: {
  icon: typeof Activity;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', tone)}>
          <Icon className="h-4 w-4" strokeWidth={2.2} />
        </span>
        <p className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      </div>
      <p className="mt-3 truncate font-display text-xl font-extrabold tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{hint}</p>
    </Card>
  );
}

function ErrorBox({ teks }: { teks: string }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      Gagal memuat data: {teks}
    </div>
  );
}

export function MonitorTransaksiView() {
  const [hari, setHari] = useState<Rentang>(30);
  const [data, setData] = useState<MonitorTransaksi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const muat = (h: Rentang) => {
    setLoading(true);
    const { mulai, selesai } = rentangTanggal(h);
    void fetchMonitorTransaksi(mulai, selesai).then((r) => {
      setData(r.data);
      setError(r.error);
      setLoading(false);
    });
  };

  useEffect(() => {
    muat(hari);
  }, [hari]);

  const perHari = (data?.perHari ?? []).map((p) => ({ ...p, label: tanggalPendek(p.tanggal) }));

  return (
    <div className="space-y-5">
      <ToolbarRentang hari={hari} onChange={setHari} onRefresh={() => muat(hari)} loading={loading} />
      {error && <ErrorBox teks={error} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuAngka icon={Receipt} label="Transaksi dicatat" value={(data?.dicatat ?? 0).toLocaleString('id-ID')} hint={`Dalam ${hari} hari`} tone="bg-sky-500/10 text-sky-600 dark:text-sky-400" />
        <KartuAngka icon={Trash2} label="Dihapus" value={(data?.dihapus ?? 0).toLocaleString('id-ID')} hint="Penghapusan lunak" tone="bg-rose-500/10 text-rose-600 dark:text-rose-400" />
        <KartuAngka icon={ArrowLeftRight} label="Transfer antar-dompet" value={(data?.transfer ?? 0).toLocaleString('id-ID')} hint="Pindah dana antar akun" tone="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
        <KartuAngka icon={Activity} label="Transaksi berulang" value={(data?.berulang ?? 0).toLocaleString('id-ID')} hint="Aturan berulang aktif" tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Pencatatan per hari</h3>
          <p className="mb-4 text-xs text-muted-foreground">Jumlah transaksi baru, tanpa nominal</p>
          <div className="h-[220px] w-full min-w-0">
            {perHari.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perHari} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [v.toLocaleString('id-ID'), 'Transaksi']} />
                  <Bar dataKey="jumlah" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Per tipe</h3>
          <p className="mb-4 text-xs text-muted-foreground">Jumlah dan rata-rata nominal</p>
          <ul className="space-y-4">
            {(data?.perTipe ?? []).length === 0 && <li className="text-sm text-muted-foreground">Belum ada data.</li>}
            {(data?.perTipe ?? []).map((t) => (
              <li key={t.tipe} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div>
                  <p className="text-sm font-semibold">{LABEL_TIPE[t.tipe] ?? t.tipe}</p>
                  <p className="text-xs text-muted-foreground">{t.jumlah.toLocaleString('id-ID')} transaksi</p>
                </div>
                <p className="text-right text-xs">
                  <span className="block text-muted-foreground">Rata-rata</span>
                  <span className="font-bold tabular-nums">{rupiah(t.rataRata)}</span>
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
            Transaksi tanpa kategori: <span className="font-bold text-foreground">{(data?.tanpaKategori ?? 0).toLocaleString('id-ID')}</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function MonitorAiView() {
  const [hari, setHari] = useState<Rentang>(30);
  const [data, setData] = useState<MonitorAi | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [kesehatan, setKesehatan] = useState<KesehatanAi | null>(null);
  const [errorKesehatan, setErrorKesehatan] = useState<string | null>(null);

  const muat = (h: Rentang) => {
    setLoading(true);
    const { mulai, selesai } = rentangTanggal(h);
    void fetchMonitorAi(mulai, selesai).then((r) => {
      setData(r.data);
      setError(r.error);
      setLoading(false);
    });
    void fetchKesehatanAi(mulai, selesai).then((r) => {
      setKesehatan(r.data);
      setErrorKesehatan(r.error);
    });
  };

  useEffect(() => {
    muat(hari);
  }, [hari]);

  const perHari = (data?.perHari ?? []).map((p) => ({ ...p, label: tanggalPendek(p.tanggal) }));
  const totalScan = (data?.scan ?? []).reduce((a, s) => a + s.jumlah, 0);

  return (
    <div className="space-y-5">
      <ToolbarRentang hari={hari} onChange={setHari} onRefresh={() => muat(hari)} loading={loading} />
      {error && <ErrorBox teks={error} />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuAngka icon={Bot} label="Permintaan asisten" value={(data?.totalPermintaan ?? 0).toLocaleString('id-ID')} hint={`Dalam ${hari} hari`} tone="bg-violet-500/10 text-violet-600 dark:text-violet-400" />
        <KartuAngka icon={Activity} label="Pengguna asisten" value={(data?.penggunaAsisten ?? 0).toLocaleString('id-ID')} hint="Unik dalam rentang" tone="bg-sky-500/10 text-sky-600 dark:text-sky-400" />
        <KartuAngka icon={ScanLine} label="Scan" value={totalScan.toLocaleString('id-ID')} hint="Struk dan mutasi" tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
        <KartuAngka icon={Receipt} label="Item tersimpan" value={(data?.scan ?? []).reduce((a, s) => a + s.item, 0).toLocaleString('id-ID')} hint="Dari hasil scan" tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Pemakaian asisten per hari</h3>
          <p className="mb-4 text-xs text-muted-foreground">Jumlah permintaan AI</p>
          <div className="h-[220px] w-full min-w-0">
            {perHari.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Belum ada data.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={perHari} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={36} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [v.toLocaleString('id-ID'), 'Permintaan']} />
                  <Bar dataKey="jumlah" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display text-sm font-bold">Hasil scan</h3>
          <p className="mb-4 text-xs text-muted-foreground">Per jenis dan status</p>
          <ul className="divide-y divide-border">
            {(data?.scan ?? []).length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Belum ada scan.</li>}
            {(data?.scan ?? []).map((s, i) => (
              <li key={`${s.jenis}-${s.status}-${i}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="font-semibold">
                  {LABEL_SCAN[s.jenis] ?? s.jenis} · <span className="font-normal text-muted-foreground">{LABEL_STATUS[s.status] ?? s.status}</span>
                </span>
                <span className="tabular-nums text-xs text-muted-foreground">
                  {s.jumlah.toLocaleString('id-ID')} scan · {s.item.toLocaleString('id-ID')} item
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="font-display text-sm font-bold">Kesehatan AI</h3>
        <p className="mb-4 text-xs text-muted-foreground">Latensi dan error dicatat saat fungsi AI dipanggil</p>
        {errorKesehatan && <ErrorBox teks={errorKesehatan} />}
        {kesehatan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KartuAngka icon={Activity} label="Total panggilan" value={kesehatan.total.toLocaleString('id-ID')} hint={`Dalam ${hari} hari`} tone="bg-sky-500/10 text-sky-600 dark:text-sky-400" />
              <KartuAngka icon={Trash2} label="Error" value={kesehatan.error.toLocaleString('id-ID')} hint={kesehatan.total > 0 ? `${Math.round((kesehatan.error / kesehatan.total) * 100)}% dari total` : '-'} tone="bg-rose-500/10 text-rose-600 dark:text-rose-400" />
              <KartuAngka icon={Clock} label="Rata-rata latensi" value={kesehatan.rataLatensi !== null ? `${kesehatan.rataLatensi} ms` : '-'} hint="Waktu tunggu balasan" tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
              <KartuAngka icon={Clock} label="Latensi p95" value={kesehatan.p95Latensi !== null ? `${kesehatan.p95Latensi} ms` : '-'} hint="95% panggilan lebih cepat" tone="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Per fitur</p>
                <ul className="divide-y divide-border">
                  {kesehatan.perFitur.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">Belum ada panggilan.</li>}
                  {kesehatan.perFitur.map((f) => (
                    <li key={f.fitur} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="font-semibold">{f.fitur}</span>
                      <span className="text-right text-xs tabular-nums text-muted-foreground">
                        {f.jumlah} panggilan · {f.error} error
                        {f.rataLatensi !== null ? ` · ${f.rataLatensi} ms` : ''}
                        {f.p95 !== null ? ` · p95 ${f.p95} ms` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Kode error</p>
                <ul className="divide-y divide-border">
                  {kesehatan.kodeError.length === 0 && <li className="py-4 text-center text-sm text-muted-foreground">Tidak ada error.</li>}
                  {kesehatan.kodeError.map((k) => (
                    <li key={k.kode} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="font-mono text-xs font-semibold">{k.kode}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{k.jumlah}×</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-sm font-bold">Pengguna asisten teraktif</h3>
        <p className="mb-3 text-xs text-muted-foreground">Berdasarkan jumlah permintaan dalam rentang</p>
        <ol className="divide-y divide-border">
          {(data?.teraktif ?? []).length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Belum ada pemakaian.</li>}
          {(data?.teraktif ?? []).map((p, i) => (
            <li key={p.idSingkat} className="flex items-center gap-3 py-2.5">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-xs font-extrabold tabular-nums">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.nama ?? `ID ${p.idSingkat}`}</p>
                {p.nama && <p className="text-[11px] text-muted-foreground">ID {p.idSingkat}</p>}
              </div>
              <span className="shrink-0 text-sm font-bold tabular-nums">{p.jumlah.toLocaleString('id-ID')} permintaan</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
