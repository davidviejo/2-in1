import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  borderRadius = '0.5rem',
}) => {
  const style = {
    width,
    height,
    borderRadius,
  };

  return (
    <div className={`bg-slate-200 dark:bg-slate-700 animate-pulse ${className}`} style={style} />
  );
};
