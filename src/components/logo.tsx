import { cn } from '@/lib/utils';

export function Logo({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <div
      className={cn(
        'relative grid place-items-center rounded-xl bg-gradient-to-br from-balance via-primary to-savings text-white shadow-lg shadow-primary/30',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M3 17l5-5 4 4 6-7" />
        <path d="M15 7h4v4" />
      </svg>
      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-income ring-2 ring-background" />
    </div>
  );
}
