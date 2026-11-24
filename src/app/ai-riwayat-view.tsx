import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fetchAiReports, type AiReportItem, type AiReportKind } from '@/lib/data';
import { cn } from '@/lib/utils';

type Filter = 'semua' | AiReportKind;

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'semua', label: 'Semua' },
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'analisa', label: 'Analisa' },
];

const KIND_LABEL: Record<AiReportKind, string> = {
  dashboard: 'Dashboard',
  analisa: 'Analisa',
};

/** Tanggal YYYY-MM-DD menjadi "1 Nov 2026". Dibuat dari bagian string supaya tidak bergeser zona waktu. */
function formatTanggal(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatWaktuDibuat(iso: string): string {
  return new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });
}

/** Daftar insight AI yang pernah dibuat, terbaru di atas. Dibaca dari tabel ai_reports. */
export function AiRiwayatView() {
  const [filter, setFilter] = useState<Filter>('semua');
  const [reports, setReports] = useState<AiReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aktif = true;
    setLoading(true);
    fetchAiReports(filter === 'semua' ? undefined : filter).then((res) => {
      if (!aktif) return;
      setReports(res.reports);
      setError(res.error);
      setLoading(false);
    });
    return () => {
      aktif = false;
    };
  }, [filter]);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-500/15 text-sky-300">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Riwayat AI</h2>
            <p className="text-sm text-muted-foreground">
              Insight yang pernah dibuat dari halaman Dashboard dan Analisa, lengkap dengan periodenya.
            </p>
          </div>
        </div>
      </Card>

      <div role="tablist" className="flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors',
              filter === f.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Memuat riwayat" />
        </div>
      )}

      {!loading && error && (
        <Card className="border-destructive/30 p-5 text-sm text-destructive">
          Gagal memuat riwayat AI: {error}
        </Card>
      )}

      {!loading && !error && reports.length === 0 && (
        <Card className="p-8 text-center">
          <p className="font-semibold">Belum ada riwayat insight.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Buat insight dari halaman Dashboard atau Analisa, nanti hasilnya tersimpan di sini.
          </p>
        </Card>
      )}

      {!loading && !error && reports.length > 0 && (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li key={r.id}>
              <Card className="space-y-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-bold text-primary">
                    {KIND_LABEL[r.kind]}
                  </span>
                  <span className="text-xs text-muted-foreground">Dibuat {formatWaktuDibuat(r.createdAt)}</span>
                </div>
                <p className="text-sm font-semibold">
                  Periode {formatTanggal(r.periodStart)} – {formatTanggal(r.periodEnd)}
                </p>

                {r.insights.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Insight</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {r.insights.slice(0, 5).map((i, idx) => (
                        <li key={idx}>{i}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {r.hemat.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Saran hemat</p>
                    <ul className="list-disc space-y-1 pl-5 text-sm">
                      {r.hemat.map((h, idx) => (
                        <li key={idx}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
