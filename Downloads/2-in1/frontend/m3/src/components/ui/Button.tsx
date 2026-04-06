import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary border border-transparent hover:bg-primary-hover focus-visible:ring-primary/40 shadow-brand',
  secondary:
    'bg-surface text-foreground border border-border hover:bg-surface-alt focus-visible:ring-primary/20',
  ghost:
    'bg-transparent text-foreground border border-transparent hover:bg-surface-alt focus-visible:ring-primary/20',
  danger:
    'bg-danger text-on-primary border border-transparent hover:bg-danger-hover focus-visible:ring-danger/40 shadow-brand',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'md', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-brand-md font-medium transition-all focus-visible:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
