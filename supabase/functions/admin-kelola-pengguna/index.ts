// Edge Function: admin-kelola-pengguna
// Aksi admin atas akun pengguna: nonaktifkan, aktifkan, set_password, kirim_reset_password, dan hapus.
// - verify_jwt = true. Peran dicek ulang di server lewat RPC admin_peran_saya (memakai JWT pemanggil).
// - Service role hanya dipakai di sini, tidak pernah dikirim ke klien.
// - Aturan peran:
//     nonaktifkan / aktifkan  : super_admin atau admin. Akun dengan peran admin hanya oleh super_admin.
//     set_password            : hanya super_admin. Password tidak pernah dicatat (log maupun audit).
//     kirim_reset_password    : super_admin, admin, atau support. Pengguna membuat password sendiri lewat email.
//     hapus                   : hanya super_admin, dan akun dengan peran admin tidak bisa dihapus dari sini.
//     Akun sendiri tidak bisa diubah lewat fungsi ini.
// - Audit (admin_audit) memakai alur dua langkah:
//     1. Baris dicatat dulu dengan status 'gagal' (sebelum tindakan dijalankan).
//     2. Kalau tindakan berhasil, status diubah ke 'berhasil'. Kalau gagal, baris tetap 'gagal'.
//   Percobaan yang ditolak aturan (peran kurang, akun sendiri, akun admin, konfirmasi salah) juga dicatat sebagai 'gagal'.
//   IP dan user-agent diambil dari header request, karena klien service role tidak membawa konteks request.
// - Isi password tidak pernah masuk ke audit, detail, maupun log.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const AKSI = ['nonaktifkan', 'aktifkan', 'set_password', 'kirim_reset_password', 'hapus'] as const;
type Aksi = (typeof AKSI)[number];

