import React, { useState } from 'react';
import { ChevronDown, Info, ListChecks } from 'lucide-react';

interface HowItWorksPanelProps {
  title: string;
  steps: string[];
}

const HowItWorksPanel: React.FC<HowItWorksPanelProps> = ({ title, steps }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!steps.length) {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm dark:border-slate-700 dark:bg-slate-800/80">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1 text-left hover:bg-slate-100/80 dark:hover:bg-slate-700/50"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 text-slate-900 dark:text-slate-100">
          <Info size={18} className="text-primary" aria-hidden="true" />
          <span className="text-base font-semibold">Cómo funciona esta pestaña</span>
        </span>
        <ChevronDown
          size={16}
          className={`text-slate-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (<>
      <p className="mb-4 mt-3 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <ListChecks size={16} className="text-slate-400" aria-hidden="true" />
        {title}
      </p>
      <ol className="space-y-2">
        {steps.map((step, index) => (
          <li
            key={`${step}-${index}`}
            className="flex gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
          >
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      </>)}
    </section>
  );
};

export default HowItWorksPanel;
