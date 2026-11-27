import { useCallback, useEffect, useState } from 'react';
import { Loader2, LockKeyhole, Search, ShieldCheck, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  fetchDaftarPengguna,
  fetchPeranSaya,
  fetchStatusDukungan,
  fetchTransaksiDukungan,
  mintaAksesDukungan,
  type PenggunaAdmin,
  type TransaksiDukungan,
} from '@/lib/data';
import { cn } from '@/lib/utils';

const PER_HALAMAN = 25;
const JAM_PILIHAN = [1, 6, 24] as const;

function rupiah(n: number): string {
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function waktu(iso: string | null): string {
  if (!iso) return 'Belum pernah';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function tanggal(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function AdminPenggunaView() {
  const [peran, setPeran] = useState<string[]>([]);
  const [inputCari, setInputCari] = useState('');
  const [cari, setCari] = useState('');
  const [items, setItems] = useState<PenggunaAdmin[]>([]);
  const [halaman, setHalaman] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terpilih, setTerpilih] = useState<PenggunaAdmin | null>(null);

  // Akses dukungan hanya untuk super_admin dan support. Peran ini juga diperiksa di server.
  const bisaDukungan = peran.includes('super_admin') || peran.includes('support');

  useEffect(() => {
    void fetchPeranSaya().then(setPeran);
  }, []);

  const muat = useCallback(
    async (h: number, kata: string) => {
      setLoading(true);
      const res = await fetchDaftarPengguna(kata, h * PER_HALAMAN);
      setError(res.error);
      setItems((prev) => (h === 0 ? res.data : [...prev, ...res.data]));
      setLoading(false);
    },
    [],
  );

  useEffect(() => {
    void muat(0, cari);
  }, [cari, muat]);

  function cariSekarang(e: React.FormEvent) {
    e.preventDefault();
    setHalaman(0);
    setCari(inputCari);
  }

  function muatLebih() {
    const h = halaman + 1;
    setHalaman(h);
    void muat(h, cari);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={cariSekarang} className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={inputCari}
            onChange={(e) => setInputCari(e.target.value)}
            placeholder={bisaDukungan ? 'Cari nama, email, atau ID' : 'Cari ID singkat'}
            aria-label="Cari pengguna"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">Cari</Button>
      </form>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Gagal memuat pengguna: {error}
        </div>
      )}

      <Card className="overflow-hidden">
        {/* Tabel untuk layar lebar */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Pengguna</th>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3 text-right">Transaksi</th>
                <th className="px-4 py-3">Terakhir masuk</th>
                <th className="px-4 py-3">Bergabung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((p) => (
                <tr
                  key={p.idSingkat}
                  onClick={() => setTerpilih(p)}
                  className="cursor-pointer transition hover:bg-accent/40"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{p.nama ?? `ID ${p.idSingkat}`}</p>
                    {p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.idSingkat}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{p.jumlahTransaksi.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{waktu(p.terakhirMasuk)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{waktu(p.dibuat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Kartu untuk layar kecil */}
        <ul className="divide-y divide-border md:hidden">
          {items.map((p) => (
            <li key={p.idSingkat}>
              <button type="button" onClick={() => setTerpilih(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-accent/40">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.nama ?? `ID ${p.idSingkat}`}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {p.email ?? `ID ${p.idSingkat}`} · {p.jumlahTransaksi.toLocaleString('id-ID')} transaksi
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {!loading && items.length === 0 && !error && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">Tidak ada pengguna yang cocok.</p>
        )}
        {loading && (
          <p className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Memuat…
          </p>
        )}
      </Card>

      {!loading && items.length >= (halaman + 1) * PER_HALAMAN && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={muatLebih}>Muat lebih banyak</Button>
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {bisaDukungan
          ? 'Data pribadi pengguna tidak terlihat di sini. Akses dukungan hanya dibuka per pengguna, dengan alasan, batas waktu, dan dicatat di log admin.'
          : 'Peran analyst hanya melihat ID singkat dan angka agregat.'}
      </p>

      <DetailPengguna pengguna={terpilih} bisaDukungan={bisaDukungan} onClose={() => setTerpilih(null)} />
    </div>
  );
}

function DetailPengguna({
  pengguna,
  bisaDukungan,
  onClose,
}: {
  pengguna: PenggunaAdmin | null;
  bisaDukungan: boolean;
  onClose: () => void;
}) {
  const [berlakuSampai, setBerlakuSampai] = useState<string | null>(null);
  const [memuatStatus, setMemuatStatus] = useState(false);
  const [alasan, setAlasan] = useState('');
  const [jam, setJam] = useState<(typeof JAM_PILIHAN)[number]>(1);
  const [mengirim, setMengirim] = useState(false);
  const [tx, setTx] = useState<TransaksiDukungan[] | null>(null);
  const [memuatTx, setMemuatTx] = useState(false);

  const idPengguna = pengguna?.id ?? null;

  useEffect(() => {
    if (!idPengguna || !bisaDukungan) return;
    let aktif = true;
    void fetchStatusDukungan(idPengguna).then((r) => {
      if (!aktif) return;
      setBerlakuSampai(r.berlakuSampai);
      setMemuatStatus(false);
    });
    return () => {
      aktif = false;
    };
  }, [idPengguna, bisaDukungan]);

  // Reset state tiap kali pengguna lain dipilih atau dialog ditutup
  useEffect(() => {
    setBerlakuSampai(null);
    setAlasan('');
    setJam(1);
    setTx(null);
    setMemuatStatus(!!idPengguna && bisaDukungan);
  }, [idPengguna, bisaDukungan]);

  async function kirimPermintaan() {
    if (!idPengguna) return;
    if (alasan.trim().length < 5) {
      toast.error('Alasan minimal 5 karakter.');
      return;
    }
    setMengirim(true);
    const res = await mintaAksesDukungan(idPengguna, alasan, jam);
    setMengirim(false);
    if (!res.success) {
      toast.error('Gagal meminta akses', { description: res.error ?? undefined });
      return;
    }
    toast.success(`Akses dukungan aktif selama ${jam} jam`);
    setAlasan('');
    const status = await fetchStatusDukungan(idPengguna);
    setBerlakuSampai(status.berlakuSampai);
  }

  async function bukaTransaksi() {
    if (!idPengguna) return;
    setMemuatTx(true);
    const res = await fetchTransaksiDukungan(idPengguna);
    setMemuatTx(false);
    if (res.error) {
      toast.error('Tidak bisa membuka transaksi', { description: res.error });
      return;
    }
    setTx(res.data);
  }

  const aktifSampai = berlakuSampai ? new Date(berlakuSampai) : null;
  const dukunganAktif = !!aktifSampai && aktifSampai.getTime() > Date.now();

  return (
    <Dialog open={!!pengguna} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        {pengguna && (
          <>
            <DialogHeader>
              <DialogTitle>{pengguna.nama ?? `ID ${pengguna.idSingkat}`}</DialogTitle>
              <DialogDescription>{pengguna.email ?? 'Email disembunyikan untuk peran ini'}</DialogDescription>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-sm">
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">ID</dt>
                <dd className="font-mono text-xs">{pengguna.idSingkat}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Transaksi</dt>
                <dd className="tabular-nums">{pengguna.jumlahTransaksi.toLocaleString('id-ID')}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Bergabung</dt>
                <dd className="text-xs">{waktu(pengguna.dibuat)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Terakhir masuk</dt>
                <dd className="text-xs">{waktu(pengguna.terakhirMasuk)}</dd>
              </div>
            </dl>

            <section className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <h3 className="font-display text-sm font-bold">Akses dukungan</h3>
              </div>

              {!bisaDukungan && (
                <p className="text-sm text-muted-foreground">
                  Hanya super_admin dan support yang bisa meminta akses dukungan.
                </p>
              )}

              {bisaDukungan && memuatStatus && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memeriksa status…
                </p>
              )}

              {bisaDukungan && !memuatStatus && dukunganAktif && (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    <Unlock className="h-4 w-4" /> Aktif sampai {waktu(berlakuSampai)}
                  </p>
                  {tx === null && (
                    <Button type="button" onClick={() => void bukaTransaksi()} disabled={memuatTx} className="gap-2">
                      {memuatTx && <Loader2 className="h-4 w-4 animate-spin" />}
                      Lihat transaksi (100 terbaru)
                    </Button>
                  )}
                  {tx !== null && (
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
                      {tx.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">Belum ada transaksi.</p>}
                      <ul className="divide-y divide-border">
                        {tx.map((t, i) => (
                          <li key={`${t.dibuat}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">{t.deskripsi}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {tanggal(t.tanggal)} · {t.kategori}
                              </p>
                            </div>
                            <span className={cn('shrink-0 text-xs font-bold tabular-nums', t.tipe === 'Pemasukan' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                              {t.tipe === 'Pemasukan' ? '+' : '−'}
                              {rupiah(t.nominal)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {bisaDukungan && !memuatStatus && !dukunganAktif && (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <LockKeyhole className="h-4 w-4" /> Belum ada akses aktif.
                  </p>
                  <div className="space-y-1.5">
                    <label htmlFor="alasan-dukungan" className="text-xs font-bold">Alasan</label>
                    <Textarea
                      id="alasan-dukungan"
                      value={alasan}
                      onChange={(e) => setAlasan(e.target.value)}
                      placeholder="Contoh: pengguna melaporkan saldo tidak sesuai"
                      maxLength={500}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="jam-dukungan" className="text-xs font-bold">Batas waktu</label>
                    <select
                      id="jam-dukungan"
                      value={jam}
                      onChange={(e) => setJam(Number(e.target.value) as (typeof JAM_PILIHAN)[number])}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {JAM_PILIHAN.map((j) => (
                        <option key={j} value={j}>{j} jam</option>
                      ))}
                    </select>
                  </div>
                  <Button type="button" onClick={() => void kirimPermintaan()} disabled={mengirim} className="w-full gap-2">
                    {mengirim && <Loader2 className="h-4 w-4 animate-spin" />}
                    Minta akses dukungan
                  </Button>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    Persetujuan pengguna diasumsikan sudah diberikan lewat syarat dan ketentuan saat mendaftar.
                  </p>
                </div>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
