import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildBackupPayload,
  getMediaFlowStorageSnapshot,
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

    expect(payload.version).toBe(2);
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
});
