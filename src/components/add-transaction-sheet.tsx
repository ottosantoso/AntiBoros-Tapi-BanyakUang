import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Loader2,
  PlusCircle,
  Repeat,
  Send,
  Tags,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { toISODate, formatIDR } from '@/lib/format';
import type { Transaction, TransactionType, Wallet } from '@/lib/types';

export type SheetTab = TransactionType | 'Transfer';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Wallet[];
  onSubmitted: () => void;
  /** Pre-select a tab when opening. */
  initialTab?: SheetTab;
  /** Form khusus satu jenis: tab Jenis disembunyikan, jenis mengikuti initialTab. */
  lockTab?: boolean;
  /** When set, the sheet edits this transaction instead of creating one. */
  editing?: Transaction | null;
  /** Dipakai untuk peringatan duplikat saat menambah transaksi (tidak memblokir simpan). */
  existingTransactions?: Transaction[];
  /** Jika diisi (mode edit), footer menampilkan tombol Hapus. */
  onDelete?: () => void;
}

export interface TxActions {
  addTransaction: (input: {
    tanggal: string;
    deskripsi: string;
    tipe: TransactionType;
    nominal: number;
    walletId: string;
    kategori?: string;
    berulang?: boolean;
  }) => Promise<{ success: boolean; error: string | null }>;
  editTransaction: (
    id: string,
    input: {
      tanggal?: string;
      deskripsi?: string;
      tipe?: TransactionType;
      nominal?: number;
      walletId?: string;
      kategori?: string;
      berulang?: boolean;
    },
  ) => Promise<{ success: boolean; error: string | null }>;
  addTransfer: (input: {
    tanggal: string;
    fromWalletId: string;
    toWalletId: string;
    nominal: number;
    biayaAdmin?: number;
    catatan?: string;
  }) => Promise<{ success: boolean; error: string | null }>;
}

