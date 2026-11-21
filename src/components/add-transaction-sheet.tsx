import { useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CheckCircle2, CircleAlert, Loader2, PlusCircle, Send, Tags, WalletCards } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  const [tipe, setTipe] = useState<TransactionType>('Pemasukan');
  const [nominal, setNominal] = useState('');
  const [dompet, setDompet] = useState(wallets[0]?.nama ?? '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && wallets.length && !wallets.some((wallet) => wallet.nama === dompet)) setDompet(wallets[0].nama);
  }, [dompet, open, wallets]);

  function reset() {
    setTanggal(toISODate());
    setDeskripsi('');
    setTipe('Pemasukan');
    setNominal('');
    setDompet(wallets[0]?.nama ?? '');
  }

  const numeric = Number(nominal.replace(/[^0-9]/g, '')) || 0;
  const selectedWallet = useMemo(() => wallets.find((wallet) => wallet.nama === dompet), [dompet, wallets]);
  const insufficientBalance = tipe === 'Pengeluaran' && Boolean(selectedWallet) && numeric > (selectedWallet?.saldo ?? 0);
  const category = guessCategory(deskripsi, tipe);
  const valid = deskripsi.trim().length > 0 && numeric > 0 && dompet.length > 0 && !insufficientBalance;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    const payload = { action: 'addTransaction' as const, tanggal, deskripsi: deskripsi.trim(), tipe, nominal: numeric, dompet, kategori: category };
    const result = await addTransaction(payload);
    setSubmitting(false);
    if (result.success) {
      toast.success('Transaksi tersimpan', { description: `${tipe} ${formatIDR(numeric)} — ${deskripsi.trim()}` });
      reset();
      onOpenChange(false);
      onSubmitted();
    } else {
      toast.error('Gagal menyimpan', { description: result.error ?? 'Periksa koneksi data Anda.' });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-[#dbeafe] bg-[#f8fbff] p-0 shadow-[-14px_0_35px_rgba(30,64,175,0.08)] sm:max-w-[410px]">
        <SheetHeader className="border-b border-[#e7eef9] bg-white px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2563eb] text-white shadow-[0_7px_16px_rgba(37,99,235,0.24)]"><PlusCircle className="h-6 w-6" strokeWidth={2.2} /></span>
            <div><SheetTitle className="font-display text-xl font-extrabold tracking-[-0.04em] text-[#172554]">Tambah Transaksi</SheetTitle><SheetDescription className="mt-1 text-xs font-semibold text-[#5b6f99]">Catat pemasukan atau pengeluaran baru.</SheetDescription></div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-5 px-6 py-6">
            <div>
              <Label className="mb-2 block text-sm font-extrabold text-[#172554]">Jenis</Label>
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[#eef3fb] p-1">
                <button type="button" onClick={() => setTipe('Pemasukan')} className={cn('flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-extrabold transition-all', tipe === 'Pemasukan' ? 'bg-[#2563eb] text-white shadow-[0_5px_12px_rgba(37,99,235,0.2)]' : 'text-[#e11d48] hover:bg-white')}><ArrowUpRight className="h-4 w-4" /> Pemasukan</button>
                <button type="button" onClick={() => setTipe('Pengeluaran')} className={cn('flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-extrabold transition-all', tipe === 'Pengeluaran' ? 'bg-[#f43f5e] text-white shadow-[0_5px_12px_rgba(244,63,94,0.18)]' : 'text-[#be123c] hover:bg-white')}><ArrowDownLeft className="h-4 w-4" /> Pengeluaran</button>
              </div>
            </div>

            <div className="space-y-2"><Label htmlFor="tx-date" className="text-sm font-extrabold text-[#172554]">Tanggal</Label><div className="relative"><CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#2563eb]" /><Input id="tx-date" type="date" value={tanggal} onChange={(event) => setTanggal(event.target.value)} className="h-11 rounded-xl border-[#dbeafe] bg-white pl-10 font-bold text-[#172554]" required /></div></div>

            <div className="space-y-2"><Label htmlFor="tx-desc" className="text-sm font-extrabold text-[#172554]">Deskripsi</Label><Input id="tx-desc" placeholder="cth. Belanja bulanan, Gaji, Kopi..." value={deskripsi} onChange={(event) => setDeskripsi(event.target.value)} maxLength={80} className="h-11 rounded-xl border-[#dbeafe] bg-white font-medium text-[#172554] placeholder:text-[#8a9abb]" required /><div className="flex items-center gap-2 rounded-xl bg-[#eff6ff] px-3 py-2 text-xs font-bold text-[#31548a]"><Tags className="h-3.5 w-3.5 text-[#2563eb]" />Kategori otomatis: <span className="text-[#2563eb]">{category}</span></div></div>

            <div className="space-y-2"><Label htmlFor="tx-nominal" className="text-sm font-extrabold text-[#172554]">Nominal (Rp)</Label><div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-[#5b6f99]">Rp</span><Input id="tx-nominal" inputMode="numeric" placeholder="0" value={nominal ? new Intl.NumberFormat('id-ID').format(numeric) : ''} onChange={(event) => setNominal(event.target.value.replace(/[^0-9]/g, ''))} className="h-11 rounded-xl border-[#dbeafe] bg-white pl-10 font-bold tnum text-[#172554]" required /></div>{numeric > 0 && <p className="text-xs font-bold text-[#5b6f99] tnum">{formatIDR(numeric)}</p>}</div>

            <div className="space-y-2"><Label className="text-sm font-extrabold text-[#172554]">Dompet sumber dana</Label><Select value={dompet} onValueChange={setDompet}><SelectTrigger className="h-11 rounded-xl border-[#dbeafe] bg-white font-bold text-[#172554]"><div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-[#2563eb]" /><SelectValue placeholder="Pilih dompet" /></div></SelectTrigger><SelectContent>{wallets.length === 0 ? <SelectItem value="_none" disabled>Belum ada dompet</SelectItem> : wallets.map((wallet) => <SelectItem key={wallet.nama} value={wallet.nama}>{wallet.nama}</SelectItem>)}</SelectContent></Select>{selectedWallet && <div className="flex items-center justify-between rounded-xl border border-[#dbeafe] bg-white px-3 py-2 text-xs"><span className="font-semibold text-[#5b6f99]">Saldo tersedia</span><span className={cn('font-extrabold tnum', selectedWallet.saldo >= 0 ? 'text-[#047857]' : 'text-[#be123c]')}>{formatIDR(selectedWallet.saldo)}</span></div>}</div>

            {insufficientBalance && <div className="flex gap-2 rounded-xl border border-[#fda4af] bg-[#fff1f2] px-3 py-2.5 text-xs font-bold leading-relaxed text-[#be123c]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />Nominal pengeluaran melebihi saldo dompet yang dipilih.</div>}
            {!hasApiUrl() && <div className="flex gap-2 rounded-xl border border-[#fcd34d] bg-[#fffbeb] px-3 py-2.5 text-xs font-bold leading-relaxed text-[#b45309]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />Koneksi Apps Script belum diatur. Hubungkan melalui Pengaturan sebelum menyimpan.</div>}
          </div>

          <SheetFooter className="border-t border-[#e7eef9] bg-white px-6 py-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="h-11 rounded-xl border-[#dbeafe] bg-[#f1f5fb] font-extrabold text-[#172554] hover:bg-[#e0f2fe]">Batal</Button><Button type="submit" disabled={!valid || submitting} className="h-11 gap-2 rounded-xl bg-[#2563eb] font-extrabold text-white shadow-[0_7px_15px_rgba(37,99,235,0.2)] hover:bg-[#1d4ed8]">{submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><CheckCircle2 className="h-4 w-4" /> Simpan</>}</Button></SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function guessCategory(description: string, type: TransactionType): string {
  if (type === 'Pemasukan') {
    const value = description.toLowerCase();
    if (value.includes('gaji')) return 'Gaji';
    if (value.includes('freelance')) return 'Freelance';
    if (value.includes('jual') || value.includes('penjualan')) return 'Penjualan';
    return 'Pemasukan';
  }
  const value = description.toLowerCase();
  if (value.includes('makan') || value.includes('kopi') || value.includes('resto')) return 'Makan & Minum';
  if (value.includes('gojek') || value.includes('bensin') || value.includes('transport')) return 'Transportasi';
  if (value.includes('belanja') || value.includes('supermarket')) return 'Belanja';
  if (value.includes('listrik') || value.includes('internet') || value.includes('tagihan')) return 'Tagihan & Utilitas';
  return 'Lainnya';
}
