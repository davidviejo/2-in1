import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';
import { Card } from './Card';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  className = '',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <Card
        className={`w-full max-h-[90vh] overflow-y-auto ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          {title ? <h3 className="text-lg font-semibold text-foreground">{title}</h3> : <span />}
          <Button aria-label="Cerrar" variant="ghost" size="sm" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
};
