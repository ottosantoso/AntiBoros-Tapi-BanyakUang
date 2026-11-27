import { useEffect, useState } from 'react';
import { Activity, Bot, HandCoins, Receipt, ShieldCheck, Users } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { fetchAdminSummary, type AdminSummary } from '@/lib/data';

const KARTU: { key: keyof AdminSummary; label: string; hint: string; icon: typeof Users; tone: string }[] = [
  { key: 'totalPengguna', label: 'Total pengguna', hint: 'Akun terdaftar', icon: Users, tone: 'bg-primary/10 text-primary' },
  { key: 'penggunaAktif30Hari', label: 'Aktif 30 hari', hint: 'Mencatat dalam 30 hari terakhir', icon: Activity, tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  { key: 'totalTransaksi', label: 'Total transaksi', hint: 'Seluruh transaksi aktif', icon: Receipt, tone: 'bg-sky-500/10 text-sky-600 dark:text-sky-400' },
  { key: 'pemakaianAiHariIni', label: 'Pemakaian AI hari ini', hint: 'Permintaan AI hari ini', icon: Bot, tone: 'bg-violet-500/10 text-violet-600 dark:text-violet-400' },
  { key: 'penggunaPakaiUtang', label: 'Pengguna fitur utang', hint: 'Pernah mencatat utang atau cicilan', icon: HandCoins, tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
];

export function AdminView() {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let aktif = true;
    void fetchAdminSummary().then(({ data: d, error: e }) => {
      if (!aktif) return;
      setData(d);
      setError(e);
      setLoading(false);
    });
    return () => {
      aktif = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={2.2} />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Admin</h2>
          <p className="text-sm text-muted-foreground">
            Ringkasan agregat seluruh aplikasi. Halaman ini tidak menampilkan data pribadi pengguna.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Gagal memuat ringkasan: {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {KARTU.map((k) => (
          <Card key={String(k.key)} className="p-5">
            <div className="flex items-center gap-3">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${k.tone}`}>
                <k.icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{k.label}</p>
                <p className="font-display text-2xl font-extrabold tabular-nums text-foreground">
                  {loading ? '…' : (data?.[k.key] ?? 0).toLocaleString('id-ID')}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{k.hint}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
