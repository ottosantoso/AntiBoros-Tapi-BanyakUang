import { useEffect, useState, type ChangeEvent } from 'react';
import { Check, Landmark, Loader2, Plus, Smartphone, Upload, type LucideIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  findWalletsByName,
  renameWalletRow,
  restoreWalletRow,
  uploadWalletLogo,
  type WalletInput,
  type WalletNameMatch,
  type WriteResult,
} from '@/lib/data';
import { formatIDR } from '@/lib/format';
import { normalizeLogo } from '@/lib/logo';
import {
  BANK_PROVIDERS,
  EWALLET_PROVIDERS,
  OTHER_PROVIDER_CODE,
  type WalletProvider,
} from '@/lib/wallet-providers';
import { cn } from '@/lib/utils';

type Jenis = 'bank' | 'ewallet';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

interface AddWalletSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addWallet: (input: WalletInput) => Promise<WriteResult>;
  onSubmitted: () => void;
}

/** Ambil angka saja dari input. Kosong berarti 0 (saldo awal opsional). */
function parseRupiah(raw: string): number | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** Tampilkan angka dengan titik ribuan, mis. 1250000 -> 1.250.000. */
function formatRupiahInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Nama untuk dompet lama yang diarsip saat namanya dipakai dompet baru.
 * Format: [nama]_[waktu dibuat dalam WIB], mis. BCA_2026-11-21_1432.
 */
function namaArsipUntuk(match: WalletNameMatch): string {
  if (!match.createdAt) return `${match.nama}_arsip`;
  const wib = new Date(match.createdAt).toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' });
  const stamp = wib.replace(' ', '_').replace(':', '');
  return `${match.nama}_${stamp}`.slice(0, 80);
}

type LogoResult = { ok: true; url: string | null } | { ok: false };

