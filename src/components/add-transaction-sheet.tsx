import { useEffect, useState } from 'react';
import { Loader2, Send, ArrowDownLeft, ArrowUpRight, CalendarDays } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { toISODate, formatIDR } from '@/lib/format';
import { addTransaction, hasApiUrl } from '@/lib/api';
import type { TransactionType, Wallet } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Wallet[];
  onSubmitted: () => void;
}

export function AddTransactionSheet({ open, onOpenChange, wallets, onSubmitted }: Props) {
  const [tanggal, setTanggal] = useState(toISODate());
  const [deskripsi, setDeskripsi] = useState('');
  const [tipe, setTipe] = useState<TransactionType>('Pengeluaran');
  const [nominal, setNominal] = useState('');
  const [dompet, setDompet] = useState(wallets[0]?.nama ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && wallets.length && !dompet) setDompet(wallets[0].nama);
  }, [open, wallets, dompet]);

  function reset() {
    setTanggal(toISODate());
    setDeskripsi('');
    setTipe('Pengeluaran');
    setNominal('');
    setDompet(wallets[0]?.nama ?? '');
  }

  const numeric = Number(nominal.replace(/[^0-9]/g, '')) || 0;
  const valid = deskripsi.trim().length > 0 && numeric > 0 && dompet.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    const payload = {
      action: 'addTransaction' as const,
      tanggal,
      deskripsi: deskripsi.trim(),
      tipe,
      nominal: numeric,
      dompet,
    };
    const result = await addTransaction(payload);
    setSubmitting(false);
    if (result.success) {
      toast.success('Transaksi tersimpan', {
        description: `${tipe} ${formatIDR(numeric)} — ${deskripsi.trim()}`,
      });
      reset();
      onOpenChange(false);
      onSubmitted();
    } else {
      toast.error('Gagal menyimpan', { description: result.error ?? 'Periksa URL Apps Script Anda.' });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="font-display text-lg">Tambah Transaksi</SheetTitle>
          <SheetDescription>Catat pemasukan atau pengeluaran baru.</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-5 px-6 py-6">
            {/* Type toggle */}
            <div>
              <Label className="mb-2">Jenis</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipe('Pengeluaran')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all',
                    tipe === 'Pengeluaran'
                      ? 'border-expense/50 bg-expense-soft text-expense'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent',
                  )}
                >
                  <ArrowUpRight className="h-4 w-4" /> Pengeluaran
                </button>
                <button
                  type="button"
                  onClick={() => setTipe('Pemasukan')}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all',
                    tipe === 'Pemasukan'
                      ? 'border-income/50 bg-income-soft text-income'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent',
                  )}
                >
                  <ArrowDownLeft className="h-4 w-4" /> Pemasukan
                </button>
              </div>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="tx-date">Tanggal</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="tx-date"
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="tx-desc">Deskripsi</Label>
              <Input
                id="tx-desc"
                placeholder="cth. Belanja bulanan, Gaji, Kopi..."
                value={deskripsi}
                onChange={(e) => setDeskripsi(e.target.value)}
                maxLength={80}
                required
              />
            </div>

            {/* Nominal */}
            <div className="space-y-2">
              <Label htmlFor="tx-nominal">Nominal (Rp)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  Rp
                </span>
                <Input
                  id="tx-nominal"
                  inputMode="numeric"
                  placeholder="0"
                  value={nominal ? new Intl.NumberFormat('id-ID').format(numeric) : ''}
                  onChange={(e) => setNominal(e.target.value.replace(/[^0-9]/g, ''))}
                  className="pl-10 tnum"
                  required
                />
              </div>
              {numeric > 0 && (
                <p className="text-xs text-muted-foreground tnum">
                  {formatIDR(numeric)}
                </p>
              )}
            </div>

            {/* Wallet */}
            <div className="space-y-2">
              <Label>Dompet</Label>
              <Select value={dompet} onValueChange={setDompet}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih dompet" />
                </SelectTrigger>
                <SelectContent>
                  {wallets.length === 0 ? (
                    <SelectItem value="_none" disabled>
                      Belum ada dompet
                    </SelectItem>
                  ) : (
                    wallets.map((w) => (
                      <SelectItem key={w.nama} value={w.nama}>
                        {w.nama}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {!hasApiUrl() && (
              <div className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-xs text-warning">
                URL Apps Script belum diatur. Transaksi ini tidak akan terkirim. Buka Pengaturan untuk menghubungkan.
              </div>
            )}
          </div>

          <SheetFooter className="border-t border-border px-6 py-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Batal
            </Button>
            <Button type="submit" disabled={!valid || submitting} className="gap-2">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Simpan
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
