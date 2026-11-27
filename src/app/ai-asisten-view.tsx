import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, CalendarDays, Check, Loader2, Pencil, Send, User, Wallet as WalletIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  askAiChat,
  cancelChatAction,
  confirmChatAction,
  createCatatAction,
  fetchSubkategori,
  type Subkategori,
} from '@/lib/data';
import { formatIDR } from '@/lib/format';
import { parseQuickEntry, type QuickEntryDraft } from '@/lib/quick-entry';
import { guessCategory, suggestSubkategori } from '@/lib/subkategori-suggest';
import type { Wallet } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Draf transaksi dari chat. Belum tersimpan sampai user menekan Simpan. */
interface DraftCatat {
  aksiId: string;
  teksAsli: string;
  draft: QuickEntryDraft;
  kategori: string;
  status: 'siap' | 'tersimpan' | 'dibatalkan' | 'diubah';
  sibuk: boolean;
  error?: string;
}

interface Pesan {
  id: number;
  role: 'user' | 'ai';
  teks?: string;
  gagal?: boolean;
  draft?: DraftCatat;
}

const SARAN_PERTANYAAN = [
  'Kenapa pengeluaran bulan ini naik?',
  'Apakah saya sudah sesuai budget?',
  'Bagaimana cara menghemat bulan ini?',
  'Berapa total saldo saya sekarang?',
];

const SYSTEM = new Set(['Penyesuaian Saldo', 'Biaya Admin']);
const AWALAN_TANYA = /^(kenapa|mengapa|berapa|apakah|bagaimana|gimana|kapan|apa|kok)\b/;

/** Kalimat dianggap pertanyaan bila berakhir dengan tanda tanya atau diawali kata tanya. */
function adalahPertanyaan(teks: string): boolean {
  const lower = teks.trim().toLowerCase();
  return lower.endsWith('?') || AWALAN_TANYA.test(lower);
}

