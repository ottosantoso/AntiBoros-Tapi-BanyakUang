import { useEffect, useState, type ChangeEvent } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  fetchSubkategori,
  insertTransaction,
  matchSubkategori,
  uploadWalletLogo,
  type WalletEditInput,
  type WriteResult,
} from '@/lib/data';
import { formatIDR } from '@/lib/format';
import { normalizeLogo } from '@/lib/logo';
import type { TransactionType, Wallet } from '@/lib/types';
import { BANK_PROVIDERS, EWALLET_PROVIDERS, OTHER_PROVIDER_CODE, providerLogo } from '@/lib/wallet-providers';

type JenisPilihan = 'bank' | 'ewallet';

/** Kode provider untuk dompet tunai, sama dengan yang dipakai di form Tambah Dompet. */
const TUNAI_PROVIDER = 'CASH';

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';
const KATALOG = [...BANK_PROVIDERS, ...EWALLET_PROVIDERS];

/** Kode provider yang dibandingkan dengan katalog: huruf besar, tanpa spasi atau tanda hubung. */
function kodeProvider(provider: string): string {
  return provider.toUpperCase().replace(/[\s-]/g, '');
}

/** Tampilan saldo dengan titik ribuan, mis. -1250000 -> -1.250.000. */
function formatSaldoInput(n: number): string {
  const digits = String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + digits;
}

/** Ketikan saldo jadi angka. Kosong dianggap 0; tanda minus di depan diperbolehkan. */
function parseSaldoInput(raw: string): number | null {
  const negatif = raw.trim().startsWith('-');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  if (!Number.isSafeInteger(n)) return null;
  return negatif ? -n : n;
}

