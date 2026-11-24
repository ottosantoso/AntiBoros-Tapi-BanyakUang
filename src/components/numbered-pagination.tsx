import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Daftar nomor halaman: 1 2 3 ... 8 9 10. Di layar kecil tombolnya tetap 36 px minimal. */
function pageNumbers(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | 'gap')[] = [1];
  if (page > 3) pages.push('gap');
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (page < totalPages - 2) pages.push('gap');
  pages.push(totalPages);
  return pages;
}

export function NumberedPagination({
  page,
  totalPages,
  onChange,
  label,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  label: string;
}) {
  if (totalPages <= 1) return null;
  const btn = 'grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-xs font-extrabold transition disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1.5 pt-3">
      <button type="button" className={cn(btn, 'border-border bg-card hover:bg-accent/40')} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Halaman sebelumnya">
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pageNumbers(page, totalPages).map((p, i) =>
        p === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">…</span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
            className={cn(btn, p === page ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-accent/40')}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={cn(btn, 'border-border bg-card hover:bg-accent/40')} disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Halaman berikutnya">
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  );
}
