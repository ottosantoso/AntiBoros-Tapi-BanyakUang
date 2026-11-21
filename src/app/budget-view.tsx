import { useCallback, useEffect, useMemo, useState } from 'react';
import { PiggyBank, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  NON_REAL_KATEGORI,
  deleteBudgetRow,
  deleteGoalRow,
  fetchBudgetData,
  insertGoal,
  updateGoalRow,
  upsertBudgetLimit,
  type BudgetData,
  type Budgeting,
  type Goal,
  type Subkategori,
} from '@/lib/data';
import { formatIDR, toISODate } from '@/lib/format';
import { cn } from '@/lib/utils';

const RULE: { key: Budgeting; label: string; pct: number; bar: string }[] = [
  { key: 'Kebutuhan', label: 'Kebutuhan', pct: 50, bar: 'bg-[#059669]' },
  { key: 'Keinginan', label: 'Keinginan', pct: 30, bar: 'bg-[#f59e0b]' },
  { key: 'Tabungan', label: 'Tabungan', pct: 20, bar: 'bg-[#2563eb]' },
];

function periodeBulanIni() {
  const now = new Date();
  return {
    start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function ProgressBar({ value, className }: { value: number; className: string }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[#e7eef9]">
      <div className={cn('h-full rounded-full transition-all', className)} style={{ width: `${width}%` }} />
    </div>
  );
}

export function BudgetView() {
  const [range] = useState(periodeBulanIni);
  const [data, setData] = useState<BudgetData | null>(null);

  const reload = useCallback(async () => {
    const res = await fetchBudgetData(range);
    if (res.error) toast.error('Gagal memuat budget', { description: res.error });
    setData(res);
  }, [range]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const summary = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.subkategori.map((s) => [s.id, s]));
    let kebutuhan = 0;
    let keinginan = 0;
    for (const [id, nominal] of Object.entries(data.spentBySubkat)) {
      const s = byId.get(id);
      if (!s || !s.budgeting || NON_REAL_KATEGORI.has(s.kategori)) continue;
      if (s.budgeting === 'Kebutuhan') kebutuhan += nominal;
      if (s.budgeting === 'Keinginan') keinginan += nominal;
    }
    const sisa = data.pemasukan - kebutuhan - keinginan;
    return {
      pemasukan: data.pemasukan,
      actual: { Kebutuhan: kebutuhan, Keinginan: keinginan, Tabungan: Math.max(0, sisa) } as Record<Budgeting, number>,
    };
  }, [data]);

  if (!data || !summary) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  const pengeluaranSubkat = data.subkategori.filter(
    (s) => s.jenis === 'Pengeluaran' && !NON_REAL_KATEGORI.has(s.kategori),
  );
  const limitBySubkat = new Map(data.budgets.map((b) => [b.subkategoriId, b]));

  return (
    <div className="grid gap-6">
      <Card className="rounded-2xl border-border p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-extrabold text-foreground">Aturan 50/30/20</h2>
            <p className="text-xs text-muted-foreground">Dihitung dari pemasukan bulan ini</p>
          </div>
          <p className="text-sm font-bold tnum text-foreground">Pemasukan {formatIDR(summary.pemasukan)}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {RULE.map((r) => {
            const target = (summary.pemasukan * r.pct) / 100;
            const actual = summary.actual[r.key];
            const persen = target > 0 ? Math.round((actual / target) * 100) : 0;
            return (
              <div key={r.key} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{r.label} ({r.pct}%)</span>
                  <span className="tnum text-muted-foreground">{persen}%</span>
                </div>
                <p className="mt-2 text-sm font-extrabold tnum">{formatIDR(actual)}</p>
                <p className="text-[11px] text-muted-foreground">Target {formatIDR(target)}</p>
                <div className="mt-3">
                  <ProgressBar value={persen} className={r.bar} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="rounded-2xl border-border p-5">
        <h2 className="mb-1 font-display text-base font-extrabold text-foreground">Batas per Subkategori</h2>
        <p className="mb-4 text-xs text-muted-foreground">Atur batas bulanan. Pengeluaran bulan ini dihitung otomatis.</p>
        {pengeluaranSubkat.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada subkategori pengeluaran.</p>
        ) : (
          <div className="divide-y divide-border">
            {pengeluaranSubkat.map((s) => (
              <BudgetRow
                key={s.id}
                sub={s}
                spent={data.spentBySubkat[s.id] ?? 0}
                budgetId={limitBySubkat.get(s.id)?.id ?? null}
                limit={limitBySubkat.get(s.id)?.limit ?? null}
                onChanged={reload}
              />
            ))}
          </div>
        )}
      </Card>

      <GoalsCard goals={data.goals} onChanged={reload} />
    </div>
  );
}

function BudgetRow({
  sub,
  spent,
  budgetId,
  limit,
  onChanged,
}: {
  sub: Subkategori;
  spent: number;
  budgetId: string | null;
  limit: number | null;
  onChanged: () => Promise<void>;
}) {
  const [value, setValue] = useState(limit ? String(limit) : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(limit ? String(limit) : '');
  }, [limit]);

  const save = async () => {
    const n = Number(value.replace(/[.,\s]/g, ''));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error('Batas harus lebih dari 0');
      return;
    }
    setSaving(true);
    const res = await upsertBudgetLimit(sub.id, n);
    setSaving(false);
    if (!res.success) {
      toast.error('Gagal menyimpan batas', { description: res.error ?? undefined });
      return;
    }
    toast.success(`Batas ${sub.nama} disimpan`);
    await onChanged();
  };

  const remove = async () => {
    if (!budgetId) return;
    const res = await deleteBudgetRow(budgetId);
    if (!res.success) {
      toast.error('Gagal menghapus batas', { description: res.error ?? undefined });
      return;
    }
    toast.success(`Batas ${sub.nama} dihapus`);
    await onChanged();
  };

  const persen = limit ? Math.round((spent / limit) * 100) : 0;
  const barClass = persen >= 100 ? 'bg-[#e11d48]' : persen >= 80 ? 'bg-[#f59e0b]' : 'bg-[#059669]';

  return (
    <div className="grid gap-3 py-3 md:grid-cols-[minmax(160px,1fr)_minmax(180px,1.2fr)_auto] md:items-center">
      <div>
        <p className="text-sm font-bold text-foreground">{sub.nama}</p>
        <p className="text-[11px] text-muted-foreground">
          {sub.budgeting} · terpakai <span className="tnum">{formatIDR(spent)}</span>
          {limit ? <> · {persen}%</> : null}
        </p>
        {limit ? (
          <div className="mt-2">
            <ProgressBar value={persen} className={barClass} />
          </div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          placeholder="Batas bulanan"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label={`Batas bulanan ${sub.nama}`}
        />
        <Button size="sm" onClick={save} disabled={saving}>
          Simpan
        </Button>
      </div>
      <div className="flex justify-end">
        {budgetId ? (
          <Button size="icon" variant="ghost" onClick={remove} aria-label={`Hapus batas ${sub.nama}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function GoalsCard({ goals, onChanged }: { goals: Goal[]; onChanged: () => Promise<void> }) {
  const [nama, setNama] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    const n = Number(target.replace(/[.,\s]/g, ''));
    if (!nama.trim() || !Number.isFinite(n) || n <= 0) {
      toast.error('Isi nama dan target (lebih dari 0)');
      return;
    }
    setSaving(true);
    const res = await insertGoal({ nama: nama.trim(), target: n, deadline: deadline || null });
    setSaving(false);
    if (!res.success) {
      toast.error('Gagal menambah target', { description: res.error ?? undefined });
      return;
    }
    setNama('');
    setTarget('');
    setDeadline('');
    toast.success('Target tabungan ditambahkan');
    await onChanged();
  };

  return (
    <Card className="rounded-2xl border-border p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#dcfce7] text-[#059669]">
          <PiggyBank className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-base font-extrabold text-foreground">Target Tabungan</h2>
          <p className="text-xs text-muted-foreground">Isi jumlah terkumpul secara manual setiap kali menabung.</p>
        </div>
      </div>

      <div className="mb-5 grid gap-2 md:grid-cols-[1fr_1fr_180px_auto]">
        <Input placeholder="Nama target" value={nama} onChange={(e) => setNama(e.target.value)} aria-label="Nama target" />
        <Input inputMode="numeric" placeholder="Target (Rp)" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target" />
        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} aria-label="Deadline" />
        <Button onClick={add} disabled={saving}>
          <Plus className="mr-1 h-4 w-4" /> Tambah
        </Button>
      </div>

      {goals.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Belum ada target tabungan.</p>
      ) : (
        <div className="divide-y divide-border">
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} onChanged={onChanged} />
          ))}
        </div>
      )}
    </Card>
  );
}

function GoalRow({ goal, onChanged }: { goal: Goal; onChanged: () => Promise<void> }) {
  const [terkumpul, setTerkumpul] = useState(String(goal.terkumpul));
  const persen = goal.target > 0 ? Math.round((goal.terkumpul / goal.target) * 100) : 0;

  useEffect(() => {
    setTerkumpul(String(goal.terkumpul));
  }, [goal.terkumpul]);

  const saveTerkumpul = async () => {
    const n = Number(terkumpul.replace(/[.,\s]/g, ''));
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Jumlah terkumpul tidak valid');
      return;
    }
    const res = await updateGoalRow(goal.id, { terkumpul: n });
    if (!res.success) {
      toast.error('Gagal memperbarui', { description: res.error ?? undefined });
      return;
    }
    await onChanged();
  };

  const remove = async () => {
    const res = await deleteGoalRow(goal.id);
    if (!res.success) {
      toast.error('Gagal menghapus target', { description: res.error ?? undefined });
      return;
    }
    toast.success('Target dihapus');
    await onChanged();
  };

  return (
    <div className="grid gap-3 py-3 md:grid-cols-[minmax(160px,1fr)_minmax(200px,1.2fr)_auto] md:items-center">
      <div>
        <p className="text-sm font-bold text-foreground">{goal.nama}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatIDR(goal.terkumpul)} / {formatIDR(goal.target)} · {persen}%
          {goal.deadline ? ` · sampai ${goal.deadline}` : ''}
        </p>
        <div className="mt-2">
          <ProgressBar value={persen} className="bg-[#2563eb]" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          value={terkumpul}
          onChange={(e) => setTerkumpul(e.target.value)}
          aria-label={`Terkumpul ${goal.nama}`}
        />
        <Button size="sm" variant="outline" onClick={saveTerkumpul}>
          Perbarui
        </Button>
      </div>
      <div className="flex justify-end">
        <Button size="icon" variant="ghost" onClick={remove} aria-label={`Hapus ${goal.nama}`}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
