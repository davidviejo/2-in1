import React from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange } from 'lucide-react';

const GanttBoard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarRange size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('nav.gantt_board')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('nav.gantt_board_sub')}</p>
          </div>
        </div>
      </header>
    </section>
  );
};

export default GanttBoard;
