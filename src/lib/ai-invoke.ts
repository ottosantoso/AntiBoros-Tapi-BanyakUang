import { supabase } from './supabase-client';

/**
 * Pembungkus `supabase.functions.invoke` untuk fitur AI. Mengukur latensi dan mencatat hasilnya
 * (ok atau error) ke ai_usage_logs lewat RPC `catat_ai_log`. Pencatatan tidak pernah menghentikan
 * pemanggilan utama: kalau gagal mencatat, hasil AI tetap dikembalikan.
 *
 * Pemakaian sama seperti `functions.invoke`, hanya ada tambahan nama fitur di depan:
 *   invokeAi<T>('asisten', 'ai-chat', { body: { pertanyaan } })
 */
export async function invokeAi<T>(
  fitur: string,
  namaFunction: string,
  options?: { body?: Record<string, unknown> },
) {
  const t0 = performance.now();
  const res = await supabase.functions.invoke<T>(namaFunction, options);
  const latensi = Math.round(performance.now() - t0);

  const statusLogis = (res.data as { status?: string } | null)?.status;
  const gagal = !!res.error || (statusLogis !== undefined && statusLogis !== 'success');
  const kode = res.error ? 'FUNCTION_ERROR' : gagal ? (statusLogis ?? 'LOGIC_ERROR') : undefined;

  void supabase
    .rpc('catat_ai_log', {
      p_fitur: fitur,
      p_latensi: latensi,
      p_status: gagal ? 'error' : 'ok',
      p_kode: kode ?? null,
    })
    .then(
      () => undefined,
      () => undefined,
    );

  return res;
}
