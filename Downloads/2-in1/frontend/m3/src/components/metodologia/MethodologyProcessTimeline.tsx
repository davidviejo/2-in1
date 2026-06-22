import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface MethodologyPhaseItem {
  title: string;
  description: string;
  chips: readonly string[];
  icon: LucideIcon;
}

interface MethodologyProcessTimelineProps {
  phases: readonly MethodologyPhaseItem[];
}

export const MethodologyProcessTimeline: React.FC<MethodologyProcessTimelineProps> = ({
  phases,
}) => (
  <Card className="border-border bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-xl font-semibold text-foreground">Cómo aplicamos la metodología</h2>
    <div className="mt-5 overflow-x-auto pb-2">
      <div className="grid min-w-[1100px] grid-cols-8 gap-5">
        {phases.map((phase, index) => {
          const Icon = phase.icon;
          return (
            <div
              key={phase.title}
              className="relative rounded-xl border border-border bg-surface-alt p-5"
            >
              {index < phases.length - 1 && (
                <span className="pointer-events-none absolute left-[calc(100%-8px)] top-8 hidden h-px w-4 border-t border-dashed border-border lg:block" />
              )}
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-on-primary">
                  {index + 1}
                </span>
                <span className="rounded-lg bg-white p-1.5 text-primary">
                  <Icon size={15} />
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground">{phase.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{phase.description}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {phase.chips.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </Card>
);
