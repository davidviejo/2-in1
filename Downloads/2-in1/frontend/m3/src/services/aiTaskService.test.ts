import { afterEach, describe, expect, it, vi } from 'vitest';
import { enhanceTaskWithAI } from './aiTaskService';
import { Task } from '../types';

describe('AI Task Service', () => {
  const mockTask: Task = {
    id: '1',
    title: 'Test Task',
    description: 'Test Description',
    impact: 'High',
    status: 'pending',
    category: 'Test',
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return backend enriched content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ result: 'Contenido vitaminizado.' }),
    } as Response);

    const result = await enhanceTaskWithAI(mockTask, 'media', {
      provider: 'openai',
      model: 'gpt-4o',
    });
    expect(result).toContain('Contenido vitaminizado.');
  });
});
