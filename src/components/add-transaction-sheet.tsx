import { useEffect, useMemo, useRef, useState } from 'react';
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
  Search,
  Send,
  Sparkles,
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
import { fetchSubkategori, type Subkategori } from '@/lib/data';
import { categorizeDescription, labelSumber, type SaranKategori } from '@/lib/categorize';
import { guessCategory, suggestSubkategori } from '@/lib/subkategori-suggest';

/** Subkategori sistem tidak dipilih manual: dicatat otomatis oleh aplikasi/trigger. */
const SYSTEM_SUBKATEGORI = new Set(['Penyesuaian Saldo', 'Biaya Admin']);

/** Jeda setelah user berhenti mengetik sebelum saran AI diminta. */
const SARAN_DEBOUNCE_MS = 700;

/** Pilihan nominal cepat di form transfer: nilai dan label tampilannya. */
const NOMINAL_CEPAT: { nilai: number; label: string }[] = [
  { nilai: 100_000, label: 'Rp 100rb' },
  { nilai: 250_000, label: 'Rp 250rb' },
  { nilai: 500_000, label: 'Rp 500rb' },
  { nilai: 1_000_000, label: 'Rp 1jt' },
];

export type SheetTab = TransactionType | 'Transfer';

/** Isian awal untuk transaksi baru, misalnya dari catat cepat yang ingin diedit dulu. */
export interface TxDraft {
  tanggal: string;
  deskripsi: string;
  tipe: TransactionType;
  nominal: number;
  walletId: string;
}

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
  /** Isian awal untuk transaksi baru. Diabaikan saat mode edit. */
  draft?: TxDraft | null;
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
    subkategoriId?: string | null;
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
      subkategoriId?: string | null;
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

interface SaranState {
  desc: string;
  tab: string;
  hasil: SaranKategori | null;
  loading: boolean;
}

