import { invokeAi } from '../ai-invoke';

/* ---------- Asisten Keuangan AI (Edge Function ai-chat) ---------- */

export interface AiChatResult {
  jawaban: string | null;
  /** Pesan untuk ditampilkan ke user bila gagal, mis. kuota habis. */
  error: string | null;
}

/** Ambil pesan dari balasan error (mis. 429 kuota habis) bila server mengirimkannya. */
async function pesanDariError(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: Response })?.context;
  if (!ctx || typeof ctx.json !== 'function') return null;
  try {
    const body = (await ctx.json()) as { message?: unknown };
    return typeof body.message === 'string' ? body.message : null;
  } catch {
    return null;
  }
}

/**
 * Kirim satu pertanyaan ke Asisten Keuangan AI. Jawaban berdasarkan ringkasan angka bulan berjalan.
 * Kuota 20 per hari dicek di server. Riwayat percakapan hanya ada di layar, tidak disimpan.
 */
export async function askAiChat(pertanyaan: string): Promise<AiChatResult> {
  try {
    const { data, error } = await invokeAi<{
      status?: string;
      data?: { jawaban?: string };
      message?: string;
    }>('asisten', 'ai-chat', { body: { pertanyaan } });

    if (error) {
      const pesan = await pesanDariError(error);
      return { jawaban: null, error: pesan ?? 'Gagal menghubungi Asisten AI. Coba lagi sebentar lagi.' };
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
