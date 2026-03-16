import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    PropsWithChildren {
  tone?: 'neutral' | 'accent' | 'success' | 'warning';
}

const toneStyles = {
  neutral: 'bg-elevated text-text-muted border-line',
  accent: 'bg-accent-soft text-accent-strong border-accent/20',
  success: 'bg-success-soft text-success border-success/20',
  warning: 'bg-warning-soft text-warning border-warning/20',
};

function Badge({
  tone = 'neutral',
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium tracking-wide',
        toneStyles[tone],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
