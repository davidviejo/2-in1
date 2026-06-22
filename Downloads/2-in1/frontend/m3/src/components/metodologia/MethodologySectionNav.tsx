import React from 'react';
import { Card } from '@/components/ui/Card';
import { methodologySectionNavItems } from '@/config/seoAdvancedMethod';

export const MethodologySectionNav: React.FC = () => (
  <Card className="sticky top-3 z-10 border-border bg-white/95 p-3 shadow-sm backdrop-blur">
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <p className="text-sm font-semibold text-foreground">Navegación del método</p>
        <p className="text-xs text-muted-foreground">
          Acceso rápido local; Metodología estructura y la ejecución vive en las áreas operativas.
        </p>
      </div>
      <nav aria-label="Secciones del Método SEO Avanzado" className="flex flex-wrap gap-2">
        {methodologySectionNavItems.map((item) => (
          <a
            key={item.id}
            className="rounded-full border border-border bg-surface-alt px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-ring"
            href={`#${item.id}`}
            title={item.description}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  </Card>
);
