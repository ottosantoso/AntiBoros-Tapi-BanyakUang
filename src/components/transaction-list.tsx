import { ArrowDownLeft, ArrowUpRight, CalendarDays, Inbox } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatIDR, formatDateRelative } from '@/lib/format';
import { walletGlyph } from '@/lib/wallets';

function categoryFromDesc(desc: string): string {
  const value = desc.toLowerCase();
  if (value.includes('gaji') || value.includes('freelance') || value.includes('penjualan')) return 'Pemasukan';
  if (value.includes('kopi') || value.includes('makan')) return 'Makan & Minum';
  if (value.includes('gojek') || value.includes('bensin') || value.includes('transport')) return 'Transportasi';
  if (value.includes('belanja')) return 'Belanja';
  if (value.includes('netflix') || value.includes('hiburan')) return 'Hiburan';
  return 'Lainnya';
}

function categoryClass(category: string) {
  if (category === 'Makan & Minum') return 'bg-[#fef3c7] text-[#b45309]';
  if (category === 'Transportasi') return 'bg-[#dbeafe] text-[#1d4ed8]';
  if (category === 'Pemasukan') return 'bg-[#dcfce7] text-[#047857]';
  if (category === 'Hiburan') return 'bg-[#f3e8ff] text-[#6d28d9]';
  return 'bg-[#e0f2fe] text-[#0369a1]';
}

export function TransactionRow({ tx, divider = true }: { tx: Transaction; divider?: boolean }) {
  const income = tx.tipe === 'Pemasukan';
  const category = tx.kategori ?? categoryFromDesc(tx.deskripsi);
  return <div className={cn('grid grid-cols-[minmax(86px,1fr)_minmax(130px,1.5fr)_minmax(105px,1fr)_auto] items-center gap-3 py-2.5', divider && 'border-t border-[#e7eef9]')}>
    <div className="flex items-center gap-2 text-xs font-semibold text-[#31548a]"><CalendarDays className="h-3.5 w-3.5 text-[#2563eb]" />{formatDateRelative(tx.tanggal)}</div>
    <div className="flex min-w-0 items-center gap-2"><span className={cn('grid h-7 w-7 shrink-0 place-items-center rounded-lg', income ? 'bg-[#dcfce7] text-[#059669]' : 'bg-[#ffe4e6] text-[#e11d48]')}>{income ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div className="min-w-0"><p className="truncate text-xs font-bold text-[#172554]">{tx.deskripsi}</p><p className="truncate text-[10px] font-medium text-[#6b7da4]">{walletGlyph(tx.dompet) || '•'} {tx.dompet}</p></div></div>
    <span className={cn('w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold', categoryClass(category))}>{category}</span>
    <span className={cn('text-right text-xs font-extrabold tnum', income ? 'text-[#059669]' : 'text-[#e11d48]')}>{income ? '+' : '-'} {formatIDR(tx.nominal)}</span>
  </div>;
}

export function TransactionList({ transactions, loading, limit, emptyHint }: { transactions: Transaction[]; loading?: boolean; limit?: number; emptyHint?: string }) {
  if (loading) return <div className="space-y-1">{Array.from({ length: limit ?? 6 }).map((_, i) => <div key={i} className="flex items-center gap-3 py-3"><Skeleton className="h-8 w-8 rounded-lg" /><div className="flex-1 space-y-2"><Skeleton className="h-3 w-40" /><Skeleton className="h-3 w-56" /></div><Skeleton className="h-4 w-24" /></div>)}</div>;
  const list = limit ? transactions.slice(0, limit) : transactions;
  if (!list.length) return <div className="flex flex-col items-center justify-center py-12 text-center"><Inbox className="h-9 w-9 text-[#93a4c4]" /><p className="mt-3 text-sm font-bold text-[#5b6f99]">Belum ada transaksi.</p><p className="text-xs font-medium text-[#93a4c4]">{emptyHint ?? 'Tambahkan transaksi pertama Anda.'}</p></div>;
  return <div>{list.map((tx, index) => <TransactionRow key={`${tx.tanggal}-${tx.deskripsi}-${index}`} tx={tx} divider={index > 0} />)}</div>;
}

export function TransactionListCard({ transactions, loading, limit = 6 }: { transactions: Transaction[]; loading?: boolean; limit?: number }) {
  return <Card className="rounded-2xl border-[#dbeafe] bg-white p-5 shadow-[0_6px_18px_rgba(30,64,175,0.06)]"><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dbeafe] text-[#2563eb]"><ArrowLeftRightIcon /></span><div><h3 className="font-display text-base font-extrabold tracking-[-0.02em] text-[#172554]">Transaksi Terbaru</h3><p className="text-xs font-medium text-[#5b6f99]">Aktivitas terkini</p></div></div><span className="hidden rounded-full border border-[#bfdbfe] px-3 py-1.5 text-[11px] font-extrabold text-[#2563eb] sm:inline-flex">Lihat Semua <ArrowUpRight className="ml-1 h-3 w-3" /></span></div><div className="mt-3 overflow-x-auto"><div className="min-w-[560px]"><div className="grid grid-cols-[minmax(86px,1fr)_minmax(130px,1.5fr)_minmax(105px,1fr)_auto] gap-3 border-b border-[#dbeafe] pb-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#5b6f99]"><span>Tanggal</span><span>Keterangan</span><span>Kategori</span><span className="text-right">Nominal</span></div><TransactionList transactions={transactions} loading={loading} limit={limit} /></div></div></Card>;
}

function ArrowLeftRightIcon() {
  return <ArrowUpRight className="h-5 w-5 rotate-[-45deg]" />;
}
