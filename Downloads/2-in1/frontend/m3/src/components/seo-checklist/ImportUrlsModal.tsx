import React, { useMemo, useState } from 'react';
import { X, Clipboard, Upload } from 'lucide-react';
import {
  SeoPage,
  CHECKLIST_POINTS,
  ChecklistItem,
  ChecklistKey,
  normalizeChecklistStatus,
} from '../../types/seoChecklist';
import { buildSeoUrlCanonicalKey, normalizeSeoUrl } from '../../utils/seoUrlNormalizer';
import { useSettings } from '../../context/SettingsContext';
import { isBrandTermMatch } from '../../utils/brandTerms';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImport: (pages: SeoPage[]) => void;
  existingPages: SeoPage[];
}

interface ImportErrorSummary {
  emptyRows: number[];
  invalidUrlRows: number[];
  duplicateExistingUrlRows: number[];
  duplicateImportedUrlRows: number[];
}

const createSeoPageId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `seo-page-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isValidUrl = (rawUrl: string): boolean => {
  try {
    const normalizedUrl = normalizeSeoUrl(rawUrl);
    const parsedUrl = new URL(normalizedUrl);
    const hasValidProtocol = ['http:', 'https:'].includes(parsedUrl.protocol);
    const hasHostname = parsedUrl.hostname.length > 0;
    const hasDotInHostname = parsedUrl.hostname.includes('.');
    const hasWhitespace = /\s/.test(rawUrl);
    return hasValidProtocol && hasHostname && hasDotInHostname && !hasWhitespace;
  } catch {
    return false;
  }
};

const isHeaderLikeRow = (parts: string[]): boolean => {
  if (parts.length === 0) return false;

  const normalized = parts.map((part) => part.trim().toLowerCase());
  const hasUrlHeader = normalized.some((part) => part === 'url');
  const hasKeywordHeader = normalized.some(
    (part) => part.includes('keyword') || part.includes('palabra clave'),
  );

  return hasUrlHeader && hasKeywordHeader;
};

const normalizeImportedInput = (rawInput: string): string => {
  if (!rawInput) return rawInput;
  // Cuando se pegan datos desde hojas de cálculo, a veces se "pegan" dos URLs seguidas sin salto.
  // Insertamos salto de línea entre patrones `...<no-separador>https://...`.
  return rawInput.replace(/([^\s|,;])(https?:\/\/)/g, '$1\n$2');
};

const resolveImportedUrlColumns = (parts: string[]): {
  rawUrl: string;
  metadataOffset: number;
} => {
  const firstColumn = parts[0] || '';
  const secondColumn = parts[1] || '';
  const isUrlMigrationRow = isValidUrl(firstColumn) && isValidUrl(secondColumn);

  if (isUrlMigrationRow) {
    return {
      rawUrl: secondColumn,
      metadataOffset: 1,
    };
  }

  return {
    rawUrl: firstColumn,
    metadataOffset: 0,
  };
};

const splitImportedLine = (line: string): string[] => {
  const trimmedLine = line.trim();
  if (!trimmedLine) return [];

  if (line.includes('\t')) {
    return line.split('\t').map((part) => part.trim());
  }

  if (line.includes('|')) {
    return line.split('|').map((part) => part.trim());
  }

  if (line.includes(';')) {
    return line.split(';').map((part) => part.trim());
  }

  if (line.includes(',')) {
    return line.split(',').map((part) => part.trim());
  }

  const columnsByWhitespace = line
    .trim()
    .split(/\s{2,}/)
    .map((part) => part.trim());

  if (columnsByWhitespace.length > 1) {
    return columnsByWhitespace;
  }

  return [trimmedLine];
};

const createEmptyChecklist = (): Record<ChecklistKey, ChecklistItem> => {
  return CHECKLIST_POINTS.reduce(
    (acc, pt) => {
      acc[pt.key] = {
        key: pt.key,
        label: pt.label,
        status_manual: 'NA',
        notes_manual: '',
      };
      return acc;
    },
    {} as Record<ChecklistKey, ChecklistItem>,
  );
};

const normalizeHeader = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');

const CHECKLIST_LABEL_ALIASES: Record<string, ChecklistKey> = CHECKLIST_POINTS.reduce(
  (acc, point) => {
    const normalizedLabel = normalizeHeader(point.label.replace(/^\d+\.\s*/, ''));
    acc[normalizedLabel] = point.key;
    return acc;
  },
  {} as Record<string, ChecklistKey>,
);

