import { AlertTriangle, ArrowLeftRight, Bell, CheckCircle2, ChevronDown, LayoutDashboard, LogOut, Plus, RefreshCw, ScanLine, Settings, Wallet } from 'lucide-react';
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
  onSignOut,
  userName,
  userEmail,
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
  onSignOut: () => void;
  userName: string;
  userEmail: string;
}) {
  const titleMap: Record<View, string> = {
    dashboard: 'Dashboard',
    wallets: 'Dompet',
    transactions: 'Transaksi',
    scanner: 'AI Scanner',
    settings: 'Pengaturan',
  };

  return (
    <header className="sticky top-0 z-30 flex min-h-[72px] items-center gap-3 border-b border-[#e1edff] bg-[#f5f9ff]/95 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Logo size={36} />
      </div>

      <div className="hidden min-w-0 items-center gap-3 lg:flex">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#2563eb] text-white shadow-[0_6px_14px_rgba(37,99,235,0.22)]">
          <LayoutIcon view={view} />
        </span>
        <h1 className="font-display text-xl font-extrabold leading-tight tracking-[-0.03em] text-[#172554]">{titleMap[view]}</h1>
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
        <div className={cn('hidden items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-extrabold sm:flex', usingDemo ? 'border-[#fbbf24]/35 bg-[#fffbeb] text-[#b45309]' : status === 'error' ? 'border-[#fb7185]/35 bg-[#fff1f2] text-[#be123c]' : 'border-[#86efac] bg-[#dcfce7] text-[#047857]')}>
          {usingDemo ? <AlertTriangle className="h-3.5 w-3.5" /> : status === 'error' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {usingDemo ? 'Data Demo' : status === 'error' ? 'Gagal memuat' : 'Live'}
        </div>

        <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="h-10 gap-2 rounded-full border-[#c7d8f3] bg-white px-3.5 font-bold text-[#172554] shadow-sm hover:bg-[#eff6ff]">
          <RefreshCw className={cn('h-4 w-4 text-[#172554]', refreshing && 'animate-spin')} />
          <span className="hidden sm:inline">Muat Ulang</span>
        </Button>

        <Button onClick={onAdd} size="sm" className="h-10 gap-2 rounded-full bg-[#2563eb] px-4 font-bold text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] hover:bg-[#1d4ed8]">
          <Plus className="h-4 w-4" strokeWidth={2.6} />
          <span className="hidden sm:inline">Tambah</span>
        </Button>

        <ThemeToggle className="h-10 w-10 rounded-full border-[#c7d8f3] bg-white text-[#172554]" />
        <button type="button" aria-label="Notifikasi" className="hidden h-10 w-10 items-center justify-center rounded-full border border-[#c7d8f3] bg-white text-[#172554] shadow-sm transition hover:bg-[#eff6ff] xl:flex">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <div title={userEmail} className="hidden items-center gap-2.5 rounded-full bg-white py-1 pl-1 pr-3 shadow-sm ring-1 ring-[#dbeafe] md:flex">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#2563eb] text-xs font-bold text-white">
            {initialsOf(userName || userEmail)}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="max-w-[140px] truncate text-xs font-bold text-[#172554]">{userName || 'Pengguna'}</span>
            <span className="max-w-[140px] truncate text-[11px] text-[#5b6f99]">{userEmail}</span>
          </span>
        </div>

        <Button variant="outline" size="icon" onClick={onSignOut} aria-label="Keluar" title="Keluar" className="h-10 w-10 rounded-full border-[#c7d8f3] bg-white text-[#172554]">
          <LogOut className="h-4 w-4" />
        </Button>

        <div className="lg:hidden">
          <label className="sr-only" htmlFor="nav-select">Navigasi</label>
          <select id="nav-select" value={view} onChange={(e) => onNavigate(e.target.value as View)} className="h-10 rounded-xl border border-[#c7d8f3] bg-white px-2 text-sm font-bold text-[#172554] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#93c5fd]">
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

function LayoutIcon({ view }: { view: View }) {
  const icons: Record<View, typeof LayoutDashboard> = {
    dashboard: LayoutDashboard,
    wallets: Wallet,
    transactions: ArrowLeftRight,
    scanner: ScanLine,
    settings: Settings,
  };
  const Icon = icons[view];
  return <Icon className="h-5 w-5" strokeWidth={2.4} />;
}

function initialsOf(text: string): string {
  const parts = text.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = parts.map((w) => w[0]).join('').toUpperCase();
  return letters || '?';
}
