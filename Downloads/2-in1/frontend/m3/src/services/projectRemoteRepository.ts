import { resolveApiUrl } from './apiUrlHelper';
import { Client, Note } from '../types';
import { ClientRepository } from './clientRepository';
import { ProjectSnapshotDTO } from '../types/projectApi';
import { StrategyFactory } from '../strategies/StrategyFactory';

const PROJECT_SYNC_META_KEY = 'mediaflow_project_sync_meta_v1';
const LEGACY_IMPORTED_FLAG_KEY = 'mediaflow_legacy_uploaded_v1';
const LEGACY_CLIENTS_KEY = 'mediaflow_clients';

interface SyncMeta {
  version: number;
}

const TAB_ORIGIN_KEY = 'mediaflow_project_origin_client_id_v1';

const getOriginClientId = (): string => {
  const existing = sessionStorage.getItem(TAB_ORIGIN_KEY);
  if (existing) {
    return existing;
  }
  const next = crypto.randomUUID();
  sessionStorage.setItem(TAB_ORIGIN_KEY, next);
  return next;
};

const readSyncMeta = (): SyncMeta => {
  try {
    const raw = localStorage.getItem(PROJECT_SYNC_META_KEY);
    if (!raw) return { version: 1 };
    const parsed = JSON.parse(raw) as SyncMeta;
    return { version: Number.isFinite(parsed.version) ? parsed.version : 1 };
  } catch {
    return { version: 1 };
  }
};

const saveSyncMeta = (meta: SyncMeta) => {
  localStorage.setItem(PROJECT_SYNC_META_KEY, JSON.stringify(meta));
};

const getFallbackSnapshot = (): ProjectSnapshotDTO => ({
  version: readSyncMeta().version,
  updatedAt: Date.now(),
  currentClientId: ClientRepository.getCurrentClientId(),
  clients: ClientRepository.getClients(),
  generalNotes: ClientRepository.getGeneralNotes(),
});

export class ProjectRemoteRepository {
  static async bootstrap(): Promise<ProjectSnapshotDTO> {
    await StrategyFactory.primeTemplates();
    const localSnapshot = getFallbackSnapshot();
    const hasLocalClients = localSnapshot.clients.length > 0;

    try {
      const remoteSnapshot = await this.fetchRemoteSnapshot();

      if (remoteSnapshot.clients.length === 0) {
        await this.seedRemoteFromLocal(localSnapshot, remoteSnapshot.version);
        await this.migrateLegacyOnce(localSnapshot, remoteSnapshot.version);
      }

      const finalSnapshot = await this.fetchRemoteSnapshot();

      if (finalSnapshot.clients.length === 0 && hasLocalClients) {
        this.persistCache(localSnapshot);
        saveSyncMeta({ version: localSnapshot.version });
        return localSnapshot;
      }

      if (finalSnapshot.clients.length === 0 && !hasLocalClients) {
        const fallbackSnapshot = getFallbackSnapshot();
        if (fallbackSnapshot.clients.length > 0) {
          await this.seedRemoteFromLocal(fallbackSnapshot, finalSnapshot.version);
          this.persistCache(fallbackSnapshot);
          saveSyncMeta({ version: fallbackSnapshot.version });
          return fallbackSnapshot;
        }
      }

      this.persistCache(finalSnapshot);
      saveSyncMeta({ version: finalSnapshot.version });
      return finalSnapshot;
    } catch (error) {
      console.warn('Using offline cache for project data.', error);
      return localSnapshot;
    }
  }

  static async saveSnapshot(
    snapshot: Omit<ProjectSnapshotDTO, 'version' | 'updatedAt'>,
    options?: { updatedFields?: string[] },
  ): Promise<ProjectSnapshotDTO> {
    const buildPayload = (version: number): ProjectSnapshotDTO => ({
      ...snapshot,
      version,
      updatedAt: Date.now(),
      expectedVersion: version,
      originClientId: getOriginClientId(),
      updatedFields: options?.updatedFields || ['clients', 'generalNotes', 'currentClientId'],
    });

    const meta = readSyncMeta();
    const response = await fetch(`${resolveApiUrl()}/api/v1/project-api/snapshot`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload(meta.version)),
    });

    if (response.status === 409) {
      const conflictData = await response.json();
      const serverVersion = conflictData?.serverSnapshot?.version;

      if (!Number.isFinite(serverVersion)) {
        throw new Error('version_conflict');
      }

      const retryResponse = await fetch(`${resolveApiUrl()}/api/v1/project-api/snapshot`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload(serverVersion)),
      });

      if (retryResponse.status === 409) {
        const retryConflictData = await retryResponse.json();
        if (retryConflictData?.serverSnapshot) {
          this.persistCache(retryConflictData.serverSnapshot);
          saveSyncMeta({ version: retryConflictData.serverSnapshot.version });
        }
        throw new Error('version_conflict');
      }

      if (!retryResponse.ok) {
        throw new Error(`sync_failed_${retryResponse.status}`);
      }

      const retriedSaved = (await retryResponse.json()) as ProjectSnapshotDTO;
      this.persistCache(retriedSaved);
      saveSyncMeta({ version: retriedSaved.version });
      return retriedSaved;
    }

    if (!response.ok) {
      throw new Error(`sync_failed_${response.status}`);
    }

    const saved = (await response.json()) as ProjectSnapshotDTO;
    this.persistCache(saved);
    saveSyncMeta({ version: saved.version });
    return saved;
  }

  private static async fetchRemoteSnapshot(): Promise<ProjectSnapshotDTO> {
    const response = await fetch(`${resolveApiUrl()}/api/v1/project-api/snapshot`);
    if (!response.ok) {
      throw new Error(`remote_fetch_failed_${response.status}`);
    }
    return (await response.json()) as ProjectSnapshotDTO;
  }

  private static async seedRemoteFromLocal(localSnapshot: ProjectSnapshotDTO, expectedVersion: number): Promise<void> {
    if (localSnapshot.clients.length === 0) {
      return;
    }

    const response = await fetch(`${resolveApiUrl()}/api/v1/project-api/snapshot`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...localSnapshot,
        expectedVersion,
      }),
    });

    if (!response.ok && response.status !== 409) {
      throw new Error(`seed_failed_${response.status}`);
    }
  }

  private static persistCache(snapshot: ProjectSnapshotDTO): void {
    ClientRepository.saveClients(snapshot.clients as Client[]);
    ClientRepository.saveGeneralNotes(snapshot.generalNotes as Note[]);
    if (snapshot.currentClientId) {
      ClientRepository.saveCurrentClientId(snapshot.currentClientId);
    }
  }

  private static async migrateLegacyOnce(localSnapshot: ProjectSnapshotDTO, expectedVersion: number): Promise<void> {
    if (localStorage.getItem(LEGACY_IMPORTED_FLAG_KEY) === '1') {
      return;
    }

    const legacyRaw = localStorage.getItem(LEGACY_CLIENTS_KEY);
    if (!legacyRaw) {
      localStorage.setItem(LEGACY_IMPORTED_FLAG_KEY, '1');
      return;
    }

    const response = await fetch(`${resolveApiUrl()}/api/v1/project-api/snapshot`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...localSnapshot,
        expectedVersion,
      }),
    });

    if (response.ok || response.status === 409) {
      localStorage.setItem(LEGACY_IMPORTED_FLAG_KEY, '1');
    }
  }
}
