import { Client, Note } from '../types';
import { AppSettings } from '../services/settingsRepository';
import {
  getVerticalFromProjectType,
  normalizeBrandTerms,
  normalizeCountry,
  normalizeGeoScope,
  normalizeInitialConfigPreset,
  normalizePrimaryLanguage,
  normalizeProjectType,
  normalizeAnalysisProjectTypes,
  normalizeSector,
  normalizeSubSector,
} from './projectMetadata';

export const MEDIAFLOW_STORAGE_PREFIX = 'mediaflow_';
export const BACKUP_SCHEMA_VERSION = 4;

export interface BackupStorageSnapshot {
  [key: string]: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: number;
  schema?: {
    name: 'mediaflow_backup';
    version: number;
  };
  clients: Client[];
  generalNotes: Note[];
  settings: AppSettings;
  currentClientId: string;
  storage: BackupStorageSnapshot;
  indexedDb?: {
    seoChecklists?: Record<string, unknown>;
  };
}

type LegacyBackupPayload = Partial<BackupPayload> & {
  projects?: Client[];
  notasGenerales?: Note[];
  notes?: Note[];
  activeClientId?: string;
  selectedProjectId?: string;
  config?: Partial<AppSettings>;
};

interface BuildBackupPayloadOptions {
  clients: Client[];
  generalNotes: Note[];
  settings: AppSettings;
  currentClientId: string;
  storage?: Storage;
}

const CHECKLIST_DB_NAME = 'mediaflow-seo-checklist-db';
const CHECKLIST_DB_STORE = 'seo-checklists';

const canUseIndexedDb = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const readSeoChecklistIndexedDbSnapshot = async (): Promise<Record<string, unknown>> => {
  if (!canUseIndexedDb()) return {};

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(CHECKLIST_DB_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB para backup.'));
  });

  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHECKLIST_DB_STORE, 'readonly');
    const store = tx.objectStore(CHECKLIST_DB_STORE);
    const request = store.getAllKeys();
    const out: Record<string, unknown> = {};

    request.onsuccess = () => {
      const keys = (request.result || []).map((key) => String(key));
      if (keys.length === 0) {
        resolve(out);
        return;
      }

      let pending = keys.length;
      keys.forEach((key) => {
        const readRequest = store.get(key);
        readRequest.onsuccess = () => {
          out[key] = readRequest.result;
          pending -= 1;
          if (pending === 0) resolve(out);
        };
        readRequest.onerror = () => {
          pending -= 1;
          if (pending === 0) resolve(out);
        };
      });
    };
    request.onerror = () => reject(request.error || new Error('No se pudo leer claves de IndexedDB.'));
  });
};

export const getMediaFlowStorageSnapshot = (storage: Storage = window.localStorage) => {
  const snapshot: BackupStorageSnapshot = {};

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key || !key.startsWith(MEDIAFLOW_STORAGE_PREFIX)) continue;
    const value = storage.getItem(key);
    if (value !== null) {
      snapshot[key] = value;
    }
  }

  return snapshot;
};

export const buildBackupPayload = ({
  clients,
  generalNotes,
  settings,
  currentClientId,
  storage = window.localStorage,
}: BuildBackupPayloadOptions): BackupPayload => ({
  version: BACKUP_SCHEMA_VERSION,
  exportedAt: Date.now(),
  schema: {
    name: 'mediaflow_backup',
    version: BACKUP_SCHEMA_VERSION,
  },
  clients,
  generalNotes,
  settings,
  currentClientId,
  storage: getMediaFlowStorageSnapshot(storage),
});

export const buildBackupPayloadAsync = async (
  options: BuildBackupPayloadOptions,
): Promise<BackupPayload> => {
  const basePayload = buildBackupPayload(options);
  try {
    const seoChecklists = await readSeoChecklistIndexedDbSnapshot();
    return {
      ...basePayload,
      indexedDb: {
        seoChecklists,
      },
    };
  } catch {
    return basePayload;
  }
};

