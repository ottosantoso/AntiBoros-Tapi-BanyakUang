import { supabase } from './supabase-client';

/**
 * Saran subkategori dari deskripsi. Hanya memanggil Edge Function ai-categorize:
 * tidak ada akses tabel di sini (akses tabel tetap lewat data.ts).
 * Dipanggil setelah user berhenti mengetik (debounce di form), bukan setiap tombol ditekan.
 */

export type SumberSaran = 'riwayat' | 'kata_kunci' | 'ai';

export interface SaranKategori {
  subkategoriId: string;
  nama: string;
  kategori: string;
  sumber: SumberSaran;
}

export async function categorizeDescription(
  deskripsi: string,
  tipe: 'Pemasukan' | 'Pengeluaran',
): Promise<{ saran: SaranKategori | null; error: string | null }> {
  const { data, error } = await supabase.functions.invoke<{
    status?: string;
    data?: SaranKategori | null;
    message?: string;
  }>('ai-categorize', { body: { deskripsi, tipe } });

  if (error) return { saran: null, error: error.message };
  if (data?.status !== 'success') return { saran: null, error: data?.message ?? 'Saran kategori gagal.' };
  return { saran: data.data ?? null, error: null };
}

export function labelSumber(sumber: SumberSaran): string {
  if (sumber === 'riwayat') return 'dari riwayatmu';
  if (sumber === 'kata_kunci') return 'dari kata kunci';
  return 'dari AI';
}
