import { LayoutDashboard, Wallet, ArrowLeftRight, ScanLine, Settings, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import type { View } from '@/app/views';

const NAV: { id: View; label: string; icon: typeof LayoutDashboard; hint: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, hint: 'Ringkasan keuangan' },
  { id: 'wallets', label: 'Dompet', icon: Wallet, hint: 'Kelola saldo dompet' },
  { id: 'transactions', label: 'Transaksi', icon: ArrowLeftRight, hint: 'Riwayat & tambah' },
  { id: 'scanner', label: 'AI Scanner', icon: ScanLine, hint: 'Pindai struk & mutasi' },
  { id: 'settings', label: 'Pengaturan', icon: Settings, hint: 'Koneksi API' },
];

export function Sidebar({
  view,
  onNavigate,
  connected,
  usingDemo,
}: {
  view: View;
  onNavigate: (v: View) => void;
  connected: boolean;
  usingDemo: boolean;
}) {
  return (
    <aside className="hidden h-full w-[260px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex items-center gap-3 px-6 py-6">
        <Logo />
        <div className="min-w-0">
          <p className="font-display text-[15px] font-extrabold leading-tight tracking-tight">
            Hepeng History
          </p>
          <p className="truncate text-xs text-muted-foreground">Personal Finance</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Menu
        </p>
        {NAV.map((item) => {
          const active = view === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon
                className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}
                strokeWidth={2.2}
              />
              <span className="flex flex-col items-start leading-tight">
                <span>{item.label}</span>
                <span className="text-[11px] font-normal text-muted-foreground/70">{item.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="px-3 pb-4">
        <div
          className={cn(
            'rounded-xl border p-3',
            usingDemo
              ? 'border-warning/30 bg-warning-soft'
              : 'border-income/30 bg-income-soft',
          )}
        >
          <div className="flex items-center gap-2">
            <Sparkles
              className={cn('h-4 w-4', usingDemo ? 'text-warning' : 'text-income')}
              strokeWidth={2.2}
            />
            <span className={cn('text-xs font-semibold', usingDemo ? 'text-warning' : 'text-income')}>
              {usingDemo ? 'Mode Demo' : 'Terkoneksi'}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            {usingDemo
              ? 'Menampilkan data contoh. Hubungkan Apps Script di Pengaturan.'
              : 'Data live dari Google Sheets.'}
          </p>
        </div>
      </div>
    </aside>
  );
}

export const NAV_ITEMS = NAV;
