import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Globe,
  Lightbulb,
  Loader2,
  Lock,
  Search,
  ShieldAlert,
  Timer,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  fetchKesehatanAi,
  fetchLogAktivitas,
  fetchLogRingkasan,
  fetchPeranSaya,
  type FilterLog,
  type LogItem,
  type LogRingkasan,
  type StatusLog,
} from '@/lib/data';
import { cn } from '@/lib/utils';

const PER_HALAMAN_PILIHAN = [10, 25, 50, 100] as const;
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
  ekspor_log_aktivitas: 'Mengekspor log',
  lihat_monitor_transaksi: 'Membuka monitoring transaksi',
  lihat_monitor_ai: 'Membuka monitoring AI',
  lihat_kesehatan_ai: 'Membuka kesehatan AI',
  tambah: 'Menambah data',
  ubah: 'Mengubah data',
  hapus: 'Menghapus data',
};

const TABEL_LABEL: Record<string, string> = {
  transactions: 'transaksi',
  wallets: 'dompet',
  wallet_transfers: 'transfer dompet',
  transaksi_berulang: 'transaksi berulang',
  scan_batches: 'hasil scan',
  debts: 'utang',
  debt_payments: 'pembayaran utang',
  budgets: 'budget',
  goals: 'target tabungan',
  rencana_bulanan: 'rencana bulanan',
  rencana_item: 'item rencana',
  kategori: 'kategori',
  subkategori: 'subkategori',
  notifications: 'notifikasi',
  notification_settings: 'pengaturan notifikasi',
  ai_reports: 'laporan AI',
  chat_actions: 'aksi chat AI',
  support_access_grants: 'akses dukungan',
  user_roles: 'peran pengguna',
};

const ALASAN_LABEL: Record<string, string> = {
  bukan_admin: 'Bukan admin',
  peran_tidak_cukup: 'Peran tidak cukup untuk aksi ini',
  akun_sendiri: 'Mencoba mengubah akun sendiri',
  password_tidak_valid: 'Password tidak memenuhi syarat',
  pengguna_tidak_ditemukan: 'Akun tidak ditemukan',
  target_admin: 'Target memiliki peran admin',
  konfirmasi_salah: 'Konfirmasi email tidak cocok',
  belum_selesai: 'Belum selesai diproses',
  gagal_server: 'Gagal di server',
};

