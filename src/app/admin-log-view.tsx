import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchLogAktivitas, type LogAdmin } from '@/lib/data';

const PER_HALAMAN = 25;

const FILTER: { value: string; label: string }[] = [
  { value: '', label: 'Semua aksi' },
  { value: 'lihat_ringkasan', label: 'Melihat ringkasan' },
  { value: 'lihat_dashboard', label: 'Membuka dashboard' },
  { value: 'lihat_daftar_pengguna', label: 'Melihat daftar pengguna' },
  { value: 'minta_akses_dukungan', label: 'Meminta akses dukungan' },
  { value: 'akses_dukungan_data', label: 'Membuka data dukungan' },
  { value: 'cabut_akses_dukungan', label: 'Mencabut akses dukungan' },
  { value: 'lihat_log_aktivitas', label: 'Membuka log' },
  { value: 'lihat_monitor_transaksi', label: 'Membuka monitoring transaksi' },
  { value: 'lihat_monitor_ai', label: 'Membuka monitoring AI' },
];

const LABEL_AKSI: Record<string, string> = Object.fromEntries(FILTER.filter((f) => f.value).map((f) => [f.value, f.label]));

function waktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function AdminLogView() {
  const [aksi, setAksi] = useState('');
  const [items, setItems] = useState<LogAdmin[]>([]);
  const [halaman, setHalaman] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aktif = true;
    setLoading(true);
    void fetchLogAktivitas(aksi || null, 0).then((r) => {
      if (!aktif) return;
      setItems(r.data);
      setError(r.error);
      setHalaman(0);
      setLoading(false);
    });
    return () => {
      aktif = false;
    };
  }, [aksi]);

  async function muatLebih() {
    const h = halaman + 1;
    setLoading(true);
    const r = await fetchLogAktivitas(aksi || null, h * PER_HALAMAN);
    setItems((prev) => [...prev, ...r.data]);
    setError(r.error);
    setHalaman(h);
    setLoading(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="filter-aksi" className="text-xs font-bold text-muted-foreground">Filter aksi</label>
        <select
          id="filter-aksi"
          value={aksi}
          onChange={(e) => setAksi(e.target.value)}
          className="h-10 min-w-[220px] rounded-md border border-input bg-background px-3 text-sm"
        >
          {FILTER.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Gagal memuat log: {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Admin</th>
                <th className="px-4 py-3">Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((l, i) => (
                <tr key={`${l.waktu}-${i}`}>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{waktu(l.waktu)}</td>
                  <td className="px-4 py-3 font-semibold">{LABEL_AKSI[l.aksi] ?? l.aksi}</td>
                  <td className="px-4 py-3">{l.admin ?? `ID ${l.adminIdSingkat}`}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.targetIdSingkat ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-border md:hidden">
          {items.map((l, i) => (
            <li key={`${l.waktu}-${i}`} className="px-4 py-3">
              <p className="text-sm font-semibold">{LABEL_AKSI[l.aksi] ?? l.aksi}</p>
              <p className="truncate text-xs text-muted-foreground">
                {l.admin ?? `ID ${l.adminIdSingkat}`} · {waktu(l.waktu)}
                {l.targetIdSingkat ? ` · target ${l.targetIdSingkat}` : ''}
              </p>
            </li>
          ))}
        </ul>

        {loading && (
          <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </p>
        )}
        {!loading && items.length === 0 && !error && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Belum ada log untuk filter ini.</p>
        )}
      </Card>

      {!loading && items.length >= (halaman + 1) * PER_HALAMAN && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={() => void muatLebih()}>Muat lebih banyak</Button>
        </div>
      )}
    </div>
  );
}
