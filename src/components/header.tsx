import { AlertTriangle, ArrowLeftRight, Bell, CheckCircle2, ChevronDown, LayoutDashboard, List, Plus, RefreshCw, ScanLine, Settings, TrendingDown, TrendingUp, UserRound, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';
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
  onNavigate,
  onRefresh,
  onAdd,
  onDateRangeChange,
  dateRange,
  status,
  usingDemo,
  refreshing,
  showDateRange,
}: {
  view: View;
  txSection: TransactionSection;
  onNavigate: (v: View, section?: TransactionSection) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onDateRangeChange: (r: DateRangeValue) => void;
  dateRange: DateRangeValue;
  status: 'idle' | 'loading' | 'connected' | 'error';
  usingDemo: boolean;
  refreshing: boolean;
  showDateRange?: boolean;
}) {
  const title = view === 'transactions' ? TX_TITLES[txSection] : BASE_TITLES[view];

  return (
    <header className="sticky top-0 z-30 flex min-h-[72px] items-center gap-3 border-b border-sidebar-border bg-background/90 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Logo size={36} />
      </div>

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
        <div className="ml-auto lg:hidden">
          <DateRangePicker range={dateRange} onChange={onDateRangeChange} />
        </div>
      )}

      <div className={cn('flex flex-1 items-center justify-end gap-2', showDateRange && 'lg:ml-2')}>
        <div className={cn('hidden items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-extrabold sm:flex', usingDemo ? 'border-amber-400/30 bg-amber-400/10 text-amber-300' : status === 'error' ? 'border-rose-400/30 bg-rose-400/10 text-rose-300' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300')}>
          {usingDemo || status === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {usingDemo ? 'Data Demo' : status === 'error' ? 'Gagal memuat' : 'Live'}
        </div>

        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="h-10 gap-2 rounded-full border-border bg-card px-3.5 font-bold text-foreground hover:bg-accent hover:bg-accent/40 hover:text-accent-foreground">
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          <span className="hidden sm:inline">Muat Ulang</span>
        </Button>

        <Button onClick={onAdd} size="sm" className="h-10 gap-2 rounded-full bg-primary px-4 font-bold text-primary-foreground shadow-[0_8px_20px_rgba(59,130,246,0.35)] hover:bg-primary/90">
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          <span className="hidden sm:inline">Tambah</span>
        </Button>

        <ThemeToggle className="h-10 w-10 rounded-full border-border bg-card text-foreground" />
        <button type="button" aria-label="Notifikasi" className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-accent/40 hover:text-foreground xl:flex">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <button type="button" aria-label="Profil" className="hidden items-center gap-1.5 rounded-full bg-card p-1 ring-1 ring-border xl:flex">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-400/20 text-amber-300"><UserRound className="h-4 w-4" /></span>
          <ChevronDown className="mr-1 h-4 w-4 text-muted-foreground" />
        </button>

        <div className="lg:hidden">
          <label className="sr-only" htmlFor="nav-select">Navigasi</label>
          <select
            id="nav-select"
            value={view === 'transactions' ? `transactions:${txSection}` : view}
            onChange={(e) => {
              const [v, section] = e.target.value.split(':');
              onNavigate(v as View, section as TransactionSection | undefined);
            }}
            className="h-10 rounded-xl border border-border bg-card px-2 text-sm font-bold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="dashboard">Dashboard</option>
            <option value="wallets">Dompet</option>
            <option value="transactions:all">Semua Transaksi</option>
            <option value="transactions:income">Pemasukan</option>
            <option value="transactions:expense">Pengeluaran</option>
            <option value="transactions:transfer">Transfer Antar-Dompet</option>
            <option value="scanner">AI Scanner</option>
            <option value="settings">Pengaturan</option>
          </select>
        </div>
      </div>
    </header>
  );
}

const BASE_TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  wallets: 'Dompet',
  transactions: 'Transaksi',
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
    scanner: ScanLine,
    settings: Settings,
  };
  const Icon = icons[view as Exclude<View, 'transactions'>];
  return <Icon className="h-5 w-5" strokeWidth={2.4} />;
}