const parseChecklistHeaders = (parts: string[]): Map<number, ChecklistKey> => {
  const parsed = new Map<number, ChecklistKey>();
  parts.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const stateMatch = normalized.match(/^(\d+\.\s*)?(.+?)\s*-\s*estado$/);
    const checklistName = (stateMatch?.[2] || normalized).replace(/^\d+\.\s*/, '').trim();
    const checklistKey = CHECKLIST_LABEL_ALIASES[checklistName];
    if (checklistKey) {
      parsed.set(index, checklistKey);
    }
  });
  return parsed;
};

const buildSeenUrls = (pages: SeoPage[]): Set<string> => {
  const seen = new Set<string>();
  for (const page of pages) {
    if (!page?.url || typeof page.url !== 'string') continue;
    try {
      seen.add(buildSeoUrlCanonicalKey(page.url));
    } catch {
      // Ignore malformed legacy URLs from persisted state.
    }
  }
  return seen;
};

const buildImportTemplateTsv = (): string => {
  const headers = [
    'URL',
    'Keyword Principal',
    'Tipo Página',
    'Geo (Opcional)',
    'Cluster (Opcional)',
    ...CHECKLIST_POINTS.map((point) => point.label),
  ];

  const exampleRow = [
    'https://example.com/servicio/local',
    'keyword objetivo',
    'Article',
    'ES',
    'Cluster Local SEO',
    ...CHECKLIST_POINTS.map(() => 'NA'),
  ];

  return `${headers.join('\t')}\n${exampleRow.join('\t')}`;
};

