import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  JENIS_NOTIFIKASI,
  fetchPengaturanNotifikasi,
  simpanPengaturanNotifikasi,
  type JenisNotifikasi,
} from '@/lib/data';

export function NotifikasiSettings() {
  const [aktif, setAktif] = useState<Record<JenisNotifikasi, boolean> | null>(null);
  const [savingJenis, setSavingJenis] = useState<JenisNotifikasi | null>(null);

  useEffect(() => {
    void fetchPengaturanNotifikasi().then(({ aktif: data, error }) => {
      if (error) toast.error('Gagal memuat pengaturan notifikasi', { description: error });
      setAktif(data);
    });
  }, []);

  async function ubah(jenis: JenisNotifikasi, nilai: boolean) {
    if (!aktif) return;
    const sebelum = aktif[jenis];
    setAktif({ ...aktif, [jenis]: nilai });
    setSavingJenis(jenis);
    const res = await simpanPengaturanNotifikasi(jenis, nilai);
    setSavingJenis(null);
    if (!res.success) {
      setAktif((cur) => (cur ? { ...cur, [jenis]: sebelum } : cur));
      toast.error('Gagal menyimpan', { description: res.error ?? undefined });
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
          <Bell className="h-5 w-5 text-primary" strokeWidth={2.2} />
        </div>
        <div className="flex-1">
          <h3 className="font-display text-base font-bold tracking-tight">Notifikasi</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Semua jenis notifikasi mati secara default. Notifikasi tampil di lonceng pada header aplikasi.
          </p>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-border">
        {JENIS_NOTIFIKASI.map((j) => (
          <li key={j.jenis} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{j.judul}</p>
              <p className="text-xs text-muted-foreground">{j.deskripsi}</p>
            </div>
            <Switch
              checked={aktif?.[j.jenis] ?? false}
              disabled={!aktif || savingJenis === j.jenis}
              onCheckedChange={(v) => void ubah(j.jenis, v)}
              aria-label={`Aktifkan ${j.judul}`}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
