export interface BatchProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
  estimatedCost: number;
  isRunning: boolean;
}

export async function runBatchWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
  onProgress?: (progress: BatchProgress) => void,
  costEstimator?: (item: T) => number,
): Promise<R[]> {
  const results: R[] = [];
  let processedCount = 0;
  let successCount = 0;
  let failCount = 0;
  let currentCost = 0;
  const errors: Array<{ id: string; error: string }> = [];

  const updateProgress = () => {
    if (onProgress) {
      onProgress({
        total: items.length,
        processed: processedCount,
        succeeded: successCount,
        failed: failCount,
        errors: [...errors],
        estimatedCost: currentCost,
        isRunning: processedCount < items.length,
      });
    }
  };

  const queue = [...items];
  const activePromises: Promise<void>[] = [];

  const runNext = async (): Promise<void> => {
    if (queue.length === 0) return;

    const item = queue.shift();
    if (!item) return;

    if (costEstimator) {
      currentCost += costEstimator(item);
    }

    try {
      const result = await processor(item);
      results.push(result);
      successCount++;
    } catch (e: any) {
      failCount++;
      // We assume item has an id property or we just log index if not possible
      const id = (item as any).id || `item-${processedCount}`;
      errors.push({ id, error: e.message || 'Unknown error' });
    } finally {
      processedCount++;
      updateProgress();
    }

    // Recursively pick up next
    return runNext();
  };

  // Start initial batch
  for (let i = 0; i < concurrency; i++) {
    activePromises.push(runNext());
  }

  await Promise.all(activePromises);

  // Final update
  updateProgress();

  return results;
}
