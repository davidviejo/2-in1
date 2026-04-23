import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runAnalysisInWorker } from './workerClient';
import { GSCRow } from '../types';

describe('workerClient', () => {
  let originalWorker: any;
  let mockPostMessage: any;
  let mockTerminate: any;
  let mockWorkerInstance: any;

  beforeEach(() => {
    originalWorker = window.Worker;
    mockPostMessage = vi.fn();
    mockTerminate = vi.fn();

    mockWorkerInstance = {
      postMessage: mockPostMessage,
      terminate: mockTerminate,
      onmessage: null,
      onerror: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    const MockWorker = vi.fn(function () {
      return mockWorkerInstance;
    });
    window.Worker = MockWorker as any;
  });

  afterEach(() => {
    window.Worker = originalWorker;
  });

  it('should stream chunks to worker and resolve with insights', async () => {
    const mockData: GSCRow[] = [
      { keys: ['q1', '/p1'], clicks: 10, impressions: 100, ctr: 0.1, position: 1 },
      { keys: ['q2', '/p2'], clicks: 20, impressions: 200, ctr: 0.1, position: 2 },
    ];
    const mockInsights = { quickWins: { count: 1 } };

    mockPostMessage.mockImplementation((message: { type: string }) => {
      if (message.type === 'FINALIZE') {
        setTimeout(() => {
          mockWorkerInstance.onmessage?.({
            data: { type: 'SUCCESS', payload: mockInsights },
          });
        }, 0);
      }
    });

    const progressSpy = vi.fn();
    const result = await runAnalysisInWorker(
      { currentRows: mockData, previousRows: [] },
      { chunkSize: 1000, onProgress: progressSpy },
    );

    expect(window.Worker).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'INIT' }));
    expect(mockPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'CHUNK', payload: expect.objectContaining({ chunkIndex: 1, totalChunks: 1 }) }),
    );
    expect(mockPostMessage).toHaveBeenLastCalledWith({ type: 'FINALIZE' });
    expect(result).toEqual(mockInsights);
    expect(progressSpy).not.toHaveBeenCalled();
    expect(mockTerminate).toHaveBeenCalled();
  });

  it('should forward worker progress callbacks', async () => {
    mockPostMessage.mockImplementation((message: { type: string }) => {
      if (message.type === 'FINALIZE') {
        setTimeout(() => {
          mockWorkerInstance.onmessage?.({
            data: { type: 'PROGRESS', payload: { chunkIndex: 1, totalChunks: 1, period: 'current' } },
          });
          mockWorkerInstance.onmessage?.({
            data: { type: 'SUCCESS', payload: { quickWins: { count: 0 } } },
          });
        }, 0);
      }
    });

    const progressSpy = vi.fn();
    await runAnalysisInWorker(
      { currentRows: [{ keys: ['q', '/p'], clicks: 1, impressions: 10, ctr: 0.1, position: 2 }] },
      { chunkSize: 1000, onProgress: progressSpy },
    );

    expect(progressSpy).toHaveBeenCalledWith({ chunkIndex: 1, totalChunks: 1, period: 'current' });
  });

  it('should reject when worker returns error', async () => {
    mockPostMessage.mockImplementation((message: { type: string }) => {
      if (message.type === 'FINALIZE') {
        setTimeout(() => {
          mockWorkerInstance.onmessage?.({
            data: { type: 'ERROR', payload: 'Some error' },
          });
        }, 0);
      }
    });

    await expect(runAnalysisInWorker({ currentRows: [] })).rejects.toThrow('Some error');
    expect(mockTerminate).toHaveBeenCalled();
  });
});
