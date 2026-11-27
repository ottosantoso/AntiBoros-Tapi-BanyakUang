import { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, Megaphone, Save, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  buatNotifikasiSistem,
  catatBackup,
  fetchBackup,
  fetchKategoriAdmin,
  fetchNotifikasiSistem,
  fetchPeranSaya,
  fetchStatusSistem,
  nonaktifkanNotifikasiSistem,
  type CatatanBackup,
  type MasterKategori,
  type NotifikasiSistem,
  type StatusSistem,
} from '@/lib/data';
import { cn } from '@/lib/utils';

function waktu(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Kosong({ teks }: { teks: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{teks}</p>;
}

/* ---------- Manajemen Kategori (hanya baca) ---------- */

export function KategoriAdminView() {
  const [data, setData] = useState<MasterKategori[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aktif = true;
    void fetchKategoriAdmin().then((r) => {
      if (!aktif) return;
      setData(r.data);
      setError(r.error);
      setLoading(false);
    });
    return () => {
      aktif = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Kategori sistem bawaan. Pengubahan belum tersedia, karena mengubah kategori akan memengaruhi data semua pengguna.
      </p>
      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">Gagal memuat: {error}</div>}
      <Card className="overflow-hidden">
        {loading && <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</p>}
        {!loading && data.length === 0 && !error && <Kosong teks="Belum ada kategori sistem." />}
        <ul className="divide-y divide-border">
          {data.map((k) => (
            <li key={k.kategori} className="flex items-center gap-3 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Tags className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{k.kategori}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {k.jumlahSub} subkategori · {k.jumlahAktif} aktif{k.budgeting ? ` · ${k.budgeting}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold tabular-nums">{k.pemakaian.toLocaleString('id-ID')}</p>
                <p className="text-[11px] text-muted-foreground">pemakaian</p>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ---------- Manajemen Sistem: status dan backup ---------- */

export function SistemAdminView() {
  const [status, setStatus] = useState<StatusSistem | null>(null);
  const [backup, setBackup] = useState<CatatanBackup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [catatan, setCatatan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    const [s, b] = await Promise.all([fetchStatusSistem(), fetchBackup()]);
    setStatus(s.data);
    setBackup(b.data);
    setError(s.error ?? b.error);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const persen = status ? Math.min(100, Math.round((status.databaseMb / status.batasFreeMb) * 100)) : 0;

  async function simpanBackup() {
    if (catatan.trim().length < 3) {
      toast.error('Catatan minimal 3 karakter.');
      return;
    }
    setMenyimpan(true);
    const res = await catatBackup(catatan);
    setMenyimpan(false);
    if (!res.success) {
      toast.error('Gagal mencatat backup', { description: res.error ?? undefined });
      return;
    }
    toast.success('Backup manual dicatat');
    setCatatan('');
    void muat();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive lg:col-span-2">Gagal memuat: {error}</div>}

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Penyimpanan database</h3>
        </div>
        {status ? (
          <div className="space-y-3">
            <p className="font-display text-2xl font-extrabold tabular-nums">
              {status.databaseMb.toLocaleString('id-ID')} MB
              <span className="ml-2 text-sm font-medium text-muted-foreground">dari {status.batasFreeMb} MB (paket free)</span>
            </p>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full rounded-full transition-all', persen >= 80 ? 'bg-rose-500' : persen >= 60 ? 'bg-amber-500' : 'bg-emerald-500')}
                style={{ width: `${persen}%` }}
              />
            </div>
            <dl className="grid grid-cols-2 gap-3 pt-2 text-sm">
              <div><dt className="text-[11px] font-bold uppercase text-muted-foreground">Versi Postgres</dt><dd>{status.versiPostgres}</dd></div>
              <div><dt className="text-[11px] font-bold uppercase text-muted-foreground">Jumlah tabel</dt><dd>{status.jumlahTabel}</dd></div>
              <div className="col-span-2"><dt className="text-[11px] font-bold uppercase text-muted-foreground">Waktu server</dt><dd>{waktu(status.waktuServer)}</dd></div>
            </dl>
          </div>
        ) : (
          <Kosong teks="Memuat…" />
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-sm font-bold">Backup manual</h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Paket free tidak punya backup otomatis. Lakukan ekspor berkala, lalu catat di sini.
        </p>
        <div className="flex gap-2">
          <Input
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            placeholder="Contoh: ekspor SQL 27 Nov, tersimpan di drive"
            maxLength={300}
            aria-label="Catatan backup"
          />
          <Button type="button" onClick={() => void simpanBackup()} disabled={menyimpan} className="shrink-0 gap-2">
            {menyimpan ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Catat
          </Button>
        </div>
        <ul className="mt-4 divide-y divide-border">
          {backup.length === 0 && <Kosong teks="Belum ada backup yang dicatat." />}
          {backup.map((b, i) => (
            <li key={`${b.dibuat}-${i}`} className="py-2.5">
              <p className="text-sm font-semibold">{b.catatan}</p>
              <p className="text-xs text-muted-foreground">{b.pencatat ?? 'Admin'} · {waktu(b.dibuat)}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/* ---------- Notifikasi Sistem ---------- */

const LEVEL: { value: NotifikasiSistem['level']; label: string; tone: string }[] = [
  { value: 'info', label: 'Info', tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  { value: 'peringatan', label: 'Peringatan', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { value: 'penting', label: 'Penting', tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
];

export function NotifikasiSistemAdminView() {
  const [daftar, setDaftar] = useState<NotifikasiSistem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bisaKelola, setBisaKelola] = useState(false);
  const [judul, setJudul] = useState('');
  const [isi, setIsi] = useState('');
  const [level, setLevel] = useState<NotifikasiSistem['level']>('info');
  const [jam, setJam] = useState<string>('');
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    setLoading(true);
    const r = await fetchNotifikasiSistem();
    setDaftar(r.data);
    setError(r.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchPeranSaya().then((p) => setBisaKelola(p.includes('super_admin')));
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  async function buat() {
    if (judul.trim().length < 3 || isi.trim().length < 3) {
      toast.error('Judul dan isi minimal 3 karakter.');
      return;
    }
    setMenyimpan(true);
    const res = await buatNotifikasiSistem(judul, isi, level, jam ? Number(jam) : null);
    setMenyimpan(false);
    if (!res.success) {
      toast.error('Gagal membuat notifikasi', { description: res.error ?? undefined });
      return;
    }
    toast.success('Notifikasi sistem dipasang');
    setJudul('');
    setIsi('');
    setJam('');
    void muat();
  }

  async function nonaktifkan(id: string) {
    const res = await nonaktifkanNotifikasiSistem(id);
    if (!res.success) {
      toast.error('Gagal menonaktifkan', { description: res.error ?? undefined });
      return;
    }
    toast.success('Notifikasi dinonaktifkan');
    void muat();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
      <Card className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Pasang notifikasi baru</h3>
        </div>
        {!bisaKelola && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            Hanya super_admin yang bisa membuat dan menonaktifkan notifikasi sistem.
          </p>
        )}
        <div className="space-y-1.5">
          <label htmlFor="notif-judul" className="text-xs font-bold">Judul</label>
          <Input id="notif-judul" value={judul} onChange={(e) => setJudul(e.target.value)} maxLength={120} disabled={!bisaKelola} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="notif-isi" className="text-xs font-bold">Isi</label>
          <Textarea id="notif-isi" value={isi} onChange={(e) => setIsi(e.target.value)} maxLength={1000} rows={4} disabled={!bisaKelola} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="notif-level" className="text-xs font-bold">Level</label>
            <select
              id="notif-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as NotifikasiSistem['level'])}
              disabled={!bisaKelola}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {LEVEL.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="notif-jam" className="text-xs font-bold">Tampil selama</label>
            <select
              id="notif-jam"
              value={jam}
              onChange={(e) => setJam(e.target.value)}
              disabled={!bisaKelola}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Sampai dinonaktifkan</option>
              <option value="24">24 jam</option>
              <option value="72">3 hari</option>
              <option value="168">7 hari</option>
            </select>
          </div>
        </div>
        <Button type="button" onClick={() => void buat()} disabled={!bisaKelola || menyimpan} className="w-full gap-2">
          {menyimpan && <Loader2 className="h-4 w-4 animate-spin" />}
          Pasang notifikasi
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-display text-sm font-bold">Riwayat notifikasi</h3>
        </div>
        {error && <div role="alert" className="px-5 py-3 text-sm text-destructive">Gagal memuat: {error}</div>}
        {loading && <p className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat…</p>}
        {!loading && daftar.length === 0 && !error && <Kosong teks="Belum ada notifikasi sistem." />}
        <ul className="divide-y divide-border">
          {daftar.map((n) => {
            const lv = LEVEL.find((l) => l.value === n.level);
            return (
              <li key={n.id} className="space-y-1.5 px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-bold', lv?.tone)}>{lv?.label ?? n.level}</span>
                  <span className={cn('text-[11px] font-bold', n.aktif ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                    {n.aktif ? 'Aktif' : 'Tidak aktif'}
                  </span>
                </div>
                <p className="text-sm font-semibold">{n.judul}</p>
                <p className="text-xs text-muted-foreground">{n.isi}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <p className="text-[11px] text-muted-foreground">
                    {n.pembuat ?? 'Admin'} · {waktu(n.dibuat)}
                    {n.aktifSampai ? ` · sampai ${waktu(n.aktifSampai)}` : ''}
                  </p>
                  {n.aktif && bisaKelola && (
                    <Button type="button" variant="outline" size="sm" onClick={() => void nonaktifkan(n.id)}>
                      Nonaktifkan
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
