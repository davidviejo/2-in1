import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface GSCDateRangeControlProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
}

export const GSCDateRangeControl: React.FC<GSCDateRangeControlProps> = ({
  startDate,
  endDate,
  onRangeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const GSC_DATA_DELAY_DAYS = 2;

  const ranges = [
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 28 días', days: 28 },
    { label: 'Últimos 3 meses', days: 90 },
    { label: 'Últimos 6 meses', days: 180 },
    { label: 'Últimos 12 meses', days: 365 },
    { label: 'Últimos 16 meses', days: 486 },
  ];

  const handleSelect = (days: number) => {
    const end = new Date();
    end.setDate(end.getDate() - GSC_DATA_DELAY_DAYS);
    const start = new Date();
    start.setDate(end.getDate() - days);

    onRangeChange(start.toISOString().split('T')[0], end.toISOString().split('T')[0]);
    setIsOpen(false);
  };

  const currentLabel =
    ranges.find((r) => {
      // Approximate check
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return Math.abs(diff - r.days) < 2;
    })?.label || 'Personalizado';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
      >
        <Calendar size={14} className="text-slate-400" />
        {currentLabel}
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)}></div>
          <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 py-1">
            {ranges.map((range) => (
              <button
                key={range.days}
                onClick={() => handleSelect(range.days)}
                className="w-full text-left px-4 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                {range.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
