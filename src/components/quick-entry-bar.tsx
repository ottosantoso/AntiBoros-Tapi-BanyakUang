import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Loader2, Wallet as WalletIcon, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchSubkategori, type Subkategori } from '@/lib/data';
import { formatIDR } from '@/lib/format';
import { parseQuickEntry, type QuickEntryDraft } from '@/lib/quick-entry';
import { guessCategory, suggestSubkategori } from '@/lib/subkategori-suggest';
import type { Wallet } from '@/lib/types';
import { cn } from '@/lib/utils';

const SYSTEM = new Set(['Penyesuaian Saldo', 'Biaya Admin']);

function formatTanggal(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Catat cepat: satu kolom teks, pratinjau sebelum simpan, lalu simpan. Subkategori ditebak dari deskripsi
 * dengan cara yang sama seperti form transaksi. Untuk perubahan lain, pakai tombol Pemasukan atau Pengeluaran.
 */
export function QuickEntryBar({
  wallets,
  addTransaction,
  onSaved,
}: {
  wallets: Wallet[];
  addTransaction: (input: {
    tanggal: string;
    deskripsi: string;
    tipe: QuickEntryDraft['tipe'];
    nominal: number;
    walletId: string;
    kategori?: string;
    subkategoriId?: string | null;
  }) => Promise<{ success: boolean; error: string | null }>;
  onSaved: () => void;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [subs, setSubs] = useState<Subkategori[]>([]);

  useEffect(() => {
    let aktif = true;
    fetchSubkategori().then((list) => {
      if (aktif) setSubs(list.filter((s) => !SYSTEM.has(s.nama)));
    });
    return () => {
      aktif = false;
    };
  }, []);

  const hasil = useMemo(() => (text.trim() ? parseQuickEntry(text, wallets) : null), [text, wallets]);
  const draft = hasil?.ok ? hasil.draft : null;
  const dompet = draft ? wallets.find((w) => w.id === draft.walletId) : undefined;
  const melebihiSaldo = Boolean(draft && draft.tipe === 'Pengeluaran' && dompet && draft.nominal > dompet.saldo);

  async function simpan(event?: FormEvent) {
    event?.preventDefault();
    if (!draft || saving || melebihiSaldo) return;
    setSaving(true);
    const sub = subs.length
      ? suggestSubkategori(subs.filter((s) => s.jenis === draft.tipe), draft.deskripsi, draft.tipe)
      : undefined;
    const res = await addTransaction({
      tanggal: draft.tanggal,
      deskripsi: draft.deskripsi,
      tipe: draft.tipe,
      nominal: draft.nominal,
      walletId: draft.walletId,
      kategori: sub?.kategori ?? guessCategory(draft.deskripsi, draft.tipe),
      subkategoriId: sub?.id ?? null,
    });
    setSaving(false);
    if (!res.success) {
      toast.error('Gagal menyimpan', { description: res.error ?? undefined });
      return;
    }
    toast.success('Tersimpan', { description: `${draft.deskripsi} · ${formatIDR(draft.nominal)} · ${draft.walletNama}` });
    setText('');
    onSaved();
  }

  return (
    <Card className="rounded-2xl border-[#dbeafe] bg-white p-4 shadow-[0_6px_18px_rgba(30,64,175,0.06)]">
      <form onSubmit={simpan} className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#fef3c7] text-[#b45309]">
            <Zap className="h-4 w-4" />
          </span>
          <p className="text-sm font-extrabold text-[#172554]">Catat cepat</p>
          <span className="text-xs font-medium text-[#5b6f99]">contoh: 15/04 25rb parkir GOPAY · +5jt gaji BCA</span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-label="Catat transaksi dengan teks"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="25rb parkir GOPAY"
            maxLength={120}
            disabled={saving}
            className="h-11 flex-1 rounded-xl border-[#dbeafe] bg-[#f8fbff] text-sm font-bold text-[#172554]"
          />
          <Button
            type="submit"
            disabled={!draft || saving || melebihiSaldo}
            className="h-11 gap-2 rounded-xl bg-[#2563eb] font-extrabold text-white hover:bg-[#1d4ed8]"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </div>

        {hasil && !hasil.ok && (
          <p className="text-xs font-semibold text-[#be123c]">{hasil.error}</p>
        )}

        {draft && (
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <Chip tone={draft.tipe === 'Pemasukan' ? 'income' : 'expense'}>
              {draft.tipe === 'Pemasukan' ? '+' : '-'} {formatIDR(draft.nominal)}
            </Chip>
            <Chip>{draft.deskripsi}</Chip>
            <Chip>
              <WalletIcon className="h-3.5 w-3.5" /> {draft.walletNama}
            </Chip>
            <Chip>
              <CalendarDays className="h-3.5 w-3.5" /> {formatTanggal(draft.tanggal)}
            </Chip>
            {melebihiSaldo && (
              <span className="text-[#be123c]">
                Nominal melebihi saldo {draft.walletNama} ({formatIDR(dompet?.saldo ?? 0)})
              </span>
            )}
          </div>
        )}
      </form>
    </Card>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: 'income' | 'expense' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        tone === 'income' && 'border-[#a7f3d0] bg-[#ecfdf5] text-[#047857]',
        tone === 'expense' && 'border-[#fecdd3] bg-[#fff1f2] text-[#be123c]',
        !tone && 'border-[#dbeafe] bg-[#f8fbff] text-[#31548a]',
      )}
    >
      {children}
    </span>
  );
}
