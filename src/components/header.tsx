import { AlertTriangle, ArrowLeftRight, BarChart3, Bell, CalendarRange, CheckCircle2, LayoutDashboard, List, LogOut, Menu, PiggyBank, HandCoins, RefreshCw, ScanLine, Settings, Sparkles, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { DateRangePicker } from '@/components/date-range-picker';
import { cn } from '@/lib/utils';
import type { DateRangeValue } from '@/lib/date-range';
import type { View, TransactionSection } from '@/app/views';

const TX_TITLES: Record<TransactionSection, string> = {
  all: 'Semua Transaksi',
  income: 'Pemasukan',
  expense: 'Pengeluaran',
  transfer: 'Transfer Antar-Dompet',
};

export function Header({
  view,
  txSection,
  onMenuToggle,
  onRefresh,
  onDateRangeChange,
  dateRange,
  status,
  usingDemo,
  refreshing,
  showDateRange,
  onSignOut,
  userName,
  userEmail,
}: {
  view: View;
  txSection: TransactionSection;
  onMenuToggle: () => void;
  onNavigate?: (v: View, section?: TransactionSection) => void;
  onRefresh: () => void;
  onDateRangeChange: (r: DateRangeValue) => void;
  dateRange: DateRangeValue;
  status: 'idle' | 'loading' | 'connected' | 'error';
  usingDemo: boolean;
  refreshing: boolean;
  showDateRange?: boolean;
  onSignOut: () => void;
  userName: string;
  userEmail: string;
}) {
  const title = view === 'transactions' ? TX_TITLES[txSection] : BASE_TITLES[view];

  return (
    <header className="sticky top-0 z-30 flex min-h-[64px] items-center gap-2 border-b border-sidebar-border bg-background/90 px-3 backdrop-blur-xl sm:gap-3 sm:px-4 md:px-6 lg:min-h-[72px]">
      {/* Tombol menu: hanya di layar kecil, membuka drawer sidebar */}
      <Button
        variant="outline"
        size="icon"
        onClick={onMenuToggle}
        aria-label="Buka menu"
        className="h-10 w-10 shrink-0 rounded-full border-border bg-card text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Judul halaman untuk layar kecil */}
      <h1 className="min-w-0 flex-1 truncate font-display text-base font-extrabold tracking-[-0.02em] text-foreground lg:hidden">
        {title}
      </h1>

      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_0_20px_rgba(59,130,246,0.4)]">
          <LayoutIcon view={view} txSection={txSection} />
        </span>
        <h1 className="font-display text-xl font-extrabold leading-tight tracking-[-0.02em] text-foreground">{title}</h1>
        {showDateRange && (
          <div className="ml-3">
            <DateRangePicker range={dateRange} onChange={onDateRangeChange} />
          </div>
        )}
      </div>

      {showDateRange && (
        <div className="shrink-0 lg:hidden">
          <DateRangePicker range={dateRange} onChange={onDateRangeChange} />
        </div>
      )}

      <div className={cn('flex shrink-0 items-center justify-end gap-2 lg:flex-1', showDateRange && 'lg:ml-2')}>
        <div className={cn('hidden items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-extrabold md:flex', usingDemo ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' : status === 'error' ? 'border-rose-400/30 bg-rose-400/10 text-rose-300' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300')}>
          {usingDemo || status === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {usingDemo ? 'Data Demo' : status === 'error' ? 'Gagal memuat' : 'Live'}
        </div>

        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} aria-label="Muat ulang" className="h-10 gap-2 rounded-full border-border bg-card px-3 font-bold text-foreground hover:bg-accent hover:bg-accent/40 hover:text-accent-foreground sm:px-3.5">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          <span className="hidden sm:inline">Muat Ulang</span>
        </Button>

        <ThemeToggle className="h-10 w-10 rounded-full border-border bg-card text-foreground" />
        <button type="button" aria-label="Notifikasi" className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-accent/40 hover:text-foreground xl:flex">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <div title={userEmail} className="hidden items-center gap-2.5 rounded-full bg-card py-1 pl-1 pr-3 ring-1 ring-border xl:flex">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{initialsOf(userName || userEmail)}</span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="max-w-[140px] truncate text-xs font-bold text-foreground">{userName || 'Pengguna'}</span>
            <span className="max-w-[140px] truncate text-[11px] text-muted-foreground">{userEmail}</span>
          </span>
        </div>
        {/* Di HP tombol keluar sudah ada di dalam drawer sidebar */}
        <div className="hidden sm:block">
          <Button variant="outline" size="icon" onClick={onSignOut} aria-label="Keluar" title="Keluar" className="h-10 w-10 rounded-full border-border bg-card text-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

const BASE_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  wallets: 'Dompet',
  budget: 'Budget',
  utang: 'Utang & Piutang',
  analisa: 'Analisa',
  rencana: 'Rencana Bulanan',
  transactions: 'Transaksi',
  ai: 'AI Center',
  scanner: 'AI Scanner',
  settings: 'Pengaturan',
};

function LayoutIcon({ view, txSection }: { view: View; txSection: TransactionSection }) {
  if (view === 'transactions') {
    const icons: Record<TransactionSection, typeof List> = {
      all: List,
      income: TrendingUp,
      expense: TrendingDown,
      transfer: ArrowLeftRight,
    };
    const Icon = icons[txSection];
    return <Icon className="h-5 w-5" strokeWidth={2.4} />;
  }
  const icons: Record<Exclude<View, 'transactions'>, typeof LayoutDashboard> = {
    dashboard: LayoutDashboard,
    wallets: Wallet,
    budget: PiggyBank,
    utang: HandCoins,
    analisa: BarChart3,
    rencana: CalendarRange,
    ai: Sparkles,
    scanner: ScanLine,
    settings: Settings,
  };
  const Icon = icons[view as Exclude<View, 'transactions'>];
  return <Icon className="h-5 w-5" strokeWidth={2.4} />;
}

function initialsOf(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((w) => w[0]).join('').toUpperCase() || '?';
}
