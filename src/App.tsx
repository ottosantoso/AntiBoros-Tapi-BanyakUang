import { useCallback, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/lib/theme';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { AddTransactionSheet } from '@/components/add-transaction-sheet';
import { useDashboard } from '@/lib/use-dashboard';
import { thisMonthRange, type DateRangeValue } from '@/lib/date-range';
import type { View } from '@/app/views';
import { DashboardView } from '@/app/dashboard-view';
import { WalletsView } from '@/app/wallets-view';
import { TransactionsView } from '@/app/transactions-view';
import { ScannerView } from '@/app/scanner-view';
import { SettingsView } from '@/app/settings-view';

export default function App() {
  const [view, setView] = useState<View>('dashboard');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => thisMonthRange());
  const { data, status, error, usingDemo, refresh } = useDashboard(dateRange);

  const loading = status === 'loading';

  const handleRefresh = useCallback(() => refresh(), [refresh]);

  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar
          view={view}
          onNavigate={setView}
          connected={status === 'connected'}
          usingDemo={usingDemo}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            view={view}
            onNavigate={setView}
            onRefresh={handleRefresh}
            onAdd={() => setSheetOpen(true)}
            onDateRangeChange={setDateRange}
            dateRange={dateRange}
            status={status}
            usingDemo={usingDemo}
            refreshing={loading}
            showDateRange={view === 'dashboard' || view === 'transactions'}
          />

          <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
            <div className="mx-auto max-w-7xl animate-fade-in">
              {error && status === 'error' && (
                <div className="mb-4 flex flex-col gap-1 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Gagal memuat data dari Google Sheets. Menampilkan data demo untuk saat ini.
                  </span>
                  <button
                    onClick={handleRefresh}
                    className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {view === 'dashboard' && <DashboardView data={data} loading={loading} dateRange={dateRange} />}
              {view === 'wallets' && <WalletsView data={data} loading={loading} />}
              {view === 'transactions' && <TransactionsView data={data} loading={loading} />}
              {view === 'scanner' && (
                <ScannerView wallets={data.dompet} onSaved={handleRefresh} />
              )}
              {view === 'settings' && <SettingsView onSaved={handleRefresh} />}
            </div>
          </main>

          <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground md:px-6">
            Hepeng History · Personal Finance Tracker · Data tersimpan di Google Sheets Anda
          </footer>
        </div>
      </div>

      <AddTransactionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        wallets={data.dompet}
        onSubmitted={handleRefresh}
      />

      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}
