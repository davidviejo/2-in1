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
}

interface BuildBackupPayloadOptions {
  clients: Client[];
  generalNotes: Note[];
  settings: AppSettings;
  currentClientId: string;
  storage?: Storage;
}

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

export const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Partial<BackupPayload> & { schema?: { version?: unknown } };
  const hasValidVersion = typeof payload.version === 'number';
  const hasValidSchemaVersion =
    typeof payload.schema === 'object' &&
    payload.schema !== null &&
    typeof payload.schema.version === 'number';

  return Array.isArray(payload.clients) && (hasValidVersion || hasValidSchemaVersion);
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
  return {
    ...value,
    version: BACKUP_SCHEMA_VERSION,
    schema: {
      name: 'mediaflow_backup',
      version: BACKUP_SCHEMA_VERSION,
    },
    exportedAt: typeof value.exportedAt === 'number' ? value.exportedAt : Date.now(),
    clients: (value.clients || []).map((client) => normalizeBackupClient(client)),
    generalNotes: Array.isArray(value.generalNotes) ? value.generalNotes : [],
    currentClientId: typeof value.currentClientId === 'string' ? value.currentClientId : '',
    storage: value.storage || {},
    settings: value.settings || {
      openaiApiKey: '',
      geminiApiKey: '',
      mistralApiKey: '',
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
