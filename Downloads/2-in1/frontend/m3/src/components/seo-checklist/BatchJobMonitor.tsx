import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Square,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  ChevronRight,
  ChevronLeft,
  Download,
  Loader2,
} from 'lucide-react';
import {
  BatchJobStatus,
  BatchJobItem,
  getBatchJob,
  getBatchJobItems,
  updateBatchJob,
  getBatchJobItemResult,
  getRunnerHealth,
  AnalysisResponse,
  RunnerHealth,
  JobStatus,
  BatchJobNotFoundError,
} from '../../services/pythonEngineClient';
import { useToast } from '../ui/ToastContext';
import { useTranslation } from 'react-i18next';

interface Props {
  jobs: BatchJobStatus[];
  onClose: () => void;
  onApplyResult: (result: AnalysisResponse) => void;
  onJobUpdate: (updatedJob: BatchJobStatus) => void;
  onRemoveJob: (jobId: string) => void;
}

const PAUSE_ALLOWED_STATUSES: JobStatus[] = ['processing', 'pending'];
const CANCEL_ALLOWED_STATUSES: JobStatus[] = ['pending', 'processing', 'paused'];
const TERMINAL_STATUSES: JobStatus[] = ['done', 'cancelled', 'error'];

export const BatchJobMonitor: React.FC<Props> = ({
  jobs,
  onClose,
  onApplyResult,
  onJobUpdate,
  onRemoveJob,
}) => {
  const { t } = useTranslation();
  const { errorAction, successAction } = useToast();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'done' | 'errors' | 'queued'>('done');
  const [items, setItems] = useState<BatchJobItem[]>([]);
  const [itemsPage, setItemsPage] = useState(1);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());
  const [runnerHealth, setRunnerHealth] = useState<RunnerHealth | null>(null);

  const selectedJob = jobs.find((j) => j.id === selectedJobId);

  // Poll selected job
  useEffect(() => {
    if (!selectedJobId) return;

    // Initial fetch
    getBatchJob(selectedJobId)
      .then(onJobUpdate)
      .catch((error) => {
        if (error instanceof BatchJobNotFoundError) {
          onRemoveJob(selectedJobId);
          setSelectedJobId(null);
          successAction(t('feedback.actions.update_batch_job'));
          return;
        }
        console.error(error);
      });

    const interval = setInterval(() => {
      const job = jobs.find((j) => j.id === selectedJobId);
      if (job && !TERMINAL_STATUSES.includes(job.status)) {
        getBatchJob(selectedJobId)
          .then(onJobUpdate)
          .catch((error) => {
            if (error instanceof BatchJobNotFoundError) {
              onRemoveJob(selectedJobId);
              setSelectedJobId(null);
              return;
            }
            console.error(error);
          });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [selectedJobId, jobs, onJobUpdate]);

  // Fetch items when tab or page changes
  useEffect(() => {
    if (!selectedJobId) return;

    const fetchItems = async () => {
      setIsLoadingItems(true);
      try {
        const statusMap = {
          done: 'done',
          errors: 'error',
          queued: 'queued,running,paused',
        };

        const status = statusMap[activeTab];

        const res = await getBatchJobItems(selectedJobId, status, itemsPage, 50);
        setItems(res.items);
        setItemsTotal(res.total);
      } catch (e) {
        console.error('Failed to fetch job items', e);
      } finally {
        setIsLoadingItems(false);
      }
    };

    fetchItems();
  }, [selectedJobId, activeTab, itemsPage]);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const health = await getRunnerHealth();
        setRunnerHealth(health);
      } catch (e) {
        console.error('Failed to fetch runner health', e);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: 'pause' | 'resume' | 'cancel') => {
    if (!selectedJobId) return;
    try {
      await updateBatchJob(selectedJobId, action);
      // Immediately fetch update
      const updated = await getBatchJob(selectedJobId);
      onJobUpdate(updated);
    } catch (e) {
      if (e instanceof BatchJobNotFoundError) {
        onRemoveJob(selectedJobId);
        setSelectedJobId(null);
        successAction(t('feedback.actions.update_batch_job'));
        return;
      }
      console.error(e);
      errorAction(t('feedback.actions.update_batch_job'));
    }
  };

  const handleApply = async (itemId: string) => {
    if (!selectedJobId) return;
    setApplyingIds((prev) => new Set(prev).add(itemId));
    try {
      const result = await getBatchJobItemResult(selectedJobId, itemId);
      onApplyResult(result);
      setAppliedIds((prev) => new Set(prev).add(itemId));
      successAction(t('feedback.actions.apply_batch_result'));
    } catch (e) {
      console.error('Failed to apply result', e);
      errorAction(t('feedback.actions.apply_batch_result'));
    } finally {
      setApplyingIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleApplyAllPage = async () => {
    if (!selectedJobId) return;
    // Apply for all items in current view that are NOT applied
    const toApply = items.filter((i) => !appliedIds.has(i.itemId));

    // Process strictly sequentially or with small concurrency to avoid UI freeze/state thrashing
    for (const item of toApply) {
      await handleApply(item.itemId);
    }
  };

  if (!selectedJobId) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RefreshCw size={20} />
              Batch Jobs Monitor
            </h2>
            <div className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              Runner:{' '}
              <span
                className={runnerHealth?.thread_alive ? 'text-emerald-600' : 'text-amber-600'}
                title={runnerHealth?.thread_name || ''}
              >
                {runnerHealth?.thread_alive ? 'alive' : 'down'}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {jobs.length === 0 ? (
              <div className="text-center py-20 text-slate-400">No hay jobs recientes.</div>
            ) : (
              <div className="grid gap-4">
                {jobs.map((job) => (
                  <div
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className="cursor-pointer bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-xl hover:shadow-md transition-all flex justify-between items-center group"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`font-mono text-xs px-2 py-0.5 rounded-full border ${
                            job.status === 'done'
                              ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                              : job.status === 'error'
                                ? 'bg-red-100 border-red-200 text-red-700'
                                : job.status === 'paused'
                                  ? 'bg-violet-100 border-violet-200 text-violet-700'
                                : job.status === 'cancelled'
                                  ? 'bg-slate-100 border-slate-200 text-slate-700'
                                  : 'bg-blue-100 border-blue-200 text-blue-700'
                          }`}
                        >
                          {job.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-400">ID: {job.id.slice(0, 8)}...</span>
                      </div>
                      <div className="text-sm font-medium">
                        {new Date(job.created_at).toLocaleString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-end min-w-[120px]">
                        <div className="text-xs text-slate-500 mb-1">
                          {job.progress.processed} / {job.progress.total} URLs
                        </div>
                        <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              job.status === 'error' ? 'bg-red-500' : 'bg-blue-600'
                            }`}
                            style={{
                              width: `${(job.progress.processed / (job.progress.total || 1)) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                      <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedJobId(null)}
              className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500"
            >
              <ChevronLeft size={20} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Job Details
                <span className="font-mono text-sm font-normal text-slate-500">
                  #{selectedJob?.id.slice(0, 8)}
                </span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span
                  className={`px-1.5 py-0.5 rounded border ${
                    runnerHealth?.thread_alive
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                      : 'bg-amber-100 border-amber-200 text-amber-700'
                  }`}
                  title={runnerHealth?.thread_name || ''}
                >
                  runner {runnerHealth?.thread_alive ? 'alive' : 'down'}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded border ${
                    selectedJob?.status === 'done'
                      ? 'bg-emerald-100 border-emerald-200 text-emerald-700'
                      : selectedJob?.status === 'error'
                        ? 'bg-red-100 border-red-200 text-red-700'
                      : selectedJob?.status === 'paused'
                        ? 'bg-violet-100 border-violet-200 text-violet-700'
                      : selectedJob?.status === 'processing'
                        ? 'bg-blue-100 border-blue-200 text-blue-700'
                      : selectedJob?.status === 'cancelled'
                        ? 'bg-slate-100 border-slate-200 text-slate-700'
                        : 'bg-amber-100 border-amber-200 text-amber-700'
                  }`}
                >
                  {selectedJob?.status}
                </span>
                <span>
                  {selectedJob?.progress.processed} / {selectedJob?.progress.total} processed
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedJob && PAUSE_ALLOWED_STATUSES.includes(selectedJob.status) && (
              <button
                onClick={() => handleAction('pause')}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 text-sm font-medium"
              >
                <Pause size={16} /> Pause
              </button>
            )}
            {selectedJob?.status === 'paused' ? (
              <button
                onClick={() => handleAction('resume')}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 text-sm font-medium"
              >
                <Play size={16} /> Resume
              </button>
            ) : null}
            {selectedJob && CANCEL_ALLOWED_STATUSES.includes(selectedJob.status) && (
              <button
                onClick={() => handleAction('cancel')}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 text-sm font-medium"
              >
                <Square size={16} /> Cancel
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => {
              setActiveTab('done');
              setItemsPage(1);
            }}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'done'
                ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50 dark:bg-emerald-900/10'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Done ({selectedJob?.progress.succeeded})
          </button>
          <button
            onClick={() => {
              setActiveTab('errors');
              setItemsPage(1);
            }}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'errors'
                ? 'border-red-500 text-red-600 bg-red-50/50 dark:bg-red-900/10'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Errors ({selectedJob?.progress.failed})
          </button>
          <button
            onClick={() => {
              setActiveTab('queued');
              setItemsPage(1);
            }}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'queued'
                ? 'border-blue-500 text-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Queued / Pending / Paused
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 p-4">
          {activeTab === 'done' && items.length > 0 && (
            <div className="mb-4 flex justify-end">
              <button
                onClick={handleApplyAllPage}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl shadow hover:bg-blue-700 transition-colors text-sm font-bold"
              >
                <Download size={16} /> Apply All on Page
              </button>
            </div>
          )}

          {isLoadingItems ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-slate-400" size={32} />
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.itemId}
                  className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center text-sm"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {item.status === 'done' && (
                      <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle size={16} className="text-red-500 shrink-0" />
                    )}
                    {(item.status === 'pending' ||
                      item.status === 'processing' ||
                      item.status === 'paused') && (
                      <Clock size={16} className="text-slate-400 shrink-0" />
                    )}

                    <span className="truncate max-w-md font-medium" title={item.url}>
                      {item.url}
                    </span>
                    {item.error && (
                      <span className="text-red-500 text-xs truncate max-w-xs">{item.error}</span>
                    )}
                  </div>

                  {item.status === 'done' && (
                    <button
                      onClick={() => handleApply(item.itemId)}
                      disabled={applyingIds.has(item.itemId) || appliedIds.has(item.itemId)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        appliedIds.has(item.itemId)
                          ? 'bg-emerald-100 text-emerald-700 cursor-default'
                          : 'bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-600'
                      }`}
                    >
                      {applyingIds.has(item.itemId) ? (
                        <Loader2 className="animate-spin" size={14} />
                      ) : appliedIds.has(item.itemId) ? (
                        'Applied'
                      ) : (
                        'Apply Result'
                      )}
                    </button>
                  )}
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center py-10 text-slate-400">
                  No items found in this section.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center">
          <button
            onClick={() => setItemsPage((p) => Math.max(1, p - 1))}
            disabled={itemsPage === 1}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm text-slate-500">
            Page {itemsPage} of {Math.ceil(itemsTotal / 50) || 1}
          </span>
          <button
            onClick={() => setItemsPage((p) => p + 1)}
            disabled={itemsPage >= Math.ceil(itemsTotal / 50)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
