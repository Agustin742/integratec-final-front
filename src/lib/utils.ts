import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Register the theme animations so later `animate-*` classes override earlier ones.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      animate: [
        'fade-in',
        'fade-out',
        'dialog-in',
        'dialog-out',
        'sheet-right-in',
        'sheet-right-out',
        'sheet-left-in',
        'sheet-left-out',
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
