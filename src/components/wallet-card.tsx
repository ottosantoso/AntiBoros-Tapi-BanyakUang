import { AlertTriangle, Wallet2 } from 'lucide-react';
import type { Wallet } from '@/lib/types';
import { getWalletMeta } from '@/lib/wallets';
import { providerLogo } from '@/lib/wallet-providers';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Angka saldo yang disamarkan saat mode sembunyi aktif. */
const MASKED = 'Rp •••••••';

/** A single wallet rendered as a premium credit-card shape. */
export function WalletCard({
  wallet,
  index = 0,
  sembunyi = false,
  persen = null,
  onOpen,
}: {
  wallet: Wallet;
  index?: number;
  /** Jika true, saldo disamarkan. Badge minus tetap tampil supaya kondisi dompet tetap terlihat. */
  sembunyi?: boolean;
  /** Persen perubahan bulan ini. Null bila belum tersedia atau saldo awal bulan 0. */
  persen?: number | null;
  /** Dipanggil saat kartu diklik. Bila tidak diisi, kartu tidak bisa diklik. */
  onOpen?: () => void;
}) {
  const meta = getWalletMeta(wallet);
  // Logo unggahan dulu; kalau tidak ada, pakai logo katalog untuk provider ini.
  const logo = meta.logoUrl ?? providerLogo(wallet.provider);

  const isi = (
    <>
      {/* glossy highlight */}
      <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-black/10 blur-2xl" />

      <div className="relative flex flex-1 flex-col justify-between gap-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Dompet</p>
            <p className="font-display text-base font-bold leading-tight">{meta.brand}</p>
          </div>
          {logo ? (
            // Chip putih sengaja: logo bank/e-wallet mudah terbaca di atas warna kartu apa pun
            <div className="flex h-11 max-w-[9.5rem] items-center rounded-lg bg-white px-2.5 shadow-sm">
              <img src={logo} alt="" className="h-8 w-auto max-w-full object-contain" />
            </div>
          ) : (
            <div className="grid h-9 w-12 place-items-center rounded-md bg-white/15 text-xs font-bold tracking-wide backdrop-blur-sm">
              {meta.glyph}
            </div>
          )}
        </div>

        {/* chip */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-8 rounded-md bg-gradient-to-br from-yellow-200/80 to-yellow-400/80 shadow-inner" />
          <div className="flex gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-white/40" />
            ))}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-medium text-white/70">Saldo tersisa</p>
          <p className="font-display text-xl font-bold tnum leading-tight sm:text-2xl whitespace-nowrap">
            {sembunyi ? (
              MASKED
            ) : (
              <>
                {meta.negative && '-'}
                {formatIDR(Math.abs(wallet.saldo))}
              </>
            )}
          </p>
          {persen !== null && (
            <p className="mt-0.5 text-[11px] font-semibold tnum text-white/90">
              {persen > 0 ? '+' : ''}
              {persen.toLocaleString('id-ID', { maximumFractionDigits: 1 })}% bulan ini
            </p>
          )}
        </div>

        {meta.negative && (
          <div className="absolute right-0 top-0 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-rose-600 shadow">
            <AlertTriangle className="h-3 w-3" /> Minus
          </div>
        )}
      </div>
    </>
  );

  const kelas = cn(
    // Tinggi pakai min-h, bukan aspect-ratio: di iOS Safari aspect-ratio + h-full membuat nominal terpotong.
    'lift group relative flex min-h-[14rem] w-full flex-col overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg transition-all duration-300 hover:shadow-xl sm:min-h-[15rem] sm:p-5',
    meta.gradient,
  );

  if (onOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={cn(kelas, 'text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2')}
        style={{ animationDelay: `${index * 60}ms` }}
        aria-label={`Lihat detail ${wallet.nama}`}
      >
        {isi}
      </button>
    );
  }

  return (
    <div className={kelas} style={{ animationDelay: `${index * 60}ms` }}>
      {isi}
    </div>
  );
}

export function WalletCardSkeleton() {
  return (
    <div className="min-h-[14rem] w-full animate-pulse rounded-2xl bg-muted sm:min-h-[15rem]" />
  );
}

export function WalletGrid({
  wallets,
  loading,
  sembunyi = false,
  persenById,
  onOpen,
}: {
  wallets: Wallet[];
  loading?: boolean;
  sembunyi?: boolean;
  /** Persen perubahan per id dompet. */
  persenById?: Record<string, number | null>;
  /** Dipanggil dengan id dompet saat kartunya diklik. */
  onOpen?: (walletId: string) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <WalletCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!wallets.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
        <Wallet2 className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">Belum ada dompet.</p>
        <p className="text-xs text-muted-foreground/70">Tambahkan dompet untuk mulai mencatat saldo.</p>
      </div>
    );
  }

  const negativeCount = wallets.filter((w) => w.saldo < 0).length;

  return (
    <div>
      {negativeCount > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{negativeCount} dompet memiliki saldo minus. Perlu ditinjau.</span>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {wallets.map((w, i) => (
          <WalletCard
            key={w.id}
            wallet={w}
            index={i}
            sembunyi={sembunyi}
            persen={persenById?.[w.id] ?? null}
            onOpen={onOpen ? () => onOpen(w.id) : undefined}
          />
        ))}
      </div>
    </div>
  );
}
