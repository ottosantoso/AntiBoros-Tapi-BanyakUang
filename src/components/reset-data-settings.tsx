import { useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { resetSemuaTransaksi, resetTransaksiPeriode, type ResetResult } from '@/lib/data';
import { toISODate } from '@/lib/format';
import { cn } from '@/lib/utils';

type Mode = 'bulan' | 'semua';

const KATA_KONFIRMASI = 'RESET';

const INFO: Record<Mode, { judul: string; diubah: string[]; tetap: string[]; tombol: string }> = {
  bulan: {
    judul: 'Reset data bulan ini',
    diubah: ['Transaksi bulan ini dipindah ke Sampah', 'Saldo dompet ikut kembali sesuai transaksi yang dipindah'],
    tetap: [
      'Dompet dan saldo awal',
      'Kategori dan subkategori',
      'Budget dan target tabungan',
      'Transfer antar-dompet (dan biaya admin-nya)',
    ],
    tombol: 'Reset bulan ini',
  },
  semua: {
    judul: 'Reset semua transaksi',
    diubah: [
      'Semua transaksi dipindah ke Sampah (masih bisa dipulihkan)',
      'Semua transfer antar-dompet dihapus permanen (tidak bisa dipulihkan)',
      'Saldo dompet kembali ke saldo awal',
    ],
    tetap: ['Dompet dan saldo awal', 'Kategori dan subkategori', 'Budget dan target tabungan'],
    tombol: 'Reset semua',
  },
};

/** Tanggal awal dan akhir bulan berjalan, format YYYY-MM-DD. */
function rentangBulanIni(): { start: string; end: string } {
  const now = new Date();
  return {
    start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function ResetDataSettings({ onChanged }: { onChanged: () => void }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const [ketik, setKetik] = useState('');
  const [running, setRunning] = useState(false);

  function tutup() {
    if (running) return;
    setMode(null);
    setKetik('');
  }

  async function jalankan() {
    if (!mode || ketik !== KATA_KONFIRMASI || running) return;
    setRunning(true);
    let hasil: ResetResult;
    if (mode === 'bulan') {
      hasil = await resetTransaksiPeriode(rentangBulanIni());
    } else {
      hasil = await resetSemuaTransaksi();
    }
    setRunning(false);

    if (!hasil.success) {
      toast.error('Reset belum selesai', { description: hasil.error ?? undefined });
      onChanged();
      return;
    }
    toast.success(
      mode === 'bulan'
        ? `${hasil.jumlahTransaksi} transaksi bulan ini dipindah ke Sampah`
        : `${hasil.jumlahTransaksi} transaksi ke Sampah, ${hasil.jumlahTransfer} transfer dihapus`,
      { description: 'Lihat Sampah di halaman Transaksi untuk memulihkan.' },
    );
    setMode(null);
    setKetik('');
    onChanged();
  }

  const info = mode ? INFO[mode] : null;
  const siap = ketik === KATA_KONFIRMASI && !running;

  return (
    <>
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#fff1f2]">
            <RotateCcw className="h-5 w-5 text-[#e11d48]" strokeWidth={2.2} />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-base font-bold tracking-tight">Reset data</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Kosongkan transaksi untuk mulai dari awal. Dompet, kategori, budget, dan target tidak ikut dihapus.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            onClick={() => setMode('bulan')}
            className="h-10 gap-2 rounded-full font-bold"
          >
            Reset data bulan ini
          </Button>
          <Button
            variant="outline"
            onClick={() => setMode('semua')}
            className="h-10 gap-2 rounded-full border-[#fecdd3] font-bold text-[#be123c] hover:bg-[#fff1f2]"
          >
            Reset semua transaksi
          </Button>
        </div>
      </Card>

      <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) tutup(); }}>
        <DialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl sm:max-w-md">
          {info && mode && (
            <>
              <DialogHeader>
                <DialogTitle>{info.judul}</DialogTitle>
                <DialogDescription>
                  {mode === 'bulan'
                    ? 'Periode yang direset: bulan berjalan.'
                    : 'Periode yang direset: semua transaksi.'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#5b6f99]">Yang berubah</p>
                  <ul className="mt-2 space-y-1.5">
                    {info.diubah.map((item) => (
                      <li key={item} className="flex gap-2 text-[#172554]">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#e11d48]" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#5b6f99]">Tetap aman</p>
                  <ul className="mt-2 space-y-1.5">
                    {info.tetap.map((item) => (
                      <li key={item} className="flex gap-2 text-[#172554]">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#16a34a]" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex gap-2 rounded-xl border border-[#fecdd3] bg-[#fff1f2] px-3 py-2.5 text-xs font-semibold text-[#9f1239]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>Ketik <strong>{KATA_KONFIRMASI}</strong> di bawah untuk melanjutkan.</span>
                </div>

                <Input
                  value={ketik}
                  onChange={(e) => setKetik(e.target.value)}
                  placeholder={KATA_KONFIRMASI}
                  autoComplete="off"
                  aria-label={`Ketik ${KATA_KONFIRMASI} untuk konfirmasi`}
                  className="font-bold tracking-wider"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-2">
                <Button variant="outline" onClick={tutup} disabled={running} className="rounded-full">
                  Batal
                </Button>
                <Button
                  onClick={jalankan}
                  disabled={!siap}
                  className={cn('gap-2 rounded-full font-bold', siap ? 'bg-[#e11d48] text-white hover:bg-[#be123c]' : '')}
                >
                  {running && <Loader2 className="h-4 w-4 animate-spin" />}
                  {info.tombol}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
