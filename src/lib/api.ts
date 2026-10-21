import type { DashboardData, NewTransaction, ScanPayload, ScanReceipt, ScanMutasi, ScanResult, ScanRow, TransactionType } from './types';

const LS_KEY = 'hepeng.appsScriptUrl';

export function getApiUrl(): string {
  if (typeof localStorage === 'undefined') return '';
  return localStorage.getItem(LS_KEY) ?? '';
}

export function setApiUrl(url: string): void {
  if (typeof localStorage === 'undefined') return;
  const clean = url.trim();
  if (clean) localStorage.setItem(LS_KEY, clean);
  else localStorage.removeItem(LS_KEY);
}

export function hasApiUrl(): boolean {
  return getApiUrl().length > 0;
}

function buildUrl(base: string, action: string, dateParams?: { start?: string; end?: string }): string {
  const sep = base.includes('?') ? '&' : '?';
  const params = new URLSearchParams({ action });
  if (dateParams?.start) params.set('startDate', dateParams.start);
  if (dateParams?.end) params.set('endDate', dateParams.end);
  return `${base}${sep}${params.toString()}`;
}

function normaliseDashboard(raw: unknown): DashboardData {
  const d = (raw ?? {}) as Partial<DashboardData>;
  const dompet = Array.isArray(d.dompet)
    ? d.dompet.map((w) => ({ nama: String(w.nama), saldo: Number(w.saldo) || 0 }))
    : [];
  const topPengeluaran = Array.isArray(d.topPengeluaran)
    ? d.topPengeluaran.map((t) => ({ deskripsi: String(t.deskripsi), nominal: Number(t.nominal) || 0 }))
    : [];
  const rekapKategori = (d.rekapKategori && typeof d.rekapKategori === 'object')
    ? Object.fromEntries(
        Object.entries(d.rekapKategori).map(([k, v]) => [String(k), Number(v) || 0]),
      )
    : {};
  const transaksi = Array.isArray(d.transaksi)
    ? d.transaksi.map((t) => ({
        tanggal: String(t.tanggal),
        deskripsi: String(t.deskripsi),
        tipe: (String(t.tipe) === 'Pemasukan' ? 'Pemasukan' : 'Pengeluaran') as TransactionType,
        nominal: Number(t.nominal) || 0,
        dompet: String(t.dompet),
        kategori: t.kategori ? String(t.kategori) : undefined,
      }))
    : [];
  const trenBulanan = Array.isArray(d.trenBulanan)
    ? d.trenBulanan.map((m) => ({
        bulan: String(m.bulan),
        pemasukan: Number(m.pemasukan) || 0,
        pengeluaran: Number(m.pengeluaran) || 0,
      }))
    : [];
  const totalSaldo = Number(d.totalSaldo) || dompet.reduce((s, w) => s + (Number(w.saldo) || 0), 0);
  const pemasukanBulanIni = Number(d.pemasukanBulanIni) || 0;
  const pengeluaranBulanIni = Number(d.pengeluaranBulanIni) || 0;
  const tabunganBulanIni =
    Number(d.tabunganBulanIni) || (pemasukanBulanIni - pengeluaranBulanIni);
  return {
    totalSaldo,
    pemasukanBulanIni,
    pengeluaranBulanIni,
    tabunganBulanIni,
    dompet,
    topPengeluaran,
    rekapKategori,
    transaksi,
    trenBulanan,
  };
}

export interface FetchResult {
  data: DashboardData | null;
  error: string | null;
}

/**
 * Fetch the dashboard payload from the Google Apps Script web app.
 * Apps Script text responses are JSON; some deployments wrap in their
 * own envelope, so we guard every access.
 */
export async function fetchDashboard(dateParams?: { start?: string; end?: string }): Promise<FetchResult> {
  const base = getApiUrl();
  if (!base) return { data: null, error: null };

  try {
    const res = await fetch(buildUrl(base, 'getDashboard', dateParams), {
      method: 'GET',
      redirect: 'follow',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      return { data: null, error: `Server merespons ${res.status} ${res.statusText}` };
    }
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Apps Script occasionally returns JSON wrapped in HTML during auth.
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return { data: null, error: 'Respons server bukan JSON valid.' };
        }
      } else {
        return { data: null, error: 'Respons server bukan JSON valid.' };
      }
    }
    return { data: normaliseDashboard(parsed), error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal terhubung ke server.';
    return { data: null, error: `Gagal mengambil data: ${msg}` };
  }
}

