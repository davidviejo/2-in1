import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
      <button
        onClick={() => changeLanguage('es')}
        className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
          i18n.language && i18n.language.startsWith('es')
            ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
      >
        ES
      </button>
      <button
        onClick={() => changeLanguage('en')}
        className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${
          i18n.language && i18n.language.startsWith('en')
            ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm'
            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;
