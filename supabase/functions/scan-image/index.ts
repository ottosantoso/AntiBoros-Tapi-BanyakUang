// Edge Function: scan-image
// Membaca struk belanja atau mutasi rekening dengan Gemini.
// GEMINI_API_KEY diambil dari Supabase Secrets (tidak pernah dikirim ke browser).
// verify_jwt = true: hanya user yang sudah login yang bisa memanggil fungsi ini.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Urutan fallback model. Model yang tidak tersedia akan dilewati otomatis.
const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];

// ~8 MB gambar dalam base64.
const MAX_BASE64_LENGTH = 11_000_000;

const PROMPT_STRUK = `Kamu adalah sistem pembaca struk belanja/nota/bukti transaksi Indonesia yang sangat teliti.
Analisis gambar ini dan kembalikan HANYA JSON murni (tanpa markdown, tanpa penjelasan) dengan format:
{"nominal": number, "deskripsi": "string", "tanggal": "YYYY-MM-DD", "kategori": "string", "jenis": "pengeluaran" | "pemasukan"}

Aturan:
- nominal: TOTAL TERBAYAR / GRAND TOTAL paling bawah, angka bulat rupiah tanpa titik/koma.
- deskripsi: nama toko, restoran, atau tujuan transaksi.
- tanggal: format YYYY-MM-DD. Kalau tanggal tidak terbaca sama sekali, isi string kosong "".
- kategori: tebak kategori singkat (Makan & Minum, Transportasi, Belanja, Tagihan & Utilitas, Hiburan, Kesehatan, Pendidikan, Lainnya).
- jenis: default "pengeluaran", kecuali jelas bukti uang MASUK (cashback, refund, transfer diterima, top up masuk) maka "pemasukan".
- Kalau gambar kabur tapi pola angka dan konteks masih bisa ditebak dengan yakin, ambil tebakan paling masuk akal. Jangan kosongkan field kalau masih terbaca dari konteks.`;

const PROMPT_MUTASI = `Kamu adalah sistem pembaca mutasi rekening bank/e-wallet Indonesia yang sangat teliti.
Dari gambar mutasi ini, ekstrak SEMUA transaksi, baik yang keluar (pengeluaran) maupun yang masuk (pemasukan). Jangan lewatkan satu baris pun.
Kembalikan HANYA JSON murni (tanpa markdown) dengan format:
{"bank": "string", "transaksi": [{"tanggal": "YYYY-MM-DD", "deskripsi": "string", "nominal": number, "jenis": "pengeluaran" | "pemasukan", "kategori": "string"}]}

Aturan:
- Penanda DB / tanda minus (-) = pengeluaran. Penanda CR / tanda plus (+) / tanpa penanda = pemasukan. Kode teknis di keterangan (misal "TRANSFER DR", nomor referensi) BUKAN penanda debit/kredit.
- nominal: angka bulat rupiah tanpa sen. Format BCA: "35,500.00" berarti 35500 (dua digit sen di belakang titik dibuang). Format BNI/GoPay: "-50.000" berarti 50000.
- tanggal: format YYYY-MM-DD. Kalau gambar tidak mencantumkan tahun, pakai tahun ${new Date().getFullYear()}.
- deskripsi: nama merchant atau tujuan transfer, bersihkan kode teknis.
- Cashback, refund, atau pengembalian dana selalu "pemasukan".
- Abaikan biaya admin di bawah Rp 2.000 dan poin non-tunai (misal GoPay Coins).
- kategori: tebak singkat (Makan & Minum, Transportasi, Transfer, Isi Saldo, Belanja, Top Up, Cashback, Hiburan, Lainnya).`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function errorResponse(message: string, status = 200): Response {
  return json({ status: 'error', message }, status);
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

  let body: { imageType?: unknown; imageBase64?: unknown };
  try {
    body = await req.json();
  } catch {
    return errorResponse('Body request bukan JSON valid.', 400);
  }

  const imageType = body.imageType === 'struk' || body.imageType === 'mutasi' ? body.imageType : null;
  if (!imageType) {
    return errorResponse('imageType harus "struk" atau "mutasi".', 400);
  }

  const raw = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : '';
  if (!raw) {
    return errorResponse('Gambar kosong.', 400);
  }
  if (raw.length > MAX_BASE64_LENGTH) {
    return errorResponse('Ukuran gambar terlalu besar. Maksimal sekitar 8 MB.', 413);
  }

  const dataUrl = raw.match(/^data:([^;]+);base64,/i);
  const mimeType = dataUrl ? dataUrl[1] : 'image/jpeg';
  const base64Data = dataUrl ? raw.slice(dataUrl[0].length) : raw;

  const payload = {
    contents: [
      {
        parts: [
          { text: imageType === 'struk' ? PROMPT_STRUK : PROMPT_MUTASI },
          { inline_data: { mime_type: mimeType, data: base64Data } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };

  let lastError = 'Semua model Gemini gagal diakses.';

  for (const model of MODELS) {
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

      const text: string | undefined = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = `Respons kosong dari ${model}.`;
        continue;
      }

      const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
      return json({ status: 'success', data: { ...parsed, imageType } });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  return errorResponse(`AI tidak dapat membaca dokumen ini. Coba foto lain. (${lastError})`);
});
