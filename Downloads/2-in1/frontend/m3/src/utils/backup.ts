import { Client, Note } from '../types';
import { AppSettings } from '../services/settingsRepository';

export const MEDIAFLOW_STORAGE_PREFIX = 'mediaflow_';

export interface BackupStorageSnapshot {
  [key: string]: string;
}

export interface BackupPayload {
  version: number;
  exportedAt: number;
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
  version: 2,
  exportedAt: Date.now(),
  clients,
  generalNotes,
  settings,
  currentClientId,
  storage: getMediaFlowStorageSnapshot(storage),
});

export const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (!value || typeof value !== 'object') return false;

  const payload = value as Partial<BackupPayload>;
  return Array.isArray(payload.clients) && typeof payload.version === 'number';
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
