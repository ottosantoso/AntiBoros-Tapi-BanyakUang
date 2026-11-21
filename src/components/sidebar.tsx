import {
  ArrowLeftRight,
  CheckCircle2,
  LayoutDashboard,
  LogOut,
  ScanLine,
  Settings,
  Sparkles,
  Wallet,
} from 'lucide-react';
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
  userEmail,
  onSignOut,
}: {
  view: View;
  onNavigate: (v: View) => void;
  connected: boolean;
  usingDemo: boolean;
  userEmail: string;
  onSignOut: () => void;
}) {
  return (
    <aside className="hidden min-h-screen w-[252px] shrink-0 flex-col border-r border-[#dbeafe] bg-white lg:flex">
      <div className="flex items-center gap-3 px-7 py-7">
        <Logo size={46} />
        <div className="min-w-0">
          <p className="font-display text-[16px] font-extrabold leading-tight tracking-[-0.03em] text-[#172554]">
            Hepeng History
          </p>
          <p className="mt-0.5 text-xs font-medium text-[#5b6f99]">Personal Finance</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 px-4">
        <p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1e3a8a]">
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
                'group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-all duration-200',
                active
                  ? 'bg-[#e0f2fe] text-[#1d4ed8] shadow-[0_8px_20px_rgba(37,99,235,0.08)]'
                  : 'text-[#172554] hover:bg-[#f4f8ff] hover:text-[#1d4ed8]',
              )}
            >
              {active && <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-[#2563eb]" />}
              <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-colors', active ? 'bg-[#bfdbfe] text-[#2563eb]' : 'bg-[#eff6ff] text-[#335b9e] group-hover:bg-[#dbeafe]')}>
                <Icon className="h-[19px] w-[19px]" strokeWidth={2.2} />
              </span>
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm font-bold">{item.label}</span>
                <span className={cn('mt-1 text-[11px] font-medium', active ? 'text-[#2563eb]/75' : 'text-[#6b7da4]')}>
                  {item.hint}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="px-4 pb-5">
        <div className={cn('rounded-2xl border p-4', usingDemo ? 'border-[#fbbf24]/35 bg-[#fffbeb]' : 'border-[#86efac]/50 bg-[#dcfce7]')}>
          <div className="flex items-center gap-2">
            {usingDemo ? <Sparkles className="h-5 w-5 text-[#d97706]" strokeWidth={2.2} /> : <CheckCircle2 className="h-5 w-5 text-[#10b981]" strokeWidth={2.2} />}
            <span className={cn('text-xs font-extrabold', usingDemo ? 'text-[#b45309]' : 'text-[#047857]')}>
              {usingDemo ? 'Mode Demo' : connected ? 'Terkoneksi' : 'Menyiapkan data'}
            </span>
          </div>
          <p className="mt-2 text-[11px] font-medium leading-relaxed text-[#5b6f99]">
            {usingDemo ? 'Menampilkan data contoh. Hubungkan Apps Script di Pengaturan.' : 'Data live dari Google Sheets.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-3 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm font-bold text-[#172554] transition hover:bg-[#f4f8ff] hover:text-[#1d4ed8]"
        >
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={2.2} />
          <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[#5b6f99]" title={userEmail}>{userEmail}</span>
          <span>Keluar</span>
        </button>
      </div>
    </aside>
  );
}

export const NAV_ITEMS = NAV;
