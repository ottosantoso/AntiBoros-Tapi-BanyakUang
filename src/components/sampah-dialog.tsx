import { useCallback, useEffect, useState } from 'react';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  emptySampah,
  fetchSampahTransactions,
  hardDeleteSampahRow,
  restoreTransactionRow,
} from '@/lib/data';
import type { Transaction } from '@/lib/types';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * Sampah transaksi: transaksi yang dihapus sementara. Bisa dipulihkan atau dihapus permanen.
 * Item di sampah tidak dihitung di saldo, dashboard, atau laporan.
 */
export function SampahDialog({
  open,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dipanggil setelah pulihkan atau hapus permanen, agar data dashboard ikut diperbarui. */
  onChanged: () => void;
}) {
  const [items, setItems] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const muat = useCallback(async () => {
    setLoading(true);
    const res = await fetchSampahTransactions();
    setItems(res.items);
    setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) {
      setConfirmId(null);
      setConfirmEmpty(false);
      void muat();
    }
  }, [open, muat]);

  async function pulihkan(tx: Transaction) {
    if (!tx.id) return;
    setBusyId(tx.id);
    const res = await restoreTransactionRow(tx.id);
    setBusyId(null);
    if (!res.success) {
      toast.error('Gagal memulihkan transaksi', { description: res.error ?? undefined });
      return;
    }
    toast.success('Transaksi dipulihkan', { description: `${tx.deskripsi} · ${formatIDR(tx.nominal)}` });
    onChanged();
    void muat();
  }

  async function hapusPermanen(tx: Transaction) {
    if (!tx.id) return;
    if (confirmId !== tx.id) {
      setConfirmId(tx.id);
      return;
    }
    setBusyId(tx.id);
    const res = await hardDeleteSampahRow(tx.id);
    setBusyId(null);
    setConfirmId(null);
    if (!res.success) {
      toast.error('Gagal menghapus permanen', { description: res.error ?? undefined });
      return;
    }
    toast.success('Dihapus permanen');
    void muat();
  }

  async function kosongkan() {
    if (!confirmEmpty) {
      setConfirmEmpty(true);
      return;
    }
    setBusyId('__all__');
    const res = await emptySampah();
    setBusyId(null);
    setConfirmEmpty(false);
    if (!res.success) {
      toast.error('Gagal mengosongkan sampah', { description: res.error ?? undefined });
      return;
    }
    toast.success('Sampah dikosongkan');
    void muat();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Sampah Transaksi</DialogTitle>
          <DialogDescription>
            Transaksi yang dihapus sementara ada di sini. Tidak dihitung di saldo, dashboard, atau laporan. Pulihkan untuk mengembalikannya.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-label="Memuat sampah" />
          </div>
        ) : error ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Gagal memuat sampah: {error}
          </p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm font-medium text-muted-foreground">Sampah kosong.</p>
        ) : (
          <>
            <ul className="divide-y divide-[#e7eef9]">
              {items.map((tx) => (
                <li key={tx.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#172554]">{tx.deskripsi}</p>
                    <p className="truncate text-xs font-medium text-[#5b6f99]">
                      {tx.tanggal} · {tx.dompet} · {tx.kategori ?? 'Tanpa kategori'}
                    </p>
                  </div>
                  <span className={cn('shrink-0 text-sm font-extrabold tnum', tx.tipe === 'Pemasukan' ? 'text-[#047857]' : 'text-[#be123c]')}>
                    {tx.tipe === 'Pemasukan' ? '+' : '-'} {formatIDR(tx.nominal)}
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => pulihkan(tx)}
                      disabled={busyId !== null}
                      className="h-8 gap-1.5 rounded-full text-xs font-bold"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Pulihkan
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => hapusPermanen(tx)}
                      disabled={busyId !== null}
                      className={cn(
                        'h-8 gap-1.5 rounded-full text-xs font-bold',
                        confirmId === tx.id ? 'border-[#e11d48] bg-[#e11d48] text-white hover:bg-[#be123c]' : 'text-[#be123c]',
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {confirmId === tx.id ? 'Yakin?' : 'Hapus permanen'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2 border-t border-[#e7eef9] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-medium text-[#5b6f99]">
                Hapus permanen tidak bisa dibatalkan. Riwayat perubahannya tetap tersimpan di log.
              </p>
              <Button
                size="sm"
                onClick={kosongkan}
                disabled={busyId !== null}
                className={cn('h-9 gap-2 rounded-full font-bold', confirmEmpty ? 'bg-[#e11d48] text-white hover:bg-[#be123c]' : 'bg-[#fff1f2] text-[#be123c] hover:bg-[#ffe4e6]')}
              >
                <Trash2 className="h-4 w-4" />
                {confirmEmpty ? 'Ya, kosongkan semua' : 'Kosongkan sampah'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
