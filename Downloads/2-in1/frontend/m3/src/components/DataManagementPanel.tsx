import React, { useRef } from 'react';
import { Download, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useProject } from '../context/ProjectContext';
import { useSettings } from '../context/SettingsContext';
import {
  BACKUP_SCHEMA_VERSION,
  buildBackupBlob,
  buildBackupPayloadAsync,
  isBackupPayload,
  migrateBackupPayload,
  restoreMediaFlowStorageSnapshot,
  restoreSeoChecklistIndexedDbSnapshot,
} from '../utils/backup';
import { useToast } from './ui/ToastContext';
import ConfirmDialog from './ui/ConfirmDialog';
import { useTranslation } from 'react-i18next';
import { createHttpClient } from '../services/httpClient';


const normalizeImportedJson = (raw: string) => raw.replace(/^\uFEFF/, '').replace(/\u0000/g, '').trim();
const MAX_IMPORT_FILE_SIZE_BYTES = 250 * 1024 * 1024;
const projectApiHttpClient = createHttpClient({ service: 'api' });

const DataManagementPanel: React.FC = () => {
  const { t } = useTranslation();
  const { successAction, errorAction, error } = useToast();
  const { clients, generalNotes, restoreProjectData, currentClientId } = useProject();
  const { settings, updateSettings } = useSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingBackup, setPendingBackup] = React.useState<ReturnType<typeof migrateBackupPayload> | null>(null);
  const [isExportingBackup, setIsExportingBackup] = React.useState(false);

  const formatMesColumn = (dueDate?: string) => {
    if (!dueDate) return '';
    const parsedDate = new Date(dueDate);
    if (Number.isNaN(parsedDate.getTime())) return '';

    const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(parsedDate);
    const yearShort = parsedDate.getFullYear().toString().slice(-2);
    return `${monthLabel} ${yearShort}`;
  };

  const formatCompletedAtColumn = (completedAt?: number) => {
    if (!completedAt) return '';
    const completedDate = new Date(completedAt);
    if (Number.isNaN(completedDate.getTime())) return '';

    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(completedDate);
  };

  const handleExport = async () => {
    if (isExportingBackup) return;

    setIsExportingBackup(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));

      const data = await buildBackupPayloadAsync({
        clients,
        generalNotes,
        settings,
        currentClientId,
      });

      const blob = buildBackupBlob(data);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MediaFlow_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      successAction('Backup JSON exportado correctamente.');
    } catch (err) {
      console.error(err);
      errorAction(t('feedback.actions.export_data'));
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'MES',
      'TAREA',
      'IMPLEMENTACIÓN',
      'TIPOLOGÍA',
      'SECTOR',
      'SUBSECTOR',
      'GEO_SCOPE',
      'COUNTRY',
      'PRIMARY_LANGUAGE',
      'BRAND_TERMS',
      'PROJECT_CONFIG',
      'ÁREA',
      'ESTADO',
      'FECHA_COMPLETADO',
      'COMENTARIOS',
    ];
    const rows: string[][] = [];

    clients.forEach((client) => {
      const completedByTaskId = new Map<string, number>();
      (client.completedTasksLog || []).forEach((entry) => {
        if (!entry.taskId || entry.source !== 'module') return;
        const previousCompletedAt = completedByTaskId.get(entry.taskId);
        if (!previousCompletedAt || entry.completedAt > previousCompletedAt) {
          completedByTaskId.set(entry.taskId, entry.completedAt);
        }
      });

      client.modules.forEach((module) => {
        module.tasks.forEach((task) => {
          const completedAt = task.status === 'completed' ? completedByTaskId.get(task.id) : undefined;
          rows.push([
            formatMesColumn(task.dueDate),
            task.title,
            client.name,
            client.projectType,
            client.sector,
            client.subSector || '',
            client.geoScope,
            client.country || '',
            client.primaryLanguage || '',
            (client.brandTerms || []).join(', '),
            client.initialConfigPreset ? JSON.stringify(client.initialConfigPreset) : '',
            task.category || module.title,
            task.status,
            formatCompletedAtColumn(completedAt),
            task.userNotes || task.description || '',
          ]);
        });
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tareas');
    XLSX.writeFile(workbook, `MediaFlow_Tareas_Sheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const remoteSnapshot = await projectApiHttpClient.request<unknown>('/api/v1/project-api/snapshot/import-file', {
          method: 'POST',
          body: formData,
          timeoutMs: 30 * 60 * 1000,
        });
        if (isBackupPayload(remoteSnapshot)) {
          setPendingBackup(migrateBackupPayload(remoteSnapshot));
          successAction('Backup grande cargado en servidor. Confirma para restaurar en este navegador.');
        } else {
          error('El servidor recibió el archivo pero no devolvió un backup válido.', 6000);
        }
      } catch (uploadError) {
        console.error(uploadError);
        error('No se pudo subir el backup grande al servidor. Verifica backend y vuelve a intentar.', 6000);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const fileContent = e.target?.result;
          if (typeof fileContent !== 'string') {
            throw new Error('El archivo importado no es texto válido');
          }

          const content = normalizeImportedJson(fileContent);
          const data = JSON.parse(content);

          if (isBackupPayload(data)) {
            setPendingBackup(migrateBackupPayload(data));
          } else {
            errorAction(t('feedback.actions.import_backup'));
          }
        } catch (err) {
          console.error(err);
          const message = err instanceof Error ? err.message : '';
          if (/Invalid string length|out of memory|memory/i.test(message)) {
            error(
              'No se pudo leer el backup localmente. Se recomienda subirlo por servidor para tamaños grandes.',
              6000,
            );
          } else {
            errorAction(t('feedback.actions.read_json_file'));
          }
        }
      };
      reader.readAsText(file);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void handleImport(event).catch((unexpectedError) => {
      console.error(unexpectedError);
      errorAction(t('feedback.actions.import_backup'));
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    });
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackup) return;

    if (pendingBackup.storage) {
      restoreMediaFlowStorageSnapshot(pendingBackup.storage);
    }
    await restoreSeoChecklistIndexedDbSnapshot(pendingBackup.indexedDb?.seoChecklists);

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
          onClick={() => void handleExport()}
          disabled={isExportingBackup}
          className="flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
        >
          <Download size={14} /> {isExportingBackup ? 'Exportando backup…' : 'Backup JSON'}
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
          <Download size={14} /> Exportar Sheet Tareas
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept=".json"
        />
      </div>
      <p className="text-[10px] text-slate-400 mt-2 leading-tight">
        Guarda una copia completa con todos tus proyectos, checklists SEO, URLs, kanban, tareas, notas y ajustes.
        {' '}Esquema actual: v{BACKUP_SCHEMA_VERSION}.
      </p>
    </div>
  );
};

export default DataManagementPanel;