export interface AddResult {
  success: boolean;
  error: string | null;
}

/**
 * POST a new transaction. Apps Script `doPost` reads `e.postData.contents`.
 * NOTE: We deliberately omit the Content-Type header. Setting it to
 * application/json triggers a CORS preflight (OPTIONS) that Apps Script
 * does not handle, causing the request to fail. A bare POST with a JSON
 * string body is sent as text/plain and avoids the preflight.
 */
export async function addTransaction(payload: NewTransaction): Promise<AddResult> {
  const base = getApiUrl();
  if (!base) return { success: false, error: 'URL Apps Script belum diset.' };

  try {
    const res = await fetch(base, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { success: false, error: `Server merespons ${res.status} ${res.statusText}` };
    }
    return { success: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal mengirim transaksi.';
    return { success: false, error: `Gagal menambah transaksi: ${msg}` };
  }
}

export interface ScanResponseResult {
  success: boolean;
  data: ScanResult | null;
  error: string | null;
}

/**
 * POST an image for AI scanning. Same no-Content-Type rule as addTransaction
 * so Apps Script receives the body without a CORS preflight.
 */
export async function scanImage(payload: ScanPayload): Promise<ScanResponseResult> {
  const base = getApiUrl();
  if (!base) return { success: false, data: null, error: 'URL Apps Script belum diset.' };

  try {
    const res = await fetch(base, {
      method: 'POST',
      redirect: 'follow',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { success: false, data: null, error: `Server merespons ${res.status} ${res.statusText}` };
    }
    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch {
          return { success: false, data: null, error: 'Respons server bukan JSON valid.' };
        }
      } else {
        return { success: false, data: null, error: 'Respons server bukan JSON valid.' };
      }
    }
    const env = parsed as { status?: string; data?: ScanResult; message?: string };
    if (env.status === 'success' && env.data) {
      return { success: true, data: normaliseScanResult(env.data, payload.imageType), error: null };
    }
    return {
      success: false,
      data: null,
      error: env.message ?? 'AI tidak dapat membaca dokumen ini. Coba foto lain.',
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal terhubung ke server.';
    return { success: false, data: null, error: `Gagal memindai: ${msg}` };
  }
}

function toTransactionType(v: unknown): TransactionType {
  const s = String(v ?? '').toLowerCase();
  if (s === 'pemasukan' || s === 'income' || s === 'kredit' || s === '+' ) return 'Pemasukan';
  return 'Pengeluaran';
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  const cleaned = String(v ?? '').replace(/[^0-9-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function toString(v: unknown, fallback = ''): string {
  const s = v == null ? '' : String(v);
  return s.trim() || fallback;
}

function toISODateVal(v: unknown): string {
  const s = String(v ?? '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

/** Normalise the AI scan payload into a consistent shape the UI can render. */
function normaliseScanResult(raw: ScanResult, imageType: 'struk' | 'mutasi'): ScanResult {
  if (imageType === 'struk') {
    const r = raw as Partial<ScanReceipt>;
    return {
      imageType: 'struk',
      nominal: toNumber(r.nominal),
      deskripsi: toString(r.deskripsi, 'Struk Belanja'),
      tanggal: toISODateVal(r.tanggal),
      kategori: toString(r.kategori, 'Lainnya'),
      jenis: toTransactionType(r.jenis),
    } satisfies ScanReceipt;
  }
  const m = raw as Partial<ScanMutasi>;
  const transaksi = Array.isArray(m.transaksi)
    ? m.transaksi.map((t: Partial<ScanRow>) => ({
        tanggal: toISODateVal(t.tanggal),
        deskripsi: toString(t.deskripsi, 'Transaksi'),
        nominal: toNumber(t.nominal),
        jenis: toTransactionType(t.jenis),
        kategori: toString(t.kategori, 'Lainnya'),
      }))
    : [];
  return {
    imageType: 'mutasi',
    transaksi,
  } satisfies ScanMutasi;
}

