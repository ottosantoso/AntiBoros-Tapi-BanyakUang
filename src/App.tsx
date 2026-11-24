import { useCallback, useState } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/lib/theme';
import { Sidebar } from '@/components/sidebar';
import { Header } from '@/components/header';
import { AddWalletSheet } from '@/components/add-wallet-sheet';
import { useDashboard } from '@/lib/use-dashboard';
import { thisMonthRange, type DateRangeValue } from '@/lib/date-range';
import type { View, TransactionSection, AiSection } from '@/app/views';
import { DashboardView } from '@/app/dashboard-view';
import { WalletsView } from '@/app/wallets-view';
import { WalletDetailView } from '@/app/wallet-detail-view';
import { BudgetView } from '@/app/budget-view';
import { AnalisaView } from '@/app/analisa-view';
import { TransactionsView } from '@/app/transactions-view';
import { AiScannerPage } from '@/app/ai-scanner-page';
import { AiCenterView } from '@/app/ai-center-view';
import { SettingsView } from '@/app/settings-view';
import { LoginView, SetPasswordView } from '@/app/login-view';
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
  const { session, loading, recovery, clearRecovery } = useSession();

  if (!supabaseConfigured) return <ConfigMissing />;
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Memuat" />
      </div>
    );
  }
  if (!session) return <LoginView />;
  if (recovery) return <SetPasswordView onDone={clearRecovery} />;
  const userName = (session.user.user_metadata?.name as string | undefined) ?? '';
  return <Workspace userName={userName} userEmail={session.user.email ?? ''} />;
}

function Workspace({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [view, setView] = useState<View>('dashboard');
  const [txSection, setTxSection] = useState<TransactionSection>('all');
  /** Sub-halaman AI Center yang aktif (hub, kategorisasi, asisten, riwayat). */
  const [aiSection, setAiSection] = useState<AiSection>('hub');
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  /** Dompet yang sedang dibuka di halaman detail. Null berarti daftar dompet. */
  const [detailWalletId, setDetailWalletId] = useState<string | null>(null);
  const [navOpen, setNavOpen] = useState(false);
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
    removeTransaction,
    addWallet,
    editWallet,
    transfers,
  } = useDashboard(dateRange);

  const loading = status === 'loading';

  const handleRefresh = useCallback(() => refresh(), [refresh]);

  const handleNavigate = useCallback((nextView: View, section?: TransactionSection) => {
    setView(nextView);
    if (section) setTxSection(section);
    setDetailWalletId(null);
    setNavOpen(false);
  }, []);

  const handleNavigateAi = useCallback((section: AiSection) => {
    setView('ai');
    setAiSection(section);
    setDetailWalletId(null);
    setNavOpen(false);
  }, []);

  // Setelah keluar, useSession mengembalikan pengguna ke halaman masuk.
  const handleSignOut = useCallback(async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) toast.error('Gagal keluar', { description: signOutError.message });
  }, []);

  const detailWallet = detailWalletId ? data.dompet.find((w) => w.id === detailWalletId) ?? null : null;

  return (
    <>
      <div className="flex min-h-screen bg-background text-foreground">
        <Sidebar
          view={view}
          txSection={txSection}
          aiSection={aiSection}
          onNavigate={handleNavigate}
          onNavigateAi={handleNavigateAi}
          connected={status === 'connected'}
          usingDemo={usingDemo}
          userEmail={userEmail}
          onSignOut={handleSignOut}
          open={navOpen}
        />

        {navOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-hidden="true"
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            view={view}
            txSection={txSection}
            onMenuToggle={() => setNavOpen((o) => !o)}
            onNavigate={handleNavigate}
            onRefresh={handleRefresh}
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

              {view === 'dashboard' && (
                <DashboardView
                  data={data}
                  loading={loading}
                  dateRange={dateRange}
                  userName={userName}
                  onNavigate={handleNavigate}
                />
              )}
              {view === 'wallets' && detailWallet && (
                <WalletDetailView wallet={detailWallet} onBack={() => setDetailWalletId(null)} />
              )}
              {view === 'wallets' && !detailWallet && (
                <WalletsView
                  data={data}
                  loading={loading}
                  onAddWallet={() => setWalletSheetOpen(true)}
                  editWallet={editWallet}
                  onChanged={handleRefresh}
                  onOpenDetail={setDetailWalletId}
                />
              )}
              {view === 'transactions' && (
                <TransactionsView
                  data={data}
                  transfers={transfers}
                  loading={loading}
                  txSection={txSection}
                  addTransaction={addTransaction}
                  editTransaction={editTransaction}
                  addTransfer={addTransfer}
                  removeTransaction={removeTransaction}
                  onChanged={handleRefresh}
                />
              )}
              {view === 'budget' && <BudgetView />}
              {view === 'analisa' && (
                <AnalisaView onGoTransactions={() => handleNavigate('transactions')} syncKey={data} />
              )}
              {view === 'ai' && (
                <AiCenterView
                  section={aiSection}
                  onOpen={setAiSection}
                  onOpenScanner={() => handleNavigate('scanner')}
                />
              )}
              {view === 'scanner' && <AiScannerPage wallets={data.dompet} onSaved={handleRefresh} />}
              {view === 'settings' && <SettingsView onSaved={handleRefresh} />}
            </div>
          </main>

          <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground md:px-6">
            Hepeng History · Pantau Duit & Pengeluaran Harianmu
          </footer>
        </div>
      </div>

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
