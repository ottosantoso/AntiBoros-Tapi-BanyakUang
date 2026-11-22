import { useState } from 'react';
import { CalendarIcon, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getPresets,
  monthRange,
  rangeKey,
  rangeLabel,
  type DateRangeValue,
} from '@/lib/date-range';

interface Props {
  range: DateRangeValue;
  onChange: (r: DateRangeValue) => void;
}

type Panel = 'calendar' | 'monthYear';

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const YEARS_PER_PAGE = 12;

export function DateRangePicker({ range, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState<DateRangeValue>(range);
  const [panel, setPanel] = useState<Panel>('calendar');
  const [pickMonth, setPickMonth] = useState<number | null>(null);
  const [pickYear, setPickYear] = useState<number | null>(null);
  const [yearPageStart, setYearPageStart] = useState<number>(new Date().getFullYear() - 5);
  const presets = getPresets();
  const activeKey = rangeKey(range);
  const regularPresets = presets.filter((p) => p.id !== 'allTime');
  const allTimePreset = presets.find((p) => p.id === 'allTime');

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (o) {
      setInternal(range);
      setPanel('calendar');
      setPickMonth(null);
      setPickYear(null);
    }
  }

  function applyPreset(r: DateRangeValue) {
    setInternal(r);
    onChange(r);
    setOpen(false);
  }

  function openMonthYear() {
    setPanel('monthYear');
    setPickMonth(null);
    setPickYear(null);
    setYearPageStart(new Date().getFullYear() - 5);
  }

  function chooseMonth(m: number) {
    setPickMonth(m);
    if (pickYear !== null) applyMonthYear(pickYear, m);
  }

  function chooseYear(y: number) {
    setPickYear(y);
    if (pickMonth !== null) applyMonthYear(y, pickMonth);
  }

  function applyMonthYear(y: number, m: number) {
    const next = monthRange(y, m);
    setInternal(next);
    onChange(next);
    setOpen(false);
  }

  function handleSelect(r?: DateRangeValue) {
    const next: DateRangeValue = r ?? { from: undefined, to: undefined };
    setInternal(next);
    if (next.from && next.to) {
      onChange(next);
      setOpen(false);
    }
  }

  function handleApply() {
    if (internal.from) {
      onChange({ from: internal.from, to: internal.to ?? internal.from });
    }
    setOpen(false);
  }

  const selectedForCalendar = internal.from ? { from: internal.from, to: internal.to } : undefined;
  const years = Array.from({ length: YEARS_PER_PAGE }, (_, i) => yearPageStart + i);
  const rangeActive = panel === 'monthYear';

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-card/60 font-medium"
          aria-label="Pilih rentang tanggal"
        >
          <CalendarIcon className="h-4 w-4 shrink-0 text-balance" />
          <span className="hidden max-w-[180px] truncate sm:inline">{rangeLabel(range)}</span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="end" sideOffset={6}>
        <div className="flex flex-col sm:flex-row">
          {/* Presets */}
          <div className="flex shrink-0 flex-row gap-1 overflow-x-auto border-b border-border p-2 sm:flex-col sm:border-b-0 sm:border-r sm:overflow-visible">
            {regularPresets.map((p) => {
              const active = !rangeActive && rangeKey(p.range) === activeKey;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.range)}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={openMonthYear}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors',
                rangeActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              Rentang Waktu
            </button>

            {allTimePreset && (
              <button
                type="button"
                onClick={() => applyPreset(allTimePreset.range)}
                className={cn(
                  'whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-medium transition-colors',
                  !rangeActive && rangeKey(allTimePreset.range) === activeKey
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {allTimePreset.label}
              </button>
            )}
          </div>

          {/* Calendar atau pemilih bulan dan tahun */}
          {panel === 'calendar' ? (
            <div className="p-2">
              <Calendar
                mode="range"
                selected={selectedForCalendar}
                onSelect={handleSelect}
                numberOfMonths={1}
                initialFocus
              />
            </div>
          ) : (
            <div className="w-[300px] p-3">
              <p className="mb-2 text-xs text-muted-foreground">Pilih bulan, lalu tahun</p>
              <div className="grid grid-cols-2 gap-3">
                {/* Kolom bulan */}
                <div className="grid grid-cols-2 gap-1">
                  {NAMA_BULAN.map((nama, idx) => (
                    <button
                      key={nama}
                      type="button"
                      onClick={() => chooseMonth(idx)}
                      className={cn(
                        'rounded-md px-1 py-2 text-xs font-medium transition-colors',
                        pickMonth === idx
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      {nama.slice(0, 3)}
                    </button>
                  ))}
                </div>

                {/* Kolom tahun */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <button
                      type="button"
                      aria-label="Halaman tahun sebelumnya"
                      onClick={() => setYearPageStart((s) => s - YEARS_PER_PAGE)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-medium">
                      {yearPageStart} – {yearPageStart + YEARS_PER_PAGE - 1}
                    </span>
                    <button
                      type="button"
                      aria-label="Halaman tahun berikutnya"
                      onClick={() => setYearPageStart((s) => s + YEARS_PER_PAGE)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {years.map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => chooseYear(y)}
                        className={cn(
                          'rounded-md px-1 py-2 text-xs font-medium tabular-nums transition-colors',
                          pickYear === y
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                        )}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border p-3">
          <span className="truncate text-xs text-muted-foreground">{rangeLabel(internal)}</span>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Tutup
            </Button>
            <Button size="sm" onClick={handleApply} disabled={!internal.from}>
              Terapkan
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
