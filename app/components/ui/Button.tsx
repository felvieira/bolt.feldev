import * as React from 'react';
import { classNames } from '~/utils/classNames';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'default' | 'destructive' | 'outline' | 'link';
type Size = 'default' | 'sm' | 'lg' | 'icon';

const variantStyles: Record<string, string> = {
  primary:     'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white border-transparent',
  secondary:   'bg-transparent border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]',
  ghost:       'bg-transparent border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-2)]',
  danger:      'bg-transparent border-[var(--error-border)] text-[var(--error)] hover:bg-[var(--error-muted)]',
  // Legacy aliases for backwards compat
  default:     'bg-transparent border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]',
  destructive: 'bg-transparent border-[var(--error-border)] text-[var(--error)] hover:bg-[var(--error-muted)]',
  outline:     'bg-transparent border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-[var(--surface-2)]',
  link:        'bg-transparent border-transparent text-[var(--text-secondary)] underline-offset-4 hover:underline',
};

const sizeStyles: Record<string, string> = {
  default: 'h-9 px-4 py-2',
  sm:      'h-8 px-3 text-xs',
  lg:      'h-10 px-8',
  icon:    'h-9 w-9 p-0',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  _asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'default', className, children, _asChild = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={classNames(
          'inline-flex items-center justify-center gap-2',
          'text-sm font-medium border rounded-[var(--radius-sm)]',
          'transition-all duration-150 cursor-pointer',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          variantStyles[variant] ?? variantStyles['secondary'],
          sizeStyles[size] ?? sizeStyles['default'],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

// Keep buttonVariants export for any callers that import it
export const buttonVariants = (opts?: { variant?: string; size?: string }) => {
  const v = opts?.variant ?? 'secondary';
  const s = opts?.size ?? 'default';
  return classNames(
    'inline-flex items-center justify-center gap-2',
    'text-sm font-medium border rounded-[var(--radius-sm)]',
    'transition-all duration-150 cursor-pointer',
    'disabled:opacity-40 disabled:cursor-not-allowed',
    variantStyles[v] ?? variantStyles['secondary'],
    sizeStyles[s] ?? sizeStyles['default'],
  );
};

export { Button };
