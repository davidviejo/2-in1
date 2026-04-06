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

    // Create a mock worker instance
    mockWorkerInstance = {
      postMessage: mockPostMessage,
      terminate: mockTerminate,
      onmessage: null,
      onerror: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };

    // Create a mock constructor
    // Note: We use a regular function so it can be called with 'new'
    const MockWorker = vi.fn(function () {
      return mockWorkerInstance;
    });
    window.Worker = MockWorker as any;
  });

  afterEach(() => {
    window.Worker = originalWorker;
  });

  it('should send data to worker and resolve with insights', async () => {
    const mockData: GSCRow[] = [
      { keys: ['test'], clicks: 10, impressions: 100, ctr: 0.1, position: 1 },
    ];
    const mockInsights = { quickWins: { count: 1 } }; // Partial mock

    // Setup the worker to respond when postMessage is called
    mockPostMessage.mockImplementation(() => {
      // Simulate async response
      setTimeout(() => {
        if (mockWorkerInstance.onmessage) {
          mockWorkerInstance.onmessage({
            data: { type: 'SUCCESS', payload: mockInsights },
          });
        }
      }, 10);
    });

    const result = await runAnalysisInWorker(mockData);

    expect(window.Worker).toHaveBeenCalledTimes(1);
    expect(mockPostMessage).toHaveBeenCalledWith(mockData);
    expect(result).toEqual(mockInsights);
    expect(mockTerminate).toHaveBeenCalled();
  });

  it('should reject when worker returns error', async () => {
    const mockData: GSCRow[] = [];

    mockPostMessage.mockImplementation(() => {
      setTimeout(() => {
        if (mockWorkerInstance.onmessage) {
          mockWorkerInstance.onmessage({
            data: { type: 'ERROR', payload: 'Some error' },
          });
        }
      }, 10);
    });

    await expect(runAnalysisInWorker(mockData)).rejects.toThrow('Some error');
    expect(mockTerminate).toHaveBeenCalled();
  });

  it('should reject when worker throws error event', async () => {
    const mockData: GSCRow[] = [];

    mockPostMessage.mockImplementation(() => {
      setTimeout(() => {
        if (mockWorkerInstance.onerror) {
          mockWorkerInstance.onerror(new Error('Network error'));
        }
      }, 10);
    });

    await expect(runAnalysisInWorker(mockData)).rejects.toThrow('Network error');
    expect(mockTerminate).toHaveBeenCalled();
  });
});
