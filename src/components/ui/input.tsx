import { cn } from '@/lib/utils';
import type { ComponentProps } from 'react';

function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      className={cn(
        'border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 flex h-9 w-full rounded-lg border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-2',
        className
      )}
      {...props}
    />
  );
}

export { Input };
