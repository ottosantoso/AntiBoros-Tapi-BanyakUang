import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bot, Loader2, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { askAiChat } from '@/lib/data';
import { cn } from '@/lib/utils';

interface Pesan {
  id: number;
  role: 'user' | 'ai';
  teks: string;
  gagal?: boolean;
}

const SARAN_PERTANYAAN = [
  'Kenapa pengeluaran bulan ini naik?',
  'Apakah saya sudah sesuai budget?',
  'Bagaimana cara menghemat bulan ini?',
  'Berapa total saldo saya sekarang?',
];

/**
 * Asisten Keuangan AI. Jawaban berdasarkan ringkasan angka bulan berjalan.
 * Riwayat percakapan hanya di layar dan hilang saat halaman ditutup (tidak disimpan).
 */
export function AiAsistenView() {
  const [pesan, setPesan] = useState<Pesan[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const nextId = useRef(1);
  const akhirRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    akhirRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [pesan, sending]);

  async function kirim(teks: string) {
    const pertanyaan = teks.trim();
    if (pertanyaan.length < 3 || sending) return;

    const idUser = nextId.current++;
    setPesan((p) => [...p, { id: idUser, role: 'user', teks: pertanyaan }]);
    setInput('');
    setSending(true);

    const res = await askAiChat(pertanyaan);
    const idAi = nextId.current++;
    setPesan((p) => [
      ...p,
      res.jawaban
        ? { id: idAi, role: 'ai', teks: res.jawaban }
        : { id: idAi, role: 'ai', teks: res.error ?? 'Asisten AI belum bisa menjawab.', gagal: true },
    ]);
    setSending(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void kirim(input);
  }

  const kosong = pesan.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-start gap-3 p-5">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
          <Bot className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight">Asisten Keuangan AI</h2>
          <p className="text-sm text-muted-foreground">
            Tanya tentang keuanganmu bulan ini. Jawaban dibuat dari ringkasan angka, bukan dari detail deskripsi
            transaksi. Batas 20 pertanyaan per hari.
          </p>
        </div>
      </Card>

      <Card className="flex min-h-[360px] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
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
                    className="rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-primary/50 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pesan.map((p) => (
            <div key={p.id} className={cn('flex gap-3', p.role === 'user' && 'flex-row-reverse')}>
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                  p.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-violet-500/15 text-violet-300',
                )}
                aria-hidden
              >
                {p.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </span>
              <div
                className={cn(
                  'max-w-[80%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  p.role === 'user'
                    ? 'rounded-tr-sm bg-primary text-primary-foreground'
                    : p.gagal
                      ? 'rounded-tl-sm border border-destructive/30 bg-destructive/10 text-destructive'
                      : 'rounded-tl-sm border border-border bg-card text-foreground',
                )}
              >
                {p.teks}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Asisten sedang menyusun jawaban...
            </div>
          )}
          <div ref={akhirRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tulis pertanyaanmu..."
            maxLength={500}
            disabled={sending}
            aria-label="Pertanyaan untuk Asisten Keuangan AI"
          />
          <Button type="submit" disabled={sending || input.trim().length < 3}>
            <Send className="h-4 w-4" />
            <span className="sr-only">Kirim</span>
          </Button>
        </form>
      </Card>

      <p className="text-xs text-muted-foreground">
        Asisten memberi saran umum, bukan nasihat keuangan profesional. Percakapan hanya ada di layar ini dan hilang saat halaman ditutup.
      </p>
    </div>
  );
}
