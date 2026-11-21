import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  ScanLine,
  UploadCloud,
  ReceiptText,
  FileSpreadsheet,
  Sparkles,
  Loader2,
  RotateCcw,
  Trash2,
  Check,
  Save,
  Image as ImageIcon,
  ArrowDownLeft,
  ArrowUpRight,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
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
import { formatIDR, toISODate } from '@/lib/format';
import { scanImage } from '@/lib/api';
import {
  fetchSubkategori,
  insertTransaction,
  insertTransactions,
  matchSubkategori,
  type Subkategori,
} from '@/lib/data';
import type {
  ImageType,
  ScanItem,
  ScanResult,
  ScanRow,
  TransactionType,
  Wallet,
} from '@/lib/types';

type Phase = 'upload' | 'scanning' | 'review';

/** Satu barang di struk yang bisa dicentang sebelum disimpan. */
interface StrukItem extends ScanItem {
  id: number;
  selected: boolean;
}

interface Props {
  wallets: Wallet[];
  onSaved: () => void;
}

export function ScannerView({ wallets, onSaved }: Props) {
  const [phase, setPhase] = useState<Phase>('upload');
  const [imageType, setImageType] = useState<ImageType>('struk');
  const [preview, setPreview] = useState<string | null>(null);
  const [base64, setBase64] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  // Receipt review state
  const [receipt, setReceipt] = useState({
    tanggal: toISODate(),
    deskripsi: '',
    nominal: '',
    kategori: 'Lainnya',
    jenis: 'Pengeluaran' as TransactionType,
  });
  // Mutasi review state
  const [rows, setRows] = useState<ScanRow[]>([]);
  // Rincian barang struk (bisa dicentang per item)
  const [strukItems, setStrukItems] = useState<StrukItem[]>([]);
  const [subkategoriList, setSubkategoriList] = useState<Subkategori[]>([]);

  useEffect(() => {
    fetchSubkategori().then(setSubkategoriList);
  }, []);
  const [rowWallet, setRowWallet] = useState(wallets[0]?.nama ?? '');
  const [receiptWallet, setReceiptWallet] = useState(wallets[0]?.nama ?? '');

  const onDrop = useCallback((accepted: File[]) => {
    const file = accepted[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      setPreview(dataUrl);
      // strip the data:image/...;base64, prefix → raw base64 for the API
      const raw = dataUrl.includes(',') ? dataUrl.split(',')[1] ?? '' : dataUrl;
      setBase64(raw);
    };
    reader.onerror = () => setError('Gagal membaca file. Coba gambar lain.');
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open: openPicker } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] },
    multiple: false,
    noClick: true,
    noKeyboard: true,
  });

  function reset() {
    setPhase('upload');
    setPreview(null);
    setBase64('');
    setFileName('');
    setError(null);
    setResult(null);
    setReceipt({
      tanggal: toISODate(),
      deskripsi: '',
      nominal: '',
      kategori: 'Lainnya',
      jenis: 'Pengeluaran',
    });
    setRows([]);
    setStrukItems([]);
  }

  function applyResult(data: ScanResult) {
    setResult(data);
    if (data.imageType === 'struk') {
      setReceipt({
        tanggal: data.tanggal,
        deskripsi: data.deskripsi,
        nominal: String(data.nominal),
        kategori: data.kategori,
        jenis: data.jenis,
      });
      // Kalau AI membaca rincian barang, pakai daftar item yang bisa dipilih.
      setStrukItems(
        (data.items ?? []).map((it, i) => ({ ...it, id: i, selected: true })),
      );
    } else {
      setRows(data.transaksi.length ? data.transaksi : []);
    }
    setPhase('review');
  }

  async function handleScan() {
    if (!base64) {
      setError('Unggah gambar terlebih dahulu.');
      return;
    }
    setError(null);
    setPhase('scanning');
    const res = await scanImage({ action: 'scanImage', imageType, imageBase64: base64 });
    if (res.success && res.data) {
      toast.success('Pindai selesai', {
        description: res.data.imageType === 'struk' ? 'Data struk berhasil dibaca.' : `${res.data.transaksi.length} transaksi terbaca.`,
      });
      applyResult(res.data);
    } else {
      setError(res.error ?? 'Gagal memindai dokumen.');
      setPhase('upload');
      toast.error('Pindai gagal', { description: res.error ?? undefined });
    }
  }

  /* ---------- struk item helpers ---------- */
  function updateStrukItem(id: number, patch: Partial<StrukItem>) {
    setStrukItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function setAllStrukItems(selected: boolean) {
    setStrukItems((prev) => prev.map((it) => ({ ...it, selected })));
  }

  /* ---------- mutasi row helpers ---------- */
  function updateRow(idx: number, patch: Partial<ScanRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }
  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }
  function addEmptyRow() {
    setRows((prev) => [
      ...prev,
      { tanggal: toISODate(), deskripsi: '', nominal: 0, jenis: 'Pengeluaran', kategori: 'Lainnya' },
    ]);
  }

  const receiptNumeric = Number(receipt.nominal.replace(/[^0-9]/g, '')) || 0;
  const receiptValid =
    receipt.deskripsi.trim().length > 0 && receiptNumeric > 0 && receiptWallet.length > 0;
  const strukSelected = strukItems.filter((it) => it.selected && it.nominal > 0 && it.nama.trim().length > 0);
  const strukItemsValid = strukSelected.length > 0 && receiptWallet.length > 0;
  const validRows = rows.filter(
    (r) => r.deskripsi.trim().length > 0 && r.nominal > 0,
  );
  const mutasiValid = validRows.length > 0 && rowWallet.length > 0;

  async function handleSave() {
    setSaving(true);
    let ok = 0;
    let fail = 0;

    // Pilihan dompet disimpan sebagai nama; tabel transactions memakai wallet_id.
    const idDompet = (nama: string) => wallets.find((w) => w.nama === nama)?.id ?? '';

    if (result?.imageType === 'struk' && strukItems.length > 0) {
      // Simpan hanya barang yang dicentang; satu transaksi per barang.
      const walletId = idDompet(receiptWallet);
      if (!strukItemsValid || !walletId) {
        setSaving(false);
        toast.error('Tidak ada item dipilih', { description: 'Centang minimal satu barang dan pilih dompet.' });
        return;
      }
      const r = await insertTransactions(
        strukSelected.map((it) => {
          const sub = matchSubkategori(subkategoriList, it.kategori, receipt.jenis);
          return {
            tanggal: receipt.tanggal,
            deskripsi: it.nama.trim(),
            tipe: receipt.jenis,
            nominal: it.nominal,
            walletId,
            kategori: sub?.kategori ?? it.kategori,
            subkategoriId: sub?.id ?? null,
          };
        }),
      );
      ok = r.saved;
      fail = strukSelected.length - r.saved;
      if (!r.success) toast.error('Gagal menyimpan', { description: r.error ?? undefined });
    } else if (result?.imageType === 'struk') {
      const walletId = idDompet(receiptWallet);
      if (!receiptValid || !walletId) {
        setSaving(false);
        toast.error('Data belum lengkap', { description: 'Periksa deskripsi, nominal, dan dompet.' });
        return;
      }
      // Kategori teks dari AI dipetakan ke subkategori yang ada (fallback 'Lain-lain').
      const sub = matchSubkategori(subkategoriList, receipt.kategori, receipt.jenis);
      const r = await insertTransaction({
        tanggal: receipt.tanggal,
        deskripsi: receipt.deskripsi.trim(),
        tipe: receipt.jenis,
        nominal: receiptNumeric,
        walletId,
        kategori: sub?.kategori ?? receipt.kategori,
        subkategoriId: sub?.id ?? null,
      });
      if (r.success) ok += 1;
      else fail += 1;
    } else if (result?.imageType === 'mutasi') {
      const walletId = idDompet(rowWallet);
      if (!mutasiValid || !walletId) {
        setSaving(false);
        toast.error('Tidak ada baris valid', { description: 'Pastikan ada minimal satu transaksi lengkap dan dompet dipilih.' });
        return;
      }
      // Satu insert untuk seluruh baris mutasi, supaya tidak parsial per baris.
      const r = await insertTransactions(
        validRows.map((row) => {
          const sub = matchSubkategori(subkategoriList, row.kategori, row.jenis);
          return {
            tanggal: row.tanggal,
            deskripsi: row.deskripsi.trim(),
            tipe: row.jenis,
            nominal: row.nominal,
            walletId,
            kategori: sub?.kategori ?? row.kategori,
            subkategoriId: sub?.id ?? null,
          };
        }),
      );
      ok = r.saved;
      fail = validRows.length - r.saved;
      if (!r.success) toast.error('Gagal menyimpan', { description: r.error ?? undefined });
    }

    setSaving(false);
    if (ok > 0 && fail === 0) {
      toast.success('Tersimpan ke database', { description: `${ok} transaksi berhasil disimpan.` });
      onSaved();
      reset();
    } else if (ok > 0 && fail > 0) {
      toast.warning('Sebagian tersimpan', { description: `${ok} berhasil, ${fail} gagal.` });
      onSaved();
    } else {
      toast.error('Gagal menyimpan', { description: 'Tidak ada transaksi yang tersimpan.' });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Header card */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-primary/10 via-balance-soft to-savings-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
              <ScanLine className="h-6 w-6" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">AI Smart Scanner</h2>
              <p className="text-sm text-muted-foreground">
                Pindai struk atau mutasi, periksa, lalu simpan.
              </p>
            </div>
          </div>
          <Stepper phase={phase} />
        </div>
      </Card>

      {error && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="shrink-0 rounded-md p-0.5 hover:bg-destructive/15">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* UPLOAD PHASE */}
      {phase === 'upload' && (
        <Card className="p-5 sm:p-6">
          {/* image type selector */}
          <div className="space-y-2">
            <Label>Jenis Dokumen</Label>
            <div className="grid grid-cols-2 gap-3">
              <TypeCard
                active={imageType === 'struk'}
                onClick={() => setImageType('struk')}
                icon={<ReceiptText className="h-5 w-5" />}
                label="Struk (Receipt)"
                desc="Nota belanja, restoran"
              />
              <TypeCard
                active={imageType === 'mutasi'}
                onClick={() => setImageType('mutasi')}
                icon={<FileSpreadsheet className="h-5 w-5" />}
                label="Mutasi (Bank Statement)"
                desc="Rekening / e-wallet"
              />
            </div>
          </div>

          {/* dropzone */}
          <div
            {...getRootProps()}
            className={cn(
              'mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all',
              isDragActive
                ? 'border-primary bg-primary/10'
                : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50',
            )}
            onClick={openPicker}
          >
            <input {...getInputProps()} />
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UploadCloud className="h-7 w-7" strokeWidth={2} />
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground">
              {isDragActive ? 'Lepaskan untuk unggah' : 'Seret & lepas gambar di sini'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              atau klik untuk memilih file · JPG, PNG, WEBP
            </p>
          </div>

          {preview && (
            <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="relative overflow-hidden rounded-xl border border-border bg-muted/40">
                <img src={preview} alt="Pratinjau" className="max-h-56 w-auto object-contain" />
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate font-medium text-foreground">{fileName}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Gambar siap dipindai sebagai{' '}
                  <span className="font-semibold text-foreground">
                    {imageType === 'struk' ? 'Struk (Receipt)' : 'Mutasi (Bank Statement)'}
                  </span>
                  . Klik tombol di bawah untuk memulai analisis AI.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleScan} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Pindai dengan AI
                  </Button>
                  <Button variant="outline" onClick={reset} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Ganti
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* SCANNING PHASE */}
      {phase === 'scanning' && (
        <Card className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="relative grid h-20 w-20 place-items-center">
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/30" />
            <span className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20" style={{ animationDelay: '0.6s' }} />
            <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="h-8 w-8" />
            </div>
          </div>
          <h3 className="mt-6 font-display text-lg font-bold tracking-tight">
            AI sedang menganalisis dokumen Anda...
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Sedang membaca teks dan angka dari {imageType === 'struk' ? 'struk' : 'mutasi'} Anda. Mohon tunggu sebentar.
          </p>
          {preview && (
            <img
              src={preview}
              alt="Sedang dipindai"
              className="mt-6 max-h-32 rounded-xl border border-border object-contain opacity-60"
            />
          )}
        </Card>
      )}

      {/* REVIEW PHASE */}
      {phase === 'review' && result && (
        <div className="space-y-5">
          <Card className="flex items-center justify-between gap-3 border-income/30 bg-income-soft p-4">
            <div className="flex items-center gap-2 text-income">
              <Check className="h-5 w-5" />
              <span className="text-sm font-semibold">Pindai selesai — periksa & edit sebelum menyimpan.</span>
            </div>
            <Button variant="ghost" size="sm" onClick={reset} className="gap-2 text-income hover:bg-income/10">
              <RotateCcw className="h-4 w-4" /> Pindai ulang
            </Button>
          </Card>

          {result.imageType === 'struk' && strukItems.length > 0 ? (
            <StrukItemsReview
              items={strukItems}
              total={result.nominal}
              tanggal={receipt.tanggal}
              jenis={receipt.jenis}
              onTanggalChange={(tanggal) => setReceipt((prev) => ({ ...prev, tanggal }))}
              onJenisChange={(jenis) => setReceipt((prev) => ({ ...prev, jenis }))}
              wallets={wallets}
              wallet={receiptWallet}
              onWalletChange={setReceiptWallet}
              onToggle={(id, selected) => updateStrukItem(id, { selected })}
              onUpdate={updateStrukItem}
              onSelectAll={setAllStrukItems}
            />
          ) : result.imageType === 'struk' ? (
            <ReceiptReview
              receipt={receipt}
              onChange={setReceipt}
              wallets={wallets}
              wallet={receiptWallet}
              onWalletChange={setReceiptWallet}
              numeric={receiptNumeric}
            />
          ) : (
            <MutasiReview
              rows={rows}
              onChange={updateRow}
              onRemove={removeRow}
              onAdd={addEmptyRow}
              wallets={wallets}
              wallet={rowWallet}
              onWalletChange={setRowWallet}
            />
          )}

          <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-background/90 p-3 shadow-lg backdrop-blur-xl">
            <div className="text-sm text-muted-foreground">
              {result.imageType === 'struk' ? (
                strukItems.length > 0 ? (
                  <>{strukSelected.length} dari {strukItems.length} item dipilih</>
                ) : (
                  <>1 transaksi siap disimpan</>
                )
              ) : (
                <>{validRows.length} dari {rows.length} baris valid</>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={reset}>
                Batal
              </Button>
              <Button
                onClick={handleSave}
                disabled={
                  saving ||
                  (result.imageType === 'struk'
                    ? strukItems.length > 0
                      ? !strukItemsValid
                      : !receiptValid
                    : !mutasiValid)
                }
                className="gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> Simpan ke Database
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- subcomponents ---------------- */

function Stepper({ phase }: { phase: Phase }) {
  const steps: { key: Phase; label: string }[] = [
    { key: 'upload', label: 'Unggah' },
    { key: 'scanning', label: 'Analisis' },
    { key: 'review', label: 'Periksa' },
  ];
  const activeIdx = steps.findIndex((s) => s.key === phase);
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1.5">
          <span
            className={cn(
              'grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold transition-colors',
              i <= activeIdx
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
          >
            {i < activeIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span
            className={cn(
              'hidden text-xs font-medium sm:inline',
              i <= activeIdx ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {s.label}
          </span>
          {i < steps.length - 1 && (
            <span className={cn('h-px w-4', i < activeIdx ? 'bg-primary' : 'bg-border')} />
          )}
        </div>
      ))}
    </div>
  );
}

function TypeCard({
  active,
  onClick,
  icon,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-3.5 text-left transition-all',
        active
          ? 'border-primary/50 bg-primary/10'
          : 'border-border bg-card hover:bg-accent',
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
          active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-sm font-semibold', active ? 'text-primary' : 'text-foreground')}>
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}

function NominalInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (raw: string) => void;
}) {
  const numeric = Number(value.replace(/[^0-9]/g, '')) || 0;
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
        Rp
      </span>
      <Input
        inputMode="numeric"
        value={value ? new Intl.NumberFormat('id-ID').format(numeric) : ''}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ''))}
        className="pl-10 tnum"
        placeholder="0"
      />
    </div>
  );
}

function TypeToggle({
  value,
  onChange,
}: {
  value: TransactionType;
  onChange: (t: TransactionType) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onChange('Pengeluaran')}
        className={cn(
          'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all',
          value === 'Pengeluaran'
            ? 'border-expense/50 bg-expense-soft text-expense'
            : 'border-border bg-card text-muted-foreground hover:bg-accent',
        )}
      >
        <ArrowUpRight className="h-4 w-4" /> Keluar
      </button>
      <button
        type="button"
        onClick={() => onChange('Pemasukan')}
        className={cn(
          'flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-all',
          value === 'Pemasukan'
            ? 'border-income/50 bg-income-soft text-income'
            : 'border-border bg-card text-muted-foreground hover:bg-accent',
        )}
      >
        <ArrowDownLeft className="h-4 w-4" /> Masuk
      </button>
    </div>
  );
}

function StrukItemsReview({
  items,
  total,
  tanggal,
  jenis,
  onTanggalChange,
  onJenisChange,
  wallets,
  wallet,
  onWalletChange,
  onToggle,
  onUpdate,
  onSelectAll,
}: {
  items: StrukItem[];
  total: number;
  tanggal: string;
  jenis: TransactionType;
  onTanggalChange: (t: string) => void;
  onJenisChange: (j: TransactionType) => void;
  wallets: Wallet[];
  wallet: string;
  onWalletChange: (w: string) => void;
  onToggle: (id: number, selected: boolean) => void;
  onUpdate: (id: number, patch: Partial<StrukItem>) => void;
  onSelectAll: (selected: boolean) => void;
}) {
  const selected = items.filter((it) => it.selected);
  const selectedTotal = selected.reduce((s, it) => s + it.nominal, 0);
  const allSelected = selected.length === items.length;
  // Hanya beri peringatan saat semua item dicentang, karena selisih wajar kalau ada item yang tidak dipilih.
  const mismatch = allSelected && total > 0 && selectedTotal !== total;

  return (
    <Card className="space-y-5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <ReceiptText className="h-5 w-5 text-primary" />
        <h3 className="font-display text-base font-bold tracking-tight">Rincian Struk</h3>
        <span className="ml-auto text-xs text-muted-foreground">AI-extracted · centang yang mau disimpan</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label>Tanggal</Label>
          <Input type="date" value={tanggal} onChange={(e) => onTanggalChange(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Dompet</Label>
          <Select value={wallet} onValueChange={onWalletChange}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih dompet" />
            </SelectTrigger>
            <SelectContent>
              {wallets.length === 0 ? (
                <SelectItem value="_none" disabled>Belum ada dompet</SelectItem>
              ) : (
                wallets.map((w) => (
                  <SelectItem key={w.nama} value={w.nama}>{w.nama}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Jenis</Label>
          <TypeToggle value={jenis} onChange={onJenisChange} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{selected.length} dari {items.length}</span> item dipilih
        </p>
        <Button variant="outline" size="sm" onClick={() => onSelectAll(!allSelected)}>
          {allSelected ? 'Kosongkan pilihan' : 'Pilih semua'}
        </Button>
      </div>

      <div className="space-y-2">
        {items.map((it) => (
          <div
            key={it.id}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 transition-colors',
              it.selected ? 'border-primary/40 bg-primary/5' : 'border-border bg-card/60 opacity-70',
            )}
          >
            <button
              type="button"
              role="checkbox"
              aria-checked={it.selected}
              aria-label={`Pilih ${it.nama}`}
              onClick={() => onToggle(it.id, !it.selected)}
              className={cn(
                'mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
                it.selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 bg-background',
              )}
            >
              {it.selected && <Check className="h-4 w-4" strokeWidth={3} />}
            </button>
            <div className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-12">
              <div className="min-w-0 sm:col-span-7">
                <Input
                  value={it.nama}
                  onChange={(e) => onUpdate(it.id, { nama: e.target.value })}
                  placeholder="Nama barang"
                />
              </div>
              <div className="sm:col-span-5">
                <NominalInput
                  value={String(it.nominal)}
                  onChange={(raw) => onUpdate(it.id, { nominal: Number(raw) || 0 })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5 rounded-xl bg-muted/60 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Dipilih</span>
          <span className="font-bold tnum">{formatIDR(selectedTotal)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted-foreground">Total di struk</span>
          <span className="font-semibold tnum">{formatIDR(total)}</span>
        </div>
        {mismatch && (
          <p className="pt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            Jumlah item berbeda {formatIDR(Math.abs(selectedTotal - total))} dari total struk. Periksa apakah ada barang atau biaya yang belum terbaca.
          </p>
        )}
      </div>
    </Card>
  );
}

function ReceiptReview({
  receipt,
  onChange,
  wallets,
  wallet,
  onWalletChange,
  numeric,
}: {
  receipt: {
    tanggal: string;
    deskripsi: string;
    nominal: string;
    kategori: string;
    jenis: TransactionType;
  };
  onChange: (r: typeof receipt) => void;
  wallets: Wallet[];
  wallet: string;
  onWalletChange: (w: string) => void;
  numeric: number;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <ReceiptText className="h-5 w-5 text-primary" />
        <h3 className="font-display text-base font-bold tracking-tight">Data Struk</h3>
        <span className="ml-auto text-xs text-muted-foreground">AI-extracted · dapat diedit</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Tanggal</Label>
          <Input
            type="date"
            value={receipt.tanggal}
            onChange={(e) => onChange({ ...receipt, tanggal: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Dompet</Label>
          <Select value={wallet} onValueChange={onWalletChange}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih dompet" />
            </SelectTrigger>
            <SelectContent>
              {wallets.length === 0 ? (
                <SelectItem value="_none" disabled>Belum ada dompet</SelectItem>
              ) : (
                wallets.map((w) => (
                  <SelectItem key={w.nama} value={w.nama}>{w.nama}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Deskripsi</Label>
          <Input
            value={receipt.deskripsi}
            onChange={(e) => onChange({ ...receipt, deskripsi: e.target.value })}
            placeholder="cth. Belanja Bulanan"
          />
        </div>
        <div className="space-y-2">
          <Label>Nominal</Label>
          <NominalInput
            value={receipt.nominal}
            onChange={(raw) => onChange({ ...receipt, nominal: raw })}
          />
          {numeric > 0 && (
            <p className="text-xs text-muted-foreground tnum">{formatIDR(numeric)}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label>Kategori</Label>
          <Input
            value={receipt.kategori}
            onChange={(e) => onChange({ ...receipt, kategori: e.target.value })}
            placeholder="cth. Makan & Minum"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Jenis</Label>
          <TypeToggle
            value={receipt.jenis}
            onChange={(j) => onChange({ ...receipt, jenis: j })}
          />
        </div>
      </div>
    </Card>
  );
}

function MutasiReview({
  rows,
  onChange,
  onRemove,
  onAdd,
  wallets,
  wallet,
  onWalletChange,
}: {
  rows: ScanRow[];
  onChange: (idx: number, patch: Partial<ScanRow>) => void;
  onRemove: (idx: number) => void;
  onAdd: () => void;
  wallets: Wallet[];
  wallet: string;
  onWalletChange: (w: string) => void;
}) {
  const totalIn = useMemo(
    () => rows.filter((r) => r.jenis === 'Pemasukan').reduce((s, r) => s + r.nominal, 0),
    [rows],
  );
  const totalOut = useMemo(
    () => rows.filter((r) => r.jenis === 'Pengeluaran').reduce((s, r) => s + r.nominal, 0),
    [rows],
  );

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <FileSpreadsheet className="h-5 w-5 text-primary" />
        <h3 className="font-display text-base font-bold tracking-tight">Data Mutasi</h3>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} baris</span>
      </div>

      {/* shared wallet for all rows */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <Label className="mb-1.5 block">Dompet untuk semua baris</Label>
          <Select value={wallet} onValueChange={onWalletChange}>
            <SelectTrigger>
              <SelectValue placeholder="Pilih dompet" />
            </SelectTrigger>
            <SelectContent>
              {wallets.length === 0 ? (
                <SelectItem value="_none" disabled>Belum ada dompet</SelectItem>
              ) : (
                wallets.map((w) => (
                  <SelectItem key={w.nama} value={w.nama}>{w.nama}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-income">
            <ArrowDownLeft className="h-3.5 w-3.5" /> {formatIDR(totalIn)}
          </span>
          <span className="flex items-center gap-1.5 text-expense">
            <ArrowUpRight className="h-3.5 w-3.5" /> {formatIDR(totalOut)}
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">Tidak ada baris terbaca.</p>
          <Button variant="outline" size="sm" onClick={onAdd} className="mt-3 gap-2">
            <ScanLine className="h-4 w-4" /> Tambah baris manual
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-border bg-card/60 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                <button
                  onClick={() => onRemove(idx)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-expense transition-colors hover:bg-expense-soft"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Hapus
                </button>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="space-y-1 sm:col-span-3">
                  <Label className="text-[11px]">Tanggal</Label>
                  <Input
                    type="date"
                    value={row.tanggal}
                    onChange={(e) => onChange(idx, { tanggal: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-5">
                  <Label className="text-[11px]">Deskripsi</Label>
                  <Input
                    value={row.deskripsi}
                    onChange={(e) => onChange(idx, { deskripsi: e.target.value })}
                    placeholder="Deskripsi transaksi"
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-4">
                  <Label className="text-[11px]">Nominal</Label>
                  <NominalInput
                    value={String(row.nominal)}
                    onChange={(raw) => onChange(idx, { nominal: Number(raw) || 0 })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-7">
                  <Label className="text-[11px]">Kategori</Label>
                  <Input
                    value={row.kategori}
                    onChange={(e) => onChange(idx, { kategori: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1 sm:col-span-5">
                  <Label className="text-[11px]">Jenis</Label>
                  <TypeToggle
                    value={row.jenis}
                    onChange={(j) => onChange(idx, { jenis: j })}
                  />
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={onAdd} className="w-full gap-2">
            <ScanLine className="h-4 w-4" /> Tambah baris
          </Button>
        </div>
      )}
    </Card>
  );
}