/** Tanggal hari ini di zona Jakarta, format YYYY-MM-DD. */
function tanggalHariIni(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

interface EditWalletSheetProps {
  wallet: Wallet;
  onClose: () => void;
  editWallet: (id: string, input: WalletEditInput) => Promise<WriteResult>;
  onSubmitted: () => void;
}

/**
 * Menu edit dompet aktif. Dirender hanya saat ada dompet yang dipilih
 * (parent memakai key per dompet), jadi state awalnya cukup dari props.
 */
export function EditWalletSheet({ wallet, onClose, editWallet, onSubmitted }: EditWalletSheetProps) {
  const [nama, setNama] = useState(wallet.nama);
  const [provider, setProvider] = useState(kodeProvider(wallet.provider));
  const [jenisLainnya, setJenisLainnya] = useState<JenisPilihan>(wallet.jenis === 'ewallet' ? 'ewallet' : 'bank');
  const [saldoInput, setSaldoInput] = useState(formatSaldoInput(wallet.saldo));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [hapusLogo, setHapusLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  // Preview logo baru; object URL dibebaskan setiap kali file berganti.
  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const isOther = provider === OTHER_PROVIDER_CODE;
  const isTunai = provider === TUNAI_PROVIDER;
  const katalogTerpilih = KATALOG.find((p) => p.code === provider);
  // Provider lama yang tidak ada di katalog (mis. JENIUS) tetap bisa dipilih ulang.
  const providerLama = !katalogTerpilih && !isOther && !isTunai;

  // Jenis mengikuti provider yang dipilih; untuk Lainnya, pengguna memilih sendiri.
  const jenisFinal: Wallet['jenis'] = katalogTerpilih
    ? katalogTerpilih.jenis
    : isTunai
      ? 'tunai'
      : isOther
        ? jenisLainnya
        : wallet.jenis;

  const logoSekarang = hapusLogo ? null : (wallet.logoUrl ?? providerLogo(provider));
  const previewTampil = logoPreview ?? logoSekarang;
  const bisaHapusLogo = !logoFile && !hapusLogo && wallet.logoUrl !== null;

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
    setHapusLogo(false);
  }

  async function simpan() {
    const namaFinal = nama.trim();
    if (!namaFinal) {
      toast.error('Nama dompet wajib diisi');
      return;
    }
    const saldoBaru = parseSaldoInput(saldoInput);
    if (saldoBaru === null) {
      toast.error('Saldo tidak valid');
      return;
    }

    setSaving(true);
    try {
      // Logo: unggahan baru, atau hapus unggahan (kartu kembali memakai logo provider), atau biarkan.
      let logoUrl: string | null = hapusLogo ? null : wallet.logoUrl;
      if (logoFile) {
        const up = await uploadWalletLogo(logoFile);
        if (up.error || !up.url) {
          toast.error('Gagal mengunggah logo', { description: up.error ?? undefined });
          return;
        }
        logoUrl = up.url;
      }

      const res = await editWallet(wallet.id, {
        nama: namaFinal,
        provider,
        jenis: jenisFinal,
        logo_url: logoUrl,
      });
      if (!res.success) {
        const pesan = res.error ?? '';
        const namaKembar = /wallets_user_nama_key|duplicate key/i.test(pesan);
        toast.error('Gagal menyimpan dompet', {
          description: namaKembar ? 'Nama dompet sudah dipakai, baik yang aktif maupun yang diarsipkan.' : pesan,
        });
        return;
      }

      // Saldo tidak ditulis langsung (ditolak database). Selisihnya dicatat sebagai transaksi penyesuaian,
      // sehingga trigger saldo dan riwayat tetap sinkron.
      const selisih = saldoBaru - wallet.saldo;
      if (selisih !== 0) {
        const tipeAdj = (selisih > 0 ? 'Pemasukan' : 'Pengeluaran') as TransactionType;
        const sub = matchSubkategori(await fetchSubkategori(), 'Penyesuaian Saldo', tipeAdj);
        const adj = await insertTransaction({
          tanggal: tanggalHariIni(),
          deskripsi: 'Penyesuaian saldo',
          tipe: tipeAdj,
          nominal: Math.abs(selisih),
          walletId: wallet.id,
          kategori: sub?.kategori ?? 'Penyesuaian Saldo',
          subkategoriId: sub?.id ?? null,
        });
        if (!adj.success) {
          toast.error('Data dompet tersimpan, tetapi saldo belum diubah', { description: adj.error ?? undefined });
          onSubmitted();
          return;
        }
      }

      toast.success('Dompet diperbarui', { description: namaFinal });
      onSubmitted();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-6 py-5 text-left">
          <SheetTitle className="font-display text-lg">Ubah Dompet</SheetTitle>
          <SheetDescription>Ubah nama, provider, logo, atau saldo dompet.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <section className="space-y-2.5">
            <Label htmlFor="edit-nama" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Nama Dompet
            </Label>
            <Input
              id="edit-nama"
              value={nama}
              maxLength={40}
              disabled={saving}
              onChange={(e) => setNama(e.target.value)}
            />
          </section>

          <section className="space-y-2.5">
            <Label htmlFor="edit-provider" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Bank / E-Wallet / Tunai
            </Label>
            <Select value={provider} onValueChange={setProvider} disabled={saving}>
              <SelectTrigger id="edit-provider">
                <SelectValue placeholder="Pilih provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Bank</SelectLabel>
                  {BANK_PROVIDERS.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.nama}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>E-Wallet</SelectLabel>
                  {EWALLET_PROVIDERS.map((p) => (
                    <SelectItem key={p.code} value={p.code}>
                      {p.nama}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Tunai</SelectLabel>
                  <SelectItem value={TUNAI_PROVIDER}>Tunai</SelectItem>
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Lainnya</SelectLabel>
                  <SelectItem value={OTHER_PROVIDER_CODE}>Dompet lainnya</SelectItem>
                </SelectGroup>
                {providerLama && (
                  <SelectGroup>
                    <SelectLabel>Saat ini</SelectLabel>
                    <SelectItem value={provider}>{wallet.provider}</SelectItem>
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </section>

          {isOther && (
            <section className="space-y-2.5">
              <Label htmlFor="edit-jenis" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Jenis Dompet Lainnya
              </Label>
              <Select value={jenisLainnya} onValueChange={(v) => setJenisLainnya(v as JenisPilihan)} disabled={saving}>
                <SelectTrigger id="edit-jenis">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bank">Bank</SelectItem>
                  <SelectItem value="ewallet">E-Wallet</SelectItem>
                </SelectContent>
              </Select>
            </section>
          )}

          <section className="space-y-2.5">
            <Label htmlFor="edit-saldo" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Saldo
            </Label>
            <p className="text-sm text-muted-foreground">
              Saldo saat ini <span className="font-semibold text-foreground">{formatIDR(wallet.saldo)}</span>
            </p>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                Rp
              </span>
              <Input
                id="edit-saldo"
                inputMode="numeric"
                className="pl-10 tnum"
                value={saldoInput}
                disabled={saving}
                onChange={(e) => setSaldoInput(formatSaldoInput(parseSaldoInput(e.target.value) ?? 0))}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Jika diubah, selisihnya dicatat sebagai transaksi "Penyesuaian saldo" (pemasukan atau pengeluaran)
              dan ikut terhitung di laporan.
            </p>
          </section>

          <section className="space-y-2.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Logo Dompet <span className="font-normal normal-case">(opsional)</span>
            </Label>
            {/* Background putih sengaja: logo transparan dan logo SVG tampil sama jelasnya */}
            <div className="grid h-24 w-full place-items-center overflow-hidden rounded-xl border border-border bg-white p-3">
              {previewTampil ? (
                <img src={previewTampil} alt="Preview logo dompet" className="h-full w-full object-contain" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                <Upload className="h-4 w-4" />
                {logoFile ? 'Ganti logo' : wallet.logoUrl ? 'Ganti logo' : 'Unggah logo'}
                <input type="file" accept={LOGO_ACCEPT} className="sr-only" disabled={saving} onChange={onLogoChange} />
              </label>
              {(logoFile || bisaHapusLogo) && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setLogoFile(null);
                    setHapusLogo(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                  {logoFile ? 'Batalkan logo baru' : 'Hapus logo unggahan'}
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tanpa logo unggahan, kartu memakai logo provider. PNG, JPG, WEBP, atau SVG, maks 2 MB.
            </p>
          </section>
        </div>

        <SheetFooter className="flex-row gap-3 border-t border-border px-6 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Batal
          </Button>
          <Button className="flex-1" onClick={simpan} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
