import { Wallet2 } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import { WalletGrid } from '@/components/wallet-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatIDR, formatIDRCompact } from '@/lib/format';
import { getWalletMeta } from '@/lib/wallets';

export function WalletsView({ data, loading }: { data: DashboardData; loading: boolean }) {
  const wallets = data.dompet;
  const positive = wallets.filter((w) => w.saldo >= 0);
  const negative = wallets.filter((w) => w.saldo < 0);
  const positiveTotal = positive.reduce((s, w) => s + w.saldo, 0);
  const negativeTotal = negative.reduce((s, w) => s + w.saldo, 0);

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Total Dompet</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 font-display text-xl font-bold tnum text-balance">{formatIDR(data.totalSaldo)}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Saldo Positif</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 font-display text-xl font-bold tnum text-income">{formatIDRCompact(positiveTotal)}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Saldo Minus</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 font-display text-xl font-bold tnum text-expense">
              {negative.length ? formatIDRCompact(negativeTotal) : 'Rp 0'}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Jumlah Dompet</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-16" />
          ) : (
            <p className="mt-1 font-display text-xl font-bold tnum">{wallets.length}</p>
          )}
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Semua Dompet</h2>
          <p className="text-sm text-muted-foreground">Saldo live dari setiap sumber dana</p>
        </div>
        <Wallet2 className="h-5 w-5 text-muted-foreground" />
      </div>

      <WalletGrid wallets={wallets} loading={loading} />

      {/* Detailed table */}
      {!loading && wallets.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-display text-base font-bold tracking-tight">Rincian Saldo</h3>
          </div>
          <div className="divide-y divide-border/60">
            {wallets.map((w) => {
              const meta = getWalletMeta(w);
              return (
                <div key={w.nama} className="flex items-center gap-4 px-5 py-3.5">
                  <div
                    className={`grid h-10 w-14 place-items-center rounded-lg bg-gradient-to-br ${meta.gradient} text-xs font-bold text-white`}
                  >
                    {meta.glyph}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{meta.brand}</p>
                    <p className="text-xs text-muted-foreground">{w.nama}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-bold tnum ${meta.negative ? 'text-expense' : 'text-foreground'}`}
                    >
                      {meta.negative && '-'}
                      {formatIDR(Math.abs(w.saldo))}
                    </p>
                    {meta.negative && (
                      <p className="text-[11px] font-medium text-expense">Saldo minus</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
