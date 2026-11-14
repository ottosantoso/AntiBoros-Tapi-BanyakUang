import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardData, Wallet } from './types';
import {
  fetchDashboardData,
  insertTransaction,
  insertTransactions,
  insertWallet,
  updateWalletRow,
  deleteWalletRow,
  countTransactionsForWallet,
  type NewTransactionInput,
  type WalletInput,
} from './data';

type Status = 'idle' | 'loading' | 'connected' | 'error';

interface DashboardState {
  data: DashboardData;
  status: Status;
  error: string | null;
}

export function useDashboard(range: { from?: Date; to?: Date }) {
  const [state, setState] = useState<DashboardState>({
    data: {
      totalSaldo: 0,
      pemasukanBulanIni: 0,
      pengeluaranBulanIni: 0,
      tabunganBulanIni: 0,
      dompet: [],
      topPengeluaran: [],
      rekapKategori: {},
    },
    status: 'loading',
    error: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const iso = (d?: Date) =>
    d
      ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      : undefined;

  const load = useCallback(async (opts?: { silent?: boolean; currentRange?: typeof range }) => {
    const r = opts?.currentRange ?? rangeRef.current;
    if (!opts?.silent) setState((s) => ({ ...s, status: 'loading' }));
    const result = await fetchDashboardData({ start: iso(r.from), end: iso(r.to) });
    if (result.error) {
      setState({ data: emptyData(), status: 'error', error: result.error });
      return;
    }
    if (result.data) {
      setState({ data: result.data, status: 'connected', error: null });
      return;
    }
    setState({ data: emptyData(), status: 'idle', error: null });
  }, []);

  // Muat ulang saat rentang tanggal berubah.
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKeyFor(range)]);

  // Poll tiap 30 detik agar dashboard terasa realtime.
  useEffect(() => {
    if (state.status !== 'connected') return;
    timer.current = setTimeout(() => load({ silent: true }), 30_000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state.status, load]);

  /* ---------- Aksi tulis ---------- */

  const addTransaction = useCallback(
    async (input: Omit<NewTransactionInput, 'walletId'> & { walletId: string }) =>
      insertTransaction(input),
    [],
  );

  const addTransactions = useCallback(
    async (inputs: NewTransactionInput[]) => insertTransactions(inputs),
    [],
  );

  const addWallet = useCallback(async (input: WalletInput) => insertWallet(input), []);

  const editWallet = useCallback(async (id: string, input: WalletInput) => updateWalletRow(id, input), []);

  const removeWallet = useCallback(
    async (wallet: Wallet, moveTo?: string) => {
      const count = await countTransactionsForWallet(wallet.id);
      if (count > 0 && !moveTo) {
        return { blocked: true as const, count };
      }
      const res = await deleteWalletRow(wallet.id, moveTo);
      return { ...res, blocked: false as const };
    },
    [],
  );

  return {
    ...state,
    refresh: () => load(),
    addTransaction,
    addTransactions,
    addWallet,
    editWallet,
    removeWallet,
  };
}

function rangeKeyFor(r: { from?: Date; to?: Date }): string {
  return `${isoDate(r.from) ?? 'all'}_${isoDate(r.to) ?? 'all'}`;
}

function isoDate(d?: Date): string | undefined {
  return d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    : undefined;
}

function emptyData(): DashboardData {
  return {
    totalSaldo: 0,
    pemasukanBulanIni: 0,
    pengeluaranBulanIni: 0,
    tabunganBulanIni: 0,
    dompet: [],
    topPengeluaran: [],
    rekapKategori: {},
  };
}
