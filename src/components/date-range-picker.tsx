import { useState } from 'react';
import { CalendarIcon, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getPresets,
  rangeKey,
  rangeLabel,
  type DateRangeValue,
} from '@/lib/date-range';

interface Props {
  range: DateRangeValue;
  onChange: (r: DateRangeValue) => void;
}

export function DateRangePicker({ range, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState<DateRangeValue>(range);
  const presets = getPresets();
  const activeKey = rangeKey(range);

  function handleOpenChange(o: boolean) {
    setOpen(o);
    if (o) setInternal(range);
  }

  function applyPreset(r: DateRangeValue) {
    setInternal(r);
    onChange(r);
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
            {presets.map((p) => {
              const active = rangeKey(p.range) === activeKey;
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
          </div>

          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="range"
              selected={selectedForCalendar}
              onSelect={handleSelect}
              numberOfMonths={1}
              initialFocus
            />
          </div>
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
