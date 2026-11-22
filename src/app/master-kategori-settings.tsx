import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Pencil, Plus, Trash2, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PaginationBar, usePagination } from '@/components/pagination-bar';
import {
  type Budgeting,
  type JenisMaster,
  type KategoriMaster,
  type Subkategori,
  type WriteResult,
  deleteKategoriRow,
  deleteSubkategoriRow,
  fetchKategoriMaster,
  fetchSubkategoriSemua,
  insertKategori,
  insertSubkategori,
  updateSubkategoriRow,
} from '@/lib/data';

const BUDGETING_OPTIONS: Budgeting[] = ['Kebutuhan', 'Keinginan', 'Tabungan'];
const JENIS_OPTIONS: JenisMaster[] = ['Pengeluaran', 'Pemasukan'];
const SUB_PAGE_SIZE = 20;

/** CRUD kategori dan subkategori master. Item sistem terkunci (tidak bisa diubah, dinonaktifkan, atau dihapus). */
export function MasterKategoriSettings() {
  const [kategori, setKategori] = useState<KategoriMaster[]>([]);
  const [subs, setSubs] = useState<Subkategori[]>([]);
  const [jenis, setJenis] = useState<JenisMaster>('Pengeluaran');
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newKategori, setNewKategori] = useState('');
  const [newSubNama, setNewSubNama] = useState('');
  const [newSubKategori, setNewSubKategori] = useState('');
  const [newSubBudgeting, setNewSubBudgeting] = useState<Budgeting>('Kebutuhan');

  const [editId, setEditId] = useState<string | null>(null);
  const [editNama, setEditNama] = useState('');

  const load = useCallback(async () => {
    const [k, s] = await Promise.all([fetchKategoriMaster(), fetchSubkategoriSemua()]);
    setKategori(k.data);
    setSubs(s.data);
    setError(k.error ?? s.error);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kategoriJenis = useMemo(() => kategori.filter((k) => k.jenis === jenis), [kategori, jenis]);
  const kategoriAktif = useMemo(() => kategoriJenis.filter((k) => k.aktif), [kategoriJenis]);
  const subJenis = useMemo(
    () => subs.filter((s) => s.jenis === jenis && (showInactive || s.aktif)),
    [subs, jenis, showInactive],
  );
  const subPage = usePagination(subJenis, SUB_PAGE_SIZE, `${jenis}|${showInactive}`);
  const pilihKategoriSub = newSubKategori || kategoriAktif[0]?.nama || '';

  async function run(action: () => Promise<WriteResult>, onOk?: () => void) {
    setBusy(true);
    const res = await action();
    setBusy(false);
    if (!res.success) {
      setError(res.error ?? 'Gagal menyimpan perubahan.');
      return;
    }
    setError(null);
    onOk?.();
    await load();
  }

  function tambahKategori() {
    const nama = newKategori.trim();
    if (!nama) return;
    if (kategoriJenis.some((k) => k.nama.toLowerCase() === nama.toLowerCase())) {
      setError(`Kategori "${nama}" sudah ada.`);
      return;
    }
    void run(() => insertKategori({ nama, jenis }), () => setNewKategori(''));
  }

  function hapusKategori(k: KategoriMaster) {
    const adaSub = subs.some((s) => s.kategori === k.nama && s.jenis === k.jenis);
    if (adaSub) {
      setError(`Kategori "${k.nama}" masih punya subkategori. Hapus atau pindahkan subkategorinya dulu.`);
      return;
    }
    if (!window.confirm(`Hapus kategori "${k.nama}"?`)) return;
    void run(() => deleteKategoriRow(k.id));
  }

  function tambahSub() {
    const nama = newSubNama.trim();
    if (!nama || !pilihKategoriSub) return;
    if (subs.some((s) => s.jenis === jenis && s.nama.toLowerCase() === nama.toLowerCase())) {
      setError(`Subkategori "${nama}" sudah ada.`);
      return;
    }
    void run(
      () =>
        insertSubkategori({
          nama,
          kategori: pilihKategoriSub,
          jenis,
          budgeting: jenis === 'Pengeluaran' ? newSubBudgeting : null,
        }),
      () => setNewSubNama(''),
    );
  }

  function simpanNama(s: Subkategori) {
    const nama = editNama.trim();
    if (!nama || nama === s.nama) {
      setEditId(null);
      return;
    }
    void run(() => updateSubkategoriRow(s.id, { nama }), () => setEditId(null));
  }

  function ubahBudgeting(s: Subkategori, value: Budgeting) {
    if (value === s.budgeting) return;
    void run(() => updateSubkategoriRow(s.id, { budgeting: value }));
  }

  function toggleSub(s: Subkategori) {
    void run(() => updateSubkategoriRow(s.id, { aktif: !s.aktif }));
  }

  function hapusSub(s: Subkategori) {
    if (!window.confirm(`Hapus subkategori "${s.nama}"? Riwayat transaksi lama tetap ada tanpa subkategori.`)) return;
    void run(() => deleteSubkategoriRow(s.id));
  }

  // Grup kategori dibentuk dari baris di halaman aktif saja.
  const subGroups = useMemo(() => {
    const map = new Map<string, Subkategori[]>();
    for (const s of subPage.pageItems) {
      const list = map.get(s.kategori) ?? [];
      list.push(s);
      map.set(s.kategori, list);
    }
    return Array.from(map.entries());
  }, [subPage.pageItems]);

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {JENIS_OPTIONS.map((j) => (
          <Button
            key={j}
            size="sm"
            variant={jenis === j ? 'default' : 'outline'}
            onClick={() => {
              setJenis(j);
              setEditId(null);
              setError(null);
            }}
          >
            {j}
          </Button>
        ))}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Card className="p-5">
        <h3 className="font-display text-base font-bold tracking-tight">Kategori</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">Kelompok utama untuk subkategori {jenis.toLowerCase()}.</p>

        <ul className="mt-4 divide-y divide-border">
          {kategoriJenis.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="flex items-center gap-2">
                {k.nama}
                {k.isSystem && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    Sistem
                  </span>
                )}
              </span>
              {!k.isSystem && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Hapus kategori ${k.nama}`}
                  onClick={() => hapusKategori(k)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            tambahKategori();
          }}
        >
          <Input
            value={newKategori}
            onChange={(e) => setNewKategori(e.target.value)}
            placeholder={`Kategori ${jenis.toLowerCase()} baru`}
            maxLength={60}
          />
          <Button type="submit" disabled={busy || !newKategori.trim()}>
            <Plus className="mr-1 h-4 w-4" /> Tambah
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold tracking-tight">Subkategori</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Dipakai di form transaksi dan dihitung di Budget.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowInactive((v) => !v)}>
            {showInactive ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
            {showInactive ? 'Sembunyikan nonaktif' : 'Tampilkan nonaktif'}
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          {subGroups.length === 0 && <p className="text-sm text-muted-foreground">Belum ada subkategori.</p>}
          {subGroups.map(([kat, list]) => (
            <div key={kat}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{kat}</p>
              <ul className="mt-1 divide-y divide-border">
                {list.map((s) => (
                  <li key={s.id} className={`flex flex-wrap items-center gap-2 py-2 text-sm ${s.aktif ? '' : 'opacity-60'}`}>
                    {editId === s.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input value={editNama} onChange={(e) => setEditNama(e.target.value)} maxLength={80} />
                        <Button size="sm" variant="ghost" aria-label="Simpan nama" disabled={busy} onClick={() => simpanNama(s)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" aria-label="Batal ubah" onClick={() => setEditId(null)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 min-w-[10rem]">
                          {s.nama}
                          {s.isSystem && (
                            <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                              Sistem
                            </span>
                          )}
                          {!s.aktif && <span className="ml-2 text-xs text-muted-foreground">(nonaktif)</span>}
                        </span>

                        {jenis === 'Pengeluaran' && (
                          <select
                            aria-label={`Budgeting ${s.nama}`}
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs disabled:opacity-50"
                            value={s.budgeting ?? 'Kebutuhan'}
                            disabled={s.isSystem || busy}
                            onChange={(e) => ubahBudgeting(s, e.target.value as Budgeting)}
                          >
                            {BUDGETING_OPTIONS.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        )}

                        {!s.isSystem && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Ubah nama ${s.nama}`}
                              disabled={busy}
                              onClick={() => {
                                setEditId(s.id);
                                setEditNama(s.nama);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => toggleSub(s)}
                            >
                              {s.aktif ? 'Sembunyikan' : 'Tampilkan'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Hapus ${s.nama}`}
                              disabled={busy}
                              onClick={() => hapusSub(s)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <PaginationBar
          page={subPage.page}
          totalPages={subPage.totalPages}
          total={subPage.total}
          from={subPage.from}
          to={subPage.to}
          setPage={subPage.setPage}
          noun="subkategori"
        />

        <form
          className="mt-5 grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_1fr_auto_auto]"
          onSubmit={(e) => {
            e.preventDefault();
            tambahSub();
          }}
        >
          <Input
            value={newSubNama}
            onChange={(e) => setNewSubNama(e.target.value)}
            placeholder="Nama subkategori"
            maxLength={80}
            aria-label="Nama subkategori baru"
          />
          <select
            aria-label="Kategori subkategori baru"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={pilihKategoriSub}
            onChange={(e) => setNewSubKategori(e.target.value)}
          >
            {kategoriAktif.map((k) => (
              <option key={k.id} value={k.nama}>
                {k.nama}
              </option>
            ))}
          </select>
          {jenis === 'Pengeluaran' && (
            <select
              aria-label="Budgeting subkategori baru"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              value={newSubBudgeting}
              onChange={(e) => setNewSubBudgeting(e.target.value as Budgeting)}
            >
              {BUDGETING_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          )}
          <Button type="submit" disabled={busy || !newSubNama.trim() || !pilihKategoriSub}>
            <Plus className="mr-1 h-4 w-4" /> Tambah
          </Button>
        </form>
      </Card>
    </div>
  );
}