const LABEL_AUDIT: Record<Aksi, string> = {
  nonaktifkan: 'nonaktifkan_pengguna',
  aktifkan: 'aktifkan_pengguna',
  set_password: 'ubah_password_pengguna',
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

  const ip = (req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '').split(',')[0].trim() || null;
  const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null;

  let body: { aksi?: unknown; target?: unknown; konfirmasi?: unknown; password?: unknown };
  try {
    body = await req.json();
  } catch {
    return gagal('Permintaan tidak valid.', 400);
  }

  const aksi = body.aksi as Aksi;
  const target = typeof body.target === 'string' ? body.target : '';
  if (!AKSI.includes(aksi)) return gagal('Aksi tidak dikenal.', 400);
  if (!UUID.test(target)) return gagal('ID pengguna tidak valid.', 400);

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // Klien dengan JWT pemanggil: dipakai untuk mengetahui siapa yang meminta dan perannya.
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });

  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) return gagal('Sesi tidak valid.', 401);
  const adminId = userData.user.id;

  // Catat percobaan yang ditolak. Tidak pernah memuat isi password.
  async function catatGagal(alasan: string, targetId: string | null): Promise<void> {
    await admin.from('admin_audit').insert({
      admin_id: adminId,
      aksi: LABEL_AUDIT[aksi],
      target_user_id: targetId && UUID.test(targetId) ? targetId : null,
      status: 'gagal',
      ip,
      user_agent: userAgent,
      detail: { alasan },
    });
  }

  const { data: peranData, error: peranErr } = await userClient.rpc('admin_peran_saya');
  if (peranErr) {
    await catatGagal('bukan_admin', target);
    return gagal('Akses ditolak.', 403);
  }
  const peranSaya = (Array.isArray(peranData) ? peranData : []) as string[];
  const isSuper = peranSaya.includes('super_admin');
  const isAdmin = isSuper || peranSaya.includes('admin');
  const isSupport = isAdmin || peranSaya.includes('support');

  const izin: Record<Aksi, boolean> = {
    nonaktifkan: isAdmin,
    aktifkan: isAdmin,
    set_password: isSuper,
    kirim_reset_password: isSupport,
    hapus: isSuper,
  };
  if (!izin[aksi]) {
    await catatGagal('peran_tidak_cukup', target);
    return gagal('Peran Anda tidak boleh melakukan aksi ini.', 403);
  }

  if (target === adminId) {
    await catatGagal('akun_sendiri', target);
    return gagal('Tidak bisa mengubah akun sendiri dari sini.', 400);
  }

  // Validasi password sebelum menyentuh data apa pun. Batas 72 byte adalah batas bcrypt.
  if (aksi === 'set_password') {
    const panjang = typeof body.password === 'string' ? new TextEncoder().encode(body.password).length : 0;
    if (typeof body.password !== 'string' || body.password.length < 8 || panjang > 72) {
      await catatGagal('password_tidak_valid', target);
      return gagal('Password minimal 8 karakter dan maksimal 72 byte.', 400);
    }
  }

  const { data: targetData, error: targetErr } = await admin.auth.admin.getUserById(target);
  if (targetErr || !targetData.user) {
    await catatGagal('pengguna_tidak_ditemukan', target);
    return gagal('Pengguna tidak ditemukan.', 404);
  }
  const email = targetData.user.email ?? '';

  // Peran target: akun admin hanya bisa diubah oleh super_admin, dan tidak bisa dihapus dari sini.
  const { data: rolesTarget } = await admin.from('user_roles').select('role').eq('user_id', target);
  const peranTarget = (rolesTarget ?? []).map((r: { role: string }) => r.role);
  const targetAdmin = peranTarget.length > 0;

  if (aksi === 'hapus' && targetAdmin) {
    await catatGagal('target_admin', target);
    return gagal('Akun dengan peran admin tidak bisa dihapus dari sini.', 403);
  }
  if ((aksi === 'nonaktifkan' || aksi === 'aktifkan') && targetAdmin && !isSuper) {
    await catatGagal('target_admin', target);
    return gagal('Hanya super_admin yang bisa mengubah akun admin.', 403);
  }

  if (aksi === 'hapus') {
    if (typeof body.konfirmasi !== 'string' || body.konfirmasi.trim().toLowerCase() !== email.toLowerCase()) {
      await catatGagal('konfirmasi_salah', target);
      return gagal('Konfirmasi email tidak cocok.', 400);
    }
  }

  // Langkah 1: catat sebagai 'gagal' dulu. Diubah ke 'berhasil' setelah tindakan sukses.
  const { data: audit, error: auditErr } = await admin
    .from('admin_audit')
    .insert({
      admin_id: adminId,
      aksi: LABEL_AUDIT[aksi],
      target_user_id: target,
      status: 'gagal',
      ip,
      user_agent: userAgent,
      detail: { alasan: 'belum_selesai' },
    })
    .select('id')
    .single();
  if (auditErr || !audit) return gagal('Gagal mencatat aksi. Tindakan dibatalkan.', 500);
  const auditId = audit.id as string;

  async function tandaiBerhasil(): Promise<void> {
    await admin.from('admin_audit').update({ status: 'berhasil', detail: null }).eq('id', auditId);
  }
  async function tandaiGagalServer(): Promise<void> {
    await admin.from('admin_audit').update({ detail: { alasan: 'gagal_server' } }).eq('id', auditId);
  }

  if (aksi === 'nonaktifkan' || aksi === 'aktifkan') {
    const { error } = await admin.auth.admin.updateUserById(target, {
      ban_duration: aksi === 'nonaktifkan' ? NONAKTIF_SELAMANYA : 'none',
    });
    if (error) {
      await tandaiGagalServer();
      return gagal('Gagal mengubah status akun.', 500);
    }
    await tandaiBerhasil();
    return json({ status: 'success' });
  }

  if (aksi === 'set_password') {
    const { error } = await admin.auth.admin.updateUserById(target, { password: body.password as string });
    if (error) {
      await tandaiGagalServer();
      return gagal('Gagal mengubah password.', 500);
    }
    await tandaiBerhasil();
    return json({ status: 'success' });
  }

  if (aksi === 'kirim_reset_password') {
    if (!email) {
      await tandaiGagalServer();
      return gagal('Akun tidak punya email.', 400);
    }
    const anon = createClient(url, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error } = await anon.auth.resetPasswordForEmail(email);
    if (error) {
      await tandaiGagalServer();
      return gagal('Gagal mengirim email reset password.', 500);
    }
    await tandaiBerhasil();
    return json({ status: 'success' });
  }

  // hapus: data pengguna ikut terhapus lewat ON DELETE CASCADE.
  const { error: delErr } = await admin.auth.admin.deleteUser(target);
  if (delErr) {
    await tandaiGagalServer();
    return gagal('Gagal menghapus pengguna.', 500);
  }
  await tandaiBerhasil();
  return json({ status: 'success' });
});
