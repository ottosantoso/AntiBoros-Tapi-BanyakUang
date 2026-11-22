import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Paginasi sisi klien untuk daftar yang sudah ada di memori.
 * `resetKey` adalah string yang mewakili filter. Saat nilainya berubah, halaman kembali ke 1
 * tanpa perlu effect. Pakai string, bukan objek, supaya perbandingannya berdasarkan nilai.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const rawPage = state.key === resetKey ? state.page : 1;
  const page = Math.min(Math.max(1, rawPage), totalPages);
  const start = (page - 1) * pageSize;
  return {
    pageItems: items.slice(start, start + pageSize),
    page,
    totalPages,
    total: items.length,
    from: items.length ? start + 1 : 0,
    to: Math.min(start + pageSize, items.length),
    setPage: (next: number) => setState({ key: resetKey, page: Math.min(Math.max(1, next), totalPages) }),
  };
}

/** Bar bawah tabel: info rentang dan tombol halaman sebelumnya/berikutnya. */
export function PaginationBar({
  page,
  totalPages,
  total,
  from,
  to,
  setPage,
  noun = 'data',
}: {
  page: number;
  totalPages: number;
  total: number;
  from: number;
  to: number;
  setPage: (next: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  return (
    <div className="mt-4 flex flex-col items-center justify-between gap-3 border-t border-border pt-3 text-xs sm:flex-row">
      <p className="text-muted-foreground">
        Menampilkan {from}–{to} dari {total} {noun}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            aria-label="Halaman sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[7rem] text-center font-semibold tnum">
            Halaman {page} dari {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
            aria-label="Halaman berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
