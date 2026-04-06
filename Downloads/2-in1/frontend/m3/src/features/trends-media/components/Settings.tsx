import React, { useState } from 'react';
import { Database, Save, Search, Settings2 } from 'lucide-react';
import { getSettings, saveSettings } from '../services/storage';
import { AppSettings } from '../types';

interface SettingsProps {
  onSettingsChanged: (settings: AppSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onSettingsChanged }) => {
  const [settings, setSettings] = useState<AppSettings>(getSettings());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    saveSettings(settings);
    onSettingsChanged(settings);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-20">
      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-4 flex items-center text-xl font-bold text-slate-800"><Settings2 className="mr-2 h-5 w-5 text-blue-600" />Credenciales SERP centralizadas</h2>
        <p className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
          Las credenciales (DataForSEO/SerpApi) ahora se gestionan de forma global en{' '}
          <strong>Ajustes del sistema</strong>. Este módulo solo guarda queries y fuentes.
        </p>
        <div className="mt-3 text-sm">
          <a href="/app/settings" className="font-semibold text-blue-600 hover:underline">
            Ir a Ajustes para configurar credenciales SERP →
          </a>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="mb-6 flex items-center text-xl font-bold text-slate-800"><Search className="mr-2 h-5 w-5 text-emerald-600" />Configuración de Búsqueda (SERPs)</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">Queries Automatizadas</label>
            <textarea className="h-48 w-full rounded-lg border border-slate-300 p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-emerald-500" value={settings.searchQueries.join('\n')} onChange={(event) => setSettings({ ...settings, searchQueries: event.target.value.split('\n').filter((query) => query.trim() !== '') })} placeholder="Una query por línea..." />
            <p className="mt-1 text-xs text-slate-500">El sistema ejecutará estas búsquedas cuando lances el pipeline desde el panel integrado.</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">Fuentes Objetivo (Prioridad)</h4>
            <p className="mb-2 text-sm text-slate-600">Estas fuentes se mantienen como referencia editorial dentro del prompt y la interfaz.</p>
            <div className="flex flex-wrap gap-2">
              {settings.targetSources.map((source) => (
                <span key={source} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600">{source}</span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} className={`flex items-center space-x-2 rounded-lg px-6 py-3 font-semibold text-white transition-all ${saved ? 'bg-green-600' : 'bg-slate-900 hover:bg-slate-800'}`}>
          {saved ? <Database className="h-5 w-5" /> : <Save className="h-5 w-5" />}
          <span>{saved ? 'Guardado Correctamente' : 'Guardar Configuración'}</span>
        </button>
      </div>
    </div>
  );
};
