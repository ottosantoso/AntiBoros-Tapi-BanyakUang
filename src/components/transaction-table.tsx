import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { cn } from '@/lib/utils';
import { formatIDR } from '@/lib/format';
import { walletGlyph } from '@/lib/wallets';
import { isTransfer, txJenis, type Jenis } from '@/lib/transaction-view';

/** Kolom: Tanggal, Keterangan, Kategori, Dompet, Jenis, Nominal, Saldo Setelah, Aksi. */
const GRID =
  'grid-cols-[100px_minmax(170px,1.6fr)_minmax(120px,1fr)_minmax(120px,1fr)_104px_minmax(120px,1fr)_minmax(120px,1fr)_88px]';

const JENIS_BADGE: Record<Jenis, string> = {
  Pemasukan: 'bg-[#dcfce7] text-[#047857]',
  Pengeluaran: 'bg-[#ffe4e6] text-[#be123c]',
  Transfer: 'bg-[#dbeafe] text-[#1d4ed8]',
  Penyesuaian: 'bg-[#f1f5f9] text-[#475569]',
};

const CATEGORY_TONES = [
  'bg-[#fef3c7] text-[#b45309]',
  'bg-[#e0f2fe] text-[#0369a1]',
  'bg-[#f3e8ff] text-[#6d28d9]',
  'bg-[#dcfce7] text-[#047857]',
  'bg-[#ffe4e6] text-[#be123c]',
  'bg-[#e0e7ff] text-[#4338ca]',
];

/** Warna kategori dipilih dari nama, jadi kategori yang sama selalu punya warna yang sama. */
function categoryClass(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_TONES[hash % CATEGORY_TONES.length];
}

