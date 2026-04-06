import React, { useState, useEffect } from 'react';
import { useSeoChecklist } from '../hooks/useSeoChecklist';
import { SeoUrlList } from '../components/seo-checklist/SeoUrlList';
import { SeoChecklistDetail } from '../components/seo-checklist/SeoChecklistDetail';
import { ImportUrlsModal } from '../components/seo-checklist/ImportUrlsModal';
import { BatchJobMonitor } from '../components/seo-checklist/BatchJobMonitor';
import { Plus, ListChecks, Sparkles, Table, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import {
  getCapabilities,
  createBatchJob,
  BatchJobStatus,
  AnalysisPayload,
  AnalysisResponse,
} from '../services/pythonEngineClient';
import { Capabilities, AnalysisConfigPayload, SeoPage } from '../types/seoChecklist';
import { processAnalysisResult } from '../utils/seoUtils';
import { AutoClusterizationPanel } from '../components/seo-checklist/AutoClusterizationPanel';
import { AutoAssignKeywordsPanel } from '../components/seo-checklist/AutoAssignKeywordsPanel';

const SeoChecklistPage: React.FC = () => {
  const normalizeStoredJob = (raw: any): BatchJobStatus | null => {
    const id = raw?.id || raw?.jobId;
    if (!id) {
      return null;
    }

    const rawStatus = raw?.status;
    const status: BatchJobStatus['status'] =
      rawStatus === 'queued' || rawStatus === 'pending'
        ? 'pending'
        : rawStatus === 'running' || rawStatus === 'processing'
          ? 'processing'
          : rawStatus === 'completed' || rawStatus === 'done'
            ? 'done'
            : rawStatus === 'failed' || rawStatus === 'error'
              ? 'error'
              : rawStatus === 'paused'
                ? 'paused'
                : rawStatus === 'cancelled'
                  ? 'cancelled'
                  : 'pending';

    return {
      id,
      status,
      progress: {
        total: raw?.progress?.total ?? raw?.total ?? 0,
        processed: raw?.progress?.processed ?? raw?.processed ?? 0,
        succeeded: raw?.progress?.succeeded ?? raw?.success ?? raw?.succeeded ?? 0,
        failed: raw?.progress?.failed ?? raw?.errors ?? raw?.failed ?? 0,
      },
      created_at: raw?.created_at || raw?.createdAt || new Date().toISOString(),
      completed_at: raw?.completed_at || raw?.completedAt || undefined,
      error: raw?.error || raw?.lastError || undefined,
    };
  };

  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);

  useEffect(() => {
    const fetchCaps = async () => {
      const stored = localStorage.getItem('mediaflow_capabilities');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
            setCapabilities(parsed.data);
            return;
          }
        } catch (e) {
          console.error('Failed to parse cached capabilities', e);
        }
      }

      const caps = await getCapabilities();
      if (caps) {
        setCapabilities(caps);
        localStorage.setItem(
          'mediaflow_capabilities',
          JSON.stringify({
            data: caps,
            timestamp: Date.now(),
          }),
        );
      }
    };

    fetchCaps();
  }, []);

  const {
    pages,
    addPages,
    updatePage,
    updateChecklistItem,
    deletePage,
    bulkUpdatePages,
    bulkDeletePages,
  } = useSeoChecklist();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeView, setActiveView] = useState<'official' | 'auto_cluster' | 'auto_kw'>('official');
  const [allowKwAutoSelectInBasic, setAllowKwAutoSelectInBasic] = useState(true);


  // Batch Job State
  const [jobs, setJobs] = useState<BatchJobStatus[]>(() => {
    const savedJobs = localStorage.getItem('mediaflow_batch_jobs');
    if (!savedJobs) return [];
    try {
      const parsed = JSON.parse(savedJobs);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map(normalizeStoredJob)
        .filter((job): job is BatchJobStatus => Boolean(job));
    } catch (e) {
      console.error('Failed to parse saved jobs', e);
      return [];
    }
  });
  const [isMonitorOpen, setIsMonitorOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('mediaflow_batch_jobs', JSON.stringify(jobs));
  }, [jobs]);

  const handleRunBatch = async (selectedPages: SeoPage[], config: AnalysisConfigPayload) => {
    // Construct payload
    const shouldAnalyzeCompetitors = config.mode === 'advanced' && config.serp?.confirmed;

    const items: AnalysisPayload[] = selectedPages.map((p) => ({
      url: p.url,
      kwPrincipal: p.kwPrincipal,
      pageType: p.pageType,
      geoTarget: p.geoTarget,
      cluster: p.cluster,
      pageId: p.id,
      // If GSC integration exists, maybe we should fetch queries first?
      // For batch, fetching GSC queries for 5000 URLs client-side is bad.
      // We assume the backend can handle it or we skip it for now.
      // Or if we already have them in autoData, pass them.
      gscQueries: p.checklist.OPORTUNIDADES?.autoData?.gscQueries || [],
      analyzeCompetitors: shouldAnalyzeCompetitors,
      competitorUrls: (p.competitors || [])
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter((url) => Boolean(url)),
    }));

    try {
      const response = await createBatchJob({ items, config });
      const newJob: BatchJobStatus = {
        id: response.jobId,
        status: 'pending',
        progress: { total: items.length, processed: 0, succeeded: 0, failed: 0 },
        created_at: new Date().toISOString(),
      };
      setJobs((prev) => [newJob, ...prev]);
      setIsMonitorOpen(true);
    } catch (e) {
      console.error('Failed to start batch job', e);
      alert('Failed to start server-side batch job. Check console or try client-side mode.');
    }
  };

  const handleJobUpdate = (updatedJob: BatchJobStatus) => {
    setJobs((prev) => {
      const existing = prev.find((j) => j.id === updatedJob.id);
      if (existing) {
        return prev.map((j) => (j.id === updatedJob.id ? updatedJob : j));
      }
      return [updatedJob, ...prev];
    });
  };

  const handleJobRemove = (jobId: string) => {
    setJobs((prev) => prev.filter((job) => job.id !== jobId));
  };

  const handleApplyResult = (result: AnalysisResponse) => {
    const page = pages.find((p) => p.id === result.pageId);
    if (!page) {
      console.warn('Page not found for result', result.pageId);
      return;
    }
    const updates = processAnalysisResult(page, result);
    updatePage(page.id, updates);
  };

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  return (
    <div className="page-shell">
      {!selectedPage ? (
        <>
          <Card className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="section-title">Checklist SEO (URLs)</h1>
                <p className="section-subtitle">Gestiona y analiza el SEO On-Page de tus URLs.</p>
              </div>
              {activeView === 'official' && (
                <div className="flex items-center gap-3">
                  {jobs.length > 0 && (
                    <Button onClick={() => setIsMonitorOpen(true)} variant="secondary">
                      <ListChecks size={20} />
                      Monitor Jobs (
                      {
                        jobs.filter(
                          (j) =>
                            j.status !== 'done' && j.status !== 'cancelled' && j.status !== 'error',
                        ).length
                      }
                      )
                    </Button>
                  )}
                  <Button
                    onClick={() => setIsImportModalOpen(true)}
                    variant="primary"
                    className="font-bold"
                  >
                    <Plus size={20} />
                    Importar URLs
                  </Button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeView === 'official' ? 'primary' : 'secondary'}
                onClick={() => setActiveView('official')}
              >
                <Table size={16} />
                Análisis SEO y Clusters
              </Button>
              <Button
                variant={activeView === 'auto_cluster' ? 'primary' : 'secondary'}
                onClick={() => setActiveView('auto_cluster')}
              >
                <Sparkles size={16} />
                Auto-clusterización
              </Button>
              <Button
                variant={activeView === 'auto_kw' ? 'primary' : 'secondary'}
                onClick={() => setActiveView('auto_kw')}
              >
                <KeyRound size={16} />
                Autoasignar KWs
              </Button>
            </div>
          </Card>

          {activeView === 'official' ? (
            <SeoUrlList
              pages={pages}
              onSelect={(page) => setSelectedPageId(page.id)}
              onDelete={deletePage}
              onBulkUpdate={bulkUpdatePages}
              onBulkDelete={bulkDeletePages}
              capabilities={capabilities}
              onRunBatch={handleRunBatch}
              allowKwAutoSelectInBasic={allowKwAutoSelectInBasic}
              onAllowKwAutoSelectInBasicChange={setAllowKwAutoSelectInBasic}
            />
          ) : activeView === 'auto_cluster' ? (
            <AutoClusterizationPanel pages={pages} onBulkUpdate={bulkUpdatePages} />
          ) : (
            <AutoAssignKeywordsPanel pages={pages} onBulkUpdate={bulkUpdatePages} />
          )}
        </>
      ) : (
        <SeoChecklistDetail
          page={selectedPage}
          onUpdatePage={updatePage}
          onUpdateChecklistItem={updateChecklistItem}
          onBack={() => setSelectedPageId(null)}
        />
      )}

      <ImportUrlsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={addPages}
        existingPages={pages}
      />

      {isMonitorOpen && (
        <BatchJobMonitor
          jobs={jobs}
          onClose={() => setIsMonitorOpen(false)}
          onApplyResult={handleApplyResult}
          onJobUpdate={handleJobUpdate}
          onRemoveJob={handleJobRemove}
        />
      )}
    </div>
  );
};

export default SeoChecklistPage;
