const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

const IDR_COMPACT = new Intl.NumberFormat('id-ID', {
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 1,
});

/** Full currency, e.g. "Rp 5.250.000" */
export function formatIDR(value: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)}`;
}

/** Compact currency for tight spaces, e.g. "Rp 5,3 jt" */
export function formatIDRCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const jt = value / 1_000_000;
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(jt)} jt`;
  }
  if (abs >= 1_000) {
    const rb = value / 1_000;
    return `Rp ${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(rb)} rb`;
  }
  return IDR.format(value);
}

/** Signed amount, e.g. "+ Rp 7.000.000" / "- Rp 1.750.000" */
export function formatSignedIDR(value: number): string {
  const sign = value > 0 ? '+ ' : value < 0 ? '- ' : '';
  return `${sign}${formatIDR(Math.abs(value))}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

export function formatDateID(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatDateRelative(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Hari ini';
  if (diffDays === 1) return 'Kemarin';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} hari lalu`;
  if (diffDays < 0 && diffDays > -7) return 'Mendatang';
  return formatDateID(iso);
}

export function toISODate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonthLabel(): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date());
}

export function shortMonth(monthIndex: number): string {
  return new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(2024, monthIndex, 1));
}
