import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  className = '',
}) => (
  <div
    className={`rounded-brand-lg border border-dashed border-border bg-surface px-6 py-10 text-center text-muted ${className}`}
  >
    {icon && <div className="mb-3 flex justify-center text-muted">{icon}</div>}
    <p className="text-base font-semibold text-foreground">{title}</p>
    {description && <p className="mt-2 text-sm text-muted">{description}</p>}
  </div>
);
