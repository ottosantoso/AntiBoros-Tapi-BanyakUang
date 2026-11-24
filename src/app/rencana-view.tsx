import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, Lock, Plus, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createRencana,
  deleteRencana,
  deleteRencanaItem,
  fetchRencanaList,
  insertRencanaItem,
  updateRencana,
  type Rencana,
  type RencanaJenis,
  type RencanaStatus,
} from '@/lib/data';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { cn } from '@/lib/utils';
import { formatIDR, formatSignedIDR } from '@/lib/format';
import { formatRupiahInput, parseRupiahInput } from '@/lib/rupiah-input';
import {
  RENCANA_KATEGORI,
  categoryBreakdown,
  monthKey,
  monthLabel,
  summarizeRencana,
} from '@/lib/rencana-math';

const STATUS_LABEL: Record<RencanaStatus, string> = {
  draft: 'Draf',
  aktif: 'Aktif',
  ditutup: 'Ditutup',
};

const STATUS_CLASS: Record<RencanaStatus, string> = {
  draft: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  aktif: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  ditutup: 'bg-muted text-muted-foreground',
};

export function RencanaView() {
  const [list, setList] = useState<Rencana[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await fetchRencanaList();
    if (error) toast.error('Gagal memuat rencana', { description: error });
    setList(data);
    setSelectedId((current) => (current && data.some((r) => r.id === current) ? current : data[0]?.id ?? null));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  const selected = useMemo(() => list.find((r) => r.id === selectedId) ?? null, [list, selectedId]);

  async function handleCreate(input: { bulan: string; nama: string; budget: number }) {
    setBusy(true);
    const res = await createRencana(input);
    setBusy(false);
    if (!res.success) {
      toast.error('Gagal membuat rencana', { description: res.error ?? undefined });
      return false;
    }
    toast.success('Rencana dibuat sebagai draf');
    setSelectedId(res.id);
    await load();
    return true;
  }

  async function changeStatus(status: RencanaStatus) {
    if (!selected) return;
    setBusy(true);
    const res = await updateRencana(selected.id, { status });
    setBusy(false);
    if (!res.success) return toast.error('Gagal mengubah status', { description: res.error ?? undefined });
    toast.success(status === 'aktif' ? 'Rencana diaktifkan' : 'Bulan ditutup. Rencana tidak bisa diubah lagi.');
    await load();
  }

  async function handleDeleteRencana() {
    if (!selected) return;
    setBusy(true);
    const res = await deleteRencana(selected.id);
    setBusy(false);
    setConfirmDelete(false);
    if (!res.success) return toast.error('Gagal menghapus rencana', { description: res.error ?? undefined });
    toast.success('Rencana dihapus');
    setSelectedId(null);
    await load();
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <CalendarRange className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-xl font-extrabold tracking-tight md:text-2xl">Rencana Bulanan</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Susun rencana pemasukan dan pengeluaran bulanan. Rencana tidak mengubah saldo atau transaksi.
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-10 gap-2 rounded-full px-4 font-bold">
          <Plus className="h-4 w-4" /> Rencana Baru
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyPlan onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pilih bulan">
            {list.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={r.id === selectedId}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  'rounded-full border px-4 py-2 text-xs font-extrabold transition',
                  r.id === selectedId ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent/40',
                )}
              >
                {monthLabel(r.bulan)}
              </button>
            ))}
          </div>

          {selected && (
            <PlanDetail
              key={selected.id}
              rencana={selected}
              busy={busy}
              onChangeStatus={changeStatus}
              onDelete={() => setConfirmDelete(true)}
              onChanged={load}
              setBusy={setBusy}
            />
          )}
        </>
      )}

      <CreatePlanDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} busy={busy} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus rencana ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua item di rencana {selected ? monthLabel(selected.bulan) : ''} ikut terhapus. Transaksi Anda tidak terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRencana}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyPlan({ onCreate }: { onCreate: () => void }) {
  return (
    <Card className="flex flex-col items-center justify-center rounded-2xl p-10 text-center">
      <CalendarRange className="h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 font-display text-lg font-extrabold">Belum ada rencana</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Mulai dengan membuat rencana untuk bulan ini, lalu catat pengeluaran yang Anda rencanakan.
      </p>
      <Button onClick={onCreate} className="mt-5 gap-2 rounded-full font-bold">
        <Plus className="h-4 w-4" /> Buat rencana bulan ini
      </Button>
    </Card>
  );
}