export function AddWalletSheet({ open, onOpenChange, addWallet, onSubmitted }: AddWalletSheetProps) {
  const [jenis, setJenis] = useState<Jenis>('bank');
  const [selected, setSelected] = useState<string | null>(null);
  const [nama, setNama] = useState('');
  const [namaDiedit, setNamaDiedit] = useState(false);
  const [saldoAwal, setSaldoAwal] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Dompet arsip yang namanya sama dengan yang diisi, beserta saldo yang diinput. */
  const [konflik, setKonflik] = useState<{ arsip: WalletNameMatch; saldoBaru: number } | null>(null);

  // Kosongkan form setiap sheet ditutup, supaya pembukaan berikutnya bersih.
  useEffect(() => {
    if (open) return;
    setJenis('bank');
    setSelected(null);
    setNama('');
    setNamaDiedit(false);
    setSaldoAwal('');
    setLogoFile(null);
    setKonflik(null);
    setSaving(false);
  }, [open]);

  // Preview logo; object URL dibebaskan setiap kali file berganti.
  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const providers = jenis === 'bank' ? BANK_PROVIDERS : EWALLET_PROVIDERS;
  const isOther = selected === OTHER_PROVIDER_CODE;

  function pilihJenis(next: Jenis) {
    setJenis(next);
    setKonflik(null);
    // Pilihan dari jenis lain tidak boleh tersisa setelah jenis berganti.
    setSelected((cur) => {
      if (!cur || cur === OTHER_PROVIDER_CODE) return cur;
      const p = [...BANK_PROVIDERS, ...EWALLET_PROVIDERS].find((x) => x.code === cur);
      return p?.jenis === next ? cur : null;
    });
    if (selected !== OTHER_PROVIDER_CODE) setLogoFile(null);
  }

  function pilihProvider(p: WalletProvider) {
    setSelected(p.code);
    setLogoFile(null);
    setKonflik(null);
    if (!namaDiedit) setNama(`Dompet ${p.nama}`);
  }

  function pilihLainnya() {
    setSelected(OTHER_PROVIDER_CODE);
    setKonflik(null);
    if (!namaDiedit) setNama('');
  }

  function onNamaChange(e: ChangeEvent<HTMLInputElement>) {
    setNama(e.target.value);
    setNamaDiedit(true);
    setKonflik(null);
  }

  function onSaldoChange(e: ChangeEvent<HTMLInputElement>) {
    setSaldoAwal(formatRupiahInput(e.target.value));
  }

  async function onLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Ukuran logo maksimal 2 MB');
      return;
    }
    // Logo disesuaikan otomatis (dipotong dan dipusatkan di kanvas 480×160) sebelum dipakai.
    setLogoFile(await normalizeLogo(file));
  }

  /** Unggah logo hanya untuk pilihan "Lainnya" dan bila ada file. */
  async function unggahLogoBila(): Promise<LogoResult> {
    if (!isOther || !logoFile) return { ok: true, url: null };
    const up = await uploadWalletLogo(logoFile);
    if (up.error || !up.url) {
      toast.error('Gagal mengunggah logo', { description: up.error ?? undefined });
      return { ok: false };
    }
    return { ok: true, url: up.url };
  }

  function selesai(namaFinal: string) {
    toast.success('Dompet berhasil ditambahkan', { description: namaFinal });
    onSubmitted();
    onOpenChange(false);
  }

  /** Buat baris dompet baru. Mengembalikan false bila gagal (sudah ada pesan error). */
  async function buatBaru(namaFinal: string, saldo: number): Promise<boolean> {
    const logo = await unggahLogoBila();
    if (!logo.ok) return false;
    // Grid hanya menampilkan provider sesuai jenis aktif, jadi jenis state sudah benar.
    const res = await addWallet({
      nama: namaFinal,
      provider: selected ?? '',
      saldo,
      jenis,
      logo_url: logo.url,
    });
    if (!res.success) {
      toast.error('Gagal menambah dompet', { description: res.error ?? undefined });
      return false;
    }
    return true;
  }

  async function simpan() {
    if (!selected) {
      toast.error('Pilih bank atau e-wallet dulu');
      return;
    }
    const namaFinal = nama.trim();
    if (!namaFinal) {
      toast.error('Nama dompet wajib diisi');
      return;
    }
    const saldoFinal = parseRupiah(saldoAwal);
    if (saldoFinal === null) {
      toast.error('Saldo awal tidak valid', { description: 'Isi dengan angka saja, contoh: 1500000' });
      return;
    }

    setSaving(true);
    try {
      const cek = await findWalletsByName(namaFinal);
      if (cek.error) {
        toast.error('Gagal memeriksa nama dompet', { description: cek.error });
        return;
      }
      if (cek.matches.some((m) => !m.isArchived)) {
        toast.error('Nama dompet sudah dipakai', { description: 'Pilih nama lain.' });
        return;
      }
      const arsip = cek.matches.find((m) => m.isArchived);
      if (arsip) {
        // Jangan buat dompet baru dulu; tanyakan dulu apa yang dipakai.
        setKonflik({ arsip, saldoBaru: saldoFinal });
        return;
      }
      if (await buatBaru(namaFinal, saldoFinal)) selesai(namaFinal);
    } finally {
      setSaving(false);
    }
  }

  /** Pilihan 1: pulihkan dompet arsip beserta sisa saldonya. Saldo yang diinput diabaikan. */
  async function pakaiSisaArsip() {
    if (!konflik) return;
    setSaving(true);
    try {
      const logo = await unggahLogoBila();
      if (!logo.ok) return;
      const res = await restoreWalletRow(konflik.arsip.id, {
        provider: selected ?? '',
        jenis,
        logo_url: logo.url,
      });
      if (!res.success) {
        toast.error('Gagal memulihkan dompet', { description: res.error ?? undefined });
        return;
      }
      toast.success('Dompet dipulihkan dengan sisa saldo lama', {
        description: `${konflik.arsip.nama} · ${formatIDR(konflik.arsip.saldo)}`,
      });
      onSubmitted();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  /** Pilihan 2: dompet lama diganti nama dan diarsip dengan sisanya, lalu dompet baru dibuat dengan saldo yang diinput. */
  async function mulaiBaru() {
    if (!konflik) return;
    const namaFinal = nama.trim();
    const { arsip, saldoBaru } = konflik;
    setSaving(true);
    try {
      const namaLama = namaArsipUntuk(arsip);
      const ren = await renameWalletRow(arsip.id, namaLama);
      if (!ren.success) {
        toast.error('Gagal menyiapkan dompet arsip', { description: ren.error ?? undefined });
        return;
      }
      if (await buatBaru(namaFinal, saldoBaru)) {
        selesai(namaFinal);
      } else {
        // Dibatalkan: kembalikan nama dompet arsip seperti semula.
        await renameWalletRow(arsip.id, arsip.nama);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="font-display text-lg">Tambah Dompet</SheetTitle>
          <SheetDescription>Pilih bank atau e-wallet, lalu beri nama dompetmu.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Jenis Dompet
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <JenisCard
                active={jenis === 'bank'}
                icon={Landmark}
                label="Bank"
                onClick={() => pilihJenis('bank')}
              />
              <JenisCard
                active={jenis === 'ewallet'}
                icon={Smartphone}
                label="E-Wallet"
                onClick={() => pilihJenis('ewallet')}
              />
            </div>
          </section>

          <section className="space-y-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {jenis === 'bank' ? 'Pilih Bank' : 'Pilih E-Wallet'}
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {providers.map((p) => (
                <ProviderTile
                  key={p.code}
                  provider={p}
                  active={selected === p.code}
                  onClick={() => pilihProvider(p)}
                />
              ))}
            </div>

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">atau</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={pilihLainnya}
              aria-pressed={isOther}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 text-sm font-semibold transition-colors',
                isOther
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
              )}
            >
              <Plus className="h-4 w-4" />
              Lainnya (tidak ada di daftar)
            </button>
          </section>

          {isOther && (
            <section className="space-y-2.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Logo Dompet <span className="font-normal normal-case">(opsional)</span>
              </Label>
              <div className="flex items-center gap-3">
                <div className="grid h-20 w-44 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-white p-2">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Preview logo dompet" className="h-full w-full object-contain" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="inline-flex cursor-pointer items-center gap-2 self-start rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                    <Upload className="h-4 w-4" />
                    {logoFile ? 'Ganti logo' : 'Unggah logo'}
                    <input type="file" accept={LOGO_ACCEPT} className="sr-only" onChange={onLogoChange} />
                  </label>
                  {logoFile && (
                    <button
                      type="button"
                      onClick={() => setLogoFile(null)}
                      className="self-start text-xs text-muted-foreground hover:text-destructive"
                    >
                      Hapus logo
                    </button>
                  )}
                  <p className="text-[11px] text-muted-foreground">PNG, JPG, WEBP, atau SVG. Maks 2 MB.</p>
                </div>
              </div>
            </section>
          )}

          <section className="space-y-2.5">
            <Label htmlFor="nama-dompet" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nama Dompet
            </Label>
            <Input
              id="nama-dompet"
              value={nama}
              maxLength={40}
              placeholder="Contoh: Dompet BCA"
              onChange={onNamaChange}
            />
          </section>

          <section className="space-y-2.5">
            <Label htmlFor="saldo-awal" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Saldo Awal <span className="font-normal normal-case">(opsional)</span>
            </Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                id="saldo-awal"
                inputMode="numeric"
                autoComplete="off"
                value={saldoAwal}
                placeholder="0"
                onChange={onSaldoChange}
                className="pl-10 tabular-nums"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Kosongkan bila saldo mulai dari Rp 0. Saldo ini tidak dihitung sebagai pemasukan.
            </p>
          </section>

          {konflik && (
            <section role="alert" className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
              <p className="text-sm font-semibold text-foreground">
                Dompet "{konflik.arsip.nama}" pernah diarsipkan
              </p>
              <p className="text-xs text-muted-foreground">
                Sisa saldonya masih tersimpan {formatIDR(konflik.arsip.saldo)}. Pilih cara melanjutkan:
              </p>
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="h-auto justify-start py-2.5 text-left" onClick={pakaiSisaArsip} disabled={saving}>
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-semibold">Pakai sisa saldo {formatIDR(konflik.arsip.saldo)}</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Dompet lama dipulihkan. Saldo yang kamu isi ({formatIDR(konflik.saldoBaru)}) diabaikan.
                    </span>
                  </span>
                </Button>
                <Button variant="outline" className="h-auto justify-start py-2.5 text-left" onClick={mulaiBaru} disabled={saving}>
                  <span className="flex flex-col items-start">
                    <span className="text-sm font-semibold">Mulai baru dengan {formatIDR(konflik.saldoBaru)}</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Dompet lama diganti nama jadi {namaArsipUntuk(konflik.arsip)} dan tetap di arsip.
                    </span>
                  </span>
                </Button>
              </div>
            </section>
          )}
        </div>

        <SheetFooter className="flex-row gap-3 border-t border-border px-6 py-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>
            Batal
          </Button>
          <Button className="flex-1" onClick={simpan} disabled={saving || konflik !== null}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function JenisCard({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-4 text-sm font-semibold transition-colors',
        active
          ? 'border-primary bg-primary/5 text-primary'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {active && (
        <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </span>
      )}
      <Icon className="h-6 w-6" />
      {label}
    </button>
  );
}

function ProviderTile({
  provider,
  active,
  onClick,
}: {
  provider: WalletProvider;
  active: boolean;
  onClick: () => void;
}) {
  // Bila logo belum ada atau gagal dimuat, kembali ke tile berwarna dengan glyph.
  const [logoGagal, setLogoGagal] = useState(false);
  const tampilLogo = Boolean(provider.logo) && !logoGagal;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={provider.nama}
      className={cn(
        'relative flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-colors',
        active ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40',
      )}
    >
      {active && (
        <span className="absolute right-1 top-1 z-10 grid h-4 w-4 place-items-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}
      {tampilLogo ? (
        <img
          src={provider.logo}
          alt=""
          aria-hidden="true"
          loading="lazy"
          draggable={false}
          onError={() => setLogoGagal(true)}
          className="aspect-[3/1] w-full rounded-lg border border-border/60 bg-white object-contain"
        />
      ) : (
        <span
          className="grid aspect-[3/1] w-full place-items-center rounded-lg text-xs font-extrabold tracking-tight text-white"
          style={{ backgroundColor: provider.color }}
        >
          {provider.glyph}
        </span>
      )}
      <span className="w-full truncate text-center text-[11px] font-medium text-foreground">{provider.nama}</span>
    </button>
  );
}
