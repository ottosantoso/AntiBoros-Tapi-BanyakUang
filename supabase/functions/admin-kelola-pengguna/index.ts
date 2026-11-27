// Edge Function: admin-kelola-pengguna
// Aksi admin atas akun pengguna: nonaktifkan, aktifkan, kirim reset password, dan hapus.
// - verify_jwt = true. Peran dicek ulang di server lewat RPC admin_peran_saya (memakai JWT pemanggil).
// - Service role hanya dipakai di sini, tidak pernah dikirim ke klien.
// - Aturan peran:
//     nonaktifkan / aktifkan  : super_admin atau admin. Akun dengan peran admin hanya oleh super_admin.
//     kirim_reset_password    : super_admin, admin, atau support. Admin tidak pernah melihat atau menetapkan password.
//     hapus                   : hanya super_admin, dan akun dengan peran admin tidak bisa dihapus dari sini.
//     Akun sendiri tidak bisa diubah lewat fungsi ini.
// - Setiap aksi dicatat di admin_audit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AKSI = ['nonaktifkan', 'aktifkan', 'kirim_reset_password', 'hapus'] as const;
type Aksi = (typeof AKSI)[number];

const LABEL_AUDIT: Record<Aksi, string> = {
  nonaktifkan: 'nonaktifkan_pengguna',
  aktifkan: 'aktifkan_pengguna',
  kirim_reset_password: 'kirim_reset_password',
  hapus: 'hapus_pengguna',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NONAKTIF_SELAMANYA = '876000h'; // ±100 tahun

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function gagal(message: string, status: number): Response {
  return json({ status: 'error', message }, status);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return gagal('Metode tidak didukung.', 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  let body: { aksi?: unknown; target?: unknown; konfirmasi?: unknown };
  try {
    body = await req.json();
  } catch {
    return gagal('Permintaan tidak valid.', 400);
  }

  const aksi = body.aksi as Aksi;
  const target = typeof body.target === 'string' ? body.target : '';
  if (!AKSI.includes(aksi)) return gagal('Aksi tidak dikenal.', 400);
  if (!UUID.test(target)) return gagal('ID pengguna tidak valid.', 400);

  // Klien dengan JWT pemanggil: dipakai untuk mengetahui siapa yang meminta dan perannya.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return gagal('Sesi tidak valid.', 401);
  const adminId = userData.user.id;

  const { data: peranData, error: peranErr } = await userClient.rpc('admin_peran_saya');
  if (peranErr) return gagal('Akses ditolak.', 403);
  const peranSaya = (Array.isArray(peranData) ? peranData : []) as string[];
  const isSuper = peranSaya.includes('super_admin');
  const isAdmin = isSuper || peranSaya.includes('admin');
  const isSupport = isAdmin || peranSaya.includes('support');

  const izin: Record<Aksi, boolean> = {
    nonaktifkan: isAdmin,
    aktifkan: isAdmin,
    kirim_reset_password: isSupport,
    hapus: isSuper,
  };
  if (!izin[aksi]) return gagal('Peran Anda tidak boleh melakukan aksi ini.', 403);

  if (target === adminId) return gagal('Tidak bisa mengubah akun sendiri dari sini.', 400);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: targetData, error: targetErr } = await admin.auth.admin.getUserById(target);
  if (targetErr || !targetData.user) return gagal('Pengguna tidak ditemukan.', 404);
  const email = targetData.user.email ?? '';

  // Peran target: akun admin hanya bisa diubah oleh super_admin, dan tidak bisa dihapus dari sini.
  const { data: rolesTarget } = await admin.from('user_roles').select('role').eq('user_id', target);
  const peranTarget = (rolesTarget ?? []).map((r: { role: string }) => r.role);
  const targetAdmin = peranTarget.length > 0;

  if (aksi === 'hapus' && targetAdmin) {
    return gagal('Akun dengan peran admin tidak bisa dihapus dari sini.', 403);
  }
  if ((aksi === 'nonaktifkan' || aksi === 'aktifkan') && targetAdmin && !isSuper) {
    return gagal('Hanya super_admin yang bisa mengubah akun admin.', 403);
  }

  if (aksi === 'hapus') {
    if (typeof body.konfirmasi !== 'string' || body.konfirmasi.trim().toLowerCase() !== email.toLowerCase()) {
      return gagal('Konfirmasi email tidak cocok.', 400);
    }
  }

  // Catat dulu sebelum tindakan. target_user_id di-set null otomatis setelah akun dihapus.
  await admin.from('admin_audit').insert({ admin_id: adminId, aksi: LABEL_AUDIT[aksi], target_user_id: target });

  if (aksi === 'nonaktifkan' || aksi === 'aktifkan') {
    const { error } = await admin.auth.admin.updateUserById(target, {
      ban_duration: aksi === 'nonaktifkan' ? NONAKTIF_SELAMANYA : 'none',
    });
    if (error) return gagal('Gagal mengubah status akun.', 500);
    return json({ status: 'success' });
  }

  if (aksi === 'kirim_reset_password') {
    if (!email) return gagal('Akun tidak punya email.', 400);
    const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await anon.auth.resetPasswordForEmail(email);
    if (error) return gagal('Gagal mengirim email reset password.', 500);
    return json({ status: 'success' });
  }

  // hapus: data pengguna ikut terhapus lewat ON DELETE CASCADE.
  const { error: delErr } = await admin.auth.admin.deleteUser(target);
  if (delErr) return gagal('Gagal menghapus pengguna.', 500);
  return json({ status: 'success' });
});