function PlanDetail({
  rencana,
  busy,
  onChangeStatus,
  onDelete,
  onChanged,
  setBusy,
}: {
  rencana: Rencana;
  busy: boolean;
  onChangeStatus: (status: RencanaStatus) => void;
  onDelete: () => void;
  onChanged: () => void;
  setBusy: (value: boolean) => void;
}) {
  const summary = summarizeRencana(rencana.budget, rencana.items);
  const breakdown = categoryBreakdown(rencana.items);
  const editable = rencana.status !== 'ditutup';
  const maxBreakdown = breakdown[0]?.total ?? 0;

  return (
    <div className="space-y-5">
      <Card className="flex flex-col gap-3 rounded-2xl p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-extrabold">{rencana.nama}</h2>
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-extrabold', STATUS_CLASS[rencana.status])}>
            {STATUS_LABEL[rencana.status]}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {rencana.status === 'draft' && (
            <Button size="sm" disabled={busy} onClick={() => onChangeStatus('aktif')} className="gap-2 rounded-full font-bold">
              <CheckCircle2 className="h-4 w-4" /> Aktifkan rencana
            </Button>
          )}
          {rencana.status === 'aktif' && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => onChangeStatus('ditutup')} className="gap-2 rounded-full font-bold">
              <Lock className="h-4 w-4" /> Tutup bulan
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDelete} className="gap-2 rounded-full font-bold text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Hapus
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Budget rencana" value={formatIDR(summary.budget)} />
        <Stat label="Pemasukan rencana" value={formatIDR(summary.pemasukan)} tone="income" />
        <Stat label="Pengeluaran rencana" value={formatIDR(summary.pengeluaran)} tone="expense" />
        <Stat
          label="Selisih budget"
          value={`${summary.selisihBudget < 0 ? '-' : '+'} ${formatIDR(Math.abs(summary.selisihBudget))}`}
          tone={summary.selisihBudget < 0 ? 'expense' : 'income'}
          hint={summary.selisihBudget < 0 ? 'Melebihi budget' : 'Masih di bawah budget'}
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Sisa rencana (pemasukan dikurangi pengeluaran): <span className="font-bold">{formatSignedIDR(summary.sisaRencana)}</span>
        {summary.sisaRencana < 0 && ' — pengeluaran rencana lebih besar dari pemasukan.'}
      </p>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <ItemsCard rencana={rencana} editable={editable} busy={busy} onChanged={onChanged} setBusy={setBusy} />

        <Card className="rounded-2xl p-5">
          <h3 className="font-display text-base font-extrabold">Pengeluaran per kategori</h3>
          <p className="text-xs text-muted-foreground">Lihat kategori terbesar untuk menentukan biaya yang bisa dikurangi.</p>
          {breakdown.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Belum ada pengeluaran rencana.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {breakdown.map((row) => (
                <li key={row.kategori}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-bold">{row.kategori}</span>
                    <span className="font-extrabold tabular-nums">{formatIDR(row.total)}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${maxBreakdown ? (row.total / maxBreakdown) * 100 : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function ItemsCard({
  rencana,
  editable,
  busy,
  onChanged,
  setBusy,
}: {
  rencana: Rencana;
  editable: boolean;
  busy: boolean;
  onChanged: () => void;
  setBusy: (value: boolean) => void;
}) {
  const [jenis, setJenis] = useState<RencanaJenis>('pengeluaran');
  const [nama, setNama] = useState('');
  const [nominal, setNominal] = useState('');
  const [kategori, setKategori] = useState<string>(RENCANA_KATEGORI[0]);
  const [error, setError] = useState<string | null>(null);

  async function addItem() {
    // Nominal boleh kosong atau 0 (misalnya item yang belum tahu jumlahnya). Total menghitung 0.
    const value = nominal === '' ? 0 : Number(nominal);
    if (!nama.trim()) return setError('Isi nama item terlebih dahulu.');
    if (!Number.isFinite(value) || value < 0) return setError('Nominal tidak valid.');
    setError(null);
    setBusy(true);
    const res = await insertRencanaItem(rencana.id, { jenis, nama: nama.trim(), nominal: Math.round(value), kategori });
    setBusy(false);
    if (!res.success) return toast.error('Gagal menambah item', { description: res.error ?? undefined });
    setNama('');
    setNominal('');
    onChanged();
  }

  async function removeItem(id: string) {
    setBusy(true);
    const res = await deleteRencanaItem(id);
    setBusy(false);
    if (!res.success) return toast.error('Gagal menghapus item', { description: res.error ?? undefined });
    onChanged();
  }

  const expenses = rencana.items.filter((i) => i.jenis === 'pengeluaran');
  const incomes = rencana.items.filter((i) => i.jenis === 'pemasukan');

  return (
    <Card className="rounded-2xl p-5">
      <h3 className="font-display text-base font-extrabold">Item rencana</h3>

      {editable ? (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/40 p-3">
          <div className="inline-flex rounded-full bg-background p-1">
            {(['pengeluaran', 'pemasukan'] as RencanaJenis[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setJenis(value)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-extrabold capitalize transition',
                  jenis === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                )}
              >
                {value}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
            <Input aria-label="Nama item" placeholder="Nama, misal: Makan di luar" value={nama} onChange={(e) => setNama(e.target.value)} />
            <Input aria-label="Nominal (opsional)" inputMode="numeric" placeholder="Rp 0 (opsional)" value={formatRupiahInput(nominal)} onChange={(e) => setNominal(parseRupiahInput(e.target.value))} />
          </div>
          {jenis === 'pengeluaran' && (
            <select
              aria-label="Kategori"
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {RENCANA_KATEGORI.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          {error && <p className="text-xs font-bold text-destructive">{error}</p>}
          <Button size="sm" disabled={busy} onClick={addItem} className="gap-2 rounded-full font-bold">
            <PlusCircle className="h-4 w-4" /> Tambah item
          </Button>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Bulan ini sudah ditutup. Item tidak bisa diubah.
        </p>
      )}

      <ItemGroup title="Pengeluaran" items={expenses} editable={editable} busy={busy} onRemove={removeItem} />
      <ItemGroup title="Pemasukan" items={incomes} editable={editable} busy={busy} onRemove={removeItem} />
    </Card>
  );
}

function ItemGroup({
  title,
  items,
  editable,
  busy,
  onRemove,
}: {
  title: string;
  items: Rencana['items'];
  editable: boolean;
  busy: boolean;
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  const total = items.reduce((sum, i) => sum + i.nominal, 0);
  return (
    <div className="mt-5">
      <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span className="tabular-nums">{formatIDR(total)}</span>
      </div>
      <ul className="mt-2 divide-y divide-border">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{item.nama}</p>
              {item.kategori && <p className="truncate text-[11px] text-muted-foreground">{item.kategori}</p>}
            </div>
            <span className="shrink-0 text-sm font-extrabold tabular-nums">{formatIDR(item.nominal)}</span>
            {editable && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(item.id)}
                aria-label={`Hapus ${item.nama}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'income' | 'expense'; hint?: string }) {
  return (
    <Card className="rounded-2xl p-4">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-[20px] font-extrabold tabular-nums md:text-[22px]',
          tone === 'income' && 'text-emerald-600 dark:text-emerald-300',
          tone === 'expense' && 'text-rose-600 dark:text-rose-300',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] font-semibold text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function CreatePlanDialog({
  open,
  onOpenChange,
  onSubmit,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: { bulan: string; nama: string; budget: number }) => Promise<boolean>;
  busy: boolean;
}) {
  const [month, setMonth] = useState(monthKey().slice(0, 7));
  const [nama, setNama] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('Pilih bulan terlebih dahulu.');
    const value = budget === '' ? 0 : Number(budget);
    if (!Number.isFinite(value) || value < 0) return setError('Budget tidak boleh negatif.');
    setError(null);
    const bulan = `${month}-01`;
    const ok = await onSubmit({ bulan, nama: nama.trim() || monthLabel(bulan), budget: Math.round(value) });
    if (ok) {
      setNama('');
      setBudget('');
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Rencana baru</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1.5 text-xs font-bold">
            Bulan
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm" />
          </label>
          <label className="block space-y-1.5 text-xs font-bold">
            Nama rencana (opsional)
            <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Misal: Rencana hemat" />
          </label>
          <label className="block space-y-1.5 text-xs font-bold">
            Budget pengeluaran bulan ini
            <Input inputMode="numeric" value={formatRupiahInput(budget)} onChange={(e) => setBudget(parseRupiahInput(e.target.value))} placeholder="Rp 0" />
          </label>
          {error && <p className="text-xs font-bold text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button disabled={busy} onClick={submit}>Simpan sebagai draf</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
