import { supabase } from '../supabase-client';

/* ---------- Asisten Keuangan AI (Edge Function ai-chat) ---------- */

export interface AiChatResult {
  jawaban: string | null;
  /** Pesan untuk ditampilkan ke user bila gagal, mis. kuota habis. */
  error: string | null;
}

/**
 * Kirim satu pertanyaan ke Asisten Keuangan AI. Jawaban berdasarkan ringkasan angka bulan berjalan.
 * Kuota 20 per hari dicek di server. Riwayat percakapan hanya ada di layar, tidak disimpan.
 */
export async function askAiChat(pertanyaan: string): Promise<AiChatResult> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      status?: string;
      data?: { jawaban?: string };
      message?: string;
    }>('ai-chat', { body: { pertanyaan } });
    if (error) {
      // Kuota habis dan validasi dikirim sebagai status non-200; pesan dari server tetap dipakai bila ada.
      return { jawaban: null, error: 'Gagal menghubungi Asisten AI. Coba lagi sebentar lagi.' };
    }
    if (data?.status === 'success' && data.data?.jawaban) {
      return { jawaban: data.data.jawaban, error: null };
    }
    return { jawaban: null, error: data?.message ?? 'Asisten AI belum bisa menjawab. Coba lagi.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal terhubung ke server.';
    return { jawaban: null, error: `Gagal menghubungi Asisten AI: ${msg}` };
  }
}
