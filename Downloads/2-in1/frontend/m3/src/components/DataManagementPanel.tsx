import React, { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { useSettings } from '../context/SettingsContext';
import { buildBackupPayload, isBackupPayload, restoreMediaFlowStorageSnapshot } from '../utils/backup';
import { useToast } from './ui/ToastContext';
import ConfirmDialog from './ui/ConfirmDialog';
import { useTranslation } from 'react-i18next';

const DataManagementPanel: React.FC = () => {
  const { t } = useTranslation();
  const { successAction, errorAction } = useToast();
  const { clients, generalNotes, restoreProjectData, currentClientId } = useProject();
  const { settings, updateSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = React.useState<any | null>(null);

  const handleExport = () => {
    const data = buildBackupPayload({
      clients,
      generalNotes,
      settings,
      currentClientId,
    });

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MediaFlow_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const headers = ['Proyecto', 'Vertical', 'Módulo', 'Tarea', 'Estado', 'Impacto'];
    const rows: string[][] = [];

    clients.forEach((client) => {
      client.modules.forEach((module) => {
        module.tasks.forEach((task) => {
          rows.push([
            `"${client.name.replace(/"/g, '""')}"`,
            `"${client.vertical.replace(/"/g, '""')}"`,
            `"${module.title.replace(/"/g, '""')}"`,
            `"${task.title.replace(/"/g, '""')}"`,
            `"${task.status.replace(/"/g, '""')}"`,
            `"${task.impact.replace(/"/g, '""')}"`,
          ]);
        });
      });
    });

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MediaFlow_Tasks_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);

        if (isBackupPayload(data)) {
          setPendingBackup(data);
        } else {
          errorAction(t('feedback.actions.import_backup'));
        }
      } catch (err) {
        console.error(err);
        errorAction(t('feedback.actions.read_json_file'));
      }
    };
    reader.readAsText(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmRestore = () => {
    if (!pendingBackup) return;

    if (pendingBackup.storage) {
      restoreMediaFlowStorageSnapshot(pendingBackup.storage);
    }

    restoreProjectData(
      pendingBackup.clients,
      pendingBackup.generalNotes || [],
      pendingBackup.currentClientId,
    );

    if (pendingBackup.settings) {
      updateSettings(pendingBackup.settings);
    }

    successAction(t('feedback.actions.restore_data'));
    setPendingBackup(null);
    setTimeout(() => window.location.reload(), 1200);
  };

  return (
    <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 mt-6 border border-slate-200 dark:border-slate-700">
      <ConfirmDialog
        isOpen={!!pendingBackup}
        title={t('feedback.confirm.restore_backup_title')}
        message={t('feedback.confirm.restore_backup_message')}
        confirmLabel={t('feedback.confirm.confirm_button')}
        cancelLabel={t('feedback.confirm.cancel_button')}
        onConfirm={handleConfirmRestore}
        onCancel={() => setPendingBackup(null)}
      />
      <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
        Gestión de Datos
      </h3>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
        >
          <Download size={14} /> Backup JSON
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
        >
          <Upload size={14} /> Restaurar
        </button>
      </div>
      <div className="grid grid-cols-1">
        <button
          onClick={handleExportCSV}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-xs font-medium text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
        >
          <Download size={14} /> Exportar CSV Tareas
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImport}
          className="hidden"
          accept=".json"
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-2 leading-tight">
        Guarda una copia completa con todos tus proyectos, checklists SEO, URLs, kanban, tareas, notas y ajustes.
      </p>
    </div>
  );
};

export default DataManagementPanel;
