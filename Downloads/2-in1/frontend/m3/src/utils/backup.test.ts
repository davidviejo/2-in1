import { describe, expect, it, beforeEach } from 'vitest';
import {
  BACKUP_SCHEMA_VERSION,
  buildBackupPayload,
  getMediaFlowStorageSnapshot,
  migrateBackupPayload,
  restoreMediaFlowStorageSnapshot,
} from './backup';

describe('backup utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('captures every mediaflow localStorage entry in the backup payload', () => {
    localStorage.setItem('mediaflow_clients', '[{"id":"1"}]');
    localStorage.setItem('mediaflow_seo_checklist_project-a', '[{"id":"page-1"}]');
    localStorage.setItem('mediaflow_batch_jobs', '[{"id":"job-1"}]');
    localStorage.setItem('external_key', 'should-not-be-exported');

    const payload = buildBackupPayload({
      clients: [],
      generalNotes: [],
      settings: {
        openaiApiKey: '',
        geminiApiKey: '',
        mistralApiKey: '',
      },
      currentClientId: 'project-a',
      storage: localStorage,
    });

    expect(payload.version).toBe(BACKUP_SCHEMA_VERSION);
    expect(payload.schema).toEqual({
      name: 'mediaflow_backup',
      version: BACKUP_SCHEMA_VERSION,
    });
    expect(payload.storage).toEqual({
      mediaflow_batch_jobs: '[{"id":"job-1"}]',
      mediaflow_clients: '[{"id":"1"}]',
      'mediaflow_seo_checklist_project-a': '[{"id":"page-1"}]',
    });
  });

  it('restores the snapshot and removes obsolete mediaflow entries', () => {
    localStorage.setItem('mediaflow_clients', 'old');
    localStorage.setItem('mediaflow_seo_checklist_old-project', '[1]');
    localStorage.setItem('external_key', 'keep-me');

    restoreMediaFlowStorageSnapshot(
      {
        mediaflow_clients: 'new',
        'mediaflow_seo_checklist_project-a': '[{"id":"page-1"}]',
      },
      localStorage,
    );

    expect(getMediaFlowStorageSnapshot(localStorage)).toEqual({
      mediaflow_clients: 'new',
      'mediaflow_seo_checklist_project-a': '[{"id":"page-1"}]',
    });
    expect(localStorage.getItem('external_key')).toBe('keep-me');
    expect(localStorage.getItem('mediaflow_seo_checklist_old-project')).toBeNull();
  });

  it('migrates legacy backups without project metadata fields', () => {
    const migrated = migrateBackupPayload({
      version: 2,
      exportedAt: Date.now(),
      clients: [
        {
          id: 'project-1',
          name: 'Proyecto Legacy',
          vertical: 'local',
          modules: [],
          createdAt: Date.now(),
        },
      ],
      generalNotes: [],
      settings: {
        openaiApiKey: '',
        geminiApiKey: '',
        mistralApiKey: '',
      },
      currentClientId: 'project-1',
      storage: {},
    });

    expect(migrated.version).toBe(BACKUP_SCHEMA_VERSION);
    expect(migrated.schema.version).toBe(BACKUP_SCHEMA_VERSION);
    expect(migrated.clients[0]).toMatchObject({
      projectType: 'LOCAL',
      vertical: 'local',
      sector: 'Otro',
      geoScope: 'local',
      brandTerms: [],
    });
  });
});
