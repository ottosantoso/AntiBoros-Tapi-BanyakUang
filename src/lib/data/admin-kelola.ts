import { supabase } from '../supabase-client';
import type { WriteResult } from './shared';

/* ---------- Admin: kelola akun (nonaktifkan, aktifkan, reset password, hapus) lewat Edge Function ---------- */

export type AksiPengguna = 'nonaktifkan' | 'aktifkan' | 'set_password' | 'kirim_reset_password' | 'hapus';

/** ID akun yang sedang masuk. Dipakai untuk mencegah admin mengubah akunnya sendiri dari UI. */
export async function fetchIdSaya(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Jalankan satu aksi atas akun pengguna. Server memeriksa peran dan mencatat di admin_audit.
 * set_password hanya super_admin dan password tidak pernah dicatat. Reset lewat email tidak butuh password.
 */
export async function jalankanAksiPengguna(
  aksi: AksiPengguna,
  target: string,
  opsi?: { konfirmasi?: string; password?: string },
): Promise<WriteResult> {
  try {
    const { data, error } = await supabase.functions.invoke<{ status?: string; message?: string }>(
      'admin-kelola-pengguna',
      { body: { aksi, target, konfirmasi: opsi?.konfirmasi, password: opsi?.password } },
    );
    if (error) {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        try {
          const body = (await ctx.json()) as { message?: unknown };
          if (typeof body.message === 'string') return { success: false, error: body.message };
        } catch {
          /* balasan bukan JSON, pakai pesan umum */
        }
      }
      return { success: false, error: 'Gagal menghubungi server.' };
    }
    if (data?.status === 'success') return { success: true, error: null };
    return { success: false, error: data?.message ?? 'Aksi gagal.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal terhubung ke server.';
    return { success: false, error: msg };
  }
}
