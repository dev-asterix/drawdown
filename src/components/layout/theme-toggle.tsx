'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="pressable flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground shadow-elev-1 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 md:h-10 md:w-10"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label="Toggle theme"
    >
      {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}