export const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (!value || typeof value !== 'object') return false;

  const payload = value as LegacyBackupPayload & { schema?: { version?: unknown } };
  const hasValidVersion = typeof payload.version === 'number';
  const hasValidSchemaVersion =
    typeof payload.schema === 'object' &&
    payload.schema !== null &&
    typeof payload.schema.version === 'number';
  const hasLegacyClients = Array.isArray(payload.projects);
  const hasClients = Array.isArray(payload.clients) || hasLegacyClients;

  // Accept legacy snapshots that predate versioning metadata.
  return hasClients && (hasValidVersion || hasValidSchemaVersion || hasLegacyClients);
};

const normalizeBackupClient = (rawClient: Client): Client => {
  const projectType = normalizeProjectType(rawClient.projectType, rawClient.vertical);
  const geoScope = normalizeGeoScope(rawClient.geoScope, projectType);
  const resolvedCountry = normalizeCountry(rawClient.country, geoScope);

  return {
    ...rawClient,
    vertical: getVerticalFromProjectType(projectType),
    projectType,
    analysisProjectTypes: normalizeAnalysisProjectTypes(rawClient.analysisProjectTypes, projectType),
    sector: normalizeSector(rawClient.sector),
    subSector: normalizeSubSector(rawClient.subSector),
    geoScope,
    country: resolvedCountry,
    primaryLanguage: normalizePrimaryLanguage(rawClient.primaryLanguage),
    brandTerms: normalizeBrandTerms(rawClient.brandTerms),
    initialConfigPreset: normalizeInitialConfigPreset(rawClient.initialConfigPreset, projectType),
  };
};

export const migrateBackupPayload = (value: BackupPayload): BackupPayload => {
  const legacyValue = value as BackupPayload & LegacyBackupPayload;
  const clientsSource = Array.isArray(legacyValue.clients)
    ? legacyValue.clients
    : Array.isArray(legacyValue.projects)
      ? legacyValue.projects
      : [];
  const generalNotesSource = Array.isArray(legacyValue.generalNotes)
    ? legacyValue.generalNotes
    : Array.isArray(legacyValue.notes)
      ? legacyValue.notes
      : Array.isArray(legacyValue.notasGenerales)
        ? legacyValue.notasGenerales
        : [];
  const rawSettings = legacyValue.settings || legacyValue.config || {};

  return {
    ...value,
    version: BACKUP_SCHEMA_VERSION,
    schema: {
      name: 'mediaflow_backup',
      version: BACKUP_SCHEMA_VERSION,
    },
    exportedAt: typeof value.exportedAt === 'number' ? value.exportedAt : Date.now(),
    clients: clientsSource.map((client) => normalizeBackupClient(client)),
    generalNotes: generalNotesSource,
    currentClientId:
      typeof value.currentClientId === 'string'
        ? value.currentClientId
        : typeof legacyValue.activeClientId === 'string'
          ? legacyValue.activeClientId
          : typeof legacyValue.selectedProjectId === 'string'
            ? legacyValue.selectedProjectId
            : '',
    storage: value.storage || {},
    settings: {
      openaiApiKey: typeof rawSettings.openaiApiKey === 'string' ? rawSettings.openaiApiKey : '',
      geminiApiKey: typeof rawSettings.geminiApiKey === 'string' ? rawSettings.geminiApiKey : '',
      mistralApiKey: typeof rawSettings.mistralApiKey === 'string' ? rawSettings.mistralApiKey : '',
    },
  };
};

export const restoreMediaFlowStorageSnapshot = (
  snapshot: BackupStorageSnapshot,
  storage: Storage = window.localStorage,
) => {
  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(MEDIAFLOW_STORAGE_PREFIX) && !(key in snapshot)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => storage.removeItem(key));
  Object.entries(snapshot).forEach(([key, value]) => storage.setItem(key, value));
};

export const restoreSeoChecklistIndexedDbSnapshot = async (snapshot?: Record<string, unknown>) => {
  if (!snapshot || !canUseIndexedDb()) return;

  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(CHECKLIST_DB_NAME, 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB para restaurar.'));
  });

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CHECKLIST_DB_STORE, 'readwrite');
    const store = tx.objectStore(CHECKLIST_DB_STORE);
    Object.entries(snapshot).forEach(([key, value]) => {
      store.put(value, key);
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('No se pudo restaurar SEO checklist en IndexedDB.'));
  });
};
