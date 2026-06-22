import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { advancedMethodNavigation } from '@/config/seoAdvancedMethod';

export const AdvancedMethodNavigationMap: React.FC = () => (
  <Card className="border-border bg-white p-5 shadow-sm sm:p-6" id="mapa-operativo">
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Dónde se prepara cada parte</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mapa transversal para usar el método sin crear una sección monolítica nueva.
        </p>
      </div>
      <Badge variant="neutral">Navegación existente</Badge>
    </div>

    <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {advancedMethodNavigation.map((item) => (
        <Link
          key={`${item.title}-${item.route.path}`}
          to={item.route.path}
          className="group rounded-xl border border-border bg-surface-alt p-4 transition hover:border-primary/40 hover:bg-surface"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <Badge variant={item.route.area === 'Workflow' ? 'warning' : 'primary'}>
                {item.route.area}
              </Badge>
              <h3 className="mt-3 text-sm font-semibold text-foreground">{item.title}</h3>
            </div>
            <ArrowRight
              size={16}
              className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
          <span className="mt-3 inline-flex text-xs font-semibold text-primary">
            {item.route.label}
          </span>
        </Link>
      ))}
    </div>
  </Card>
);
