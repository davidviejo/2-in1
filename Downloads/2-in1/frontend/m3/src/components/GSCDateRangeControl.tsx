import React, { useMemo, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

interface GSCDateRangeControlProps {
  startDate: string;
  endDate: string;
  onRangeChange: (start: string, end: string) => void;
}

const GSC_DATA_DELAY_DAYS = 2;

const toDateInputValue = (date: Date) => date.toISOString().split('T')[0];

const getDelayedToday = () => {
  const end = new Date();
  end.setDate(end.getDate() - GSC_DATA_DELAY_DAYS);
  return end;
};

const getMonthRange = (monthsBackFromCurrent: number) => {
  const delayedToday = getDelayedToday();
  const targetYear = delayedToday.getFullYear();
  const targetMonth = delayedToday.getMonth() - monthsBackFromCurrent;
  const monthStart = new Date(targetYear, targetMonth, 1);
  const monthEnd = new Date(targetYear, targetMonth + 1, 0);

  const clampedEnd = monthEnd > delayedToday ? delayedToday : monthEnd;

  return {
    start: toDateInputValue(monthStart),
    end: toDateInputValue(clampedEnd),
  };
};

export const GSCDateRangeControl: React.FC<GSCDateRangeControlProps> = ({
  startDate,
  endDate,
  onRangeChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(startDate);
  const [customEndDate, setCustomEndDate] = useState(endDate);

  const ranges = [
    { label: 'Últimos 7 días', days: 7 },
    { label: 'Últimos 28 días', days: 28 },
    { label: 'Últimos 3 meses', days: 90 },
    { label: 'Últimos 6 meses', days: 180 },
    { label: 'Últimos 12 meses', days: 365 },
    { label: 'Últimos 16 meses', days: 486 },
  ];

  const monthRanges = [
    { label: 'Mes actual', monthsBackFromCurrent: 0 },
    { label: 'Mes pasado', monthsBackFromCurrent: 1 },
    { label: 'Hace 2 meses', monthsBackFromCurrent: 2 },
  ];

  const handleSelect = (days: number) => {
    const end = getDelayedToday();
    const start = new Date(end);
    start.setDate(end.getDate() - days);

    onRangeChange(toDateInputValue(start), toDateInputValue(end));
    setIsOpen(false);
  };

  const handleMonthSelect = (monthsBackFromCurrent: number) => {
    const range = getMonthRange(monthsBackFromCurrent);
    onRangeChange(range.start, range.end);
    setCustomStartDate(range.start);
    setCustomEndDate(range.end);
    setIsOpen(false);
  };

  const handleApplyCustomDates = () => {
    if (!customStartDate || !customEndDate || customStartDate > customEndDate) {
      return;
    }

    onRangeChange(customStartDate, customEndDate);
    setIsOpen(false);
  };

  const currentLabel = useMemo(
    () =>
      ranges.find((r) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        return Math.abs(diff - r.days) < 2;
      })?.label || 'Personalizado',
    [endDate, ranges, startDate],
  );

  return (
    <div className="relative">
      <button
        onClick={() => {
          setCustomStartDate(startDate);
          setCustomEndDate(endDate);
          setIsOpen(!isOpen);
        }}
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
          <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-20 p-2 space-y-2">
            <div className="space-y-1">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rangos rápidos</p>
              {ranges.map((range) => (
                <button
                  key={range.days}
                  onClick={() => handleSelect(range.days)}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md text-slate-700 dark:text-slate-200"
                >
                  {range.label}
                </button>
              ))}
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 space-y-1">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Por mes</p>
              <div className="grid grid-cols-1 gap-1">
                {monthRanges.map((range) => (
                  <button
                    key={range.monthsBackFromCurrent}
                    onClick={() => handleMonthSelect(range.monthsBackFromCurrent)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 rounded-md text-slate-700 dark:text-slate-200"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-2 space-y-2">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rango personalizado</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  max={customEndDate || undefined}
                  onChange={(event) => setCustomStartDate(event.target.value)}
                  className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                  aria-label="Fecha inicial personalizada"
                />
                <input
                  type="date"
                  value={customEndDate}
                  min={customStartDate || undefined}
                  onChange={(event) => setCustomEndDate(event.target.value)}
                  className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200"
                  aria-label="Fecha final personalizada"
                />
              </div>
              <button
                onClick={handleApplyCustomDates}
                disabled={!customStartDate || !customEndDate || customStartDate > customEndDate}
                className="w-full rounded-md px-3 py-2 text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar fechas
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
