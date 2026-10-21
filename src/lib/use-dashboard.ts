import { useCallback, useEffect, useRef, useState } from 'react';
import type { DashboardData } from './types';
import { fetchDashboard, hasApiUrl } from './api';
import { demoDashboardData } from './demo-data';
import {
  formatRangeParam,
  inRange,
  isAllTime,
  type DateRangeValue,
} from './date-range';

type Status = 'idle' | 'loading' | 'connected' | 'error';

interface DashboardState {
  data: DashboardData;
  status: Status;
  error: string | null;
  usingDemo: boolean;
}

/** Client-side filter demo data so the dashboard reflects the picked range. */
function filterDemo(range: DateRangeValue): DashboardData {
  if (isAllTime(range)) return demoDashboardData();
  const full = demoDashboardData();
  const txs = (full.transaksi ?? []).filter((t) => {
    const d = new Date(t.tanggal);
    return Number.isNaN(d.getTime()) ? true : inRange(d, range);
  });
  const pemasukanBulanIni = txs
    .filter((t) => t.tipe === 'Pemasukan')
    .reduce((s, t) => s + t.nominal, 0);
  const pengeluaranBulanIni = txs
    .filter((t) => t.tipe === 'Pengeluaran')
    .reduce((s, t) => s + t.nominal, 0);
  const rekapKategori: Record<string, number> = {};
  txs
    .filter((t) => t.tipe === 'Pengeluaran')
    .forEach((t) => {
      const k = t.kategori ?? 'Lainnya';
      rekapKategori[k] = (rekapKategori[k] ?? 0) + t.nominal;
    });
  const topPengeluaran = [...txs]
    .filter((t) => t.tipe === 'Pengeluaran')
    .sort((a, b) => b.nominal - a.nominal)
    .slice(0, 5)
    .map((t) => ({ deskripsi: t.deskripsi, nominal: t.nominal }));
  return {
    ...full,
    pemasukanBulanIni,
    pengeluaranBulanIni,
    tabunganBulanIni: pemasukanBulanIni - pengeluaranBulanIni,
    rekapKategori,
    topPengeluaran,
    transaksi: txs,
  };
}

export function useDashboard(range: DateRangeValue) {
  const [state, setState] = useState<DashboardState>({
    data: filterDemo(range),
    status: 'idle',
    error: null,
    usingDemo: true,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const load = useCallback(
    async (opts?: { silent?: boolean; currentRange?: DateRangeValue }) => {
      const activeRange = opts?.currentRange ?? rangeRef.current;
      if (!hasApiUrl()) {
        setState({
          data: filterDemo(activeRange),
          status: 'idle',
          error: null,
          usingDemo: true,
        });
        return;
      }
      if (!opts?.silent) setState((s) => ({ ...s, status: 'loading' }));
      const dateParams = {
        start: formatRangeParam(activeRange.from),
        end: formatRangeParam(activeRange.to),
      };
      const result = await fetchDashboard(
        isAllTime(activeRange) ? undefined : dateParams,
      );
      if (result.error) {
        setState({
          data: filterDemo(activeRange),
          status: 'error',
          error: result.error,
          usingDemo: true,
        });
        return;
      }
      if (result.data) {
        setState({
          data: result.data,
          status: 'connected',
          error: null,
          usingDemo: false,
        });
        return;
      }
      setState({
        data: filterDemo(activeRange),
        status: 'idle',
        error: null,
        usingDemo: true,
      });
    },
    [],
  );

  // Re-fetch whenever the date range changes (non-silent → triggers skeletons).
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKeyFor(range)]);

  // Poll every 30s once connected, so the dashboard feels realtime.
  useEffect(() => {
    if (state.status !== 'connected') return;
    timer.current = setTimeout(() => load({ silent: true }), 30_000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state.status, load]);

  return { ...state, refresh: () => load() };
}

// re-export for the deps array above without polluting public api
function rangeKeyFor(r: DateRangeValue): string {
  return `${formatRangeParam(r.from) ?? 'all'}_${formatRangeParam(r.to) ?? 'all'}`;
}
