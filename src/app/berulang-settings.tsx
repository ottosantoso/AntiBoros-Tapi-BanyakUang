import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  type BerulangItem,
  type Subkategori,
  deleteBerulangRow,
  fetchBerulang,
  fetchDashboardData,
  fetchSubkategori,
  insertBerulang,
  updateBerulangAktif,
} from '@/lib/data';
import type { TransactionType, Wallet } from '@/lib/types';
import { formatIDR } from '@/lib/format';

interface FormState {
  nama: string;
  tipe: TransactionType;
  nominal: string;
  walletId: string;
  subkategoriId: string;
  hari: string;
}

const EMPTY_FORM: FormState = {
  nama: '',
  tipe: 'Pengeluaran',
  nominal: '',
  walletId: '',
  subkategoriId: '',
  hari: '1',
};

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Transaksi berulang: dicatat otomatis setiap bulan pada tanggal jatuh tempo. */
export function BerulangSettings() {
  const [items, setItems] = useState<BerulangItem[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [subs, setSubs] = useState<Subkategori[]>([]);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [b, dash, s] = await Promise.all([fetchBerulang(), fetchDashboardData(), fetchSubkategori()]);
    setItems(b.data);
    setWallets(dash.data?.dompet ?? []);
    setSubs(s);
    setError(b.error ?? dash.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const subPilihan = useMemo(() => subs.filter((s) => s.jenis === form.tipe), [subs, form.tipe]);
  const namaDompet = useMemo(() => new Map(wallets.map((w) => [w.id, w.nama])), [wallets]);
  const namaSub = useMemo(() => new Map(subs.map((s) => [s.id, s.nama])), [subs]);

  async function simpan() {
    const nominal = Number(form.nominal.replace(/[.,\s]/g, ''));
    const hari = Number(form.hari);
    if (!form.nama.trim()) return setError('Nama transaksi wajib diisi.');
    if (!Number.isFinite(nominal) || nominal <= 0) return setError('Nominal harus lebih dari 0.');
    if (!form.walletId) return setError('Pilih dompet.');
    if (!Number.isInteger(hari) || hari < 1 || hari > 28) return setError('Tanggal jatuh tempo harus 1 sampai 28.');

    setBusy(true);
    const res = await insertBerulang({
      nama: form.nama,
      tipe: form.tipe,
      nominal,
      walletId: form.walletId,
      subkategoriId: form.subkategoriId || null,
      hariJatuhTempo: hari,
      tanggalMulai: todayIso(),
    });
    setBusy(false);
    if (!res.success) return setError(res.error ?? 'Gagal menyimpan transaksi berulang.');
    setForm(EMPTY_FORM);
    setError(null);
    await load();
  }

  async function toggle(item: BerulangItem) {
    setBusy(true);
    const res = await updateBerulangAktif(item.id, !item.aktif);
    setBusy(false);
    if (!res.success) return setError(res.error);
    await load();
  }

  async function hapus(item: BerulangItem) {
    if (!window.confirm(`Hapus transaksi berulang "${item.nama}"? Transaksi yang sudah tercatat tidak ikut terhapus.`)) return;
    setBusy(true);
    const res = await deleteBerulangRow(item.id);
    setBusy(false);
    if (!res.success) return setError(res.error);
    await load();
  }

  return (
    <Card className="p-5">
      <h3 className="font-display text-base font-bold tracking-tight">Transaksi berulang</h3>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Dicatat otomatis setiap bulan pada tanggal jatuh tempo. Jika tanggal bulan ini belum lewat, pencatatan pertama dimulai bulan ini.
      </p>

      {error && (
        <p role="alert" className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="mt-4 divide-y divide-border">
        {items.length === 0 && <li className="py-2 text-sm text-muted-foreground">Belum ada transaksi berulang.</li>}
        {items.map((item) => (
          <li key={item.id} className={`flex flex-wrap items-center gap-2 py-2 text-sm ${item.aktif ? '' : 'opacity-60'}`}>
            <div className="min-w-[10rem] flex-1">
              <p className="font-medium">{item.nama}</p>
              <p className="text-xs text-muted-foreground">
                {item.tipe} · {formatIDR(item.nominal)} · tiap tanggal {item.hariJatuhTempo} ·{' '}
                {namaDompet.get(item.walletId) ?? 'Dompet'}
                {item.subkategoriId && namaSub.get(item.subkategoriId) ? ` · ${namaSub.get(item.subkategoriId)}` : ''}
              </p>
            </div>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggle(item)}>
              {item.aktif ? 'Jeda' : 'Aktifkan'}
            </Button>
            <Button size="sm" variant="ghost" aria-label={`Hapus ${item.nama}`} disabled={busy} onClick={() => hapus(item)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>

      <form
        className="mt-5 grid gap-2 border-t border-border pt-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void simpan();
        }}
      >
        <Input
          placeholder="Nama, misal Listrik PLN"
          value={form.nama}
          maxLength={80}
          onChange={(e) => setForm({ ...form, nama: e.target.value })}
          aria-label="Nama transaksi berulang"
        />
        <Input
          placeholder="Nominal"
          inputMode="numeric"
          value={form.nominal}
          onChange={(e) => setForm({ ...form, nominal: e.target.value })}
          aria-label="Nominal transaksi berulang"
        />
        <select
          aria-label="Tipe transaksi berulang"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={form.tipe}
          onChange={(e) => setForm({ ...form, tipe: e.target.value as TransactionType, subkategoriId: '' })}
        >
          <option value="Pengeluaran">Pengeluaran</option>
          <option value="Pemasukan">Pemasukan</option>
        </select>
        <select
          aria-label="Dompet transaksi berulang"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={form.walletId}
          onChange={(e) => setForm({ ...form, walletId: e.target.value })}
        >
          <option value="">Pilih dompet</option>
          {wallets.map((w) => (
            <option key={w.id} value={w.id}>
              {w.nama}
            </option>
          ))}
        </select>
        <select
          aria-label="Subkategori transaksi berulang"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={form.subkategoriId}
          onChange={(e) => setForm({ ...form, subkategoriId: e.target.value })}
        >
          <option value="">Tanpa subkategori</option>
          {subPilihan.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nama}
            </option>
          ))}
        </select>
        <Input
          placeholder="Tanggal jatuh tempo (1–28)"
          inputMode="numeric"
          value={form.hari}
          onChange={(e) => setForm({ ...form, hari: e.target.value })}
          aria-label="Tanggal jatuh tempo"
        />
        <Button type="submit" disabled={busy} className="sm:col-span-2">
          <Plus className="mr-1 h-4 w-4" /> Tambah transaksi berulang
        </Button>
      </form>
    </Card>
  );
}
