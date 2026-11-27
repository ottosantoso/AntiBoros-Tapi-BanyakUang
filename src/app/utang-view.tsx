import { useCallback, useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Loader2,
  Plus,
  RefreshCw,
  Wallet as WalletIcon,
} from 'lucide-react';
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
import {
  bayarAngsuran,
  bayarUtang,
  buatCicilan,
  catatUtang,
  fetchUtang,
  type Angsuran,
  type JenisUtang,
  type MetodeBunga,
  type Utang,
} from '@/lib/data';
import { hitungJadwalCicilan, ringkasPratinjau } from '@/lib/cicilan-hitung';
import { formatIDR } from '@/lib/format';
import { formatRupiahInput, parseRupiahInput } from '@/lib/rupiah-input';
import type { Wallet } from '@/lib/types';
import { cn } from '@/lib/utils';

const JENIS_LABEL: Record<JenisUtang, string> = {
  utang: 'Saya berutang',
  piutang: 'Orang berutang ke saya',
  cicilan: 'Saya mencicil',
};

const TAB_LABEL: Record<JenisUtang, string> = {
  utang: 'Utang',
  piutang: 'Piutang',
  cicilan: 'Cicilan',
};

const METODE_LABEL: Record<MetodeBunga, string> = {
  flat: 'Flat (bunga dibagi rata)',
  anuitas: 'Anuitas (angsuran tetap)',
  tanpa_bunga: 'Tanpa bunga',
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

/** Sisa yang belum dibayar. Untuk cicilan: pokok dan bunga angsuran yang belum lunas. */
function sisaBayar(item: Utang): number {
  if (item.jenis !== 'cicilan') return item.sisa;
  return item.angsuran.filter((a) => a.status !== 'lunas').reduce((s, a) => s + a.pokok + a.bunga, 0);
}

/** Progres untuk bar: nominal pokok untuk utang/piutang, jumlah angsuran lunas untuk cicilan. */
function progres(item: Utang): { nilai: number; total: number } {
  if (item.jenis === 'cicilan') {
    return { nilai: item.angsuran.filter((a) => a.status === 'lunas').length, total: item.angsuran.length };
  }
  return { nilai: item.terbayar, total: item.pokok };
}

function statusTampil(a: Angsuran, hari: string): 'lunas' | 'terlambat' | 'belum' {
  if (a.status === 'lunas') return 'lunas';
  return a.jatuhTempo < hari ? 'terlambat' : 'belum';
}

function labelBunga(item: Utang): string {
  if (item.metodeBunga === 'tanpa_bunga') return 'Tanpa bunga';
  return `${item.bungaPersen}% per tahun · ${METODE_LABEL[item.metodeBunga].split(' ')[0].toLowerCase()}`;
}

/**
 * Utang, piutang, dan cicilan. Pokok utang dan piutang tidak dihitung sebagai pemasukan atau pengeluaran riil.
 * Bunga cicilan dihitung sebagai pengeluaran riil saat angsurannya dibayar.
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
    const dari = (j: JenisUtang) => aktif.filter((i) => i.jenis === j);
    return {
      utang: dari('utang').reduce((s, i) => s + sisaBayar(i), 0),
      piutang: dari('piutang').reduce((s, i) => s + sisaBayar(i), 0),
      cicilan: dari('cicilan').reduce((s, i) => s + sisaBayar(i), 0),
      aktifUtang: dari('utang').length,
      aktifPiutang: dari('piutang').length,
      aktifCicilan: dari('cicilan').length,
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
            Catat pinjaman, tagihan, dan cicilan. Pokok tidak dihitung sebagai pemasukan atau pengeluaran.
          </p>
        </div>
        <Button onClick={() => setTambahOpen(true)} className="h-11 gap-2 sm:h-10">
          <Plus className="h-4 w-4" aria-hidden />
          Catat baru
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Sisa utang aktif"
          value={formatIDR(totals.utang)}
          sub={`${totals.aktifUtang} catatan`}
          tone="blue"
          icon={<ArrowUpRight className="h-4 w-4" aria-hidden />}
        />
        <SummaryCard
          label="Sisa piutang aktif"
          value={formatIDR(totals.piutang)}
          sub={`${totals.aktifPiutang} catatan`}
          tone="green"
          icon={<ArrowDownLeft className="h-4 w-4" aria-hidden />}
        />
        <SummaryCard
          label="Cicilan belum dibayar"
          value={formatIDR(totals.cicilan)}
          sub={`${totals.aktifCicilan} cicilan aktif`}
          tone="amber"
          icon={<CalendarClock className="h-4 w-4" aria-hidden />}
        />
      </div>

      <div
        role="tablist"
        aria-label="Jenis catatan"
        className="grid grid-cols-3 gap-1 rounded-2xl bg-muted p-1 sm:inline-grid sm:w-96 sm:gap-2"
      >
        {(['utang', 'piutang', 'cicilan'] as JenisUtang[]).map((j) => (
          <button
            key={j}
            type="button"
            role="tab"
            aria-selected={tab === j}
            onClick={() => setTab(j)}
            className={cn(
              'min-h-10 rounded-xl px-2 text-sm font-semibold transition-colors sm:px-3',
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
            {tab === 'utang' &&
              'Kalau kamu meminjam uang, catat di sini supaya sisa dan pelunasannya tetap terlihat.'}
            {tab === 'piutang' &&
              'Kalau ada orang yang berutang ke kamu, catat di sini supaya kamu tahu sisa yang belum dibayar.'}
            {tab === 'cicilan' &&
              'Kalau kamu membayar barang atau pinjaman secara bertahap, catat jadwalnya di sini. Angsuran akan muncul lengkap dengan tanggal jatuh tempo.'}
          </p>
          <Button variant="outline" onClick={() => setTambahOpen(true)} className="mt-1 h-10">
            Catat {TAB_LABEL[tab].toLowerCase()}
          </Button>
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {daftar.map((item) => {
            const { nilai, total } = progres(item);
            const berikut = item.angsuran.find((a) => a.status !== 'lunas');
            return (
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
                    <ProgressBar nilai={nilai} total={total} jenis={item.jenis} />
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                      <span className="text-muted-foreground">
                        Sisa <span className="font-bold text-foreground">{formatIDR(sisaBayar(item))}</span>
                      </span>
                      {item.jenis === 'cicilan' ? (
                        <span className="text-xs text-muted-foreground">
                          {nilai}/{total} lunas
                          {berikut && item.status === 'aktif' ? ` · berikutnya ${formatTanggal(berikut.jatuhTempo)}` : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">dari {formatIDR(item.pokok)}</span>
                      )}
                    </div>
                  </Card>
                </button>
              </li>
            );
          })}
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
          onChanged={setelahBerubah}
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
  tone: 'blue' | 'green' | 'amber';
  icon: ReactNode;
}) {
  return (
    <Card className="flex min-w-0 items-start gap-3 p-4 sm:p-5">
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
          tone === 'blue' && 'bg-primary/10 text-primary',
          tone === 'green' && 'bg-income-soft text-income',
          tone === 'amber' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
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

function StatusAngsuranChip({ status }: { status: 'lunas' | 'terlambat' | 'belum' }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
        status === 'lunas' && 'bg-income-soft text-income',
        status === 'terlambat' && 'bg-destructive/10 text-destructive',
        status === 'belum' && 'bg-muted text-muted-foreground',
      )}
    >
      {status === 'lunas' ? 'Lunas' : status === 'terlambat' ? 'Terlambat' : 'Belum'}
    </span>
  );
}

function ProgressBar({ nilai, total, jenis }: { nilai: number; total: number; jenis: JenisUtang }) {
  const persen = total > 0 ? Math.min(100, Math.round((nilai / total) * 100)) : 0;
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
        className={cn(
          'h-full rounded-full transition-[width] duration-500',
          jenis === 'piutang' ? 'bg-income' : jenis === 'cicilan' ? 'bg-amber-500' : 'bg-primary',
        )}
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

const SELECT_CLASS =
  'h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm';

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
  const [metode, setMetode] = useState<MetodeBunga>('flat');
  const [bungaText, setBungaText] = useState('');
  const [tenorText, setTenorText] = useState('12');
  const [hariText, setHariText] = useState('5');
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
      setMetode('flat');
      setBungaText('');
      setTenorText('12');
      setHariText('5');
      setError(null);
    }
  }, [open]);

  const cicilan = jenis === 'cicilan';
  const pokok = Number(pokokDigits) || 0;
  const bungaNum = Number(bungaText.replace(',', '.'));
  const bungaDipakai = metode === 'tanpa_bunga' ? 0 : bungaNum;
  const tenorNum = Number(tenorText);
  const hariNum = Number(hariText);
  const dompet = wallets.find((w) => w.id === walletTerpilih);
  // Piutang mengeluarkan uang dari dompet, jadi saldo harus cukup.
  const saldoKurang = jenis === 'piutang' && dompet !== undefined && pokok > dompet.saldo;

  const pratinjauValid =
    cicilan &&
    pokok > 0 &&
    Number.isInteger(tenorNum) &&
    tenorNum >= 1 &&
    tenorNum <= 360 &&
    Number.isFinite(bungaDipakai) &&
    bungaDipakai >= 0 &&
    bungaDipakai <= 100;
  const pratinjau = pratinjauValid ? ringkasPratinjau(hitungJadwalCicilan(pokok, bungaDipakai, metode, tenorNum)) : null;

  async function simpan(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const nama = pihak.trim();
    if (!nama) return setError(cicilan ? 'Tulis nama platform atau leasingnya.' : 'Tulis nama orangnya atau platformnya.');
    if (nama.length > 80) return setError('Nama maksimal 80 karakter.');
    if (pokok <= 0) return setError('Jumlah harus lebih dari nol.');
    if (!walletTerpilih) return setError('Pilih dompet dulu. Tambahkan dompet di menu Dompet kalau belum ada.');

    if (cicilan) {
      if (bungaText.trim() === '' && metode !== 'tanpa_bunga') return setError('Isi bunga per tahun, atau pilih tanpa bunga.');
      if (!Number.isFinite(bungaDipakai) || bungaDipakai < 0 || bungaDipakai > 100) {
        return setError('Bunga per tahun harus 0 sampai 100 persen.');
      }
      if (!Number.isInteger(tenorNum) || tenorNum < 1 || tenorNum > 360) {
        return setError('Jumlah angsuran harus 1 sampai 360 bulan.');
      }
      if (!Number.isInteger(hariNum) || hariNum < 1 || hariNum > 28) {
        return setError('Jatuh tempo harus tanggal 1 sampai 28.');
      }
      if (!tanggal) return setError('Isi tanggal mulai.');
    } else if (saldoKurang) {
      return setError(`Saldo ${dompet?.nama} tidak cukup untuk piutang ini.`);
    }

    setSaving(true);
    setError(null);
    const res = cicilan
      ? await buatCicilan({
          pihak: nama,
          pokok,
          bungaPersen: bungaDipakai,
          metode,
          tenor: tenorNum,
          tanggalMulai: tanggal,
          hariJatuhTempo: hariNum,
          walletId: walletTerpilih,
          catatan: catatan.trim() || undefined,
        })
      : await catatUtang({
          jenis: jenis === 'piutang' ? 'piutang' : 'utang',
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
    toast.success('Tersimpan', {
      description: cicilan ? `${nama} · ${tenorNum} angsuran` : `${nama} · ${formatIDR(pokok)}`,
    });
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{cicilan ? 'Catat cicilan' : 'Catat utang atau piutang'}</DialogTitle>
          <DialogDescription>
            {cicilan
              ? 'Pokok angsuran tidak dihitung sebagai pengeluaran. Bunganya dihitung sebagai pengeluaran saat angsuran dibayar.'
              : 'Saldo dompet ikut berubah. Pokoknya tidak dihitung sebagai pemasukan atau pengeluaran.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={simpan} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-semibold">Jenis</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {(['utang', 'piutang', 'cicilan'] as JenisUtang[]).map((j) => (
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
                  {j === 'utang' ? 'Saya berutang' : j === 'piutang' ? 'Orang berutang ke saya' : 'Saya mencicil'}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label={cicilan ? 'Platform atau leasing' : 'Nama orang atau platform'} htmlFor={`${uid}-pihak`}>
            <Input
              id={`${uid}-pihak`}
              value={pihak}
              onChange={(e) => setPihak(e.target.value)}
              placeholder={cicilan ? 'Contoh: Adira Finance, atau Kredivo' : 'Contoh: Budi, atau Kredivo'}
              maxLength={80}
              className="h-11 text-base sm:text-sm"
              autoComplete="off"
            />
          </Field>

          <Field label={cicilan ? 'Harga pokok (sebelum bunga)' : 'Jumlah pokok'} htmlFor={`${uid}-pokok`}>
            <Input
              id={`${uid}-pokok`}
              inputMode="numeric"
              value={formatRupiahInput(pokokDigits)}
              onChange={(e) => setPokokDigits(parseRupiahInput(e.target.value))}
              placeholder="Rp 0"
              className="h-11 text-base sm:text-sm"
            />
          </Field>

          {cicilan && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Metode bunga" htmlFor={`${uid}-metode`}>
                <select
                  id={`${uid}-metode`}
                  value={metode}
                  onChange={(e) => setMetode(e.target.value as MetodeBunga)}
                  className={SELECT_CLASS}
                >
                  {(Object.keys(METODE_LABEL) as MetodeBunga[]).map((m) => (
                    <option key={m} value={m}>
                      {METODE_LABEL[m]}
                    </option>
                  ))}
                </select>
              </Field>
              {metode !== 'tanpa_bunga' && (
                <Field label="Bunga per tahun (%)" htmlFor={`${uid}-bunga`} hint="Contoh: 12 untuk 12% per tahun.">
                  <Input
                    id={`${uid}-bunga`}
                    inputMode="decimal"
                    value={bungaText}
                    onChange={(e) => setBungaText(e.target.value)}
                    placeholder="0"
                    className="h-11 text-base sm:text-sm"
                  />
                </Field>
              )}
              <Field label="Jumlah angsuran (bulan)" htmlFor={`${uid}-tenor`}>
                <Input
                  id={`${uid}-tenor`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={360}
                  value={tenorText}
                  onChange={(e) => setTenorText(e.target.value)}
                  className="h-11 text-base sm:text-sm"
                />
              </Field>
              <Field label="Jatuh tempo tiap tanggal" htmlFor={`${uid}-hari`} hint="Pilih tanggal 1 sampai 28.">
                <Input
                  id={`${uid}-hari`}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={28}
                  value={hariText}
                  onChange={(e) => setHariText(e.target.value)}
                  className="h-11 text-base sm:text-sm"
                />
              </Field>
            </div>
          )}

          {cicilan && pratinjau && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
              <p className="text-xs font-semibold text-muted-foreground">Perkiraan jadwal</p>
              <div className="mt-2 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Angsuran pertama</p>
                  <p className="font-bold break-words">{formatIDR(pratinjau.angsuranPertama)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total bunga</p>
                  <p className="font-bold break-words">{formatIDR(pratinjau.totalBunga)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Total dibayar</p>
                  <p className="font-bold break-words">{formatIDR(pratinjau.totalBayar)}</p>
                </div>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Perkiraan ini bisa berselisih beberapa rupiah dari jadwal yang tersimpan karena pembulatan.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={cicilan ? 'Tanggal mulai' : 'Tanggal'} htmlFor={`${uid}-tanggal`}>
              <Input
                id={`${uid}-tanggal`}
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="h-11 text-base sm:text-sm"
              />
            </Field>
            <Field
              label={
                cicilan ? 'Dompet untuk bayar angsuran' : jenis === 'utang' ? 'Uang masuk ke dompet' : 'Uang keluar dari dompet'
              }
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
              placeholder="Contoh: bayar tiap tanggal 5"
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
  onChanged,
}: {
  item: Utang;
  wallets: Wallet[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const uid = useId();
  const sudahBayar = item.angsuran.filter((a) => a.status === 'lunas').reduce((s, a) => s + a.pokok + a.bunga, 0);
  const totalBunga = item.angsuran.reduce((s, a) => s + a.bunga, 0);
  const sisa = sisaBayar(item);

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

        {item.jenis === 'cicilan' ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Harga pokok" value={formatIDR(item.pokok)} />
              <Stat label="Sudah dibayar" value={formatIDR(sudahBayar)} />
              <Stat label="Sisa" value={formatIDR(sisa)} strong />
            </div>
            <p className="text-xs text-muted-foreground">
              {labelBunga(item)} · total bunga {formatIDR(totalBunga)} · {item.angsuran.length} angsuran
              {item.hariJatuhTempo ? ` · jatuh tempo tiap tanggal ${item.hariJatuhTempo}` : ''}
            </p>
            <ProgressBar
              nilai={item.angsuran.filter((a) => a.status === 'lunas').length}
              total={item.angsuran.length}
              jenis="cicilan"
            />
            <JadwalCicilan item={item} wallets={wallets} onChanged={onChanged} idPrefix={uid} />
          </div>
        ) : (
          <DetailUtang item={item} wallets={wallets} onOpenChange={onOpenChange} onChanged={onChanged} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function JadwalCicilan({
  item,
  wallets,
  onChanged,
  idPrefix,
}: {
  item: Utang;
  wallets: Wallet[];
  onChanged: () => void;
  idPrefix: string;
}) {
  const hari = hariIni();
  const aktif = item.status === 'aktif';
  const berikutId = item.angsuran.find((a) => a.status !== 'lunas')?.id ?? null;
  const [bayarId, setBayarId] = useState<string | null>(null);

  return (
    <section aria-labelledby={`${idPrefix}-jadwal`} className="flex flex-col gap-2">
      <h3 id={`${idPrefix}-jadwal`} className="text-sm font-semibold">
        Jadwal angsuran
      </h3>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {item.angsuran.map((a) => {
          const status = statusTampil(a, hari);
          const bisaBayar = aktif && a.id === berikutId;
          return (
            <li key={a.id} className="flex flex-col gap-3 px-3 py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    Angsuran #{a.nomor} · {formatTanggal(a.jatuhTempo)}
                  </p>
                  <p className="text-xs text-muted-foreground break-words">
                    Pokok {formatIDR(a.pokok)} · Bunga {formatIDR(a.bunga)}
                  </p>
                  {status === 'lunas' && a.dibayarPada && (
                    <p className="text-xs text-muted-foreground">Dibayar {formatTanggal(a.dibayarPada)}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  <span className="font-bold">{formatIDR(a.pokok + a.bunga)}</span>
                  <StatusAngsuranChip status={status} />
                  {bisaBayar && bayarId !== a.id && (
                    <Button size="sm" className="h-9 min-w-20" onClick={() => setBayarId(a.id)}>
                      Bayar
                    </Button>
                  )}
                </div>
              </div>
              {bayarId === a.id && (
                <BayarAngsuranForm
                  item={item}
                  angsuran={a}
                  wallets={wallets}
                  idPrefix={`${idPrefix}-${a.id}`}
                  onCancel={() => setBayarId(null)}
                  onDone={() => {
                    setBayarId(null);
                    onChanged();
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
      {!aktif && (
        <p className="flex items-center gap-2 rounded-xl bg-income-soft p-3 text-sm font-semibold text-income">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Semua angsuran sudah lunas.
        </p>
      )}
    </section>
  );
}

function BayarAngsuranForm({
  item,
  angsuran,
  wallets,
  idPrefix,
  onCancel,
  onDone,
}: {
  item: Utang;
  angsuran: Angsuran;
  wallets: Wallet[];
  idPrefix: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [tanggal, setTanggal] = useState(hariIni());
  const [walletId, setWalletId] = useState(item.walletId ?? '');
  const walletTerpilih = wallets.some((w) => w.id === walletId) ? walletId : (wallets[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = angsuran.pokok + angsuran.bunga;
  const dompet = wallets.find((w) => w.id === walletTerpilih);
  const saldoKurang = dompet !== undefined && total > dompet.saldo;

  async function bayar(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!walletTerpilih) return setError('Pilih dompet dulu.');
    if (saldoKurang) return setError(`Saldo ${dompet?.nama} tidak cukup untuk angsuran ini.`);

    setSaving(true);
    setError(null);
    const res = await bayarAngsuran(angsuran.id, walletTerpilih, tanggal);
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? 'Gagal menyimpan pembayaran. Coba lagi.');
      return;
    }
    toast.success('Angsuran tercatat', {
      description: `${item.pihak} · angsuran #${angsuran.nomor} · ${formatIDR(total)}`,
    });
    onDone();
  }

  return (
    <form onSubmit={bayar} className="flex flex-col gap-4 rounded-2xl border border-border bg-muted/30 p-4" noValidate>
      <p className="text-sm font-semibold">
        Bayar angsuran #{angsuran.nomor} · {formatIDR(total)}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tanggal bayar" htmlFor={`${idPrefix}-tgl`}>
          <Input
            id={`${idPrefix}-tgl`}
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="h-11 text-base sm:text-sm"
          />
        </Field>
        <Field label="Bayar dari dompet" htmlFor={`${idPrefix}-dompet`}>
          <WalletSelect id={`${idPrefix}-dompet`} wallets={wallets} value={walletTerpilih} onChange={setWalletId} />
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
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} className="h-11 sm:h-10">
          Batal
        </Button>
        <Button type="submit" disabled={saving || saldoKurang} className="h-11 gap-2 sm:h-10">
          {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Catat pembayaran
        </Button>
      </div>
    </form>
  );
}

function DetailUtang({
  item,
  wallets,
  onOpenChange,
  onChanged,
}: {
  item: Utang;
  wallets: Wallet[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
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
  const riwayat = item.angsuran.filter((a) => a.status === 'lunas');

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
    onOpenChange(false);
    onChanged();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Pokok" value={formatIDR(item.pokok)} />
        <Stat label="Sudah dibayar" value={formatIDR(item.terbayar)} />
        <Stat label="Sisa" value={formatIDR(item.sisa)} strong />
      </div>
      <ProgressBar nilai={item.terbayar} total={item.pokok} jenis={item.jenis} />

      <section aria-labelledby={`${uid}-riwayat`} className="flex flex-col gap-2">
        <h3 id={`${uid}-riwayat`} className="text-sm font-semibold">
          Riwayat pembayaran
        </h3>
        {riwayat.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {riwayat.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 text-muted-foreground">
                  #{p.nomor} · {formatTanggal(p.dibayarPada)}
                </span>
                <span className="shrink-0 font-semibold">{formatIDR(p.pokok)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {aktif ? (
        <form onSubmit={bayar} className="flex flex-col gap-4 rounded-2xl border border-border p-4" noValidate>
          <h3 className="text-sm font-semibold">{keluar ? 'Bayar utang' : 'Terima pelunasan'}</h3>

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

          <Button type="submit" disabled={saving || saldoKurang || melebihiSisa || jumlah <= 0} className="h-11 gap-2">
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
