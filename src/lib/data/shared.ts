/** Helper bersama untuk semua modul data. Tidak memanggil Supabase sendiri. */

export interface WriteResult {
  success: boolean;
  error: string | null;
}

export function toNumber(v: number | string): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}

/** Escape karakter khusus LIKE supaya nama dicocokkan apa adanya. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}
