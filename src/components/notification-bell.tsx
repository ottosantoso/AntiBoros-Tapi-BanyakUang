import { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  fetchJumlahBelumDibaca,
  fetchNotifikasi,
  sinkronkanNotifikasi,
  tandaiNotifikasiDibaca,
  tandaiSemuaDibaca,
  type Notifikasi,
} from '@/lib/data';
import { cn } from '@/lib/utils';

const LABEL_JENIS: Record<Notifikasi['jenis'], string> = {
  pengingat_harian: 'Pengingat',
  saldo_minus: 'Saldo',
  budget_80: 'Budget',
  budget_100: 'Budget',
  jatuh_tempo_utang: 'Utang',
};

function waktuSingkat(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function NotificationBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notifikasi[]>([]);
  const [jumlah, setJumlah] = useState(0);
  const [loading, setLoading] = useState(false);

  const muat = useCallback(async () => {
    setLoading(true);
    // Sinkron dulu supaya notifikasi terbaru (jatuh tempo, budget, saldo) muncul. Gagal sinkron tidak menghentikan tampilan.
    await sinkronkanNotifikasi();
    const [{ items: daftar }, belum] = await Promise.all([fetchNotifikasi(), fetchJumlahBelumDibaca()]);
    setItems(daftar);
    setJumlah(belum);
    setLoading(false);
  }, []);

  // Hitung badge saat pertama dibuka aplikasi
  useEffect(() => {
    void fetchJumlahBelumDibaca().then(setJumlah);
  }, []);

  useEffect(() => {
    if (open) void muat();
  }, [open, muat]);

  async function klik(n: Notifikasi) {
    if (!n.dibacaPada) {
      await tandaiNotifikasiDibaca([n.id]);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, dibacaPada: new Date().toISOString() } : x)));
      setJumlah((j) => Math.max(0, j - 1));
    }
  }

  async function tandaiSemua() {
    const res = await tandaiSemuaDibaca();
    if (res.success) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => ({ ...x, dibacaPada: x.dibacaPada ?? now })));
      setJumlah(0);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={jumlah > 0 ? `Notifikasi, ${jumlah} belum dibaca` : 'Notifikasi'}
          className={cn('relative h-10 w-10 rounded-full border-border bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground', className)}
        >
          <Bell className="h-[18px] w-[18px]" />
          {jumlah > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold leading-none text-white">
              {jumlah > 9 ? '9+' : jumlah}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] p-0">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="font-display text-sm font-bold text-foreground">Notifikasi</p>
          {jumlah > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={tandaiSemua} className="h-8 gap-1.5 px-2 text-xs font-bold">
              <CheckCheck className="h-3.5 w-3.5" />
              Tandai semua dibaca
            </Button>
          )}
        </div>
        <div className="max-h-[60dvh] overflow-y-auto">
          {loading && items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Memuat…</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Belum ada notifikasi. Aktifkan jenisnya di Pengaturan.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void klik(n)}
                    className={cn(
                      'flex w-full min-w-0 gap-3 px-4 py-3 text-left transition hover:bg-accent/40',
                      !n.dibacaPada && 'bg-primary/5',
                    )}
                  >
                    <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.dibacaPada ? 'bg-transparent' : 'bg-rose-500')} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {LABEL_JENIS[n.jenis]}
                        <span className="font-medium normal-case tracking-normal">· {waktuSingkat(n.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-sm font-bold text-foreground">{n.judul}</span>
                      <span className="mt-0.5 block break-words text-xs text-muted-foreground">{n.isi}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
