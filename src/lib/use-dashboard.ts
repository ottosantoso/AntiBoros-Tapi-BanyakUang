import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardData, Wallet, WalletTransfer } from './types';
import {
  fetchDashboardData,
  fetchTransfers,
  insertTransaction,
  insertTransactions,
  insertTransfer,
  insertWallet,
  updateTransactionRow,
  deleteTransactionRow,
  deleteTransactionsBulk,
  deleteTransferRow,
  updateWalletRow,
  deleteWalletRow,
  countTransactionsForWallet,
  type NewTransactionInput,
  type UpdateTransactionInput,
  type WalletInput,
} from './data';

type Status = 'idle' | 'loading' | 'connected' | 'error';

interface DashboardState {
  data: DashboardData;
  transfers: WalletTransfer[];
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
    transfers: [],
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
    const [result, transferRes] = await Promise.all([
      fetchDashboardData({ start: iso(r.from), end: iso(r.to) }),
      fetchTransfers(),
    ]);
    if (result.error) {
      setState((s) => ({ ...s, data: emptyData(), status: 'error', error: result.error }));
      return;
    }
    if (result.data) {
      setState((s) => ({
        ...s,
        data: result.data!,
        transfers: transferRes.error ? s.transfers : transferRes.transfers,
        status: 'connected',
        error: null,
      }));
      return;
    }
    setState((s) => ({ ...s, data: emptyData(), status: 'idle', error: null }));
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

  const editTransaction = useCallback(
    async (id: string, input: UpdateTransactionInput) => {
      const res = await updateTransactionRow(id, input);
      if (res.success) load({ silent: true });
      return res;
    },
    [load],
  );

  const removeTransaction = useCallback(
    async (id: string) => {
      const res = await deleteTransactionRow(id);
      if (res.success) load({ silent: true });
      return res;
    },
    [load],
  );

  const removeTransactionsBulk = useCallback(
    async (ids: string[]) => {
      const res = await deleteTransactionsBulk(ids);
      if (res.success) load({ silent: true });
      return res;
    },
    [load],
  );

  const addTransfer = useCallback(
    async (input: {
      tanggal: string;
      fromWalletId: string;
      toWalletId: string;
      nominal: number;
      biayaAdmin?: number;
      catatan?: string;
    }) => {
      const res = await insertTransfer(input);
      if (res.success) load({ silent: true });
      return res;
    },
    [load],
  );

  const removeTransfer = useCallback(
    async (id: string) => {
      const res = await deleteTransferRow(id);
      if (res.success) load({ silent: true });
      return res;
    },
    [load],
  );

  return {
    ...state,
    usingDemo: false,
    refresh: () => load(),
    addTransaction,
    addTransactions,
    addWallet,
    editWallet,
    removeWallet,
    editTransaction,
    removeTransaction,
    removeTransactionsBulk,
    addTransfer,
    removeTransfer,
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
