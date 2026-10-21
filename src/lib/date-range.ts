import {
  endOfDay,
  endOfMonth,
  endOfYear,
  format,
  isSameDay,
  isSameMonth,
  isSameYear,
  startOfDay,
  startOfMonth,
  startOfYear,
  subMonths,
} from 'date-fns';

export interface DateRangeValue {
  from?: Date;
  to?: Date;
}

export interface Preset {
  id: string;
  label: string;
  range: DateRangeValue;
}

export function thisMonthRange(now = new Date()): DateRangeValue {
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

function lastMonthRange(now = new Date()): DateRangeValue {
  const lm = subMonths(now, 1);
  return { from: startOfMonth(lm), to: endOfMonth(lm) };
}

function thisYearRange(now = new Date()): DateRangeValue {
  return { from: startOfYear(now), to: endOfYear(now) };
}

const ALL_TIME: DateRangeValue = { from: undefined, to: undefined };

export function getPresets(now = new Date()): Preset[] {
  return [
    { id: 'thisMonth', label: 'Bulan Ini', range: thisMonthRange(now) },
    { id: 'lastMonth', label: 'Bulan Lalu', range: lastMonthRange(now) },
    { id: 'thisYear', label: 'Tahun Ini', range: thisYearRange(now) },
    { id: 'allTime', label: 'Semua Waktu', range: ALL_TIME },
  ];
}

export function isAllTime(r: DateRangeValue): boolean {
  return !r.from && !r.to;
}

/** Format a date as yyyy-MM-dd for API query params (locale-independent). */
export function formatRangeParam(d?: Date): string | undefined {
  return d ? format(d, 'yyyy-MM-dd') : undefined;
}

/** Stable string key to compare two ranges (used for active-preset highlight). */
export function rangeKey(r: DateRangeValue): string {
  return `${formatRangeParam(r.from) ?? 'all'}_${formatRangeParam(r.to) ?? 'all'}`;
}

const idDate = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('id-ID', opts).format(d);

function isFullMonthRange(from: Date, to: Date): boolean {
  return (
    isSameMonth(from, to) &&
    isSameDay(from, startOfMonth(from)) &&
    isSameDay(to, endOfMonth(from))
  );
}

function isFullYearRange(from: Date, to: Date): boolean {
  return (
    isSameYear(from, to) &&
    isSameDay(from, startOfYear(from)) &&
    isSameDay(to, endOfYear(from))
  );
}

/** Compact label shown on the picker trigger button. */
export function rangeLabel(r: DateRangeValue): string {
  if (isAllTime(r)) return 'Semua Waktu';
  if (r.from && r.to) {
    if (isFullMonthRange(r.from, r.to)) {
      return idDate(r.from, { month: 'long', year: 'numeric' });
    }
    if (isFullYearRange(r.from, r.to)) {
      return `Tahun ${idDate(r.from, { year: 'numeric' })}`;
    }
    return `${idDate(r.from, { day: 'numeric', month: 'short' })} – ${idDate(r.to, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`;
  }
  if (r.from) return idDate(r.from, { day: 'numeric', month: 'short', year: 'numeric' });
  return 'Pilih tanggal';
}

/** Suffix appended after "Pemasukan " / "Pengeluaran " on metric cards. */
export function rangeSuffix(r: DateRangeValue): string {
  if (isAllTime(r)) return 'Total';
  if (r.from && r.to) {
    if (isFullMonthRange(r.from, r.to)) {
      return idDate(r.from, { month: 'long', year: 'numeric' });
    }
    if (isFullYearRange(r.from, r.to)) {
      return `Tahun ${idDate(r.from, { year: 'numeric' })}`;
    }
    return 'Periode Ini';
  }
  return 'Periode Ini';
}

/** True when a transaction date falls inside the selected range. */
export function inRange(date: Date, r: DateRangeValue): boolean {
  if (isAllTime(r)) return true;
  const t = date.getTime();
  if (r.from && t < startOfDay(r.from).getTime()) return false;
  if (r.to && t > endOfDay(r.to).getTime()) return false;
  return true;
}