function formatTanggal(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Asisten Keuangan AI dengan dua jalur:
 * - Pertanyaan (berakhir "?" atau diawali kata tanya) dijawab AI, kuota 20 per hari.
 * - Kalimat catat (mis. "25rb makan siang BCA") diurai lokal dulu. Hasilnya draf yang harus
 *   dikonfirmasi lewat tombol Simpan. Tidak ada transaksi tersimpan tanpa konfirmasi.
 * Riwayat percakapan hanya di layar dan hilang saat halaman ditutup.
 */
export function AiAsistenView({ wallets, onSaved }: { wallets: Wallet[]; onSaved?: () => void }) {
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [subs, setSubs] = useState<Subkategori[]>([]);
  const nextId = useRef(1);
  const akhirRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let aktif = true;
    fetchSubkategori()
      .then((list) => {
        if (aktif) setSubs(list.filter((s) => !SYSTEM.has(s.nama)));
      })
      .catch(() => {});
    return () => {
      aktif = false;
    };
  }, []);

  useEffect(() => {
    akhirRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [pesan, sending]);

  function tambahAi(teks: string, gagal = false) {
    const id = nextId.current++;
    setPesan((p) => [...p, { id, role: 'ai', teks, gagal }]);
  }

  function ubahDraft(id: number, patch: Partial<DraftCatat>) {
    setPesan((p) => p.map((x) => (x.id === id && x.draft ? { ...x, draft: { ...x.draft, ...patch } } : x)));
  }

  async function tanya(pertanyaan: string) {
    const res = await askAiChat(pertanyaan);
    tambahAi(res.jawaban ?? res.error ?? 'Asisten AI belum bisa menjawab. Coba lagi.', !res.jawaban);
  }

  async function catat(teks: string) {
    const hasil = parseQuickEntry(teks, wallets);
    if (!hasil.ok) {
      tambahAi(`${hasil.error}\n\nContoh catat: 25rb makan siang BCA. Untuk bertanya, akhiri dengan tanda tanya.`, true);
      return;
    }
    const d = hasil.draft;
    const sub = subs.length
      ? suggestSubkategori(
          subs.filter((s) => s.jenis === d.tipe),
          d.deskripsi,
          d.tipe,
        )
      : undefined;
    const kategori = sub?.kategori ?? guessCategory(d.deskripsi, d.tipe);

    const res = await createCatatAction({
      tanggal: d.tanggal,
      deskripsi: d.deskripsi,
      tipe: d.tipe,
      nominal: d.nominal,
      walletId: d.walletId,
      walletNama: d.walletNama,
      kategori,
      subkategoriId: sub?.id ?? null,
    });
    if (!res.id) {
      tambahAi(`Draf belum bisa disiapkan: ${res.error ?? 'coba lagi.'}`, true);
      return;
    }
    const idAi = nextId.current++;
    setPesan((p) => [
      ...p,
      {
        id: idAi,
        role: 'ai',
        draft: { aksiId: res.id as string, teksAsli: teks, draft: d, kategori, status: 'siap', sibuk: false },
      },
    ]);
  }

  async function kirim(teks: string) {
    const pertanyaan = teks.trim();
    if (pertanyaan.length < 3 || sending) return;

    const idUser = nextId.current++;
    setPesan((p) => [...p, { id: idUser, role: 'user', teks: pertanyaan }]);
    setInput('');
    setSending(true);
    try {
      if (adalahPertanyaan(pertanyaan)) {
        await tanya(pertanyaan);
      } else {
        await catat(pertanyaan);
      }
    } finally {
      setSending(false);
    }
  }

  async function simpanDraft(id: number, d: DraftCatat) {
    ubahDraft(id, { sibuk: true, error: undefined });
    const res = await confirmChatAction(d.aksiId);
    if (!res.success) {
      ubahDraft(id, { sibuk: false, error: res.error ?? 'Gagal menyimpan. Coba lagi.' });
      return;
    }
    ubahDraft(id, { sibuk: false, status: 'tersimpan' });
    onSaved?.();
  }

  async function batalkanDraft(id: number, d: DraftCatat, status: 'dibatalkan' | 'diubah') {
    ubahDraft(id, { sibuk: true });
    // Kalau pembatalan gagal, draf tetap pending tapi kedaluwarsa otomatis dalam 15 menit dan tidak bisa disimpan.
    await cancelChatAction(d.aksiId);
    ubahDraft(id, { sibuk: false, status });
    if (status === 'diubah') {
      setInput(d.teksAsli);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void kirim(input);
  }

  const kosong = pesan.length === 0;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="flex items-start gap-3 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold tracking-tight">Asisten Keuangan AI</h2>
          <p className="text-sm text-muted-foreground">
            Tanya tentang keuanganmu, atau catat transaksi dengan kalimat singkat, misalnya{' '}
            <span className="font-semibold">25rb makan siang BCA</span>. Catatan baru tersimpan setelah kamu menekan
            Simpan. Pertanyaan dibatasi 20 per hari.
          </p>
        </div>
      </Card>

      <Card className="flex min-h-[360px] min-w-0 flex-col p-0">
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4 sm:p-5"
        >
          {kosong && (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">Mulai dengan salah satu pertanyaan ini:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SARAN_PERTANYAAN.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => kirim(s)}
                    disabled={sending}
                    className="min-h-10 rounded-full border border-border bg-card px-3.5 py-2 text-left text-xs font-semibold text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pesan.map((p) => (
            <div key={p.id} className={cn('flex min-w-0 gap-3', p.role === 'user' && 'flex-row-reverse')}>
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                  p.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-violet-500/15 text-violet-300',
                )}
                aria-hidden
              >
                {p.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              {p.draft ? (
                <KartuDraft
                  draft={p.draft}
                  saldo={wallets.find((w) => w.id === p.draft?.draft.walletId)?.saldo}
                  onSimpan={() => p.draft && simpanDraft(p.id, p.draft)}
                  onUbah={() => p.draft && batalkanDraft(p.id, p.draft, 'diubah')}
                  onBatal={() => p.draft && batalkanDraft(p.id, p.draft, 'dibatalkan')}
                />
              ) : (
                <div
                  className={cn(
                    'min-w-0 max-w-[85%] whitespace-pre-line break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[80%]',
                    p.role === 'user'
                      ? 'rounded-tr-sm bg-primary text-primary-foreground'
                      : p.gagal
                        ? 'rounded-tl-sm border border-destructive/30 bg-destructive/10 text-destructive'
                        : 'rounded-tl-sm border border-border bg-card text-foreground',
                  )}
                >
                  {p.teks}
                </div>
              )}
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sedang memproses...
            </div>
          )}
          <div ref={akhirRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Catat atau tanya, misalnya 25rb parkir GOPAY"
            maxLength={500}
            disabled={sending}
            aria-label="Pesan untuk Asisten Keuangan AI"
            className="h-11 min-w-0 flex-1 text-base sm:text-sm"
          />
          <Button type="submit" disabled={sending || input.trim().length < 3} className="h-11 w-11 shrink-0 p-0">
            <Send className="h-4 w-4" />
            <span className="sr-only">Kirim</span>
          </Button>
        </form>
      </Card>

      <p className="text-xs text-muted-foreground">
        Asisten memberi saran umum, bukan nasihat keuangan profesional. Percakapan hanya ada di layar ini dan hilang
        saat halaman ditutup. Draf yang belum disimpan kedaluwarsa otomatis dalam 15 menit.
      </p>
    </div>
  );
}

