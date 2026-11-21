import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        'relative grid place-items-center rounded-xl bg-gradient-to-br from-[#38bdf8] via-[#2563eb] to-[#1d4ed8] text-white shadow-lg shadow-primary/30',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <TrendingUp className="text-white" style={{ width: size * 0.6, height: size * 0.6 }} strokeWidth={2.4} aria-hidden="true" />
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-income ring-2 ring-background" />
    </div>
  );
}
