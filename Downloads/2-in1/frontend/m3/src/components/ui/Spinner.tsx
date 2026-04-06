import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 24, className = '' }) => {
  return <Loader2 size={size} className={`animate-spin text-blue-500 ${className}`} />;
};