function KartuDraft({
  draft,
  saldo,
  onSimpan,
  onUbah,
  onBatal,
}: {
  draft: DraftCatat;
  saldo: number | undefined;
  onSimpan: () => void;
  onUbah: () => void;
  onBatal: () => void;
}) {
  const d = draft.draft;
  const melebihi = d.tipe === 'Pengeluaran' && saldo !== undefined && d.nominal > saldo;

  return (
    <div className="min-w-0 max-w-[85%] flex-1 rounded-2xl rounded-tl-sm border border-border bg-card p-4 text-sm sm:max-w-[80%]">
      <p className="font-display text-sm font-bold">
        {d.tipe === 'Pemasukan' ? 'Catat pemasukan' : 'Catat pengeluaran'}
      </p>

      {draft.status === 'siap' && (
        <>
          <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-xs sm:text-sm">
            <dt className="text-muted-foreground">Nominal</dt>
            <dd className={cn('font-bold', d.tipe === 'Pemasukan' ? 'text-income' : 'text-expense')}>
              {d.tipe === 'Pemasukan' ? '+' : '-'} {formatIDR(d.nominal)}
            </dd>
            <dt className="text-muted-foreground">Deskripsi</dt>
            <dd className="min-w-0 break-words font-semibold">{d.deskripsi}</dd>
            <dt className="text-muted-foreground">Dompet</dt>
            <dd className="flex min-w-0 items-center gap-1.5 break-words font-semibold">
              <WalletIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {d.walletNama}
            </dd>
            <dt className="text-muted-foreground">Kategori</dt>
            <dd className="min-w-0 break-words font-semibold">{draft.kategori}</dd>
            <dt className="text-muted-foreground">Tanggal</dt>
            <dd className="flex min-w-0 items-center gap-1.5 font-semibold">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {formatTanggal(d.tanggal)}
            </dd>
          </dl>

          {melebihi && (
            <p className="mt-3 text-xs font-semibold text-destructive">
              Nominal melebihi saldo {d.walletNama} ({formatIDR(saldo ?? 0)}).
            </p>
          )}
          {draft.error && (
            <p role="alert" className="mt-3 text-xs font-semibold text-destructive">
              {draft.error}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button
              type="button"
              onClick={onSimpan}
              disabled={draft.sibuk || melebihi}
              className="h-11 w-full gap-2 sm:w-auto sm:min-w-[8rem] sm:flex-1"
            >
              {draft.sibuk && <Loader2 className="h-4 w-4 animate-spin" />}
              Simpan
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onUbah}
                disabled={draft.sibuk}
                className="h-11 flex-1 gap-2 sm:flex-none"
              >
                <Pencil className="h-4 w-4" />
                Ubah
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onBatal}
                disabled={draft.sibuk}
                className="h-11 flex-1 sm:flex-none"
              >
                Batal
              </Button>
            </div>
          </div>
        </>
      )}

      {draft.status === 'tersimpan' && (
        <p className="mt-3 flex items-start gap-2 font-semibold text-income">
          <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">
            Tersimpan: {d.deskripsi} · {formatIDR(d.nominal)} · {d.walletNama}
          </span>
        </p>
      )}
      {draft.status === 'dibatalkan' && <p className="mt-3 text-muted-foreground">Dibatalkan. Tidak ada yang disimpan.</p>}
      {draft.status === 'diubah' && (
        <p className="mt-3 text-muted-foreground">Teks dikembalikan ke kolom di bawah untuk diubah.</p>
      )}
    </div>
  );
}