function formatTanggal(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Label pihak luar: "Ke: istri" untuk pengeluaran, "Dari: istri" untuk pemasukan. */
function pihakLabel(tx: Transaction): string {
  return `${tx.tipe === 'Pengeluaran' ? 'Ke' : 'Dari'}: ${tx.pihakLuar ?? ''}`;
}

function JenisBadge({ jenis }: { jenis: Jenis }) {
  return <span className={cn('inline-flex w-fit rounded-full px-2.5 py-1 text-[10px] font-extrabold', JENIS_BADGE[jenis])}>{jenis}</span>;
}

function CategoryPill({ tx }: { tx: Transaction }) {
  if (isTransfer(tx) || !tx.kategori) return <span className="text-xs font-medium text-[#93a4c4]">—</span>;
  return <span className={cn('inline-flex w-fit max-w-full truncate rounded-full px-2.5 py-1 text-[10px] font-extrabold', categoryClass(tx.kategori))}>{tx.kategori}</span>;
}

function TxIcon({ tx }: { tx: Transaction }) {
  const jenis = txJenis(tx);
  const className = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg';
  if (jenis === 'Transfer') return <span className={cn(className, 'bg-[#ede9fe] text-[#7c3aed]')}><ArrowLeftRight className="h-4 w-4" /></span>;
  if (jenis === 'Penyesuaian') return <span className={cn(className, 'bg-[#f1f5f9] text-[#475569]')}><SlidersHorizontal className="h-4 w-4" /></span>;
  if (jenis === 'Pemasukan') return <span className={cn(className, 'bg-[#dcfce7] text-[#059669]')}><ArrowDownLeft className="h-4 w-4" /></span>;
  return <span className={cn(className, 'bg-[#ffe4e6] text-[#e11d48]')}><ArrowUpRight className="h-4 w-4" /></span>;
}

function Amount({ tx }: { tx: Transaction }) {
  const income = tx.tipe === 'Pemasukan';
  return <span className={cn('font-extrabold tnum', income ? 'text-[#059669]' : 'text-[#e11d48]')}>{income ? '+' : '-'} {formatIDR(tx.nominal)}</span>;
}

function BalanceCell({ balance }: { balance: number | undefined }) {
  if (balance === undefined) return <span className="text-xs font-medium text-[#93a4c4]">—</span>;
  return <span className={cn('text-xs font-extrabold tnum', balance < 0 ? 'text-[#e11d48]' : 'text-[#172554]')}>{formatIDR(balance)}</span>;
}

function RowActions({ tx, onEdit, onDelete }: { tx: Transaction; onEdit: (tx: Transaction) => void; onDelete: (tx: Transaction) => void }) {
  // Transaksi hasil transfer diubah dari menu Transfer, jadi tombolnya dinonaktifkan.
  const locked = isTransfer(tx);
  const title = locked ? 'Transaksi transfer, diubah dari menu Transfer' : undefined;
  return (
    <div className="flex items-center justify-end gap-1">
      <button
        type="button"
        disabled={locked}
        onClick={() => onEdit(tx)}
        aria-label={`Ubah ${tx.deskripsi}`}
        title={title ?? 'Ubah'}
        className="grid h-8 w-8 place-items-center rounded-lg text-[#2563eb] transition hover:bg-[#e0f2fe] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={locked}
        onClick={() => onDelete(tx)}
        aria-label={`Hapus ${tx.deskripsi}`}
        title={title ?? 'Hapus'}
        className="grid h-8 w-8 place-items-center rounded-lg text-[#e11d48] transition hover:bg-[#ffe4e6] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export interface TransactionTableProps {
  rows: Transaction[];
  /** Saldo dompet setelah tiap transaksi, key-nya id transaksi. */
  balances: Map<string, number>;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

export function TransactionTable({ rows, balances, onEdit, onDelete }: TransactionTableProps) {
  return (
    <>
      {/* Desktop dan tablet lebar: tabel. Scroll horizontal hanya di dalam kartu, tidak di seluruh halaman. */}
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <div className="min-w-[1000px]">
            <div className={cn('grid items-center gap-3 border-b border-[#dbeafe] px-3 pb-2 text-[11px] font-extrabold text-[#5b6f99]', GRID)}>
              <span>Tanggal</span>
              <span>Keterangan</span>
              <span>Kategori</span>
              <span>Dompet</span>
              <span>Jenis</span>
              <span className="text-right">Nominal</span>
              <span className="text-right">Saldo Setelah</span>
              <span className="text-right">Aksi</span>
            </div>
            <ul>
              {rows.map((tx, index) => (
                <li
                  key={tx.id ?? `${tx.tanggal}-${index}`}
                  className={cn('grid items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f8fbff]', GRID, index > 0 && 'border-t border-[#e7eef9]')}
                >
                  <span className="text-xs font-bold tnum text-[#31548a]">{formatTanggal(tx.tanggal)}</span>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <TxIcon tx={tx} />
                    <p className="truncate text-xs font-bold text-[#172554]">{tx.deskripsi}</p>
                  </div>
                  <div className="min-w-0"><CategoryPill tx={tx} /></div>
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-[#31548a]">
                    <span aria-hidden="true" className="shrink-0">{walletGlyph(tx.dompet) || '•'}</span>
                    <span className="truncate">{tx.dompet}</span>
                  </span>
                  <div><JenisBadge jenis={txJenis(tx)} /></div>
                  <span className="text-right text-xs"><Amount tx={tx} /></span>
                  <span className="text-right"><BalanceCell balance={tx.id ? balances.get(tx.id) : undefined} /></span>
                  <RowActions tx={tx} onEdit={onEdit} onDelete={onDelete} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Mobile: kartu, tanpa tabel. */}
      <ul className="divide-y divide-[#e7eef9] md:hidden">
        {rows.map((tx, index) => (
          <li key={tx.id ?? `${tx.tanggal}-${index}`} className="py-3">
            <div className="flex items-start gap-3">
              <TxIcon tx={tx} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#172554]">{tx.deskripsi}</p>
                <p className="mt-0.5 truncate text-[11px] font-medium text-[#5b6f99]">
                  {formatTanggal(tx.tanggal)} · {tx.dompet}{tx.pihakLuar ? ` · ${pihakLabel(tx)}` : ''}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <JenisBadge jenis={txJenis(tx)} />
                  <CategoryPill tx={tx} />
                </div>
              </div>
              <div className="shrink-0 text-right text-xs">
                <Amount tx={tx} />
                <p className="mt-1 text-[10px] font-semibold text-[#5b6f99]">
                  Saldo <BalanceCell balance={tx.id ? balances.get(tx.id) : undefined} />
                </p>
              </div>
            </div>
            <div className="mt-1 flex justify-end">
              <RowActions tx={tx} onEdit={onEdit} onDelete={onDelete} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
