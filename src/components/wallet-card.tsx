import { AlertTriangle, Wallet2 } from 'lucide-react';
import type { Wallet } from '@/lib/types';
import { getWalletMeta } from '@/lib/wallets';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';

/** A single wallet rendered as a premium credit-card shape. */
export function WalletCard({ wallet, index = 0 }: { wallet: Wallet; index?: number }) {
  const meta = getWalletMeta(wallet);
  return (
    <div
      className={cn(
        'lift group relative aspect-[1.6/1] w-full overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg transition-all duration-300 hover:shadow-xl',
        meta.gradient,
      )}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* glossy highlight */}
      <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-28 w-28 rounded-full bg-black/10 blur-2xl" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">Dompet</p>
            <p className="font-display text-base font-bold leading-tight">{meta.brand}</p>
          </div>
          <div className="grid h-9 w-12 place-items-center rounded-md bg-white/15 text-xs font-bold tracking-wide backdrop-blur-sm">
            {meta.glyph}
          </div>
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
          <p className="font-display text-xl font-bold tnum leading-tight">
            {meta.negative && '-'}
            {formatIDR(Math.abs(wallet.saldo))}
          </p>
        </div>

        {meta.negative && (
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-rose-600 shadow">
            <AlertTriangle className="h-3 w-3" /> Minus
          </div>
        )}
      </div>
    </div>
  );
}

export function WalletCardSkeleton() {
  return (
    <div className="aspect-[1.6/1] w-full animate-pulse rounded-2xl bg-muted" />
  );
}

export function WalletGrid({ wallets, loading }: { wallets: Wallet[]; loading?: boolean }) {
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
        <p className="text-xs text-muted-foreground/70">Hubungkan Google Apps Script untuk memuat saldo.</p>
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
          <WalletCard key={w.nama} wallet={w} index={i} />
        ))}
      </div>
    </div>
  );
}
