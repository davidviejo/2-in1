import { randomUUID } from 'crypto';

export type OperationLogLevel = 'info' | 'warn' | 'error';

type LogContext = Record<string, unknown>;

export function getCorrelationIdFromHeaders(headers: Headers): string {
  const incoming = headers.get('x-correlation-id')?.trim();
  if (incoming) {
    return incoming;
  }

  return randomUUID();
}

export function buildCorrelationHeaders(correlationId: string): HeadersInit {
  return { 'x-correlation-id': correlationId };
}

export function logOperation(level: OperationLogLevel, event: string, context: LogContext): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(payload));
    return;
  }

  console.info(JSON.stringify(payload));
}
