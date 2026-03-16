import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-offset-2 focus:ring-offset-canvas disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
      primary:
        'border border-accent/15 bg-accent-soft text-accent hover:bg-accent-soft/80',
      secondary:
        'bg-panel text-text hover:bg-elevated border border-line',
      outline:
        'border border-line bg-transparent text-text hover:bg-elevated/80',
      ghost: 'bg-transparent text-text-muted hover:bg-elevated/70 hover:text-text',
      danger: 'border border-danger/15 bg-danger-soft text-danger hover:bg-danger-soft/80',
    };

    const sizeStyles = {
      sm: 'px-3 py-2 text-sm rounded-full',
      md: 'px-4 py-2.5 text-sm rounded-full',
      lg: 'px-6 py-3 text-base rounded-full',
    };

    const widthStyle = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        className={cn(
          baseStyles,
          variantStyles[variant],
          sizeStyles[size],
          widthStyle,
          className
        )}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
