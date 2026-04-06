import React from 'react';

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => (
    <input
      ref={ref}
      className={`w-full rounded-brand-md border border-border bg-surface-alt px-4 py-2 text-sm text-foreground outline-none transition-all placeholder:text-muted focus:ring-4 focus:ring-primary/20 ${className}`}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