export const ImportUrlsModal: React.FC<Props> = ({ isOpen, onClose, onImport, existingPages }) => {
  const [inputText, setInputText] = useState('');
  const [ignoreDuplicates, setIgnoreDuplicates] = useState(true);
  const [importErrors, setImportErrors] = useState<ImportErrorSummary | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const { settings } = useSettings();
  const brandTerms = useMemo(() => settings.brandTerms || [], [settings.brandTerms]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setImportErrors(null);
    onClose();
  };

  const handleImport = async () => {
    if (!inputText.trim() || isImporting) return;

    const CHUNK_SIZE = 500;
    const lines = normalizeImportedInput(inputText).split('\n');
    let totalImported = 0;
    const errorSummary: ImportErrorSummary = {
      emptyRows: [],
      invalidUrlRows: [],
      duplicateExistingUrlRows: [],
      duplicateImportedUrlRows: [],
    };
    const seenExistingUrls = ignoreDuplicates ? buildSeenUrls(existingPages) : new Set<string>();
    const seenImportedUrls = new Set<string>();
    let checklistColumnsByIndex: Map<number, ChecklistKey> | null = null;
    const yieldToMainThread = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    setIsImporting(true);
    setImportProgress(0);

    try {
      for (let start = 0; start < lines.length; start += CHUNK_SIZE) {
        const end = Math.min(start + CHUNK_SIZE, lines.length);

        const chunkPages: SeoPage[] = [];

        // Simple parsing: URL [tab] KW [tab] Type [tab] Geo [tab] Cluster
        for (let index = start; index < end; index += 1) {
          const line = lines[index];
          const rowNumber = index + 1;
          try {
            const parts = splitImportedLine(line);

            if (parts.length < 1 || !parts[0]) {
              errorSummary.emptyRows.push(rowNumber);
              continue;
            }
            if (isHeaderLikeRow(parts)) {
              checklistColumnsByIndex = parseChecklistHeaders(parts);
              continue;
            }

            const { rawUrl, metadataOffset } = resolveImportedUrlColumns(parts);
            if (!isValidUrl(rawUrl)) {
              errorSummary.invalidUrlRows.push(rowNumber);
              continue;
            }

            const normalizedUrl = normalizeSeoUrl(rawUrl);
            const normalizedUrlKey = buildSeoUrlCanonicalKey(normalizedUrl);
            if (ignoreDuplicates && seenExistingUrls.has(normalizedUrlKey)) {
              errorSummary.duplicateExistingUrlRows.push(rowNumber);
              continue;
            }
            if (seenImportedUrls.has(normalizedUrlKey)) {
              errorSummary.duplicateImportedUrlRows.push(rowNumber);
              continue;
            }
            seenImportedUrls.add(normalizedUrlKey);

            const kwPrincipal = parts[1 + metadataOffset] || '';
            const isBrandKeyword = kwPrincipal ? isBrandTermMatch(kwPrincipal, brandTerms) : false;

            const checklist = createEmptyChecklist();
            if (checklistColumnsByIndex && checklistColumnsByIndex.size > 0) {
              checklistColumnsByIndex.forEach((checklistKey, columnIndex) => {
                const rawStatus = parts[columnIndex];
                if (!rawStatus) return;
                checklist[checklistKey] = {
                  ...checklist[checklistKey],
                  status_manual: normalizeChecklistStatus(rawStatus),
                };
              });
            }

            chunkPages.push({
              id: createSeoPageId(),
              url: normalizedUrl,
              kwPrincipal: isBrandKeyword ? '' : kwPrincipal,
              isBrandKeyword,
              pageType: parts[2 + metadataOffset] || 'Article',
              geoTarget: parts[3 + metadataOffset] || '',
              cluster: parts[4 + metadataOffset] || '',
              checklist,
            });
          } catch (error) {
            console.warn('No se pudo procesar la fila importada de URLs.', { rowNumber, error });
            errorSummary.invalidUrlRows.push(rowNumber);
          }
        }

        if (chunkPages.length > 0) {
          onImport(chunkPages);
          totalImported += chunkPages.length;
        }

        setImportProgress(Math.round((end / lines.length) * 100));

        if (end < lines.length) {
          await yieldToMainThread();
        }
      }

      setImportErrors(errorSummary);

      if (totalImported > 0) {
        const hasErrors =
          errorSummary.emptyRows.length > 0 ||
          errorSummary.invalidUrlRows.length > 0 ||
          errorSummary.duplicateExistingUrlRows.length > 0 ||
          errorSummary.duplicateImportedUrlRows.length > 0;

        if (!hasErrors) {
          setInputText('');
          handleCloseModal();
        }
      }
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([buildImportTemplateTsv()], {
      type: 'text/tab-separated-values;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_importacion_checklist_seo.tsv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Upload size={24} className="text-blue-600" />
            Importar URLs
          </h2>
          <button
            onClick={handleCloseModal}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Copia y pega tus URLs desde Excel o Google Sheets. El formato esperado es:
            <br />
            <code className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs mt-1 block w-fit">
              URL | Keyword Principal | Tipo Página | Geo (Opcional) | Cluster (Opcional)
            </code>
          </p>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="mb-4 inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Descargar plantilla de importación (TSV)
          </button>
          {brandTerms.length > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
              Términos de marca activos: {brandTerms.join(', ')}. Si la keyword coincide, la URL
              se importará como &quot;KW de marca&quot; y sin keyword principal asignada.
            </p>
          )}

          <textarea
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              setImportErrors(null);
            }}
            className="w-full h-64 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none"
            placeholder={`https://example.com/page1\tkeyword1\tblog\nhttps://example.com/page2\tkeyword2\tproduct`}
          />

          <div className="mt-4 flex items-center gap-2">
            <input
              type="checkbox"
              id="ignoreDuplicates"
              checked={ignoreDuplicates}
              onChange={(e) => setIgnoreDuplicates(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
            />
            <label
              htmlFor="ignoreDuplicates"
              className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none"
            >
              Ignorar URLs que ya están en la lista (evitar duplicados)
            </label>
          </div>

          {isImporting && (
            <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <p className="font-semibold">Importando URLs… {importProgress}%</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-blue-100 dark:bg-blue-900/50">
                <div
                  className="h-full bg-blue-600 transition-all duration-200"
                  style={{ width: `${importProgress}%` }}
                />
              </div>
            </div>
          )}

          {importErrors && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold mb-2">Resumen de importación</p>
              <ul className="list-disc pl-5 space-y-1">
                {importErrors.emptyRows.length > 0 && (
                  <li>
                    Filas vacías: {importErrors.emptyRows.length} (#{' '}
                    {importErrors.emptyRows.join(', #')})
                  </li>
                )}
                {importErrors.invalidUrlRows.length > 0 && (
                  <li>
                    URL inválida: {importErrors.invalidUrlRows.length} (#{' '}
                    {importErrors.invalidUrlRows.join(', #')})
                  </li>
                )}
                {importErrors.duplicateExistingUrlRows.length > 0 && (
                  <li>
                    URL ya existente en checklist: {importErrors.duplicateExistingUrlRows.length}{' '}
                    (#{importErrors.duplicateExistingUrlRows.join(', #')})
                  </li>
                )}
                {importErrors.duplicateImportedUrlRows.length > 0 && (
                  <li>
                    URL duplicada dentro de este mismo import:{' '}
                    {importErrors.duplicateImportedUrlRows.length} (#
                    {importErrors.duplicateImportedUrlRows.join(', #')})
                  </li>
                )}
                {importErrors.emptyRows.length === 0 &&
                  importErrors.invalidUrlRows.length === 0 &&
                  importErrors.duplicateExistingUrlRows.length === 0 &&
                  importErrors.duplicateImportedUrlRows.length === 0 && <li>Sin descartes.</li>}
              </ul>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={handleCloseModal}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleImport}
            disabled={!inputText.trim() || isImporting}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Clipboard size={18} />
            {isImporting ? 'Importando…' : 'Importar URLs'}
          </button>
        </div>
      </div>
    </div>
  );
};
