// Edge Function: ai-analysis
// Membuat insight dan saran hemat dari RINGKASAN ANGKA satu periode (bukan detail transaksi).
// GEMINI_API_KEY diambil dari Supabase Secrets (tidak pernah dikirim ke browser).
// GEMINI_MODELS (opsional, dipisah koma) menentukan urutan model; jika kosong dipakai default.
// verify_jwt = true: hanya user yang sudah login yang bisa memanggil fungsi ini.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEFAULT_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

const MAX_INSIGHTS = 5;
const MAX_HEMAT = 3;
const MAX_TEXT_LENGTH = 300;

interface KategoriInput { kategori: string; total: number; persen: number }
interface TrenInput { bulan: string; pemasukan: number; pengeluaran: number }
interface SumberInput { kategori: string; total: number }

interface AnalysisInput {
  periode: string;
  pemasukan: number;
  pengeluaran: number;
  sisaBersih: number;
  rasioTabungan: number | null;
  perKategori: KategoriInput[];
  tren: TrenInput[];
  sumberPemasukan: SumberInput[];
  transferJumlah: number;
  transferBiayaAdmin: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 200): Response {
  return json({ status: 'error', message }, status);
}

function num(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function text(v: unknown, max = 80): string {
  return typeof v === 'string' ? v.slice(0, max) : '';
}

/** Membersihkan input agar hanya field yang diizinkan dan jumlahnya dibatasi. */
function sanitize(raw: Record<string, unknown>): AnalysisInput | null {
  const arr = (v: unknown) => (Array.isArray(v) ? v : []);
  const perKategori = arr(raw.perKategori).slice(0, 12).map((k: Record<string, unknown>) => ({
    kategori: text(k?.kategori),
    total: num(k?.total),
    persen: num(k?.persen),
  }));
  const tren = arr(raw.tren).slice(0, 6).map((t: Record<string, unknown>) => ({
    bulan: text(t?.bulan, 20),
    pemasukan: num(t?.pemasukan),
    pengeluaran: num(t?.pengeluaran),
  }));
  const sumber = arr(raw.sumberPemasukan).slice(0, 10).map((s: Record<string, unknown>) => ({
    kategori: text(s?.kategori),
    total: num(s?.total),
  }));
  const periode = text(raw.periode, 60);
  if (!periode) return null;
  return {
    periode,
    pemasukan: num(raw.pemasukan),
    pengeluaran: num(raw.pengeluaran),
    sisaBersih: num(raw.sisaBersih),
    rasioTabungan: raw.rasioTabungan === null ? null : num(raw.rasioTabungan),
    perKategori,
    tren,
    sumberPemasukan: sumber,
    transferJumlah: num(raw.transferJumlah),
    transferBiayaAdmin: num(raw.transferBiayaAdmin),
  };
}

const rp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

function buildPrompt(d: AnalysisInput): string {
  const kategori = d.perKategori
    .map((k) => `- ${k.kategori}: ${rp(k.total)} (${k.persen.toFixed(0)}% dari pengeluaran)`)
    .join('\n') || '- (tidak ada)';
  const tren = d.tren
    .map((t) => `- ${t.bulan}: pemasukan ${rp(t.pemasukan)}, pengeluaran ${rp(t.pengeluaran)}`)
    .join('\n') || '- (tidak ada)';
  const sumber = d.sumberPemasukan
    .map((s) => `- ${s.kategori}: ${rp(s.total)}`)
    .join('\n') || '- (tidak ada)';

  return `Kamu adalah analis keuangan pribadi yang menulis dalam Bahasa Indonesia yang ringkas dan ramah.
Gunakan HANYA angka dan nama kategori dari data di bawah. Jangan mengarang angka, kategori, atau tanggal.
Nominal dalam rupiah. Jangan menghakimi pengguna.

Periode: ${d.periode}
Pemasukan riil: ${rp(d.pemasukan)}
Pengeluaran riil: ${rp(d.pengeluaran)}
Sisa bersih: ${rp(d.sisaBersih)}
Rasio tabungan: ${d.rasioTabungan === null ? 'belum bisa dihitung (tidak ada pemasukan)' : `${d.rasioTabungan.toFixed(0)}% (target 20%)`}
Pengeluaran per kategori:
${kategori}
Sumber pemasukan:
${sumber}
Tren 6 bulan:
${tren}
Transfer antar-dompet: ${d.transferJumlah} transaksi, biaya admin ${rp(d.transferBiayaAdmin)} (transfer tidak dihitung sebagai pemasukan/pengeluaran).

Kembalikan HANYA JSON murni (tanpa markdown, tanpa penjelasan) dengan format:
{"insights": ["string"], "hemat": ["string"]}

Aturan:
- insights: maksimal ${MAX_INSIGHTS} poin, tiap poin satu kalimat berisi temuan konkret dari data (tren, kategori terbesar, rasio tabungan).
- hemat: maksimal ${MAX_HEMAT} saran hemat yang spesifik untuk kategori yang terbesar. Jika data tidak cukup, kembalikan array kosong.
- Jika data pengeluaran 0, insights boleh berisi satu poin bahwa data belum cukup, dan hemat kosong.`;
}

/** Ambil JSON dari teks model dan pastikan bentuknya sesuai, lalu batasi panjangnya. */
function parseOutput(textOut: string): { insights: string[]; hemat: string[] } {
  const parsed = JSON.parse(textOut.replace(/```json|```/g, '').trim());
  const clean = (v: unknown, max: number) =>
    (Array.isArray(v) ? v : [])
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim().slice(0, MAX_TEXT_LENGTH))
      .slice(0, max);
  return { insights: clean(parsed?.insights, MAX_INSIGHTS), hemat: clean(parsed?.hemat, MAX_HEMAT) };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return errorResponse('Metode tidak didukung.', 405);
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return errorResponse('GEMINI_API_KEY belum diset di Supabase Secrets.', 500);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Body request bukan JSON valid.', 400);
  }

  const input = sanitize(body);
  if (!input) {
    return errorResponse('Data periode tidak lengkap.', 400);
  }

  const models = (Deno.env.get('GEMINI_MODELS') ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  const modelList = models.length ? models : DEFAULT_MODELS;

  const payload = {
    contents: [{ parts: [{ text: buildPrompt(input) }] }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };

  let lastError = 'Semua model Gemini gagal diakses.';

  for (const model of modelList) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(payload),
        },
      );
      const result = await res.json();

      if (result.error) {
        lastError = result.error.message ?? `Error dari model ${model}.`;
        continue;
      }

      const textOut: string | undefined = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOut) {
        lastError = `Respons kosong dari ${model}.`;
        continue;
      }

      const data = parseOutput(textOut);
      if (data.insights.length === 0 && data.hemat.length === 0) {
        lastError = `Format jawaban dari ${model} tidak sesuai.`;
        continue;
      }
      return json({ status: 'success', data });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return errorResponse(`AI belum bisa membuat insight. Coba lagi nanti. (${lastError})`);
});
