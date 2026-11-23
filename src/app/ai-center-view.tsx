import { useState } from 'react';
import { Check, ClipboardList, History, MessageSquare, Sparkles, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { AiSection } from '@/app/views';
import { cn } from '@/lib/utils';

interface HubItem {
  id: Exclude<AiSection, 'hub'>;
  title: string;
  desc: string;
  icon: typeof Sparkles;
  status: 'aktif' | 'segera';
  statusLabel: string;
  tone: string;
}

const ITEMS: HubItem[] = [
  {
    id: 'kategorisasi',
    title: 'Kategorisasi Otomatis',
    desc: 'AI mengenali deskripsi transaksi dan menyarankan kategori serta subkategori.',
    icon: Tags,
    status: 'aktif',
    statusLabel: 'Aktif',
    tone: 'bg-emerald-500/15 text-emerald-300',
  },
  {
    id: 'asisten',
    title: 'Asisten Keuangan AI',
    desc: 'Chat dengan AI untuk bertanya tentang kondisi keuangan dan meminta saran.',
    icon: MessageSquare,
    status: 'segera',
    statusLabel: 'Segera hadir',
    tone: 'bg-violet-500/15 text-violet-300',
  },
  {
    id: 'riwayat',
    title: 'Riwayat AI',
    desc: 'Melihat hasil insight AI yang pernah dibuat dan riwayat percakapan.',
    icon: History,
    status: 'segera',
    statusLabel: 'Segera hadir',
    tone: 'bg-sky-500/15 text-sky-300',
  },
];

/**
 * Hub AI Center. Sub-halaman dipilih lewat `section`; AI Scanner tidak di sini karena punya view sendiri
 * (lihat App.tsx), tetapi kartunya tetap ditampilkan agar hub terasa lengkap.
 */
export function AiCenterView({
  section,
  onOpen,
  onOpenScanner,
}: {
  section: AiSection;
  onOpen: (s: AiSection) => void;
  onOpenScanner: () => void;
}) {
  if (section === 'hub') {
    return (
      <div className="space-y-5">
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_rgba(59,130,246,0.4)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold tracking-tight">AI Center</h2>
              <p className="text-sm text-muted-foreground">
                Fitur AI untuk membantu mencatat dan memahami keuanganmu. Semua hasil AI bisa kamu ubah sebelum disimpan.
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <HubCard
            title="AI Scanner"
            desc="Pindai struk belanja, nota, dan bukti transaksi menjadi transaksi otomatis."
            icon={ClipboardList}
            tone="bg-amber-500/15 text-amber-300"
            statusLabel="Aktif"
            statusTone="bg-emerald-500/15 text-emerald-300"
            onClick={onOpenScanner}
          />
          {ITEMS.map((item) => (
            <HubCard
              key={item.id}
              title={item.title}
              desc={item.desc}
              icon={item.icon}
              tone={item.tone}
              statusLabel={item.statusLabel}
              statusTone={item.status === 'aktif' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/10 text-muted-foreground'}
              onClick={() => onOpen(item.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  const back = (
    <Button variant="ghost" size="sm" className="-ml-2" onClick={() => onOpen('hub')}>
      ← Kembali ke AI Center
    </Button>
  );

  if (section === 'kategorisasi') {
    return (
      <div className="space-y-5">
        {back}
        <Card className="space-y-4 p-5">
          <div>
            <h2 className="font-display text-lg font-bold tracking-tight">Kategorisasi Otomatis</h2>
            <p className="text-sm text-muted-foreground">
              Saat kamu mengetik deskripsi transaksi, aplikasi mencari saran subkategori dalam tiga langkah. Berhenti di langkah pertama yang cocok.
            </p>
          </div>
          <ol className="space-y-3">
            <Step n={1} title="Riwayatmu" desc="Deskripsi yang pernah kamu pilih ke subkategori tertentu dipakai lagi. Tanpa AI." />
            <Step n={2} title="Kata kunci" desc="Nama subkategori dan kata kunci bawaan dicocokkan per kata. Tanpa AI." />
            <Step n={3} title="AI (Gemini)" desc="Hanya dipanggil bila dua langkah di atas tidak menemukan cocokan. Yang dikirim hanya deskripsi dan daftar nama subkategori." />
          </ol>
          <p className="text-xs text-muted-foreground">
            Saran tidak pernah disimpan otomatis. Kamu tetap bisa memilih subkategori lain sebelum menyimpan.
          </p>
        </Card>
      </div>
    );
  }

  // asisten dan riwayat: belum dibangun, tampilkan status yang jelas
  const info =
    section === 'asisten'
      ? {
          title: 'Asisten Keuangan AI',
          desc: 'Tanya apa saja tentang keuanganmu dan minta saran berdasarkan ringkasan angka bulan ini. Akan hadir di Fase C.',
        }
      : {
          title: 'Riwayat AI',
          desc: 'Daftar insight AI yang pernah dibuat, lengkap dengan periodenya. Akan hadir setelah fitur insight disimpan.',
        };
  return (
    <div className="space-y-5">
      {back}
      <Card className="p-5">
        <h2 className="font-display text-lg font-bold tracking-tight">{info.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{info.desc}</p>
      </Card>
    </div>
  );
}

function HubCard({
  title,
  desc,
  icon: Icon,
  tone,
  statusLabel,
  statusTone,
  onClick,
}: {
  title: string;
  desc: string;
  icon: typeof Sparkles;
  tone: string;
  statusLabel: string;
  statusTone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
    >
      <Card className="flex h-full flex-col gap-3 p-5 transition-colors group-hover:border-primary/50">
        <div className="flex items-center justify-between">
          <span className={cn('grid h-10 w-10 place-items-center rounded-xl', tone)}>
            <Icon className="h-5 w-5" />
          </span>
          <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-bold', statusTone)}>{statusLabel}</span>
        </div>
        <div>
          <h3 className="font-display text-base font-bold tracking-tight">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
        </div>
      </Card>
    </button>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </li>
  );
}

// Ikon Check dan useState dipakai oleh komponen di luar file ini; dibiarkan agar impor konsisten.
export const _unused = { Check, useState };
