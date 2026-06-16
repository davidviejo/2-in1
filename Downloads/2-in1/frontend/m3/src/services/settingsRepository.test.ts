import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsRepository } from './settingsRepository';

describe('SettingsRepository', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists clear local OpenAI keys so AI features can use local fallback after server sync fails', () => {
    SettingsRepository.saveSettings({
      openaiApiKey: 'sk-local-123',
      openaiModel: 'gpt-4o-mini',
    });

    expect(SettingsRepository.getSettings().openaiApiKey).toBe('sk-local-123');
    expect(SettingsRepository.getApiKey('openai')).toBe('sk-local-123');
  });

  it('does not persist masked server OpenAI secrets as usable local keys', () => {
    SettingsRepository.saveSettings({
      openaiApiKey: '********1234',
      openaiModel: 'gpt-4o',
    });

    expect(SettingsRepository.getSettings().openaiApiKey).toBeUndefined();
    expect(SettingsRepository.getApiKey('openai')).toBeUndefined();
  });
});
