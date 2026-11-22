import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchAnalisa, type AnalisaData } from '@/lib/data';

export type AnalisaStatus = 'loading' | 'ready' | 'error';

/**
 * Memuat ringkasan analisa untuk satu periode.
 * Ganti periode menampilkan loading. `syncKey` yang berubah (mis. setelah polling dashboard)
 * memuat ulang diam-diam tanpa mengosongkan tampilan.
 */
export function useAnalisa(range: { start: string; end: string }, syncKey?: unknown) {
  const [data, setData] = useState<AnalisaData | null>(null);
  const [status, setStatus] = useState<AnalisaStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const loadedKey = useRef<string | null>(null);

  const { start, end } = range;

  useEffect(() => {
    const rangeKey = `${start}|${end}`;
    let cancelled = false;
    if (loadedKey.current !== rangeKey) setStatus('loading');

    fetchAnalisa({ start, end }).then((res) => {
      if (cancelled) return;
      if (res.error || !res.data) {
        setError(res.error ?? 'Gagal memuat analisa.');
        setStatus('error');
        return;
      }
      loadedKey.current = rangeKey;
      setData(res.data);
      setError(null);
      setStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, [start, end, syncKey, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  return { data, status, error, reload };
}