export function AddTransactionSheet({
  open,
  onOpenChange,
  wallets,
  onSubmitted,
  initialTab = 'Pemasukan',
  lockTab = false,
  editing = null,
  draft = null,
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
  const [subkategoriList, setSubkategoriList] = useState<Subkategori[]>([]);
  /** Kosong = otomatis dari deskripsi. Terisi = pilihan manual user. */
  const [subkategoriId, setSubkategoriId] = useState('');
  const [subQuery, setSubQuery] = useState('');
  const [saran, setSaran] = useState<SaranState | null>(null);
  /** Cache per jenis + deskripsi, supaya deskripsi yang sama tidak meminta AI dua kali. */
  const saranCache = useRef(new Map<string, SaranKategori | null>());

  // Transfer state
  const [fromWallet, setFromWallet] = useState('');
  const [toWallet, setToWallet] = useState('');
  const [biayaAdmin, setBiayaAdmin] = useState('');
  const [catatan, setCatatan] = useState('');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubQuery('');
    if (editing) {
      setTab(editing.tipe);
      setTanggal(editing.tanggal);
      setDeskripsi(editing.deskripsi);
      setNominal(String(editing.nominal));
      setDompet(editing.walletId ?? wallets[0]?.id ?? '');
      setBerulang(editing.berulang ?? false);
      setSubkategoriId(editing.subkategoriId ?? '');
    } else {
      setTab(initialTab);
      setTanggal(draft?.tanggal ?? toISODate());
      setDeskripsi(draft?.deskripsi ?? '');
      setNominal(draft ? String(draft.nominal) : '');
      setBerulang(false);
      setSubkategoriId('');
      setDompet(draft?.walletId || (wallets[0]?.id ?? ''));
      setFromWallet(wallets[0]?.id ?? '');
      setToWallet(wallets[1]?.id ?? '');
      setBiayaAdmin('');
      setCatatan('');
      setSaran(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, initialTab, draft]);

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

  // Daftar subkategori dari database, sesuai jenis transaksi tab aktif.
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetchSubkategori().then((list) => {
      if (active) setSubkategoriList(list);
    });
    return () => {
      active = false;
    };
  }, [open]);

  const subOptions = useMemo(
    () => subkategoriList.filter((s) => s.jenis === tab && !SYSTEM_SUBKATEGORI.has(s.nama)),
    [subkategoriList, tab],
  );

  // Saran AI bertingkat (riwayat, kata kunci, lalu Gemini). Diminta setelah user berhenti mengetik,
  // dan hanya kalau user belum memilih subkategori manual.
  const descKey = deskripsi.trim().toLowerCase();
  useEffect(() => {
    if (!open || editing || isTransfer || subkategoriId) return;
    if (descKey.length < 3) {
      setSaran(null);
      return;
    }
    const key = `${tab}|${descKey}`;
    if (saranCache.current.has(key)) {
      setSaran({ desc: descKey, tab, hasil: saranCache.current.get(key) ?? null, loading: false });
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      setSaran({ desc: descKey, tab, hasil: null, loading: true });
      const { saran: hasil, error } = await categorizeDescription(deskripsi.trim(), tab as TransactionType);
      if (error) toast.error('Saran kategori gagal', { description: error });
      saranCache.current.set(key, hasil);
      if (active) setSaran({ desc: descKey, tab, hasil, loading: false });
    }, SARAN_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, isTransfer, subkategoriId, descKey, tab]);

  // Saran dari server hanya dipakai kalau masih untuk deskripsi dan jenis yang sedang diketik.
  const saranAktif = saran && saran.desc === descKey && saran.tab === tab ? saran : null;
  const saranSub = saranAktif && !saranAktif.loading && saranAktif.hasil
    ? subOptions.find((s) => s.id === saranAktif.hasil?.subkategoriId)
    : undefined;
  const sumberSaran = saranSub && saranAktif?.hasil ? saranAktif.hasil.sumber : undefined;

  // Saran lokal (nama subkategori muncul di deskripsi) dipakai sebagai pratinjau sambil menunggu server.
  const autoLokal = useMemo(
    () => (isTransfer ? undefined : suggestSubkategori(subOptions, deskripsi, tab as TransactionType)),
    [subOptions, deskripsi, tab, isTransfer],
  );

  const manualSub = subOptions.find((s) => s.id === subkategoriId);
  const selectedSub = manualSub ?? saranSub ?? autoLokal;
  const effectiveSubId = selectedSub?.id ?? '';

  const category = isTransfer ? 'Transfer' : (selectedSub?.kategori ?? guessCategory(deskripsi, tab as TransactionType));
  const valid = editing
    ? numeric > 0 && dompet.length > 0 && !insufficientBalance && Boolean(effectiveSubId)
    : isTransfer
      ? !invalidTransfer
      : deskripsi.trim().length > 0 && numeric > 0 && dompet.length > 0 && !insufficientBalance && Boolean(effectiveSubId);

  // Daftar pilihan manual, dengan pencarian nama atau kategori induk.
  const subKeyword = subQuery.trim().toLowerCase();
  const subFiltered = subKeyword
    ? subOptions.filter((s) => s.nama.toLowerCase().includes(subKeyword) || s.kategori.toLowerCase().includes(subKeyword))
    : subOptions;

  const sedangMenganalisis = Boolean(saranAktif?.loading) && !manualSub;

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
        subkategoriId: effectiveSubId || null,
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
        subkategoriId: effectiveSubId || null,
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
      <SheetContent side="right" className="flex h-dvh w-full flex-col gap-0 border-border bg-popover p-0 shadow-[-14px_0_35px_rgba(0,0,0,0.45)] sm:max-w-[440px]">
        <SheetHeader className="shrink-0 border-b border-border bg-card py-5 pl-5 pr-14 text-left sm:px-6 sm:pr-14">
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          <div className="flex-1 space-y-5 px-5 py-6 sm:px-6">
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
                  <div className="flex flex-wrap gap-2 pt-1" role="group" aria-label="Nominal cepat">
                    {NOMINAL_CEPAT.map((opsi) => (
                      <button
                        key={opsi.nilai}
                        type="button"
                        onClick={() => setNominal(String(opsi.nilai))}
                        aria-pressed={numeric === opsi.nilai}
                        className={cn(
                          'h-9 rounded-full border px-3 text-xs font-bold transition-colors',
                          numeric === opsi.nilai
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-card text-foreground hover:bg-muted',
                        )}
                      >
                        {opsi.label}
                      </button>
                    ))}
                  </div>
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
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-sm font-extrabold text-foreground">Subkategori (opsional)</Label>
                    {manualSub ? (
                      <button type="button" onClick={() => setSubkategoriId('')} className="text-xs font-bold text-primary underline-offset-2 hover:underline">
                        Kembali ke otomatis
                      </button>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary" aria-live="polite">
                    {sedangMenganalisis ? (
                      <><Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /><span>Menganalisis deskripsi...</span></>
                    ) : manualSub ? (
                      <><Tags className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 truncate">Dipilih manual: {manualSub.nama}</span></>
                    ) : saranSub && sumberSaran ? (
                      <><Sparkles className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 truncate">Saran {labelSumber(sumberSaran)}: {saranSub.nama}</span></>
                    ) : autoLokal ? (
                      <><Tags className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 truncate">Cocok dengan nama: {autoLokal.nama}</span></>
                    ) : (
                      <><Tags className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 truncate">Tulis deskripsi atau pilih subkategori di bawah</span></>
                    )}
                  </div>

                  <div className="rounded-xl border border-border bg-card p-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                      <Input
                        value={subQuery}
                        onChange={(e) => setSubQuery(e.target.value)}
                        placeholder="Cari subkategori..."
                        aria-label="Cari subkategori"
                        className="h-10 rounded-lg border-border bg-background pl-9 font-medium text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                    <ul role="listbox" aria-label="Pilihan subkategori" className="mt-2 max-h-52 space-y-0.5 overflow-y-auto overscroll-contain">
                      {subFiltered.length === 0 ? (
                        <li className="px-2 py-3 text-center text-xs font-semibold text-muted-foreground">Subkategori tidak ditemukan.</li>
                      ) : (
                        subFiltered.map((s) => {
                          const active = s.id === effectiveSubId;
                          return (
                            <li key={s.id}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={active}
                                onClick={() => setSubkategoriId(s.id)}
                                className={cn(
                                  'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                                  active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                                )}
                              >
                                <span className="min-w-0 truncate font-semibold">{s.nama}</span>
                                <span className={cn('shrink-0 text-[11px] font-medium', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{s.kategori}</span>
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
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

          <SheetFooter className="sticky bottom-0 mt-auto shrink-0 flex-row flex-wrap items-center justify-end gap-2 border-t border-border bg-card px-5 pt-4 pb-[max(4rem,env(safe-area-inset-bottom))] sm:px-6">
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
