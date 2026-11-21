import { useState } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  LayoutDashboard,
  List,
  PiggyBank,
  ScanLine,
  Settings,
  TrendingDown,
  TrendingUp,
  LogOut,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import type { View, TransactionSection } from '@/app/views';
interface TxChild {
  id: TransactionSection;
  label: string;
  icon: typeof List;
  iconClass: string;
  tileClass: string;
}

const TX_CHILDREN: TxChild[] = [
  { id: 'all', label: 'Semua Transaksi', icon: List, iconClass: 'text-sky-300', tileClass: 'bg-sky-500/15' },
  { id: 'income', label: 'Pemasukan', icon: TrendingUp, iconClass: 'text-emerald-400', tileClass: 'bg-emerald-500/15' },
  { id: 'expense', label: 'Pengeluaran', icon: TrendingDown, iconClass: 'text-rose-400', tileClass: 'bg-rose-500/15' },
  {
    id: 'transfer',
    label: 'Transfer Antar-Dompet',
    icon: ArrowLeftRight,
    iconClass: 'text-violet-300',
    tileClass: 'bg-violet-500/15',
  },
];

const TOP_ITEMS: { id: View; label: string; hint: string; icon: typeof Wallet }[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Ringkasan keuangan', icon: LayoutDashboard },
  { id: 'wallets', label: 'Dompet', hint: 'Kelola sumber dana', icon: Wallet },
  { id: 'budget', label: 'Budget', hint: 'Batas & target tabungan', icon: PiggyBank },
];

export function Sidebar({
  view,
  txSection,
  onNavigate,
  connected,
  usingDemo,
  userEmail,
  onSignOut,
}: {
  view: View;
  txSection: TransactionSection;
  onNavigate: (v: View, section?: TransactionSection) => void;
  connected: boolean;
  usingDemo: boolean;
  userEmail: string;
  onSignOut: () => void;
}) {
  const [txOpen, setTxOpen] = useState(true);
  const txActive = view === 'transactions';

  return (
    <aside className="sticky top-0 z-20 flex h-screen w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Logo size={40} />
        <div className="min-w-0">
          <p className="truncate font-display text-[17px] font-extrabold leading-tight tracking-tight text-white">
            Hepeng History
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">Personal Finance Tracker</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {TOP_ITEMS.map((item) => (
          <NavButton
            key={item.id}
            active={view === item.id}
            onClick={() => onNavigate(item.id)}
            icon={<item.icon className="h-[18px] w-[18px]" strokeWidth={2.2} />}
            label={item.label}
            hint={item.hint}
          />
        ))}

        {/* Transaksi — accordion parent */}
        <div>
          <button
            type="button"
            onClick={() => setTxOpen((o) => !o)}
            aria-expanded={txOpen}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
              txActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
                txActive ? 'bg-primary text-primary-foreground shadow-[0_0_18px_rgba(59,130,246,0.45)]' : 'bg-white/5 text-muted-foreground group-hover:text-foreground',
              )}
            >
              <ArrowLeftRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-sm font-bold', txActive && 'text-primary')}>Transaksi</span>
              <span className="block truncate text-[11px] font-medium text-muted-foreground">
                Catatan pemasukan &amp; pengeluaran
              </span>
            </span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200', txOpen && 'rotate-180')} />
          </button>

          {txOpen && (
            <div className="relative mt-1 ml-[26px] space-y-0.5 border-l border-sidebar-border pl-3">
              {TX_CHILDREN.map((child) => {
                const childActive = txActive && txSection === child.id;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => onNavigate('transactions', child.id)}
                    className={cn(
                      'relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold transition-colors',
                      childActive
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                    )}
                  >
                    {childActive && (
                      <span className="absolute -left-[13px] top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    <span className={cn('grid h-6 w-6 shrink-0 place-items-center rounded-md', child.tileClass)}>
                      <child.icon className={cn('h-3.5 w-3.5', child.iconClass)} strokeWidth={2.4} />
                    </span>
                    <span className="truncate">{child.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <NavButton
          active={view === 'scanner'}
          onClick={() => onNavigate('scanner')}
          icon={<ScanLine className="h-[18px] w-[18px]" strokeWidth={2.2} />}
          label="AI Scanner"
          hint="Pindai struk otomatis"
        />
        <NavButton
          active={view === 'settings'}
          onClick={() => onNavigate('settings')}
          icon={<Settings className="h-[18px] w-[18px]" strokeWidth={2.2} />}
          label="Pengaturan"
          hint="Preferensi aplikasi"
        />
      </nav>

      <div className="mx-3 mb-4 rounded-2xl border border-sidebar-border bg-background-elevated p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              usingDemo ? 'bg-amber-400' : connected ? 'bg-emerald-400' : 'bg-rose-400',
            )}
          />
          <p className="text-xs font-bold">
            {usingDemo ? 'Mode Demo' : connected ? 'Terkoneksi' : 'Menghubungkan…'}
          </p>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {usingDemo
            ? 'Hubungkan Supabase untuk menyimpan data.'
            : 'Semua perubahan tersimpan otomatis ke database.'}
        </p>
      </div>
      <div className="mt-auto border-t border-sidebar-border p-4">
        <p className="truncate text-xs text-muted-foreground" title={userEmail}>{userEmail}</p>
        <button type="button" onClick={onSignOut} className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-foreground transition hover:bg-accent/40">
          <LogOut className="h-4 w-4" />
          Keluar
        </button>
      </div>
    </aside>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
        active ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
          active
            ? 'bg-primary text-primary-foreground shadow-[0_0_18px_rgba(59,130,246,0.45)]'
            : 'bg-white/5 text-muted-foreground group-hover:text-foreground',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn('block truncate text-sm font-bold', active && 'text-primary')}>{label}</span>
        <span className="block truncate text-[11px] font-medium text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
