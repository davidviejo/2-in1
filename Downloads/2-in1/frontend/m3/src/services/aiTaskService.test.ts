import { describe, it, expect } from 'vitest';
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

  it('should return error message when API key is missing', async () => {
    const result = await enhanceTaskWithAI(mockTask, 'media', {
      provider: 'openai',
      apiKey: '',
      model: 'gpt-4o',
    });
    expect(result).toContain('API Key para openai no configurada');
  });
});
