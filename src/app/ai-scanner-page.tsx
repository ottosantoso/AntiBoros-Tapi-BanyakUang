import { useEffect, useState } from 'react';
import { History, Loader2, ScanLine, ScanSearch } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScannerView } from '@/app/scanner-view';
import { fetchScanBatches, type ScanBatchItem } from '@/lib/data';
import type { Wallet } from '@/lib/types';
import { cn } from '@/lib/utils';

type Tab = 'pindai' | 'hasil' | 'riwayat';

const TABS: { id: Tab; label: string; icon: typeof ScanLine }[] = [
  { id: 'pindai', label: 'Pindai', icon: ScanLine },
  { id: 'hasil', label: 'Hasil', icon: ScanSearch },
  { id: 'riwayat', label: 'Riwayat', icon: History },
];

const STATUS_LABEL: Record<ScanBatchItem['status'], string> = {
  draft: 'Belum disimpan',
  saved: 'Tersimpan',
  cancelled: 'Dibatalkan',
};

const STATUS_CLASS: Record<ScanBatchItem['status'], string> = {
  draft: 'bg-amber-500/15 text-amber-300',
  saved: 'bg-emerald-500/15 text-emerald-300',
  cancelled: 'bg-white/10 text-muted-foreground',
};

function formatWaktu(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
}

/**
 * Halaman AI Scanner dengan tiga tab: Pindai (alur yang sudah ada), Hasil (hasil pindai terakhir),
 * dan Riwayat (daftar pindaian yang tercatat).
 */
export function AiScannerPage({ wallets, onSaved }: { wallets: Wallet[]; onSaved: () => void }) {
  const [tab, setTab] = useState<Tab>('pindai');

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div role="tablist" className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors',
              tab === t.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'pindai' && <ScannerView wallets={wallets} onSaved={onSaved} />}
      {tab === 'hasil' && <HasilTab />}
      {tab === 'riwayat' && <RiwayatTab />}
    </div>
  );
}

/** Hasil pindai terakhir. Akan terisi setelah hasil pindai dicatat (B-3b). */
function HasilTab() {
  return (
    <Card className="p-8 text-center">
      <p className="font-semibold">Belum ada hasil pindai yang tercatat.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Pindai struk atau mutasi di tab Pindai. Hasilnya akan muncul di sini.
      </p>
    </Card>
  );
}

function RiwayatTab() {
  const [batches, setBatches] = useState<ScanBatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aktif = true;
    fetchScanBatches().then((res) => {
      if (!aktif) return;
      setBatches(res.batches);
      setError(res.error);
      setLoading(false);
    });
    return () => {
      aktif = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Memuat riwayat pindai" />
      </div>
    );
  }

  if (error) {
    return <Card className="border-destructive/30 p-5 text-sm text-destructive">Gagal memuat riwayat pindai: {error}</Card>;
  }

  if (batches.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold">Belum ada riwayat pindai.</p>
        <p className="mt-1 text-sm text-muted-foreground">Setiap hasil pindai yang kamu proses akan tercatat di sini.</p>
      </Card>
    );
  }

  return (
    <ul className="space-y-3">
      {batches.map((b) => (
        <li key={b.id}>
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {b.kind === 'struk' ? 'Struk' : 'Mutasi'}: {b.ringkasan}
              </p>
              <p className="text-xs text-muted-foreground">{formatWaktu(b.createdAt)}</p>
            </div>
            <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', STATUS_CLASS[b.status])}>
              {STATUS_LABEL[b.status]}
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
