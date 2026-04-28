export type RecordedFailure = {
  id: string;
  occurredAt: string;
  operation: 'historical_import' | 'export_job';
  projectId: string;
  correlationId: string;
  message: string;
  details?: Record<string, unknown>;
};

const MAX_FAILURES = 100;

const state = {
  failures: [] as RecordedFailure[]
};

export function recordFailure(entry: Omit<RecordedFailure, 'id' | 'occurredAt'>): RecordedFailure {
  const failure: RecordedFailure = {
    id: `${entry.operation}:${Date.now()}:${Math.random().toString(16).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
    ...entry
  };

  state.failures.unshift(failure);
  if (state.failures.length > MAX_FAILURES) {
    state.failures.length = MAX_FAILURES;
  }

  return failure;
}

export function listRecentFailures(limit = 20): RecordedFailure[] {
  return state.failures.slice(0, Math.max(1, Math.min(limit, MAX_FAILURES)));
}

export function clearFailuresForTests(): void {
  state.failures.length = 0;
}
