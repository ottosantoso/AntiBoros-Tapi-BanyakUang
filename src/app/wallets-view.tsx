import { useCallback, useEffect, useState } from 'react';
import { Archive, Eye, EyeOff, Pencil, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { DashboardData, Wallet } from '@/lib/types';
import { WalletGrid } from '@/components/wallet-card';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  archiveWalletRow,
  fetchArchivedWallets,
  restoreWalletRow,
  type ArchivedWallet,
  type WalletEditInput,
  type WriteResult,
} from '@/lib/data';
import { EditWalletSheet } from '@/components/edit-wallet-sheet';
import { formatIDR, formatIDRCompact } from '@/lib/format';
import { getWalletMeta } from '@/lib/wallets';
import { PaginationBar, usePagination } from '@/components/pagination-bar';

const ARCHIVED_PAGE_SIZE = 10;

/** Angka saldo yang disamarkan saat mode sembunyi aktif. */
const MASKED = 'Rp •••••••';

export function WalletsView({
  data,
  loading,
  onAddWallet,
  editWallet,
  onChanged,
}: {
  data: DashboardData;
  loading: boolean;
  onAddWallet: () => void;
  editWallet: (id: string, input: WalletEditInput) => Promise<WriteResult>;
  /** Dipanggil setelah dompet diarsipkan atau dipulihkan, agar data dashboard ikut diperbarui. */
  onChanged: () => void;
}) {
  const wallets = data.dompet;
  const positive = wallets.filter((w) => w.saldo >= 0);
  const negative = wallets.filter((w) => w.saldo < 0);
  const positiveTotal = positive.reduce((s, w) => s + w.saldo, 0);
  const negativeTotal = negative.reduce((s, w) => s + w.saldo, 0);

  const [archived, setArchived] = useState<ArchivedWallet[]>([]);
  const archivedPage = usePagination(archived, ARCHIVED_PAGE_SIZE, '');
  const [target, setTarget] = useState<Wallet | null>(null);
  const [editTarget, setEditTarget] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState(false);
  /** Sembunyikan semua angka saldo di halaman ini (misalnya saat layar bisa dilihat orang lain). Tidak disimpan. */
  const [sembunyi, setSembunyi] = useState(false);

  const tampil = (nilai: number) => (sembunyi ? MASKED : formatIDR(nilai));
  const tampilRingkas = (nilai: number) => (sembunyi ? MASKED : formatIDRCompact(nilai));

  const muatArsip = useCallback(async () => {
    const res = await fetchArchivedWallets();
    if (res.error) toast.error('Gagal memuat dompet diarsipkan', { description: res.error });
    else setArchived(res.wallets);
  }, []);

  // Ikut diperbarui setiap data dashboard berubah (termasuk polling).
  useEffect(() => {
    muatArsip();
  }, [data, muatArsip]);

  async function arsipkan() {
    if (!target) return;
    setBusy(true);
    const res = await archiveWalletRow(target.id);
    setBusy(false);
    const nama = target.nama;
    const saldo = target.saldo;
    setTarget(null);
    if (!res.success) {
      toast.error('Gagal mengarsipkan dompet', { description: res.error ?? undefined });
      return;
    }
    toast.success('Dompet diarsipkan', {
      description: `${nama} tidak bisa dipakai lagi. Sisa saldo ${formatIDR(saldo)} tetap tersimpan.`,
    });
    onChanged();
    muatArsip();
  }

  async function pulihkan(w: ArchivedWallet) {
    const res = await restoreWalletRow(w.id);
    if (!res.success) {
      toast.error('Gagal memulihkan dompet', { description: res.error ?? undefined });
      return;
    }
    toast.success('Dompet dipulihkan', { description: `${w.nama} aktif lagi.` });
    onChanged();
    muatArsip();
  }

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Total Dompet</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setSembunyi((v) => !v)}
              aria-label={sembunyi ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
              aria-pressed={sembunyi}
              title={sembunyi ? 'Tampilkan saldo' : 'Sembunyikan saldo'}
            >
              {sembunyi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 font-display text-xl font-bold tnum text-balance">{tampil(data.totalSaldo)}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Saldo Positif</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 font-display text-xl font-bold tnum text-income">{tampilRingkas(positiveTotal)}</p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Saldo Minus</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 font-display text-xl font-bold tnum text-expense">
              {negative.length ? tampilRingkas(negativeTotal) : sembunyi ? MASKED : 'Rp 0'}
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
        <Button size="sm" onClick={onAddWallet}>
          <Plus className="mr-1.5 h-4 w-4" />
          Tambah Dompet
        </Button>
      </div>

      <WalletGrid wallets={wallets} loading={loading} sembunyi={sembunyi} />

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
                <div key={w.id} className="flex items-center gap-4 px-5 py-3.5">
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
                      {sembunyi ? MASKED : (
                        <>
                          {meta.negative && '-'}
                          {formatIDR(Math.abs(w.saldo))}
                        </>
                      )}
                    </p>
                    {meta.negative && (
                      <p className="text-[11px] font-medium text-expense">Saldo minus</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Ubah ${w.nama}`}
                    title="Ubah dompet"
                    onClick={() => setEditTarget(w)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Arsipkan ${w.nama}`}
                    title="Arsipkan dompet"
                    onClick={() => setTarget(w)}
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Dompet arsip: tidak dipakai di transaksi, transfer, atau total, tapi riwayat dan saldonya tetap ada */}
      {archived.length > 0 && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-display text-base font-bold tracking-tight">Dompet Diarsipkan</h3>
            <p className="text-xs text-muted-foreground">
              Tidak dipakai di transaksi, transfer, atau total saldo. Riwayat dan sisa saldonya tetap tersimpan.
            </p>
          </div>
          <div className="divide-y divide-border/60">
            {archivedPage.pageItems.map((w) => {
              const meta = getWalletMeta(w);
              return (
                <div key={w.id} className="flex items-center gap-4 px-5 py-3.5 opacity-75">
                  <div
                    className={`grid h-10 w-14 place-items-center rounded-lg bg-gradient-to-br ${meta.gradient} text-xs font-bold text-white grayscale`}
                  >
                    {meta.glyph}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{w.nama}</p>
                    <p className="text-xs text-muted-foreground">Diarsipkan</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold tnum text-foreground">{tampil(w.saldo)}</p>
                    <p className="text-[11px] text-muted-foreground">Sisa saldo</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => pulihkan(w)}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Pulihkan
                  </Button>
                </div>
              );
            })}
          </div>
          <div className="px-5 pb-4">
            <PaginationBar
              page={archivedPage.page}
              totalPages={archivedPage.totalPages}
              total={archivedPage.total}
              from={archivedPage.from}
              to={archivedPage.to}
              setPage={archivedPage.setPage}
              noun="dompet diarsipkan"
            />
          </div>
        </Card>
      )}

      {editTarget && (
        <EditWalletSheet
          key={editTarget.id}
          wallet={editTarget}
          editWallet={editWallet}
          onSubmitted={onChanged}
          onClose={() => setEditTarget(null)}
        />
      )}

      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arsipkan dompet "{target?.nama}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Dompet tidak bisa dipakai untuk transaksi atau transfer baru. Sisa saldo{' '}
              {formatIDR(target?.saldo ?? 0)} tetap tersimpan dan bisa dipulihkan kapan saja dari bagian Dompet
              Diarsipkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                arsipkan();
              }}
              disabled={busy}
            >
              Arsipkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
