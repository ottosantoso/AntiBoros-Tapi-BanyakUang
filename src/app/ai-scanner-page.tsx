import { useEffect, useRef, useState } from 'react';
import { History, Loader2, ScanLine, ScanSearch } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ScannerView, type ScanResultReport } from '@/app/scanner-view';
import {
  createScanBatch,
  fetchScanBatches,
  setScanBatchStatus,
  type ScanBatchItem,
} from '@/lib/data';
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

/** Hasil pindai terakhir di sesi ini, untuk tab Hasil. */
interface HasilTerakhir {
  kind: ScanResultReport['kind'];
  draft: Record<string, unknown>;
  jumlahItem: number;
  status: ScanBatchItem['status'];
  waktu: string;
}

function formatWaktu(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
}

/**
 * Halaman AI Scanner dengan tiga tab: Pindai (alur pemindaian), Hasil (hasil pindai terakhir),
 * dan Riwayat (daftar pindaian yang tercatat). Setiap hasil dicatat sebagai batch lalu ditandai
 * saved atau cancelled. Tab disembunyikan, bukan dilepas, supaya pindaian yang sedang berjalan tidak hilang.
 */
export function AiScannerPage({ wallets, onSaved }: { wallets: Wallet[]; onSaved: () => void }) {
  const [tab, setTab] = useState<Tab>('pindai');
  const [hasil, setHasil] = useState<HasilTerakhir | null>(null);
  /** Id batch untuk hasil yang sedang diperiksa; null bila tidak ada hasil aktif. */
  const batchIdRef = useRef<string | null>(null);

  async function handleResult(r: ScanResultReport) {
    const waktu = new Date().toISOString();
    setHasil({ kind: r.kind, draft: r.draft, jumlahItem: r.jumlahItem, status: 'draft', waktu });
    const res = await createScanBatch({ kind: r.kind, draft: r.draft, jumlahItem: r.jumlahItem });
    batchIdRef.current = res.id;
    if (res.error) console.warn('Riwayat pindai gagal dicatat:', res.error);
  }

  async function tandai(status: 'saved' | 'cancelled') {
    const id = batchIdRef.current;
    batchIdRef.current = null;
    setHasil((h) => (h ? { ...h, status } : h));
    if (!id) return;
    const res = await setScanBatchStatus(id, status);
    if (!res.success) console.warn('Status riwayat pindai gagal diperbarui:', res.error);
  }

  function handleSaved() {
    void tandai('saved');
    onSaved();
  }

  function handleDiscard() {
    void tandai('cancelled');
  }

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

      {/* Pindai selalu terpasang; hanya disembunyikan saat tab lain aktif. */}
      <div hidden={tab !== 'pindai'}>
        <ScannerView
          wallets={wallets}
          onSaved={handleSaved}
          onResult={handleResult}
          onDiscard={handleDiscard}
        />
      </div>
      {tab === 'hasil' && <HasilTab hasil={hasil} />}
      {tab === 'riwayat' && <RiwayatTab />}
    </div>
  );
}

function HasilTab({ hasil }: { hasil: HasilTerakhir | null }) {
  if (!hasil) {
    return (
      <Card className="p-8 text-center">
        <p className="font-semibold">Belum ada hasil pindai di sesi ini.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pindai struk atau mutasi di tab Pindai. Hasil terakhir akan muncul di sini.
        </p>
      </Card>
    );
  }

  const d = hasil.draft as Record<string, unknown>;
  const judul =
    hasil.kind === 'struk'
      ? (typeof d.deskripsi === 'string' && d.deskripsi) || 'Struk tanpa deskripsi'
      : `Mutasi (${hasil.jumlahItem} baris)`;

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">{judul}</p>
          <p className="text-xs text-muted-foreground">{formatWaktu(hasil.waktu)}</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', STATUS_CLASS[hasil.status])}>
          {STATUS_LABEL[hasil.status]}
        </span>
      </div>

      {hasil.kind === 'struk' ? (
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Tanggal</dt>
            <dd className="font-medium">{String(d.tanggal ?? '-')}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Nominal</dt>
            <dd className="font-medium tnum">Rp {Number(d.nominal ?? 0).toLocaleString('id-ID')}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Kategori</dt>
            <dd className="font-medium">{String(d.kategori ?? '-')}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Jenis</dt>
            <dd className="font-medium">{String(d.jenis ?? '-')}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          Rincian baris mutasi ada di tab Pindai selama hasil masih diperiksa. Setelah disimpan atau dibatalkan, rinciannya tidak ditampilkan lagi di sini.
        </p>
      )}
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
