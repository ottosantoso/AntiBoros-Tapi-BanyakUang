import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { fetchBudgetData, catatNotifikasiBudget, fetchNotifikasiBudgetBelumDibaca, tandaiNotifikasiDibaca, type NotifikasiBudgetItem } from '@/lib/data';
import { buatPeringatanBudget, type BudgetAlertRow } from '@/lib/budget-alert';
import { toISODate } from '@/lib/format';
import { cn } from '@/lib/utils';

function rentangBulanIni(): { start: string; end: string; periode: string } {
  const now = new Date();
  return {
    start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    periode: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
  };
}

/**
 * Banner notifikasi budget di atas halaman. Setiap kali `syncKey` berubah (misalnya setelah transaksi),
 * pemakaian budget dicek, ambang yang baru dilewati dicatat, lalu notifikasi yang belum dibaca ditampilkan.
 */
export function BudgetAlertBanner({ syncKey }: { syncKey: string }) {
  const [items, setItems] = useState<NotifikasiBudgetItem[]>([]);

  const periksa = useCallback(async () => {
    const { start, end, periode } = rentangBulanIni();
    const bud = await fetchBudgetData({ start, end });
    if (!bud.error) {
      const namaById = new Map(bud.subkategori.map((s) => [s.id, s.nama]));
      const rows: BudgetAlertRow[] = bud.budgets.map((b) => ({
        subkategoriId: b.subkategoriId,
        nama: namaById.get(b.subkategoriId) ?? 'Subkategori',
        spent: bud.spentBySubkat[b.subkategoriId] ?? 0,
        limit: b.limit,
      }));
      const drafts = buatPeringatanBudget(rows, periode);
      if (drafts.length) await catatNotifikasiBudget(drafts);
    }
    const belum = await fetchNotifikasiBudgetBelumDibaca();
    setItems(belum.items);
  }, []);

  useEffect(() => {
    void periksa();
  }, [periksa, syncKey]);

  async function tutup(ids: string[]) {
    const res = await tandaiNotifikasiDibaca(ids);
    if (res.success) setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
  }

  if (items.length === 0) return null;

  const tampil = items.slice(0, 3);
  const sisa = items.length - tampil.length;

  return (
    <div role="status" aria-live="polite" className="mb-4 space-y-2">
      {tampil.map((item) => (
        <div
          key={item.id}
          className={cn(
            'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm',
            item.jenis === 'budget_100'
              ? 'border-[#fecdd3] bg-[#fff1f2] text-[#9f1239]'
              : 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
          )}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">{item.judul}</p>
            <p className="text-xs font-medium opacity-80">{item.isi}</p>
          </div>
          <button
            type="button"
            onClick={() => tutup([item.id])}
            aria-label="Tandai sudah dibaca"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      {sisa > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs font-bold text-[#5b6f99]">
          <span>{sisa} notifikasi lain belum dibaca</span>
          <button type="button" onClick={() => tutup(items.map((i) => i.id))} className="underline underline-offset-2 hover:no-underline">
            Tandai semua sudah dibaca
          </button>
        </div>
      )}
    </div>
  );
}
