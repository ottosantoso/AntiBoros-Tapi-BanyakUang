import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowLeftRight, ArrowUpRight, Loader2 } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { fetchWalletInsights, type RiwayatJenis, type WalletInsight } from '@/lib/data';
import type { Wallet } from '@/lib/types';
import { formatIDR, formatIDRCompact } from '@/lib/format';
import { getWalletMeta } from '@/lib/wallets';
import { cn } from '@/lib/utils';

type Tab = 'ringkasan' | 'riwayat' | 'pengeluaran';

const TABS: { key: Tab; label: string }[] = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'riwayat', label: 'Riwayat' },
  { key: 'pengeluaran', label: 'Pengeluaran' },
];

const JENIS_LABEL: Record<Wallet['jenis'], string> = {
  bank: 'Bank',
  ewallet: 'E-Wallet',
  tunai: 'Tunai',
  lainnya: 'Lainnya',
};

const RIWAYAT_PER_HALAMAN = 20;

/** Persen perubahan dengan tanda, mis. +4,2%. */
export function formatPersen(persen: number | null): string {
  if (persen === null) return '—';
  const tanda = persen > 0 ? '+' : '';
  return `${tanda}${persen.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;
}

function ikonJenis(jenis: RiwayatJenis) {
  if (jenis === 'Pemasukan') return ArrowDownRight;
  if (jenis === 'Pengeluaran') return ArrowUpRight;
  return ArrowLeftRight;
}

export function WalletDetailView({ wallet, onBack }: { wallet: Wallet; onBack: () => void }) {
  const [insight, setInsight] = useState<WalletInsight | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('ringkasan');
  const [tampil, setTampil] = useState(RIWAYAT_PER_HALAMAN);

  useEffect(() => {
    let aktif = true;
    fetchWalletInsights().then((res) => {
      if (!aktif) return;
      setError(res.error);
      setInsight(res.byWallet[wallet.id] ?? null);
      setLoading(false);
    });
    return () => {
      aktif = false;
    };
  }, [wallet.id]);

  const meta = getWalletMeta(wallet);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        Kembali ke Dompet
      </Button>

      <Card className="overflow-hidden p-0">
        <div className={cn('flex flex-col gap-4 bg-gradient-to-br p-5 text-white md:flex-row md:items-center md:justify-between', meta.gradient)}>
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-16 place-items-center rounded-lg bg-white/15 text-sm font-bold backdrop-blur-sm">
              {meta.glyph}
            </div>
            <div>
              <p className="text-xs font-medium text-white/70">{JENIS_LABEL[wallet.jenis]}</p>
              <h2 className="font-display text-xl font-bold leading-tight">{wallet.nama}</h2>
              <p className="text-xs text-white/70">{meta.brand}</p>
            </div>
          </div>
          <div className="md:text-right">
            <p className="text-xs font-medium text-white/70">Saldo sekarang</p>
            <p className="font-display text-3xl font-bold tnum">
              {insight ? formatIDR(insight.saldoSekarang) : formatIDR(wallet.saldo)}
            </p>
            {insight && (
              <p className="mt-1 text-xs font-semibold tnum text-white/90">
                {formatPersen(insight.persenBulan)} bulan ini
              </p>
            )}
          </div>
        </div>

        <div role="tablist" className="flex gap-1 border-b border-border px-3 pt-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                '-mb-px border-b-2 px-3 pb-2 text-sm font-semibold transition-colors',
                tab === t.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {loading && (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-label="Memuat detail dompet" />
            </div>
          )}

          {!loading && error && (
            <p className="py-10 text-center text-sm text-destructive">Gagal memuat detail dompet: {error}</p>
          )}

          {!loading && !error && !insight && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Data dompet ini belum tersedia. Dompet mungkin sudah diarsipkan.
            </p>
          )}

          {!loading && !error && insight && tab === 'ringkasan' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Saldo awal bulan" value={formatIDR(insight.saldoAwalBulan)} />
                <Stat
                  label="Perubahan bulan ini"
                  value={`${insight.perubahanBulan >= 0 ? '+' : '-'} ${formatIDR(Math.abs(insight.perubahanBulan))}`}
                  tone={insight.perubahanBulan >= 0 ? 'income' : 'expense'}
                />
                <Stat
                  label="Persen perubahan"
                  value={formatPersen(insight.persenBulan)}
                  tone={insight.persenBulan === null ? undefined : insight.persenBulan >= 0 ? 'income' : 'expense'}
                />
              </div>

              <div>
                <h3 className="mb-1 font-display text-base font-bold tracking-tight">Perkembangan Saldo</h3>
                <p className="mb-3 text-xs text-muted-foreground">Saldo di akhir setiap bulan, 6 bulan terakhir</p>
                <div className="h-56 w-full min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={insight.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="saldoFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="bulan" tickLine={false} axisLine={false} fontSize={11} />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        fontSize={11}
                        width={56}
                        tickFormatter={(v: number) => formatIDRCompact(v)}
                      />
                      <Tooltip formatter={(v: number) => formatIDR(v)} />
                      <Area
                        type="monotone"
                        dataKey="saldo"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fill="url(#saldoFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && insight && tab === 'riwayat' && (
            <div>
              {insight.riwayat.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Belum ada transaksi di dompet ini.</p>
              ) : (
                <>
                  <ul className="divide-y divide-border/60">
                    {insight.riwayat.slice(0, tampil).map((r) => {
                      const Icon = ikonJenis(r.jenis);
                      const masuk = r.efek >= 0;
                      return (
                        <li key={`${r.jenis}-${r.id}`} className="flex items-center gap-3 py-3">
                          <span
                            className={cn(
                              'grid h-9 w-9 shrink-0 place-items-center rounded-full',
                              masuk ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600',
                            )}
                            aria-hidden
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">{r.deskripsi}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.tanggal} · {r.jenis}
                              {r.kategori ? ` · ${r.kategori}` : ''}
                            </p>
                          </div>
                          <p className={cn('shrink-0 text-sm font-bold tnum', masuk ? 'text-emerald-600' : 'text-rose-600')}>
                            {masuk ? '+' : '-'} {formatIDR(Math.abs(r.efek))}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  {tampil < insight.riwayat.length && (
                    <div className="pt-4 text-center">
                      <Button variant="outline" size="sm" onClick={() => setTampil((n) => n + RIWAYAT_PER_HALAMAN)}>
                        Tampilkan lebih banyak ({insight.riwayat.length - tampil} lagi)
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {!loading && !error && insight && tab === 'pengeluaran' && (
            <div>
              <h3 className="mb-1 font-display text-base font-bold tracking-tight">Pengeluaran Bulan Ini</h3>
              <p className="mb-4 text-xs text-muted-foreground">Dari dompet ini, per kategori</p>
              {insight.pengeluaranBulanIni.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pengeluaran bulan ini.</p>
              ) : (
                <KategoriBars items={insight.pengeluaranBulanIni} />
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'income' | 'expense' }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-lg font-bold tnum',
          tone === 'income' && 'text-emerald-600',
          tone === 'expense' && 'text-rose-600',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function KategoriBars({ items }: { items: { kategori: string; total: number }[] }) {
  const max = Math.max(...items.map((i) => i.total), 1);
  const total = items.reduce((s, i) => s + i.total, 0);
  return (
    <ul className="space-y-3">
      {items.map((i) => {
        const persen = Math.round((i.total / total) * 100);
        return (
          <li key={i.kategori}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="truncate font-medium">{i.kategori}</span>
              <span className="shrink-0 font-semibold tnum">
                {formatIDR(i.total)} <span className="text-xs font-normal text-muted-foreground">({persen}%)</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(i.total / max) * 100}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
