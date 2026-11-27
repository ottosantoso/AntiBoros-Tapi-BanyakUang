import { supabase } from '../supabase-client';

/* ---------- Admin MVP: hanya angka agregat, tanpa data pribadi pengguna ---------- */

export interface AdminSummary {
  totalPengguna: number;
  penggunaAktif30Hari: number;
  totalTransaksi: number;
  pemakaianAiHariIni: number;
  penggunaPakaiUtang: number;
}

/** True kalau akun yang sedang masuk punya peran admin. Dibaca lewat RPC, bukan dari tabel langsung. */
export async function isAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

/** Ringkasan agregat. Server mencatat setiap pembacaan di admin_audit. */
export async function fetchAdminSummary(): Promise<{ data: AdminSummary | null; error: string | null }> {
  const { data, error } = await supabase.rpc('admin_summary');
  if (error) return { data: null, error: error.message };
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    data: {
      totalPengguna: Number(raw.total_pengguna ?? 0),
      penggunaAktif30Hari: Number(raw.pengguna_aktif_30_hari ?? 0),
      totalTransaksi: Number(raw.total_transaksi ?? 0),
      pemakaianAiHariIni: Number(raw.pemakaian_ai_hari_ini ?? 0),
      penggunaPakaiUtang: Number(raw.pengguna_pakai_utang ?? 0),
    },
    error: null,
  };
}