export function AddTransactionSheet({
  open,
  onOpenChange,
  wallets,
  onSubmitted,
  initialTab = 'Pemasukan',
  lockTab = false,
  editing = null,
  existingTransactions = [],
  onDelete,
  addTransaction,
  editTransaction,
  addTransfer,
}: Props & TxActions) {
  const [tab, setTab] = useState<SheetTab>(initialTab);
  const [tanggal, setTanggal] = useState(toISODate());
  const [deskripsi, setDeskripsi] = useState('');
  const [nominal, setNominal] = useState('');
  const [dompet, setDompet] = useState('');
  const [berulang, setBerulang] = useState(false);

  // Transfer state
  const [fromWallet, setFromWallet] = useState('');
  const [toWallet, setToWallet] = useState('');
  const [biayaAdmin, setBiayaAdmin] = useState('');
  const [catatan, setCatatan] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTab(editing.tipe);
      setTanggal(editing.tanggal);
      setDeskripsi(editing.deskripsi);
      setNominal(String(editing.nominal));
      setDompet(editing.walletId ?? wallets[0]?.id ?? '');
      setBerulang(editing.berulang ?? false);
    } else {
      setTab(initialTab);
      setTanggal(toISODate());
      setDeskripsi('');
      setNominal('');
      setBerulang(false);
      setDompet(wallets[0]?.id ?? '');
      setFromWallet(wallets[0]?.id ?? '');
      setToWallet(wallets[1]?.id ?? '');
      setBiayaAdmin('');
      setCatatan('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, initialTab]);

  useEffect(() => {
    if (open && wallets.length && !wallets.some((w) => w.id === dompet)) setDompet(wallets[0].id);
  }, [dompet, open, wallets]);

  const numeric = Number(nominal.replace(/[^0-9]/g, '')) || 0;
  const adminNumeric = Number(biayaAdmin.replace(/[^0-9]/g, '')) || 0;
  const selectedWallet = useMemo(() => wallets.find((w) => w.id === dompet), [dompet, wallets]);
  const fromSelected = useMemo(() => wallets.find((w) => w.id === fromWallet), [fromWallet, wallets]);
  const isTransfer = tab === 'Transfer';

  const insufficientBalance =
    tab === 'Pengeluaran' && Boolean(selectedWallet) && numeric > (selectedWallet?.saldo ?? 0);
  const invalidTransfer =
    isTransfer &&
    (!fromWallet || !toWallet || fromWallet === toWallet || numeric <= 0 || numeric + adminNumeric > (fromSelected?.saldo ?? 0));

  const category = isTransfer ? 'Transfer' : guessCategory(deskripsi, tab);
  const valid = editing
    ? numeric > 0 && dompet.length > 0 && !insufficientBalance
    : isTransfer
      ? !invalidTransfer
      : deskripsi.trim().length > 0 && numeric > 0 && dompet.length > 0 && !insufficientBalance;

  // Peringatan duplikat: transaksi dengan tanggal, deskripsi, nominal, dan dompet yang sama.
  const possibleDuplicate = useMemo(() => {
    if (editing || isTransfer || !deskripsi.trim() || numeric <= 0 || !dompet) return undefined;
    const desc = deskripsi.trim().toLowerCase();
    return existingTransactions.find(
      (t) => t.tanggal === tanggal && t.nominal === numeric && t.deskripsi.trim().toLowerCase() === desc && t.walletId === dompet,
    );
  }, [editing, isTransfer, deskripsi, numeric, dompet, tanggal, existingTransactions]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    let result: { success: boolean; error: string | null };
    if (editing) {
      result = await editTransaction(editing.id!, {
        tanggal,
        deskripsi: deskripsi.trim(),
        tipe: tab as TransactionType,
        nominal: numeric,
        walletId: dompet,
        kategori: category,
        berulang,
      });
    } else if (isTransfer) {
      result = await addTransfer({
        tanggal,
        fromWalletId: fromWallet,
        toWalletId: toWallet,
        nominal: numeric,
        biayaAdmin: adminNumeric,
        catatan: catatan.trim() || undefined,
      });
    } else {
      result = await addTransaction({
        tanggal,
        deskripsi: deskripsi.trim(),
        tipe: tab as TransactionType,
        nominal: numeric,
        walletId: dompet,
        kategori: category,
        berulang,
      });
    }
    setSubmitting(false);
    if (result.success) {
      toast.success(editing ? 'Transaksi diperbarui' : 'Transaksi tersimpan', {
        description: isTransfer && !editing
          ? `Transfer ${formatIDR(numeric)} — saldo dompet sudah diperbarui`
          : `${editing ? tab : tab} ${formatIDR(numeric)}${isTransfer && adminNumeric > 0 ? ' (plus biaya admin)' : ''}`,
      });
      onOpenChange(false);
      onSubmitted();
    } else {
      toast.error('Gagal menyimpan', { description: result.error ?? 'Periksa koneksi database Anda.' });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-border bg-popover p-0 shadow-[-14px_0_35px_rgba(0,0,0,0.45)] sm:max-w-[440px]">
        <SheetHeader className="border-b border-border bg-card px-6 py-5 text-left">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_0_18px_rgba(59,130,246,0.4)]">
              <PlusCircle className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <div>
              <SheetTitle className="font-display text-xl font-extrabold tracking-[-0.04em] text-foreground">
                {editing ? 'Edit Transaksi' : lockTab ? `Catat ${initialTab}` : 'Tambah Transaksi'}
              </SheetTitle>
              <SheetDescription className="mt-1 text-xs font-semibold text-muted-foreground">
                {editing ? 'Ubah detail transaksi — saldo dompet ikut disesuaikan otomatis.' : lockTab ? 'Saldo dompet diperbarui otomatis setelah disimpan.' : 'Catat pemasukan, pengeluaran, atau transfer antar-dompet.'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-5 px-6 py-6">
            {!editing && !lockTab && (
              <div>
                <Label className="mb-2 block text-sm font-extrabold text-foreground">Jenis</Label>
                <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1">
                  <TabButton active={tab === 'Pemasukan'} onClick={() => setTab('Pemasukan')} activeClass="bg-emerald-500 text-white shadow-[0_5px_12px_rgba(16,185,129,0.3)]">
                    <ArrowUpRight className="h-4 w-4" /> Pemasukan
                  </TabButton>
                  <TabButton active={tab === 'Pengeluaran'} onClick={() => setTab('Pengeluaran')} activeClass="bg-rose-500 text-white shadow-[0_5px_12px_rgba(244,63,94,0.3)]">
                    <ArrowDownLeft className="h-4 w-4" /> Pengeluaran
                  </TabButton>
                  <TabButton active={tab === 'Transfer'} onClick={() => setTab('Transfer')} activeClass="bg-violet-500 text-white shadow-[0_5px_12px_rgba(139,92,246,0.3)]">
                    <ArrowLeftRight className="h-4 w-4" /> Transfer
                  </TabButton>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tx-date" className="text-sm font-extrabold text-foreground">Tanggal</Label>
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
                <Input id="tx-date" type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} className="h-11 rounded-xl border-border bg-card pl-10 font-bold text-foreground" required />
              </div>
            </div>

            {isTransfer ? (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-extrabold text-foreground">Dari dompet</Label>
                  <Select value={fromWallet} onValueChange={setFromWallet}>
                    <SelectTrigger className="h-11 rounded-xl border-border bg-card font-bold text-foreground">
                      <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-primary" /><SelectValue placeholder="Pilih dompet asal" /></div>
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.nama}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {fromSelected && (
                    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
                      <span className="font-semibold text-muted-foreground">Saldo dompet asal</span>
                      <span className={cn('font-extrabold tnum', fromSelected.saldo >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{formatIDR(fromSelected.saldo)}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-extrabold text-foreground">Ke dompet</Label>
                  <Select value={toWallet} onValueChange={setToWallet}>
                    <SelectTrigger className="h-11 rounded-xl border-border bg-card font-bold text-foreground">
                      <div className="flex items-center gap-2"><Send className="h-4 w-4 text-violet-300" /><SelectValue placeholder="Pilih dompet tujuan" /></div>
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.filter((w) => w.id !== fromWallet).map((w) => <SelectItem key={w.id} value={w.id}>{w.nama}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tx-nominal-tf" className="text-sm font-extrabold text-foreground">Nominal (Rp)</Label>
                  <NumberInput id="tx-nominal-tf" value={nominal} numeric={numeric} onChange={setNominal} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tx-admin" className="text-sm font-extrabold text-foreground">Biaya admin (opsional)</Label>
                  <NumberInput id="tx-admin" value={biayaAdmin} numeric={adminNumeric} onChange={setBiayaAdmin} />
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Biaya admin otomatis tercatat sebagai pengeluaran kategori "Biaya Admin".
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tx-note" className="text-sm font-extrabold text-foreground">Catatan (opsional)</Label>
                  <Input id="tx-note" placeholder="cth. Pindahkan tabungan" value={catatan} onChange={(e) => setCatatan(e.target.value)} maxLength={80} className="h-11 rounded-xl border-border bg-card font-medium text-foreground placeholder:text-muted-foreground" />
                </div>

                {fromWallet === toWallet && fromWallet && (
                  <WarningBox>Dompet asal dan tujuan tidak boleh sama.</WarningBox>
                )}
                {fromSelected && numeric + adminNumeric > fromSelected.saldo && (
                  <WarningBox>Nominal + biaya admin melebihi saldo dompet asal ({formatIDR(fromSelected.saldo)}).</WarningBox>
                )}
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="tx-desc" className="text-sm font-extrabold text-foreground">Deskripsi</Label>
                  <Input id="tx-desc" placeholder="cth. Belanja bulanan, Gaji, Kopi..." value={deskripsi} onChange={(e) => setDeskripsi(e.target.value)} maxLength={80} className="h-11 rounded-xl border-border bg-card font-medium text-foreground placeholder:text-muted-foreground" required />
                  <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
                    <Tags className="h-3.5 w-3.5" />Kategori otomatis: <span>{category}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tx-nominal" className="text-sm font-extrabold text-foreground">Nominal (Rp)</Label>
                  <NumberInput id="tx-nominal" value={nominal} numeric={numeric} onChange={setNominal} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-extrabold text-foreground">{tab === 'Pemasukan' ? 'Dompet tujuan dana' : 'Dompet sumber dana'}</Label>
                  <Select value={dompet} onValueChange={setDompet}>
                    <SelectTrigger className="h-11 rounded-xl border-border bg-card font-bold text-foreground">
                      <div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-primary" /><SelectValue placeholder="Pilih dompet" /></div>
                    </SelectTrigger>
                    <SelectContent>
                      {wallets.length === 0 ? <SelectItem value="_none" disabled>Belum ada dompet</SelectItem> : wallets.map((w) => <SelectItem key={w.id} value={w.id}>{w.nama}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {selectedWallet && (
                    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-xs">
                      <span className="font-semibold text-muted-foreground">Saldo tersedia</span>
                      <span className={cn('font-extrabold tnum', selectedWallet.saldo >= 0 ? 'text-emerald-300' : 'text-rose-300')}>{formatIDR(selectedWallet.saldo)}</span>
                    </div>
                  )}
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-3 py-3">
                  <input type="checkbox" checked={berulang} onChange={(e) => setBerulang(e.target.checked)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                  <span className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <Repeat className="h-4 w-4 text-primary" /> Transaksi berulang (gaji, tagihan, cicilan)
                  </span>
                </label>

                {insufficientBalance && <WarningBox>Nominal pengeluaran melebihi saldo dompet yang dipilih.</WarningBox>}
                {possibleDuplicate && (
                  <div className="flex gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5 text-xs font-bold leading-relaxed text-amber-700 dark:text-amber-300">
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Mirip dengan transaksi yang sudah ada ({possibleDuplicate.deskripsi}, {formatIDR(possibleDuplicate.nominal)}, {possibleDuplicate.tanggal}). Tetap bisa disimpan jika memang transaksi baru.</span>
                  </div>
                )}
              </>
            )}
          </div>

          <SheetFooter className="border-t border-border bg-card px-6 py-4">
            {editing && onDelete && (
              <Button type="button" variant="outline" onClick={onDelete} disabled={submitting} className="mr-auto h-11 gap-2 rounded-xl border-rose-400/40 font-extrabold text-rose-600 hover:bg-rose-500/10 hover:text-rose-600">
                <Trash2 className="h-4 w-4" /> Hapus
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="h-11 rounded-xl border-border bg-muted font-extrabold text-foreground hover:bg-accent/40">
              Batal
            </Button>
            <Button type="submit" disabled={!valid || submitting} className="h-11 gap-2 rounded-xl bg-primary font-extrabold text-primary-foreground shadow-[0_7px_15px_rgba(59,130,246,0.3)] hover:bg-primary/90">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...</> : <><CheckCircle2 className="h-4 w-4" /> Simpan</>}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function TabButton({ active, onClick, activeClass, children }: { active: boolean; onClick: () => void; activeClass: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-[13px] font-extrabold transition-all',
        active ? activeClass : 'text-muted-foreground hover:bg-card hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

function NumberInput({ id, value, numeric, onChange }: { id: string; value: string; numeric: number; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-muted-foreground">Rp</span>
      <Input
        id={id}
        inputMode="numeric"
        placeholder="0"
        value={value ? new Intl.NumberFormat('id-ID').format(numeric) : ''}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        className="h-11 rounded-xl border-border bg-card pl-10 font-bold tnum text-foreground"
        required
      />
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2.5 text-xs font-bold leading-relaxed text-rose-300">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />{children}
    </div>
  );
}

export function guessCategory(description: string, type: TransactionType): string {
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
