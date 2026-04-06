import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SeoChecklistPage from './SeoChecklistPage';

const mockUpdatePage = vi.fn();
const mockProcessAnalysisResult = vi.fn(() => ({ kwPrincipal: 'updated' }));

vi.mock('../hooks/useSeoChecklist', () => ({
  useSeoChecklist: () => ({
    pages: [
      { id: 'page-1', url: 'https://one.test', kwPrincipal: 'one', pageType: 'Otro', checklist: {} },
      { id: 'page-2', url: 'https://two.test', kwPrincipal: 'two', pageType: 'Otro', checklist: {} },
    ],
    addPages: vi.fn(),
    updatePage: mockUpdatePage,
    updateChecklistItem: vi.fn(),
    deletePage: vi.fn(),
    bulkUpdatePages: vi.fn(),
    bulkDeletePages: vi.fn(),
  }),
}));

vi.mock('../utils/seoUtils', () => ({
  processAnalysisResult: (...args: any[]) => mockProcessAnalysisResult(...args),
}));

vi.mock('../services/pythonEngineClient', () => ({
  getCapabilities: vi.fn(async () => null),
  createBatchJob: vi.fn(),
}));

vi.mock('../components/seo-checklist/SeoUrlList', () => ({
  SeoUrlList: () => <div>seo-url-list</div>,
}));

vi.mock('../components/seo-checklist/SeoChecklistDetail', () => ({
  SeoChecklistDetail: () => <div>seo-checklist-detail</div>,
}));

vi.mock('../components/seo-checklist/ImportUrlsModal', () => ({
  ImportUrlsModal: () => null,
}));

vi.mock('../components/seo-checklist/AutoClusterizationPanel', () => ({
  AutoClusterizationPanel: () => <div>cluster-panel</div>,
}));

vi.mock('../components/seo-checklist/AutoAssignKeywordsPanel', () => ({
  AutoAssignKeywordsPanel: () => <div>kw-panel</div>,
}));

vi.mock('../components/seo-checklist/BatchJobMonitor', () => ({
  BatchJobMonitor: ({ onApplyResult }: { onApplyResult: (result: any) => void }) => (
    <button
      type="button"
      onClick={() => onApplyResult({ pageId: 'page-2', items: { OPORTUNIDADES: {} } })}
    >
      apply-result
    </button>
  ),
}));

describe('SeoChecklistPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(
      'mediaflow_batch_jobs',
      JSON.stringify([
        {
          id: 'job-1',
          status: 'pending',
          progress: { total: 2, processed: 0, succeeded: 0, failed: 0 },
          created_at: new Date().toISOString(),
        },
      ]),
    );
  });

  it('applies batch result to the page matching result.pageId', async () => {
    render(<SeoChecklistPage />);

    fireEvent.click(await screen.findByText(/Monitor Jobs/i));
    fireEvent.click(await screen.findByText('apply-result'));

    await waitFor(() => {
      expect(mockProcessAnalysisResult).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'page-2' }),
        expect.objectContaining({ pageId: 'page-2' }),
      );
      expect(mockUpdatePage).toHaveBeenCalledWith('page-2', { kwPrincipal: 'updated' });
    });
  });
});
