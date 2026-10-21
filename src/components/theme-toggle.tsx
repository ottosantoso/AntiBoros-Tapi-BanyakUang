import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
      className={cn(
        'group relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/60 text-foreground/70 transition-all hover:bg-accent hover:text-foreground',
        className,
      )}
    >
      <Sun
        className={cn(
          'absolute transition-all duration-300',
          theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0',
        )}
        style={{ width: 18, height: 18 }}
      />
      <Moon
        className={cn(
          'absolute transition-all duration-300',
          theme === 'dark' ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100',
        )}
        style={{ width: 18, height: 18 }}
      />
    </button>
  );
}
