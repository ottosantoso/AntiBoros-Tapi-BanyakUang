import { RefreshCw, Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/logo';
import { DateRangePicker } from '@/components/date-range-picker';
import { cn } from '@/lib/utils';
import type { DateRangeValue } from '@/lib/date-range';
import type { View } from '@/app/views';

export function Header({
  view,
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
  onNavigate: (v: View) => void;
  onRefresh: () => void;
  onAdd: () => void;
  onDateRangeChange: (r: DateRangeValue) => void;
  dateRange: DateRangeValue;
  status: 'idle' | 'loading' | 'connected' | 'error';
  usingDemo: boolean;
  refreshing: boolean;
  showDateRange?: boolean;
}) {
  const titleMap: Record<View, string> = {
    dashboard: 'Dashboard',
    wallets: 'Dompet',
    transactions: 'Transaksi',
    scanner: 'AI Scanner',
    settings: 'Pengaturan',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Logo size={32} />
      </div>

      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <h1 className="font-display text-lg font-bold leading-tight tracking-tight">
          {titleMap[view]}
        </h1>
        {showDateRange && <DateRangePicker range={dateRange} onChange={onDateRangeChange} />}
      </div>

      {/* Mobile date range picker */}
      {showDateRange && (
        <div className="ml-auto lg:hidden">
          <DateRangePicker range={dateRange} onChange={onDateRangeChange} />
        </div>
      )}

      <div className={cn('flex flex-1 items-center justify-end gap-2', showDateRange && 'lg:ml-2')}>
        {/* Connection pill */}
        <div
          className={cn(
            'hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:flex',
            usingDemo
              ? 'border-warning/30 bg-warning-soft text-warning'
              : status === 'error'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-income/30 bg-income-soft text-income',
          )}
        >
          {usingDemo ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" /> Data Demo
            </>
          ) : status === 'error' ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5" /> Gagal memuat
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3.5 w-3.5" /> Live
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={refreshing}
          className="gap-2 bg-card/60"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          <span className="hidden sm:inline">Muat ulang</span>
        </Button>

        <Button onClick={onAdd} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Tambah</span>
        </Button>

        <ThemeToggle />

        {/* Mobile nav menu */}
        <div className="lg:hidden">
          <label className="sr-only" htmlFor="nav-select">Navigasi</label>
          <select
            id="nav-select"
            value={view}
            onChange={(e) => onNavigate(e.target.value as View)}
            className="h-9 rounded-lg border border-border bg-card px-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="dashboard">Dashboard</option>
            <option value="wallets">Dompet</option>
            <option value="transactions">Transaksi</option>
            <option value="scanner">AI Scanner</option>
            <option value="settings">Pengaturan</option>
          </select>
        </div>
      </div>
    </header>
  );
}