const MODUL: { value: string; label: string; tone: string }[] = [
  { value: 'Pengguna', label: 'Pengguna', tone: 'bg-primary/10 text-primary' },
  { value: 'Dukungan', label: 'Dukungan', tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  { value: 'Transaksi', label: 'Transaksi', tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  { value: 'Anggaran', label: 'Anggaran', tone: 'bg-teal-500/10 text-teal-600 dark:text-teal-400' },
  { value: 'Kategori', label: 'Kategori', tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  { value: 'Notifikasi', label: 'Notifikasi', tone: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  { value: 'Akses', label: 'Akses', tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  { value: 'AI', label: 'AI', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { value: 'Log', label: 'Log', tone: 'bg-muted text-muted-foreground' },
  { value: 'Dashboard', label: 'Dashboard', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { value: 'Lainnya', label: 'Lainnya', tone: 'bg-muted text-muted-foreground' },
];
const TONE_MODUL: Record<string, string> = Object.fromEntries(MODUL.map((m) => [m.value, m.tone]));

const AKSI_FILTER = [
  'lihat_log_aktivitas', 'ekspor_log_aktivitas', 'lihat_daftar_pengguna', 'nonaktifkan_pengguna', 'aktifkan_pengguna',
  'ubah_password_pengguna', 'kirim_reset_password', 'hapus_pengguna', 'minta_akses_dukungan', 'akses_dukungan_data',
  'cabut_akses_dukungan', 'lihat_monitor_transaksi', 'lihat_monitor_ai', 'lihat_kesehatan_ai', 'tambah', 'ubah', 'hapus',
];

const fmt = (n: number) => n.toLocaleString('id-ID');

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
  const out: { tanggal: string; label: string; total: number; gagal: number }[] = [];
  const cur = new Date(`${mulai}T00:00:00`);
  const akhir = new Date(`${selesai}T00:00:00`);
  while (cur <= akhir) {
    const t = ymd(cur);
    const p = map.get(t);
    const [, m, d] = t.split('-');
    out.push({ tanggal: t, label: `${d}/${m}`, total: p?.total ?? 0, gagal: p?.gagal ?? 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function waktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function labelAksi(l: Pick<LogItem, 'aksi' | 'sumber' | 'tabel'>): string {
  const dasar = LABEL_AKSI[l.aksi] ?? l.aksi;
  if (l.sumber === 'pengguna' && l.tabel) return `${dasar} · ${TABEL_LABEL[l.tabel] ?? l.tabel}`;
  return dasar;
}

function modulTone(modul: string): string {
  return TONE_MODUL[modul] ?? TONE_MODUL.Lainnya;
}

function escapeCsv(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

function unduhCsv(items: LogItem[], total: number, mulai: string, selesai: string, isiFilter: string, punyaDetail: boolean) {
  const kolom = ['Waktu', 'Sumber', 'Aktor', 'Peran', 'Modul', 'Aksi', 'Status', 'Tabel', 'Target'];
  if (punyaDetail) kolom.push('IP', 'User-Agent', 'Detail');
  const info = [
    ['Laporan log aktivitas Hepeng'],
    [`Periode: ${mulai} s/d ${selesai} (WIB)`],
    [`Filter: ${isiFilter}`],
    [`Jumlah baris: ${total}`],
    [`Dibuat: ${new Date().toISOString()}`],
    [],
  ].map((b) => b.map(escapeCsv).join(','));

  const baris = items.map((l) => {
    const cols = [
      escapeCsv(new Date(l.waktu).toISOString()),
      escapeCsv(l.sumber === 'admin' ? 'Admin' : 'Pengguna'),
      escapeCsv(l.aktor),
      escapeCsv(l.peran),
      escapeCsv(l.modul),
      escapeCsv(labelAksi(l)),
      escapeCsv(l.status === 'gagal' ? 'Gagal' : 'Berhasil'),
      escapeCsv(l.tabel ?? ''),
      escapeCsv(l.targetIdSingkat ?? ''),
    ];
    if (punyaDetail) {
      cols.push(escapeCsv(l.ip ?? ''), escapeCsv(l.userAgent ?? ''), escapeCsv(l.detail ? JSON.stringify(l.detail) : ''));
    }
    return cols.join(',');
  });

  const isi = [...info, kolom.map(escapeCsv).join(','), ...baris].join('\n');
  const blob = new Blob(['﻿' + isi], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laporan-log-aktivitas-${ymd(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Insight otomatis berbasis aturan dari angka ringkasan. Tidak memakai AI. */
function buatInsight(r: LogRingkasan, punyaIp: boolean): string[] {
  if (r.total === 0) return ['Belum ada aktivitas pada rentang ini.'];
  const out: string[] = [];

  if (r.totalSebelumnya > 0) {
    const p = Math.round(((r.total - r.totalSebelumnya) / r.totalSebelumnya) * 100);
    out.push(`Aktivitas ${p >= 0 ? 'naik' : 'turun'} ${Math.abs(p)}% dibanding periode sebelumnya (${fmt(r.totalSebelumnya)} → ${fmt(r.total)}).`);
  } else {
    out.push(`Ada ${fmt(r.total)} aktivitas. Belum ada pembanding dari periode sebelumnya.`);
  }

  const persenPengguna = Math.round((r.penggunaAktivitas / r.total) * 100);
  out.push(`${persenPengguna}% aktivitas berasal dari pengguna biasa, ${100 - persenPengguna}% dari admin.`);

  if (r.gagal > 0) {
    const rasio = r.gagal / r.total;
    let teks = `${fmt(r.gagal)} aktivitas gagal (${(rasio * 100).toFixed(1)}%)`;
    if (r.gagalSebelumnya > 0) {
      const pg = Math.round(((r.gagal - r.gagalSebelumnya) / r.gagalSebelumnya) * 100);
      teks += `, ${pg >= 0 ? 'naik' : 'turun'} ${Math.abs(pg)}% dari periode sebelumnya`;
    }
    out.push(rasio >= 0.1 && r.gagal >= 5 ? `${teks}. Proporsinya tinggi, periksa dengan filter status Gagal.` : `${teks}.`);
  } else {
    out.push('Tidak ada aktivitas gagal pada rentang ini.');
  }

  if (punyaIp && r.ipGagalUnik !== null && r.ipGagalUnik >= 3) {
    out.push(`Kegagalan berasal dari ${r.ipGagalUnik} IP berbeda. Periksa kolom IP untuk pola yang mencurigakan.`);
  }

  const modulTop = r.perModul[0];
  if (modulTop) out.push(`Modul paling aktif: ${modulTop.modul} (${fmt(modulTop.jumlah)} aktivitas).`);

  const puncak = r.perHari.reduce<{ tanggal: string; total: number } | null>(
    (best, h) => (best === null || h.total > best.total ? h : best),
    null,
  );
  if (puncak && puncak.total > 0) {
    const [y, m, d] = puncak.tanggal.split('-');
    out.push(`Hari paling sibuk: ${d}/${m}/${y} dengan ${fmt(puncak.total)} aktivitas.`);
  }
  return out;
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
            <p className={cn('mt-1 flex items-center gap-1 text-[11px] font-semibold', naik ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>
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

function BadgeStatus({ status }: { status: StatusLog }) {
  if (status === 'gagal') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
        <ShieldAlert className="h-3 w-3" /> Gagal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
      Berhasil
    </span>
  );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3 border-b border-border py-2.5 text-sm last:border-0">
      <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function DetailLog({ l, punyaIp }: { l: LogItem; punyaIp: boolean }) {
  const kolomBerubah = Array.isArray(l.detail?.kolom) ? (l.detail?.kolom as string[]) : null;
  const alasan = typeof l.detail?.alasan === 'string' ? (l.detail.alasan as string) : null;
  return (
    <div className="space-y-5">
      <dl>
        <Baris label="Waktu">{waktu(l.waktu)}</Baris>
        <Baris label="Sumber">{l.sumber === 'admin' ? 'Aksi admin' : 'Aktivitas pengguna'}</Baris>
        <Baris label="Aktor">
          {l.aktor} <span className="font-mono text-xs text-muted-foreground">({l.aktorIdSingkat || '-'})</span>
        </Baris>
        <Baris label="Peran">{l.peran}</Baris>
        <Baris label="Modul">
          <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold', modulTone(l.modul))}>{l.modul}</span>
        </Baris>
        <Baris label="Aksi">{labelAksi(l)}</Baris>
        <Baris label="Status"><BadgeStatus status={l.status} /></Baris>
        {l.tabel && <Baris label="Tabel"><span className="font-mono text-xs">{l.tabel}</span></Baris>}
        <Baris label="Target">
          <span className="font-mono text-xs">{l.targetIdSingkat ?? '—'}</span>
        </Baris>
      </dl>

      {punyaIp ? (
        <section className="space-y-1 rounded-xl border border-border p-4">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <Globe className="h-3.5 w-3.5" /> Detail teknis
          </h4>
          <dl>
            <Baris label="IP address">{l.ip ?? 'Tidak tercatat'}</Baris>
            <Baris label="User-agent"><span className="text-xs">{l.userAgent ?? 'Tidak tercatat'}</span></Baris>
            {alasan && <Baris label="Alasan">{ALASAN_LABEL[alasan] ?? alasan}</Baris>}
            {kolomBerubah && (
              <Baris label="Kolom berubah">
                <span className="font-mono text-xs">{kolomBerubah.join(', ') || '—'}</span>
              </Baris>
            )}
          </dl>
          <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground">
            Nilai data (jumlah, deskripsi, isi password) tidak pernah dicatat di log.
          </p>
        </section>
      ) : (
        <div className="flex gap-3 rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <p>IP address dan detail teknis hanya dapat dilihat oleh super_admin.</p>
        </div>
      )}
    </div>
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
  const [status, setStatus] = useState<StatusLog | ''>('');
  const [inputCari, setInputCari] = useState('');
  const [cari, setCari] = useState('');
  const [halaman, setHalaman] = useState(0);
  const [perHalaman, setPerHalaman] = useState<(typeof PER_HALAMAN_PILIHAN)[number]>(25);
  const [punyaIp, setPunyaIp] = useState(false);
  const [dipilih, setDipilih] = useState<LogItem | null>(null);
  const [mengunduh, setMengunduh] = useState(false);

  const [ringkas, setRingkas] = useState<LogRingkasan | null>(null);
  const [latensi, setLatensi] = useState<number | null>(null);
  const [items, setItems] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingRingkas, setLoadingRingkas] = useState(true);
  const [loadingDaftar, setLoadingDaftar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { mulai, selesai } = useMemo(() => rentangTanggal(hari), [hari]);

  const filter: FilterLog = useMemo(
    () => ({
      mulai,
      selesai,
      aksi: aksi || null,
      modul: modul || null,
      status: status || null,
      cari: cari || null,
    }),
    [mulai, selesai, aksi, modul, status, cari],
  );

  // Peran menentukan apakah IP dan detail teknis ditampilkan (super_admin saja)
  useEffect(() => {
    let aktif = true;
    void fetchPeranSaya().then((peran) => {
      if (aktif) setPunyaIp(peran.includes('super_admin'));
    });
    return () => {
      aktif = false;
    };
  }, []);

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
  }, [hari, aksi, modul, status, perHalaman]);

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
    void fetchLogAktivitas(filter, halaman * perHalaman, perHalaman).then((r) => {
      if (!aktif) return;
      setItems(r.data?.items ?? []);
      setTotal(r.data?.total ?? 0);
      setError(r.error);
      setLoadingDaftar(false);
    });
    return () => {
      aktif = false;
    };
  }, [filter, halaman, perHalaman]);

  const harian = useMemo(() => (ringkas ? isiHari(mulai, selesai, ringkas.perHari) : []), [ringkas, mulai, selesai]);
  const insight = useMemo(() => (ringkas ? buatInsight(ringkas, punyaIp) : []), [ringkas, punyaIp]);

  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));
  const dari = total === 0 ? 0 : halaman * perHalaman + 1;
  const sampai = Math.min(total, (halaman + 1) * perHalaman);

  const persenNaik =
    ringkas && ringkas.totalSebelumnya > 0
      ? Math.round(((ringkas.total - ringkas.totalSebelumnya) / ringkas.totalSebelumnya) * 100)
      : null;
  const persenGagalNaik =
    ringkas && ringkas.gagalSebelumnya > 0
      ? Math.round(((ringkas.gagal - ringkas.gagalSebelumnya) / ringkas.gagalSebelumnya) * 100)
      : null;

  const isiFilterTeks = [
    aksi ? `aksi=${LABEL_AKSI[aksi] ?? aksi}` : null,
    modul ? `modul=${modul}` : null,
    status ? `status=${status}` : null,
    cari ? 'pencarian=ya' : null,
  ]
    .filter(Boolean)
    .join('; ') || 'tanpa filter tambahan';

  async function unduhLaporan() {
    setMengunduh(true);
    const r = await fetchLogAktivitas(filter, 0, 5000, true);
    setMengunduh(false);
    if (r.error || !r.data) {
      toast.error(`Gagal mengekspor log: ${r.error ?? 'data kosong'}`);
      return;
    }
    if (r.data.items.length === 0) {
      toast.info('Tidak ada log yang cocok dengan filter untuk diekspor.');
      return;
    }
    unduhCsv(r.data.items, r.data.total, mulai, selesai, isiFilterTeks, punyaIp);
    toast.success(`Log diekspor: ${fmt(r.data.items.length)} baris.`);
  }

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KartuKpi
          icon={Activity}
          label="Total aktivitas"
          value={fmt(ringkas?.total ?? 0)}
          hint="Dalam rentang"
          delta={persenNaik}
          tone="bg-primary/10 text-primary"
          spark={ringkas && <Sparkline data={harian} dataKey="total" warna="#3b82f6" id="spark-total" />}
        />
        <KartuKpi
          icon={ShieldAlert}
          label="Aktivitas gagal"
          value={fmt(ringkas?.gagal ?? 0)}
          hint="Tidak berhasil diproses"
          delta={persenGagalNaik}
          tone="bg-rose-500/10 text-rose-600 dark:text-rose-400"
        />
        <KartuKpi
          icon={Users}
          label="Pelaku aktif"
          value={fmt(ringkas?.pelakuAktif ?? 0)}
          hint="Admin dan pengguna"
          delta={null}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
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
            placeholder={punyaIp ? 'Cari aksi, aktor, ID, atau IP…' : 'Cari aksi, aktor, atau ID…'}
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
        <select aria-label="Filter aksi" value={aksi} onChange={(e) => setAksi(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Semua aksi</option>
          {AKSI_FILTER.map((k) => (
            <option key={k} value={k}>{LABEL_AKSI[k] ?? k}</option>
          ))}
        </select>
        <select aria-label="Filter modul" value={modul} onChange={(e) => setModul(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
          <option value="">Semua modul</option>
          {MODUL.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusLog | '')}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Semua status</option>
          <option value="berhasil">Berhasil</option>
          <option value="gagal">Gagal</option>
        </select>
        <Button type="button" variant="outline" onClick={() => void unduhLaporan()} disabled={mengunduh || total === 0} className="gap-2">
          {mengunduh ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export Log
        </Button>
      </div>

      {/* Tabel */}
      <Card className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Aktor</th>
                <th className="px-4 py-3">Modul</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((l, i) => (
                <tr
                  key={`${l.waktu}-${i}`}
                  tabIndex={0}
                  onClick={() => setDipilih(l)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDipilih(l);
                    }
                  }}
                  className="cursor-pointer transition hover:bg-accent/30 focus-visible:bg-accent/30 focus-visible:outline-none"
                >
                  <td className="px-4 py-3 text-xs text-muted-foreground">{waktu(l.waktu)}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{l.aktor}</p>
                    <p className="text-[11px] text-muted-foreground">{l.peran}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold', modulTone(l.modul))}>{l.modul}</span>
                  </td>
                  <td className="px-4 py-3">{labelAksi(l)}</td>
                  <td className="px-4 py-3"><BadgeStatus status={l.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.targetIdSingkat ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {punyaIp ? (l.ip ?? '—') : <Lock className="h-3.5 w-3.5" aria-label="Hanya super_admin" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-border md:hidden">
          {items.map((l, i) => (
            <li key={`${l.waktu}-${i}`}>
              <button type="button" onClick={() => setDipilih(l)} className="w-full space-y-1 px-4 py-3 text-left transition hover:bg-accent/30">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">{labelAksi(l)}</p>
                  <span className={cn('shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold', modulTone(l.modul))}>{l.modul}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {l.aktor} · {waktu(l.waktu)}
                  {l.status === 'gagal' ? ' · Gagal' : ''}
                </p>
              </button>
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
          <div className="flex items-center gap-3">
            <p>{total === 0 ? 'Tidak ada data' : `Menampilkan ${fmt(dari)}–${fmt(sampai)} dari ${fmt(total)} aktivitas`}</p>
            <label className="flex items-center gap-2">
              <span>Per halaman</span>
              <select
                aria-label="Jumlah data per halaman"
                value={perHalaman}
                onChange={(e) => setPerHalaman(Number(e.target.value) as (typeof PER_HALAMAN_PILIHAN)[number])}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                {PER_HALAMAN_PILIHAN.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
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
              <h3 className="font-display text-sm font-bold">Tren aktivitas sistem</h3>
              <p className="text-xs text-muted-foreground">Semua aktivitas per hari dalam rentang</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-500" /> Aktivitas</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" /> Gagal</span>
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
                    formatter={(v: number, name: string) => [fmt(v), name === 'total' ? 'Aktivitas' : 'Gagal']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} fill="url(#grafik-total)" />
                  <Area type="monotone" dataKey="gagal" stroke="#f43f5e" strokeWidth={2} fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold">Ringkasan otomatis</h3>
          </div>
          {ringkas ? (
            <ul className="space-y-3 text-sm">
              {insight.map((teks, i) => (
                <li key={i} className="rounded-xl bg-muted/50 p-3">{teks}</li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">Memuat…</p>
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Dihitung otomatis dari log di database. Membuka dan mengekspor log juga ikut tercatat.
          </p>
        </Card>
      </div>

      {/* Drawer detail */}
      <Sheet open={dipilih !== null} onOpenChange={(open) => !open && setDipilih(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detail aktivitas</SheetTitle>
            <SheetDescription>Satu baris log yang dipilih.</SheetDescription>
          </SheetHeader>
          {dipilih && (
            <div className="mt-4">
              <DetailLog l={dipilih} punyaIp={punyaIp} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
