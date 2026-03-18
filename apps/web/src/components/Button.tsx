import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger';
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
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-2 font-medium transition-[background-color,color,border-color,transform,filter] duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-2 focus:ring-offset-canvas active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 disabled:hover:brightness-100';

    const variantStyles = {
      primary:
        'bg-primary text-primary-contrast hover:brightness-95',
      secondary:
        'bg-secondary text-secondary-contrast hover:brightness-95',
      tertiary:
        'bg-tertiary text-tertiary-contrast hover:brightness-95',
      outline: 'border border-line/70 bg-transparent text-text hover:bg-surface-muted/80',
      ghost: 'bg-transparent text-text-muted hover:bg-surface-muted/80 hover:text-text',
      danger:
        'bg-danger-soft text-danger-strong hover:brightness-95',
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
        type={type}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
