import { useState } from 'react';
import {
  ArrowLeftRight,
  CalendarRange,
  ChevronDown,
  LayoutDashboard,
  List,
  PiggyBank,
  HandCoins,
  BarChart3,
  ClipboardList,
  HeartPulse,
  History,
  MessageSquare,
  Settings,
  ShieldCheck,
  Sparkles,
  Tags,
  TrendingDown,
  TrendingUp,
  LogOut,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/logo';
import type { View, TransactionSection, AiSection } from '@/app/views';

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

/** Sub-menu AI Center. "AI Scanner" punya view sendiri, sisanya lewat `aiSection`. */
const AI_CHILDREN: {
  id: 'scanner' | Exclude<AiSection, 'hub'>;
  label: string;
  icon: typeof ClipboardList;
  iconClass: string;
  tileClass: string;
}[] = [
  { id: 'scanner', label: 'AI Scanner', icon: ClipboardList, iconClass: 'text-amber-300', tileClass: 'bg-amber-500/15' },
  { id: 'kategorisasi', label: 'Kategorisasi Otomatis', icon: Tags, iconClass: 'text-emerald-300', tileClass: 'bg-emerald-500/15' },
  { id: 'asisten', label: 'Asisten Keuangan AI', icon: MessageSquare, iconClass: 'text-violet-300', tileClass: 'bg-violet-500/15' },
  { id: 'prediksi', label: 'Prediksi & Kesehatan', icon: HeartPulse, iconClass: 'text-amber-300', tileClass: 'bg-amber-500/15' },
  { id: 'riwayat', label: 'Riwayat AI', icon: History, iconClass: 'text-sky-300', tileClass: 'bg-sky-500/15' },
];

const TOP_ITEMS: { id: View; label: string; hint: string; icon: typeof Wallet }[] = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Ringkasan keuangan', icon: LayoutDashboard },
  { id: 'wallets', label: 'Dompet', hint: 'Kelola sumber dana', icon: Wallet },
  { id: 'budget', label: 'Budget', hint: 'Batas & target tabungan', icon: PiggyBank },
  { id: 'utang', label: 'Utang & Piutang', hint: 'Pinjaman & tagihan', icon: HandCoins },
  { id: 'analisa', label: 'Analisa', hint: 'Tren & aliran dana', icon: BarChart3 },
  { id: 'rencana', label: 'Rencana', hint: 'Rencana pengeluaran bulanan', icon: CalendarRange },
];

export function Sidebar({
  view,
  txSection,
  aiSection,
  onNavigate,
  onNavigateAi,
  connected,
  usingDemo,
  userEmail,
  onSignOut,
  open,
  isAdmin,
}: {
  view: View;
  txSection: TransactionSection;
  aiSection: AiSection;
  onNavigate: (v: View, section?: TransactionSection) => void;
  onNavigateAi: (section: AiSection) => void;
  connected: boolean;
  usingDemo: boolean;
  userEmail: string;
  onSignOut: () => void;
  /** Hanya berpengaruh di layar kecil (drawer). Di desktop sidebar selalu tampil. */
  open: boolean;
  /** Menu Admin hanya tampil untuk akun admin. */
  isAdmin: boolean;
}) {
  const [txOpen, setTxOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);
  const txActive = view === 'transactions';
  const aiActive = view === 'ai' || view === 'scanner';

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-[264px] max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-200 ease-out',
        open ? 'translate-x-0' : '-translate-x-full',
        'lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:shrink-0 lg:translate-x-0',
      )}
    >
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <Logo size={40} />
        <div className="min-w-0">
          <p className="truncate font-display text-[17px] font-extrabold leading-tight tracking-tight text-white">
            Hepeng History
          </p>
          <p className="text-[11px] font-medium text-muted-foreground">Pantau Duit & Pengeluaran Harianmu</p>
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

        {/* AI Center — accordion parent */}
        <div>
          <button
            type="button"
            onClick={() => setAiOpen((o) => !o)}
            aria-expanded={aiOpen}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
              aiActive ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-colors',
                aiActive ? 'bg-primary text-primary-foreground shadow-[0_0_18px_rgba(59,130,246,0.45)]' : 'bg-white/5 text-muted-foreground group-hover:text-foreground',
              )}
            >
              <Sparkles className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block truncate text-sm font-bold', aiActive && 'text-primary')}>AI Center</span>
              <span className="block truncate text-[11px] font-medium text-muted-foreground">Pindai &amp; analisa dengan AI</span>
            </span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform duration-200', aiOpen && 'rotate-180')} />
          </button>

          {aiOpen && (
            <div className="relative mt-1 ml-[26px] space-y-0.5 border-l border-sidebar-border pl-3">
              {AI_CHILDREN.map((child) => {
                const childActive = child.id === 'scanner' ? view === 'scanner' : view === 'ai' && aiSection === child.id;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => (child.id === 'scanner' ? onNavigate('scanner') : onNavigateAi(child.id))}
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
          active={view === 'settings'}
          onClick={() => onNavigate('settings')}
          icon={<Settings className="h-[18px] w-[18px]" strokeWidth={2.2} />}
          label="Pengaturan"
          hint="Preferensi aplikasi"
        />

        {isAdmin && (
          <NavButton
            active={view === 'admin'}
            onClick={() => onNavigate('admin')}
            icon={<ShieldCheck className="h-[18px] w-[18px]" strokeWidth={2.2} />}
            label="Admin"
            hint="Ringkasan aplikasi"
          />
        )}
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
