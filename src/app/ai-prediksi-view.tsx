import { useEffect, useState } from 'react';
import { Loader2, TrendingUp, HeartPulse } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fetchBudgetData, fetchDashboardData } from '@/lib/data';
import { formatIDR, toISODate } from '@/lib/format';
import { prediksiBulanDepan, skorKesehatan, type Prediksi, type SkorResult } from '@/lib/health-score';
import { cn } from '@/lib/utils';

interface Hasil {
  prediksi: Prediksi;
  skor: SkorResult;
  bulanIni: string;
}

/** Hitung prediksi dan skor untuk bulan berjalan. Hanya membaca data, tidak menulis apa pun. */
async function muat(): Promise<{ hasil: Hasil | null; error: string | null }> {
  const now = new Date();
  const awal = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
  const akhir = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const [dash, bud] = await Promise.all([
    fetchDashboardData({ start: awal, end: akhir }),
    fetchBudgetData({ start: awal, end: akhir }),
  ]);
  if (dash.error || !dash.data) return { hasil: null, error: dash.error ?? 'Data dashboard kosong.' };
  if (bud.error) return { hasil: null, error: bud.error };

  const trend = dash.data.trenBulanan ?? [];
  const prediksi = prediksiBulanDepan(trend.map((t) => ({ bulan: t.bulan, total: t.pengeluaran })));

  const budget = bud.budgets.map((b) => ({
    limit: b.limit,
    spent: bud.spentBySubkat[b.subkategoriId] ?? 0,
  }));

  const skor = skorKesehatan({
    pemasukan: dash.data.pemasukanBulanIni,
    pengeluaran: dash.data.pengeluaranBulanIni,
    budget,
    dompet: dash.data.dompet.map((d) => ({ saldo: d.saldo })),
  });

  return {
    hasil: {
      prediksi,
      skor,
      bulanIni: now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }),
    },
    error: null,
  };
}

const LABEL_CLASS: Record<SkorResult['label'], string> = {
  'Sangat Baik': 'bg-emerald-500/15 text-emerald-300',
  Baik: 'bg-sky-500/15 text-sky-300',
  'Perlu Perhatian': 'bg-amber-500/15 text-amber-300',
  Kritis: 'bg-rose-500/15 text-rose-300',
};

const BAR_CLASS: Record<SkorResult['label'], string> = {
  'Sangat Baik': 'bg-emerald-500',
  Baik: 'bg-sky-500',
  'Perlu Perhatian': 'bg-amber-500',
  Kritis: 'bg-rose-500',
};

/** Prediksi pengeluaran bulan depan dan skor kesehatan keuangan bulan berjalan. */
export function AiPrediksiView() {
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aktif = true;
    muat().then((res) => {
      if (!aktif) return;
      setHasil(res.hasil);
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
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Menghitung prediksi" />
      </div>
    );
  }

  if (error || !hasil) {
    return <Card className="border-destructive/30 p-5 text-sm text-destructive">Gagal menghitung: {error}</Card>;
  }

  const { prediksi, skor, bulanIni } = hasil;

  return (
    <div className="space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-300">
            <TrendingUp className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Prediksi Pengeluaran Bulan Depan</h2>
            <p className="text-sm text-muted-foreground">Estimasi dari pola bulan-bulan sebelumnya.</p>
          </div>
        </div>
        {prediksi.estimasi === null ? (
          <p className="text-sm text-muted-foreground">{prediksi.catatan}</p>
        ) : (
          <>
            <p className="font-display text-3xl font-bold tnum">{formatIDR(prediksi.estimasi)}</p>
            <p className="text-sm text-muted-foreground">{prediksi.catatan}</p>
          </>
        )}
      </Card>

      <Card className="space-y-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
              <HeartPulse className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">Skor Kesehatan Keuangan</h2>
              <p className="text-sm text-muted-foreground">Periode {bulanIni}</p>
            </div>
          </div>
          <span className={cn('rounded-full px-3 py-1 text-xs font-bold', LABEL_CLASS[skor.label])}>{skor.label}</span>
        </div>

        <div className="flex items-end gap-2">
          <span className="font-display text-4xl font-bold tnum">{skor.skor}</span>
          <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', BAR_CLASS[skor.label])} style={{ width: `${skor.skor}%` }} />
        </div>

        <ul className="space-y-3">
          {skor.rincian.map((r) => (
            <li key={r.nama} className="rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{r.nama}</p>
                <p className="text-sm font-bold tnum">
                  {r.poin} <span className="font-normal text-muted-foreground">/ {r.maks}</span>
                </p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{r.keterangan}</p>
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          Cara hitung: tabungan (maks 40) dari sisa pemasukan, budget (maks 30) dari batas yang belum terlampaui, dan saldo dompet (maks 30) dari dompet yang tidak minus. Label: 80 ke atas Sangat Baik, 60 Baik, 40 Perlu Perhatian, di bawahnya Kritis.
        </p>
      </Card>
    </div>
  );
}
