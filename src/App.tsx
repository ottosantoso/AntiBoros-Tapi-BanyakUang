import { useCallback, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/lib/theme';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { AddTransactionSheet } from '@/components/add-transaction-sheet';
import { AddWalletSheet } from '@/components/add-wallet-sheet';
import { useDashboard } from '@/lib/use-dashboard';
import { thisMonthRange, type DateRangeValue } from '@/lib/date-range';
import type { View, TransactionSection } from '@/app/views';
import { DashboardView } from '@/app/dashboard-view';
import { WalletsView } from '@/app/wallets-view';
import { TransactionsView } from '@/app/transactions-view';
import { ScannerView } from '@/app/scanner-view';
import { SettingsView } from '@/app/settings-view';
import { LoginView } from '@/app/login-view';
import { supabase, supabaseConfigured } from '@/lib/supabase-client';
import { useSession } from '@/lib/use-session';
import { toast } from 'sonner';
import { AlertTriangle, Loader2 } from 'lucide-react';

export default function App() {
  return (
    <ThemeProvider>
      <AuthGate />
      <Toaster position="bottom-right" richColors closeButton />
    </ThemeProvider>
  );
}

function AuthGate() {
  const { session, loading } = useSession();

  if (!supabaseConfigured) return <ConfigMissing />;
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Memuat" />
      </div>
    );
  }
  if (!session) return <LoginView />;
  const userName = (session.user.user_metadata?.name as string | undefined) ?? '';
  return <Workspace userName={userName} userEmail={session.user.email ?? ''} />;
}

function Workspace({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [view, setView] = useState<View>('dashboard');
  const [txSection, setTxSection] = useState<TransactionSection>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => thisMonthRange());
  const {
    data,
    status,
    error,
    usingDemo,
    refresh,
    addTransaction,
    editTransaction,
    addTransfer,
    addWallet,
  } = useDashboard(dateRange);

  const loading = status === 'loading';

  const handleRefresh = useCallback(() => refresh(), [refresh]);

  const handleNavigate = useCallback((nextView: View, section?: TransactionSection) => {
    setView(nextView);
    if (section) setTxSection(section);
    setSheetOpen(false);
  }, []);

  // Setelah keluar, useSession mengembalikan pengguna ke halaman masuk.
  const handleSignOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) toast.error('Gagal keluar', { description: signOutError.message });
  }, []);

  return (
    <>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar
          view={view}
          txSection={txSection}
          onNavigate={handleNavigate}
          connected={status === 'connected'}
          usingDemo={usingDemo}
          userEmail={userEmail}
          onSignOut={handleSignOut}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            view={view}
            txSection={txSection}
            onNavigate={handleNavigate}
            onRefresh={handleRefresh}
            onAdd={() => setSheetOpen(true)}
            onDateRangeChange={setDateRange}
            dateRange={dateRange}
            status={status}
            usingDemo={usingDemo}
            refreshing={loading}
            showDateRange={view === 'dashboard' || view === 'transactions'}
            onSignOut={handleSignOut}
            userName={userName}
            userEmail={userEmail}
          />

          <main className="flex-1 px-4 py-5 md:px-6 md:py-6">
            <div className="mx-auto max-w-[1440px] animate-fade-in">
              {error && status === 'error' && (
                <div className="mb-4 flex flex-col gap-1 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
                  <span>Gagal memuat data. Coba muat ulang.</span>
                  <button
                    onClick={handleRefresh}
                    className="shrink-0 text-xs font-semibold underline underline-offset-2 hover:no-underline"
                  >
                    Coba lagi
                  </button>
                </div>
              )}

              {view === 'dashboard' && <DashboardView data={data} loading={loading} dateRange={dateRange} />}
              {view === 'wallets' && (
                <WalletsView
                  data={data}
                  loading={loading}
                  onAddWallet={() => setWalletSheetOpen(true)}
                  onChanged={handleRefresh}
                />
              )}
              {view === 'transactions' && (
                <TransactionsView data={data} loading={loading} onAdd={() => setSheetOpen(true)} />
              )}
              {view === 'scanner' && <ScannerView wallets={data.dompet} onSaved={handleRefresh} />}
              {view === 'settings' && <SettingsView onSaved={handleRefresh} />}
            </div>
          </main>

          <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground md:px-6">
            Hepeng History · Personal Finance Tracker
          </footer>
        </div>
      </div>

      <AddTransactionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        wallets={data.dompet}
        onSubmitted={handleRefresh}
        addTransaction={addTransaction}
        editTransaction={editTransaction}
        addTransfer={addTransfer}
      />

      <AddWalletSheet
        open={walletSheetOpen}
        onOpenChange={setWalletSheetOpen}
        addWallet={addWallet}
        onSubmitted={handleRefresh}
      />
    </>
  );
}

function ConfigMissing() {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div role="alert" className="max-w-md rounded-2xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">
        <p className="flex items-center gap-2 font-bold">
          <AlertTriangle className="h-4 w-4" /> Konfigurasi Supabase belum lengkap
        </p>
        <p className="mt-2">
          Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY (lihat .env.example), lalu muat ulang halaman.
        </p>
      </div>
    </main>
  );
}
