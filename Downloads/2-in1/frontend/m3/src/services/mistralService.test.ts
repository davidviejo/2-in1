import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { enhanceTaskWithMistral, isMistralConfigured, mistralConfig } from './mistralService';
import { Task } from '../types';

// Mock Mistral client
const mockChatComplete = vi.fn();

// Mock the module properly, ensuring Mistral is a class (constructor function)
vi.mock('@mistralai/mistralai', () => {
  return {
    Mistral: class {
      chat = {
        complete: mockChatComplete,
      };
    },
  };
});

describe('Mistral Service', () => {
  const mockTask: Task = {
    id: '1',
    title: 'Test Task',
    description: 'Test Description',
    impact: 'High',
    status: 'pending',
    category: 'Test',
  };

  const originalGetEnv = mistralConfig.getEnv;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChatComplete.mockResolvedValue({
      choices: [{ message: { content: 'Mock response' } }],
    });
    // Default mock implementation
    mistralConfig.getEnv = vi.fn().mockReturnValue({
      VITE_MISTRAL_API_KEY: 'test-key',
      VITE_MISTRAL_MODEL: '',
    });
  });

  afterEach(() => {
    mistralConfig.getEnv = originalGetEnv;
  });

  it('should return error message when API key is missing', async () => {
    mistralConfig.getEnv = vi.fn().mockReturnValue({
      VITE_MISTRAL_API_KEY: '',
    });

    const result = await enhanceTaskWithMistral(mockTask, 'media');
    expect(result).toContain('API Key de Mistral no configurada');
  });

  it('should return false for configuration check when missing', () => {
    mistralConfig.getEnv = vi.fn().mockReturnValue({
      VITE_MISTRAL_API_KEY: '',
    });
    expect(isMistralConfigured()).toBe(false);
  });

  it('should use default model when VITE_MISTRAL_MODEL is not set', async () => {
    mistralConfig.getEnv = vi.fn().mockReturnValue({
      VITE_MISTRAL_API_KEY: 'test-key',
      VITE_MISTRAL_MODEL: '',
    });

    await enhanceTaskWithMistral(mockTask, 'media');

    expect(mockChatComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mistral-tiny',
      }),
    );
  });

  it('should use configured model when VITE_MISTRAL_MODEL is set', async () => {
    mistralConfig.getEnv = vi.fn().mockReturnValue({
      VITE_MISTRAL_API_KEY: 'test-key',
      VITE_MISTRAL_MODEL: 'mistral-medium',
    });

    await enhanceTaskWithMistral(mockTask, 'media');

    expect(mockChatComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'mistral-medium',
      }),
    );
  });
});
