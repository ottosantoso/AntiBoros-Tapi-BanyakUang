import { Fragment, useEffect, useMemo, useState } from 'react';
import { CalendarRange, CheckCircle2, Lock, Plus, PlusCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  createRencana,
  deleteRencana,
  deleteRencanaItem,
  fetchRencanaList,
  insertRencanaItem,
  updateRencana,
  updateRencanaItemKelompok,
  updateRencanaModel,
  type Rencana,
  type RencanaItem,
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
import { usePagination } from '@/components/pagination-bar';
import { NumberedPagination } from '@/components/numbered-pagination';
import { ModelSelector } from '@/components/rencana-model-selector';
import { cn } from '@/lib/utils';
import { formatIDR, formatSignedIDR } from '@/lib/format';
import { formatRupiahInput, parseRupiahInput } from '@/lib/rupiah-input';
import {
  KELOMPOK_LABEL,
  RENCANA_KATEGORI,
  categoryBreakdown,
  defaultKelompok,
  getModel,
  kelompokTargets,
  monthKey,
  monthLabel,
  summarizeRencana,
  type Kelompok,
  type KelompokRow,
  type ModelKode,
  type Persen,
  type TargetStatus,
} from '@/lib/rencana-math';

/** Jumlah item per halaman di tabel item rencana. */
const ITEM_PAGE_SIZE = 10;
const KELOMPOK_KEYS = Object.keys(KELOMPOK_LABEL) as Kelompok[];

const STATUS_LABEL: Record<RencanaStatus, string> = { draft: 'Draf', aktif: 'Aktif', ditutup: 'Ditutup' };
const STATUS_CLASS: Record<RencanaStatus, string> = {
  draft: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  aktif: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  ditutup: 'bg-muted text-muted-foreground',
};
const TARGET_BAR: Record<TargetStatus, string> = { aman: 'bg-emerald-500', waspada: 'bg-amber-500', lewat: 'bg-rose-500' };
const TARGET_TEXT: Record<TargetStatus, string> = {
  aman: 'text-emerald-600 dark:text-emerald-300',
  waspada: 'text-amber-600 dark:text-amber-300',
  lewat: 'text-rose-600 dark:text-rose-300',
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

  async function handleCreate(input: { bulan: string; nama: string }) {
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
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary sm:h-12 sm:w-12">
            <CalendarRange className="h-5 w-5 sm:h-6 sm:w-6" />
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-extrabold tracking-tight sm:text-xl md:text-2xl">Rencana Bulanan</h1>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Susun pemasukan dan pengeluaran bulanan. Rencana tidak mengubah saldo atau transaksi.
            </p>
          </div>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="h-10 w-full gap-2 rounded-full px-4 font-bold md:w-auto">
          <Plus className="h-4 w-4" /> Rencana Baru
        </Button>
      </div>

      {list.length === 0 ? (
        <EmptyPlan onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Pilih bulan">
            {list.map((r) => (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={r.id === selectedId}
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  'shrink-0 rounded-full border px-4 py-2 text-xs font-extrabold transition',
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
    <Card className="flex flex-col items-center justify-center rounded-2xl p-8 text-center sm:p-10">
      <CalendarRange className="h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 font-display text-lg font-extrabold">Belum ada rencana</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Mulai dengan membuat rencana untuk bulan ini, lalu isi pemasukan dan pengeluaran yang direncanakan.
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
  const summary = summarizeRencana(rencana.items);
  const targets = kelompokTargets(summary.pemasukan, rencana.items, rencana.persen);
  const breakdown = categoryBreakdown(rencana.items);
  const editable = rencana.status !== 'ditutup';
  const maxBreakdown = breakdown[0]?.total ?? 0;

  async function saveModel(model: ModelKode, persen: Persen) {
    setBusy(true);
    const res = await updateRencanaModel(rencana.id, model, persen);
    setBusy(false);
    if (!res.success) return toast.error('Gagal menyimpan model', { description: res.error ?? undefined });
    toast.success(`Model diubah ke ${persen.kebutuhan}/${persen.keinginan}/${persen.investasi}`);
    onChanged();
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <Card className="flex flex-col gap-4 rounded-2xl p-4 sm:p-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h2 className="truncate font-display text-base font-extrabold sm:text-lg">{rencana.nama}</h2>
          <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold', STATUS_CLASS[rencana.status])}>
            {STATUS_LABEL[rencana.status]}
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end md:justify-end">
          <ModelSelector
            model={rencana.model}
            persen={rencana.persen}
            disabled={!editable || busy}
            onSave={saveModel}
          />
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
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Stat label="Pemasukan" value={formatIDR(summary.pemasukan)} tone="income" hint="Total item pemasukan" />
        <Stat label="Pengeluaran" value={formatIDR(summary.pengeluaran)} tone="expense" hint="Total item pengeluaran" />
        <Stat
          label="Tabungan"
          value={formatSignedIDR(summary.tabungan)}
          tone={summary.tabungan < 0 ? 'expense' : 'income'}
          hint={summary.tabungan < 0 ? 'Defisit, pengeluaran melebihi pemasukan' : 'Pemasukan dikurangi pengeluaran'}
        />
        <Stat label="Budget" value={formatIDR(summary.budget)} hint="Sama dengan total pemasukan" />
      </div>

      <TargetCard pemasukan={summary.pemasukan} targets={targets} model={rencana.model} persen={rencana.persen} />

      <div className="grid gap-4 sm:gap-5 lg:grid-cols-[1.25fr_1fr]">
        <ItemsCard rencana={rencana} editable={editable} busy={busy} onChanged={onChanged} setBusy={setBusy} />

        <Card className="rounded-2xl p-4 sm:p-5">
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
                    <span className="shrink-0 font-extrabold tabular-nums">{formatIDR(row.total)}</span>
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

function TargetCard({
  pemasukan,
  targets,
  model,
  persen,
}: {
  pemasukan: number;
  targets: KelompokRow[];
  model: ModelKode;
  persen: Persen;
}) {
  const title = `Target ${persen.kebutuhan}/${persen.keinginan}/${persen.investasi}`;
  return (
    <Card className="rounded-2xl p-4 sm:p-5">
      <h3 className="font-display text-base font-extrabold">{title}</h3>
      <p className="text-xs text-muted-foreground">
        Model: {getModel(model).nama}. Dihitung dari total pemasukan {formatIDR(pemasukan)}.
      </p>
      {pemasukan === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Isi pemasukan dulu untuk melihat target tiap kelompok.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {targets.map((row) => (
            <li key={row.kelompok}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className="text-sm font-extrabold">
                  {row.label} <span className="text-xs font-semibold text-muted-foreground">{row.persen}%</span>
                </span>
                <span className={cn('text-xs font-extrabold tabular-nums', TARGET_TEXT[row.status])}>
                  {Number.isFinite(row.ratio) ? `${Math.round(row.ratio * 100)}%` : 'Tanpa target'}
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', TARGET_BAR[row.status])}
                  style={{ width: `${Math.min(Number.isFinite(row.ratio) ? row.ratio : 1, 1) * 100}%` }}
                />
              </div>
              <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground tabular-nums">
                <span>
                  Terpakai {formatIDR(row.realisasi)} dari {formatIDR(row.target)}
                </span>
                <span className={cn('font-bold', row.sisa < 0 && 'text-rose-600 dark:text-rose-300')}>
                  {row.sisa >= 0 ? `Sisa ${formatIDR(row.sisa)}` : `Lewat ${formatIDR(-row.sisa)}`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
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
  const [kelompok, setKelompok] = useState<Kelompok>(defaultKelompok(RENCANA_KATEGORI[0]));
  const [error, setError] = useState<string | null>(null);

  // Urutan: pengeluaran dulu, lalu pemasukan. Dibagi per halaman.
  const ordered = useMemo(
    () => [...rencana.items.filter((i) => i.jenis === 'pengeluaran'), ...rencana.items.filter((i) => i.jenis === 'pemasukan')],
    [rencana.items],
  );
  const pager = usePagination(ordered, ITEM_PAGE_SIZE, rencana.id);
  const totals = {
    pengeluaran: rencana.items.filter((i) => i.jenis === 'pengeluaran').reduce((s, i) => s + i.nominal, 0),
    pemasukan: rencana.items.filter((i) => i.jenis === 'pemasukan').reduce((s, i) => s + i.nominal, 0),
  };

  function pickKategori(value: string) {
    setKategori(value);
    setKelompok(defaultKelompok(value));
  }

  async function addItem() {
    // Nominal boleh kosong atau 0 (misalnya item yang belum tahu jumlahnya). Total menghitung 0.
    const value = nominal === '' ? 0 : Number(nominal);
    if (!nama.trim()) return setError('Isi nama item terlebih dahulu.');
    if (!Number.isFinite(value) || value < 0) return setError('Nominal tidak valid.');
    setError(null);
    setBusy(true);
    const res = await insertRencanaItem(rencana.id, {
      jenis,
      nama: nama.trim(),
      nominal: Math.round(value),
      kategori,
      kelompok,
    });
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

  async function changeKelompok(id: string, value: Kelompok) {
    setBusy(true);
    const res = await updateRencanaItemKelompok(id, value);
    setBusy(false);
    if (!res.success) return toast.error('Gagal mengubah kelompok', { description: res.error ?? undefined });
    onChanged();
  }

  return (
    <Card className="rounded-2xl p-4 sm:p-5">
      <h3 className="font-display text-base font-extrabold">Item rencana</h3>

      {editable ? (
        <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted/40 p-3 sm:p-4">
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

          <div className="grid gap-2 sm:grid-cols-2">
            <Input aria-label="Nama item" placeholder="Nama, misal: Kosan" value={nama} onChange={(e) => setNama(e.target.value)} className="sm:col-span-2" />
            <Input aria-label="Nominal (opsional)" inputMode="numeric" placeholder="Rp 0 (opsional)" value={formatRupiahInput(nominal)} onChange={(e) => setNominal(parseRupiahInput(e.target.value))} />
            {jenis === 'pengeluaran' && (
              <select aria-label="Kategori" value={kategori} onChange={(e) => pickKategori(e.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                {RENCANA_KATEGORI.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
            {jenis === 'pengeluaran' && (
              <select aria-label="Kelompok 50/30/20" value={kelompok} onChange={(e) => setKelompok(e.target.value as Kelompok)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
                {KELOMPOK_KEYS.map((key) => (
                  <option key={key} value={key}>{KELOMPOK_LABEL[key]}</option>
                ))}
              </select>
            )}
          </div>
          {error && <p className="text-xs font-bold text-destructive">{error}</p>}
          <Button size="sm" disabled={busy} onClick={addItem} className="w-full gap-2 rounded-full font-bold sm:w-auto">
            <PlusCircle className="h-4 w-4" /> Tambah item
          </Button>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Bulan ini sudah ditutup. Item tidak bisa diubah.
        </p>
      )}

      {ordered.length === 0 ? (
        <p className="mt-6 text-center text-sm text-muted-foreground">Belum ada item. Tambahkan pemasukan dan pengeluaran di atas.</p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-border">
            {pager.pageItems.map((item, index) => {
              const showHeader = index === 0 || pager.pageItems[index - 1].jenis !== item.jenis;
              const group = item.jenis === 'pengeluaran' ? 'Pengeluaran' : 'Pemasukan';
              return (
                <Fragment key={item.id}>
                  {showHeader && (
                    <li className="flex items-center justify-between pb-1 pt-3 text-xs font-extrabold uppercase tracking-wide text-muted-foreground first:pt-0">
                      <span>{group}</span>
                      <span className="tabular-nums">{formatIDR(item.jenis === 'pengeluaran' ? totals.pengeluaran : totals.pemasukan)}</span>
                    </li>
                  )}
                  <ItemRow item={item} editable={editable} busy={busy} onRemove={removeItem} onKelompok={changeKelompok} />
                </Fragment>
              );
            })}
          </ul>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Menampilkan {pager.from}–{pager.to} dari {pager.total} item
          </p>
          <NumberedPagination page={pager.page} totalPages={pager.totalPages} onChange={pager.setPage} label="Halaman item rencana" />
        </>
      )}
    </Card>
  );
}

function ItemRow({
  item,
  editable,
  busy,
  onRemove,
  onKelompok,
}: {
  item: RencanaItem;
  editable: boolean;
  busy: boolean;
  onRemove: (id: string) => void;
  onKelompok: (id: string, value: Kelompok) => void;
}) {
  const isExpense = item.jenis === 'pengeluaran';
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-40">
        <p className="truncate text-sm font-bold">{item.nama}</p>
        <p className="truncate text-[11px] text-muted-foreground">{item.kategori ?? (isExpense ? 'Tanpa kategori' : 'Pemasukan')}</p>
      </div>

      {isExpense && item.kelompok && (
        editable ? (
          <select
            aria-label={`Kelompok ${item.nama}`}
            value={item.kelompok}
            disabled={busy}
            onChange={(e) => onKelompok(item.id, e.target.value as Kelompok)}
            className="h-8 rounded-full border border-border bg-background px-2.5 text-[11px] font-extrabold disabled:opacity-40"
          >
            {KELOMPOK_KEYS.map((key) => (
              <option key={key} value={key}>{KELOMPOK_LABEL[key]}</option>
            ))}
          </select>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-extrabold text-muted-foreground">{KELOMPOK_LABEL[item.kelompok]}</span>
        )
      )}

      <span className="ml-auto text-sm font-extrabold tabular-nums">{formatIDR(item.nominal)}</span>

      {editable && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onRemove(item.id)}
          aria-label={`Hapus ${item.nama}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: 'income' | 'expense'; hint?: string }) {
  return (
    <Card className="rounded-2xl p-3 sm:p-4">
      <p className="text-[11px] font-bold text-muted-foreground sm:text-xs">{label}</p>
      <p
        className={cn(
          'mt-1 font-display text-[15px] font-extrabold tabular-nums sm:text-xl md:text-[22px]',
          tone === 'income' && 'text-emerald-600 dark:text-emerald-300',
          tone === 'expense' && 'text-rose-600 dark:text-rose-300',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[10px] font-semibold leading-snug text-muted-foreground sm:text-[11px]">{hint}</p>}
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
  onSubmit: (input: { bulan: string; nama: string }) => Promise<boolean>;
  busy: boolean;
}) {
  const [month, setMonth] = useState(monthKey().slice(0, 7));
  const [nama, setNama] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!/^\d{4}-\d{2}$/.test(month)) return setError('Pilih bulan terlebih dahulu.');
    setError(null);
    const bulan = `${month}-01`;
    const ok = await onSubmit({ bulan, nama: nama.trim() || monthLabel(bulan) });
    if (ok) {
      setNama('');
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
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
          {error && <p className="text-xs font-bold text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button disabled={busy} onClick={submit}>Simpan sebagai draf</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
