import { useId, useState } from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getModel, MODEL_KEUANGAN, validatePersen, type ModelKode, type Persen } from '@/lib/rencana-math';

/** Pilihan model keuangan. Preset langsung tersimpan; Kustom menunggu total 100% lalu disimpan. */
export function ModelSelector({
  model,
  persen,
  disabled,
  onSave,
}: {
  model: ModelKode;
  persen: Persen;
  disabled: boolean;
  onSave: (model: ModelKode, persen: Persen) => Promise<unknown>;
}) {
  const selectId = useId();
  const [kustom, setKustom] = useState<Persen>(persen);
  const [error, setError] = useState<string | null>(null);
  const current = getModel(model);
  const kustomError = validatePersen(kustom);
  const kustomTotal = kustom.kebutuhan + kustom.keinginan + kustom.investasi;

  async function pickModel(value: ModelKode) {
    setError(null);
    if (value === 'kustom') {
      setKustom(persen);
      return onSave('kustom', persen);
    }
    const preset = getModel(value);
    return onSave(preset.kode, preset.persen);
  }

  async function saveKustom() {
    const message = validatePersen(kustom);
    if (message) return setError(message);
    setError(null);
    await onSave('kustom', kustom);
  }

  function setField(key: keyof Persen, raw: string) {
    const value = raw === '' ? 0 : Number(raw);
    setKustom((prev) => ({ ...prev, [key]: Number.isFinite(value) ? value : 0 }));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <label htmlFor={selectId} className="shrink-0 text-xs font-bold text-muted-foreground sm:w-32">
          Model keuangan
        </label>
        <select
          id={selectId}
          value={model}
          disabled={disabled}
          onChange={(e) => pickModel(e.target.value as ModelKode)}
          className="h-10 w-full rounded-xl border border-border bg-background px-4 text-sm font-extrabold text-foreground outline-none transition focus:border-primary disabled:opacity-40 sm:w-72"
        >
          {MODEL_KEUANGAN.map((m) => (
            <option key={m.kode} value={m.kode}>
              {m.kode === 'kustom' ? 'Kustom' : m.nama}
            </option>
          ))}
        </select>
      </div>

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground sm:pl-36">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Cocok untuk: {current.cocok}</span>
      </p>

      {model === 'kustom' && !disabled && (
        <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 sm:ml-36">
          <div className="grid grid-cols-3 gap-2">
            {(['kebutuhan', 'keinginan', 'investasi'] as (keyof Persen)[]).map((key) => (
              <label key={key} className="space-y-1 text-[11px] font-bold text-muted-foreground">
                {key === 'investasi' ? 'Investasi' : key === 'keinginan' ? 'Keinginan' : 'Kebutuhan'} %
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  value={kustom[key]}
                  onChange={(e) => setField(key, e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm font-extrabold tabular-nums"
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className={cn('text-xs font-bold tabular-nums', kustomTotal === 100 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300')}>
              Total {kustomTotal}%{kustomTotal === 100 ? ' · pas' : ''}
            </p>
            <Button size="sm" disabled={Boolean(kustomError)} onClick={saveKustom} className="h-9 gap-2 rounded-full font-bold">
              <CheckCircle2 className="h-4 w-4" /> Simpan kustom
            </Button>
          </div>
          {(error || kustomError) && <p className="text-xs font-bold text-destructive">{error ?? kustomError}</p>}
        </div>
      )}
    </div>
  );
}
