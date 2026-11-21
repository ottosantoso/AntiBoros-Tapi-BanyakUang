import { CalendarDays, FileSearch2, Search, Sparkles, WalletCards, X } from 'lucide-react';
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
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { TransactionType } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatIDR } from '@/lib/format';

export type TxKind = TransactionType | 'Transfer';

export function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  loading,
  hint,
}: {
  label: string;
  value: number;
  icon: typeof CalendarDays;
  tone: 'income' | 'expense' | 'net' | 'neutral';
  loading?: boolean;
  hint?: string;
}) {
  const toneClass =
    tone === 'income'
      ? 'text-emerald-300'
      : tone === 'expense'
        ? 'text-rose-300'
        : tone === 'net'
          ? 'text-sky-300'
          : 'text-foreground';
  return (
    <Card className="relative overflow-hidden rounded-2xl border-border bg-card p-4 shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'grid h-10 w-10 place-items-center rounded-xl',
            tone === 'income' && 'bg-emerald-500/15 text-emerald-300',
            tone === 'expense' && 'bg-rose-500/15 text-rose-300',
            tone === 'net' && 'bg-sky-500/15 text-sky-300',
            tone === 'neutral' && 'bg-primary/15 text-primary',
          )}
        >
          <Icon className="h-5 w-5" strokeWidth={2.4} />
        </span>
        {hint && <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-extrabold text-muted-foreground">{hint}</span>}
      </div>
      <p className="mt-3 text-xs font-bold text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-8 w-32" />
      ) : (
        <p className={cn('mt-1 font-display text-[25px] font-extrabold tracking-[-0.04em] tnum', toneClass)}>{formatIDR(value)}</p>
      )}
      <div className="pointer-events-none absolute -bottom-3 right-3 flex items-end gap-1 opacity-10">
        <span className="h-7 w-3 rounded-t bg-current" />
        <span className="h-12 w-3 rounded-t bg-current" />
        <span className="h-16 w-3 rounded-t bg-current" />
        <span className="h-20 w-3 rounded-t bg-current" />
      </div>
    </Card>
  );
}

export function KindBadge({ tipe }: { tipe: TxKind }) {
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold',
        tipe === 'Pemasukan' && 'bg-emerald-500/15 text-emerald-300',
        tipe === 'Pengeluaran' && 'bg-rose-500/15 text-rose-300',
        tipe === 'Transfer' && 'bg-violet-500/15 text-violet-300',
      )}
    >
      {tipe}
    </span>
  );
}

const CATEGORY_TONES = [
  'bg-amber-500/15 text-amber-300',
  'bg-sky-500/15 text-sky-300',
  'bg-emerald-500/15 text-emerald-300',
  'bg-violet-500/15 text-violet-300',
  'bg-rose-500/15 text-rose-300',
  'bg-teal-500/15 text-teal-300',
  'bg-primary/15 text-primary',
];

export function CategoryBadge({ category }: { category: string }) {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) | 0;
  return (
    <span className={cn('inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold', CATEGORY_TONES[Math.abs(hash) % CATEGORY_TONES.length])}>
      {category}
    </span>
  );
}

export function EmptyState({
  hasAny,
  onAdd,
  title,
  description,
  ctaLabel = 'Tambah Transaksi',
}: {
  hasAny: boolean;
  onAdd?: () => void;
  title?: string;
  description?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="flex min-h-[350px] flex-col items-center justify-center rounded-2xl bg-gradient-to-b from-card to-background px-5 py-8 text-center">
      <div className="relative grid h-32 w-40 place-items-center">
        <div className="absolute h-28 w-36 rounded-[50%] bg-primary/15" />
        <div className="relative grid h-20 w-16 rotate-[-4deg] place-items-center rounded-xl border-4 border-primary/50 bg-card shadow-[7px_8px_0_rgba(59,130,246,0.2)]">
          <FileSearch2 className="h-9 w-9 text-primary" />
          <span className="absolute -right-4 bottom-0 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-md">
            <Search className="h-5 w-5" />
          </span>
        </div>
        <Sparkles className="absolute left-3 top-2 h-5 w-5 text-amber-300" />
        <Sparkles className="absolute right-2 top-8 h-4 w-4 text-sky-300" />
      </div>
      <h3 className="mt-4 font-display text-lg font-extrabold tracking-[-0.03em] text-foreground">
        {title ?? (hasAny ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi.')}
      </h3>
      <p className="mt-1 max-w-sm text-sm font-medium text-muted-foreground">
        {description ??
          (hasAny
            ? 'Coba ubah kata kunci atau filter untuk melihat transaksi lain.'
            : 'Catat pemasukan atau pengeluaran pertamamu untuk mulai mengatur keuangan.')}
      </p>
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground shadow-[0_8px_20px_rgba(59,130,246,0.35)] transition hover:bg-primary/90"
        >
          <WalletCards className="h-4 w-4" /> {ctaLabel}
        </button>
      )}
    </div>
  );
}

export function FilterClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-extrabold text-primary hover:text-primary/80"
    >
      Hapus semua filter <X className="h-3.5 w-3.5" />
    </button>
  );
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-border bg-popover">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-foreground">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border bg-transparent font-bold text-foreground hover:bg-accent/40 hover:text-foreground">
            Batal
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-rose-500 font-extrabold text-white hover:bg-rose-600"
          >
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
