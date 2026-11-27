import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Loader2, Plus, RefreshCw, Wallet as WalletIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { bayarUtang, catatUtang, fetchUtang, type JenisUtang, type Utang } from '@/lib/data';
import { formatIDR } from '@/lib/format';
import { formatRupiahInput, parseRupiahInput } from '@/lib/rupiah-input';
import type { Wallet } from '@/lib/types';
import { cn } from '@/lib/utils';

const JENIS_LABEL: Record<JenisUtang, string> = {
  utang: 'Saya berutang',
  piutang: 'Orang berutang ke saya',
};

const TAB_LABEL: Record<JenisUtang, string> = {
  utang: 'Utang',
  piutang: 'Piutang',
};

function hariIni(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTanggal(iso: string): string {
  if (!iso) return '-';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Utang dan piutang fase 1. Pokok tidak dihitung sebagai pemasukan atau pengeluaran riil,
 * tetapi saldo dompet tetap berubah lewat transaksi. Setiap pembayaran tercatat di riwayat.
 */
export function UtangView({ wallets, onSaved }: { wallets: Wallet[]; onSaved?: () => void }) {
  const [items, setItems] = useState<Utang[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<JenisUtang>('utang');
  const [tambahOpen, setTambahOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const muat = useCallback(async () => {
    const res = await fetchUtang();
    setItems(res.items);
    setError(res.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const totals = useMemo(() => {
    const aktif = items.filter((i) => i.status === 'aktif');
    return {
      utang: aktif.filter((i) => i.jenis === 'utang').reduce((s, i) => s + i.sisa, 0),
      piutang: aktif.filter((i) => i.jenis === 'piutang').reduce((s, i) => s + i.sisa, 0),
      aktifUtang: aktif.filter((i) => i.jenis === 'utang').length,
      aktifPiutang: aktif.filter((i) => i.jenis === 'piutang').length,
    };
  }, [items]);

  const daftar = useMemo(
    () =>
      items
        .filter((i) => i.jenis === tab && i.status !== 'dibatalkan')
        .sort((a, b) => (a.status === b.status ? 0 : a.status === 'aktif' ? -1 : 1)),
    [items, tab],
  );

  const detail = items.find((i) => i.id === detailId) ?? null;

  function setelahBerubah() {
    void muat();
    onSaved?.();
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-tight">Utang & Piutang</h2>
          <p className="text-sm text-muted-foreground">
            Catat pinjaman yang kamu terima atau berikan. Pokok tidak dihitung sebagai pemasukan atau pengeluaran.
          </p>
        </div>
        <Button onClick={() => setTambahOpen(true)} className="h-11 gap-2 sm:h-10">
          <Plus className="h-4 w-4" aria-hidden />
          Catat baru
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryCard
          label="Total utang aktif"
          value={formatIDR(totals.utang)}
          sub={`${totals.aktifUtang} catatan`}
          tone="blue"
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden />}
        />
        <SummaryCard
          label="Total piutang aktif"
          value={formatIDR(totals.piutang)}
          sub={`${totals.aktifPiutang} catatan`}
          tone="green"
          icon={<ArrowDownLeft className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div role="tablist" aria-label="Jenis catatan" className="grid grid-cols-2 gap-2 rounded-2xl bg-muted p-1 sm:inline-grid sm:w-80">
        {(['utang', 'piutang'] as JenisUtang[]).map((j) => (
          <button
            key={j}
            type="button"
            role="tab"
            aria-selected={tab === j}
            onClick={() => setTab(j)}
            className={cn(
              'min-h-10 rounded-xl px-3 text-sm font-semibold transition-colors',
              tab === j ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {TAB_LABEL[j]}
          </button>
        ))}
      </div>

      {error && (
        <Card role="alert" className="flex flex-wrap items-center gap-3 border-destructive/40 p-4 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <span className="min-w-0 flex-1 break-words text-destructive">Gagal memuat data: {error}</span>
          <Button variant="outline" size="sm" onClick={() => void muat()} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Coba lagi
          </Button>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Memuat catatan...
        </div>
      ) : daftar.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
            <WalletIcon className="h-5 w-5" aria-hidden />
          </span>
          <p className="font-semibold">Belum ada {TAB_LABEL[tab].toLowerCase()}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {tab === 'utang'
              ? 'Kalau kamu meminjam uang, catat di sini supaya sisa cicilan dan pelunasannya tetap terlihat.'
              : 'Kalau ada orang yang berutang ke kamu, catat di sini supaya kamu tahu sisa yang belum dibayar.'}
          </p>
          <Button variant="outline" onClick={() => setTambahOpen(true)} className="mt-1 h-10">
            Catat {TAB_LABEL[tab].toLowerCase()}
          </Button>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {daftar.map((item) => (
            <li key={item.id} className="min-w-0">
              <button
                type="button"
                onClick={() => setDetailId(item.id)}
                className="group w-full min-w-0 rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Card className="flex h-full min-w-0 flex-col gap-3 p-4 transition-colors group-hover:border-primary/50 sm:p-5">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-bold tracking-tight">{item.pihak}</p>
                      <p className="text-xs text-muted-foreground">
                        {JENIS_LABEL[item.jenis]} · mulai {formatTanggal(item.tanggalMulai)}
                      </p>
                    </div>
                    <StatusChip status={item.status} />
                  </div>
                  <ProgressBar terbayar={item.terbayar} pokok={item.pokok} jenis={item.jenis} />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="text-muted-foreground">
                      Sisa <span className="font-bold text-foreground">{formatIDR(item.sisa)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">dari {formatIDR(item.pokok)}</span>
                  </div>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}

      <TambahDialog
        open={tambahOpen}
        onOpenChange={setTambahOpen}
        wallets={wallets}
        onSaved={() => {
          setTambahOpen(false);
          setelahBerubah();
        }}
      />

      {detail && (
        <DetailDialog
          key={detail.id}
          item={detail}
          wallets={wallets}
          onOpenChange={(open) => !open && setDetailId(null)}
          onPaid={() => {
            setDetailId(null);
            setelahBerubah();
          }}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'blue' | 'green';
  icon: ReactNode;
}) {
  return (
    <Card className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
          tone === 'blue' ? 'bg-primary/10 text-primary' : 'bg-income-soft text-income',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <p className="mt-0.5 break-words font-display text-lg font-bold tracking-tight sm:text-xl">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </Card>
  );
}

function StatusChip({ status }: { status: Utang['status'] }) {
  const aktif = status === 'aktif';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
        aktif ? 'bg-primary/10 text-primary' : 'bg-income-soft text-income',
      )}
    >
      {aktif ? 'Aktif' : 'Lunas'}
    </span>
  );
}

function ProgressBar({ terbayar, pokok, jenis }: { terbayar: number; pokok: number; jenis: JenisUtang }) {
  const persen = pokok > 0 ? Math.min(100, Math.round((terbayar / pokok) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={persen}
      aria-label={`Sudah dibayar ${persen} persen`}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', jenis === 'utang' ? 'bg-primary' : 'bg-income')}
        style={{ width: `${persen}%` }}
      />
    </div>
  );
}

function WalletSelect({
  id,
  wallets,
  value,
  onChange,
  disabled,
}: {
  id: string;
  wallets: Wallet[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-sm"
    >
      {wallets.map((w) => (
        <option key={w.id} value={w.id}>
          {w.nama} · {formatIDR(w.saldo)}
        </option>
      ))}
    </select>
  );
}

function Field({ label, htmlFor, children, hint }: { label: string; htmlFor: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TambahDialog({
  open,
  onOpenChange,
  wallets,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  wallets: Wallet[];
  onSaved: () => void;
}) {
  const uid = useId();
  const [jenis, setJenis] = useState<JenisUtang>('utang');
  const [pihak, setPihak] = useState('');
  const [pokokDigits, setPokokDigits] = useState('');
  const [tanggal, setTanggal] = useState(hariIni());
  const [walletId, setWalletId] = useState('');
  // Dompet default dipilih dari daftar terbaru saat dibutuhkan, supaya refresh daftar tidak mereset isian.
  const walletTerpilih = wallets.some((w) => w.id === walletId) ? walletId : (wallets[0]?.id ?? '');
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setJenis('utang');
      setPihak('');
      setPokokDigits('');
      setTanggal(hariIni());
      setWalletId('');
      setCatatan('');
      setError(null);
    }
  }, [open]);

  const pokok = Number(pokokDigits) || 0;
  const dompet = wallets.find((w) => w.id === walletTerpilih);
  // Piutang mengeluarkan uang dari dompet, jadi saldo harus cukup.
  const saldoKurang = jenis === 'piutang' && dompet !== undefined && pokok > dompet.saldo;

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const nama = pihak.trim();
    if (!nama) return setError('Tulis nama orangnya atau platformnya.');
    if (nama.length > 80) return setError('Nama maksimal 80 karakter.');
    if (pokok <= 0) return setError('Jumlah harus lebih dari nol.');
    if (!walletTerpilih) return setError('Pilih dompet dulu. Tambahkan dompet di menu Dompet kalau belum ada.');
    if (saldoKurang) return setError(`Saldo ${dompet?.nama} tidak cukup untuk piutang ini.`);

    setSaving(true);
    setError(null);
    const res = await catatUtang({
      jenis,
      pihak: nama,
      pokok,
      tanggal,
      walletId: walletTerpilih,
      catatan: catatan.trim() || undefined,
    });
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? 'Gagal menyimpan. Coba lagi.');
      return;
    }
    toast.success('Tersimpan', { description: `${nama} · ${formatIDR(pokok)}` });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat utang atau piutang</DialogTitle>
          <DialogDescription>Saldo dompet ikut berubah. Pokoknya tidak dihitung sebagai pemasukan atau pengeluaran.</DialogDescription>
        </DialogHeader>

        <form onSubmit={simpan} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-semibold">Jenis</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(['utang', 'piutang'] as JenisUtang[]).map((j) => (
                <label
                  key={j}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors',
                    jenis === j ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground',
                  )}
                >
                  <input
                    type="radio"
                    name={`${uid}-jenis`}
                    value={j}
                    checked={jenis === j}
                    onChange={() => setJenis(j)}
                    className="h-4 w-4"
                  />
                  {JENIS_LABEL[j]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="Nama orang atau platform" htmlFor={`${uid}-pihak`}>
            <Input
              id={`${uid}-pihak`}
              value={pihak}
              onChange={(e) => setPihak(e.target.value)}
              placeholder="Contoh: Budi, atau Kredivo"
              maxLength={80}
              className="h-11 text-base sm:text-sm"
              autoComplete="off"
            />
          </Field>

          <Field label="Jumlah pokok" htmlFor={`${uid}-pokok`}>
            <Input
              id={`${uid}-pokok`}
              inputMode="numeric"
              value={formatRupiahInput(pokokDigits)}
              onChange={(e) => setPokokDigits(parseRupiahInput(e.target.value))}
              placeholder="Rp 0"
              className="h-11 text-base sm:text-sm"
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tanggal" htmlFor={`${uid}-tanggal`}>
              <Input
                id={`${uid}-tanggal`}
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-11 text-base sm:text-sm"
              />
            </Field>
            <Field
              label={jenis === 'utang' ? 'Uang masuk ke dompet' : 'Uang keluar dari dompet'}
              htmlFor={`${uid}-dompet`}
            >
              <WalletSelect id={`${uid}-dompet`} wallets={wallets} value={walletTerpilih} onChange={setWalletId} disabled={wallets.length === 0} />
            </Field>
          </div>

          <Field label="Catatan (opsional)" htmlFor={`${uid}-catatan`}>
            <Input
              id={`${uid}-catatan`}
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Contoh: bayar tiap tanggal 25"
              maxLength={300}
              className="h-11 text-base sm:text-sm"
            />
          </Field>

          {saldoKurang && (
            <p className="text-sm font-semibold text-destructive">
              Saldo {dompet?.nama} hanya {formatIDR(dompet?.saldo ?? 0)}.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="h-11 sm:h-10">
              Batal
            </Button>
            <Button type="submit" disabled={saving || saldoKurang || wallets.length === 0} className="h-11 gap-2 sm:h-10">
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({
  item,
  wallets,
  onOpenChange,
  onPaid,
}: {
  item: Utang;
  wallets: Wallet[];
  onOpenChange: (open: boolean) => void;
  onPaid: () => void;
}) {
  const uid = useId();
  const aktif = item.status === 'aktif';
  const [jumlahDigits, setJumlahDigits] = useState('');
  const [tanggal, setTanggal] = useState(hariIni());
  const [walletId, setWalletId] = useState(item.walletId ?? '');
  const walletTerpilih = wallets.some((w) => w.id === walletId) ? walletId : (wallets[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const jumlah = Number(jumlahDigits) || 0;
  const dompet = wallets.find((w) => w.id === walletTerpilih);
  // Bayar utang mengeluarkan uang dari dompet. Terima pelunasan piutang memasukkan uang.
  const keluar = item.jenis === 'utang';
  const saldoKurang = keluar && dompet !== undefined && jumlah > dompet.saldo;
  const melebihiSisa = jumlah > item.sisa;

  async function bayar(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (jumlah <= 0) return setError('Jumlah harus lebih dari nol.');
    if (melebihiSisa) return setError(`Jumlah melebihi sisa ${formatIDR(item.sisa)}.`);
    if (!walletTerpilih) return setError('Pilih dompet dulu.');
    if (saldoKurang) return setError(`Saldo ${dompet?.nama} tidak cukup untuk pembayaran ini.`);

    setSaving(true);
    setError(null);
    const res = await bayarUtang(item.id, jumlah, tanggal, walletTerpilih);
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? 'Gagal menyimpan pembayaran. Coba lagi.');
      return;
    }
    toast.success(keluar ? 'Pembayaran tercatat' : 'Pelunasan tercatat', {
      description: `${item.pihak} · ${formatIDR(jumlah)}`,
    });
    onPaid();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">{item.pihak}</DialogTitle>
          <DialogDescription>
            {JENIS_LABEL[item.jenis]} · mulai {formatTanggal(item.tanggalMulai)}
            {item.catatan ? ` · ${item.catatan}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Pokok" value={formatIDR(item.pokok)} />
            <Stat label="Sudah dibayar" value={formatIDR(item.terbayar)} />
            <Stat label="Sisa" value={formatIDR(item.sisa)} strong />
          </div>
          <ProgressBar terbayar={item.terbayar} pokok={item.pokok} jenis={item.jenis} />

          <section aria-labelledby={`${uid}-riwayat`} className="flex flex-col gap-2">
            <h3 id={`${uid}-riwayat`} className="text-sm font-semibold">
              Riwayat pembayaran
            </h3>
            {item.pembayaran.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {item.pembayaran.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                    <span className="min-w-0 text-muted-foreground">
                      #{p.nomor} · {formatTanggal(p.tanggal)}
                    </span>
                    <span className="shrink-0 font-semibold">{formatIDR(p.jumlah)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {aktif ? (
            <form onSubmit={bayar} className="flex flex-col gap-4 rounded-2xl border border-border p-4" noValidate>
              <h3 className="text-sm font-semibold">{keluar ? 'Bayar angsuran' : 'Terima pelunasan'}</h3>

              <Field label="Jumlah" htmlFor={`${uid}-jumlah`}>
                <div className="flex min-w-0 gap-2">
                  <Input
                    id={`${uid}-jumlah`}
                    inputMode="numeric"
                    value={formatRupiahInput(jumlahDigits)}
                    onChange={(e) => setJumlahDigits(parseRupiahInput(e.target.value))}
                    placeholder="Rp 0"
                    className="h-11 min-w-0 flex-1 text-base sm:text-sm"
                  />
                  <Button type="button" variant="outline" onClick={() => setJumlahDigits(String(item.sisa))} className="h-11 shrink-0">
                    Lunasi
                  </Button>
                </div>
                {melebihiSisa && <p className="text-xs font-semibold text-destructive">Melebihi sisa {formatIDR(item.sisa)}.</p>}
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tanggal" htmlFor={`${uid}-tgl`}>
                  <Input
                    id={`${uid}-tgl`}
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="h-11 text-base sm:text-sm"
                  />
                </Field>
                <Field label={keluar ? 'Bayar dari dompet' : 'Masuk ke dompet'} htmlFor={`${uid}-dompet`}>
                  <WalletSelect id={`${uid}-dompet`} wallets={wallets} value={walletTerpilih} onChange={setWalletId} />
                </Field>
              </div>

              {saldoKurang && (
                <p className="text-sm font-semibold text-destructive">
                  Saldo {dompet?.nama} hanya {formatIDR(dompet?.saldo ?? 0)}.
                </p>
              )}
              {error && (
                <p role="alert" className="text-sm font-semibold text-destructive">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={saving || saldoKurang || melebihiSisa || jumlah <= 0}
                className="h-11 gap-2"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {keluar ? 'Catat pembayaran' : 'Catat pelunasan'}
              </Button>
            </form>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-income-soft p-3 text-sm font-semibold text-income">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Catatan ini sudah lunas.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/60 px-2 py-2.5">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 truncate text-xs sm:text-sm', strong ? 'font-bold' : 'font-semibold')}>{value}</p>
    </div>
  );
}
