import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '../../lib/cn';

interface CardProps extends HTMLAttributes<HTMLDivElement>, PropsWithChildren {
  tone?: 'default' | 'muted' | 'accent';
}

const toneStyles = {
  default: 'bg-panel border-line',
  muted: 'bg-elevated/80 border-line',
  accent: 'bg-accent-soft/70 border-accent/20',
};

function Card({
  tone = 'default',
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-[28px] border p-5 shadow-panel',
        toneStyles[tone],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export default Card;
