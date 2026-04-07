import { useState, useCallback, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { SeoChecklistSettings } from '../types/seoChecklist';
import { SettingsRepository } from '../services/settingsRepository';

const readGlobalDataforseoCredentials = () => {
  const appSettings = SettingsRepository.getSettings();
  return {
    dataforseoLogin: appSettings.dataforseoLogin || '',
    dataforseoPassword: appSettings.dataforseoPassword || '',
  };
};

const getDefaultSettings = (): SeoChecklistSettings => {
  const globalCredentials = readGlobalDataforseoCredentials();

  return {
    brandTerms: [],
    allowKwPrincipalUpdate: true,
    serp: {
      enabled: false,
      provider: 'dataforseo',
      maxKeywordsPerUrl: 10,
      maxCompetitorsPerKeyword: 3,
      useGlobalDataforseo: true,
      dataforseoDetail: 'advanced',
      dataforseoExecutionMode: 'live',
      ...globalCredentials,
    },
    budgets: {
      maxUrlsPerBatch: 50,
      dailyBudget: 10,
      maxEstimatedCostPerBatch: 5,
    },
    competitorsMode: 'autoFromSerp',
  };
};

const mergeSettings = (
  baseSettings: SeoChecklistSettings,
  partial?: Partial<SeoChecklistSettings>,
  options?: { applyLegacyMigration?: boolean },
): SeoChecklistSettings => {
  const merged = {
    ...baseSettings,
    ...partial,
    serp: { ...baseSettings.serp, ...partial?.serp },
    budgets: { ...baseSettings.budgets, ...partial?.budgets },
  };

  const globalCredentials = readGlobalDataforseoCredentials();

  // Migration from old schema: if the explicit metadata does not exist,
  // treat custom credentials as local overrides.
  if (
    options?.applyLegacyMigration &&
    partial?.serp &&
    typeof partial.serp.useGlobalDataforseo === 'undefined'
  ) {
    const hasLocalCredentials = Boolean(
      partial.serp.dataforseoLogin?.trim() && partial.serp.dataforseoPassword?.trim(),
    );
    merged.serp.useGlobalDataforseo = !hasLocalCredentials;
  }

  if (merged.serp.useGlobalDataforseo) {
    merged.serp.dataforseoLogin = globalCredentials.dataforseoLogin;
    merged.serp.dataforseoPassword = globalCredentials.dataforseoPassword;
  }

  return merged;
};

const sanitizeForStorage = (settings: SeoChecklistSettings): SeoChecklistSettings => {
  if (!settings.serp.useGlobalDataforseo) return settings;

  return {
    ...settings,
    serp: {
      ...settings.serp,
      dataforseoLogin: '',
      dataforseoPassword: '',
    },
  };
};

export const useSeoChecklistSettings = () => {
  const { currentClientId } = useProject();
  const storageKey = currentClientId ? `mediaflow_seo_settings_${currentClientId}` : null;
  const [settings, setSettings] = useState<SeoChecklistSettings>(() => {
    const defaultSettings = getDefaultSettings();
    if (!storageKey) return defaultSettings;

    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return defaultSettings;
      const parsed = JSON.parse(saved) as Partial<SeoChecklistSettings>;
      return mergeSettings(defaultSettings, parsed, { applyLegacyMigration: true });
    } catch (e) {
      console.error('Failed to parse SEO settings', e);
      return defaultSettings;
    }
  });

  useEffect(() => {
    const defaultSettings = getDefaultSettings();

    if (!storageKey) {
      setSettings(defaultSettings);
      return;
    }

    try {
      const saved = localStorage.getItem(storageKey);
      const parsed = saved ? (JSON.parse(saved) as Partial<SeoChecklistSettings>) : undefined;
      setSettings(mergeSettings(defaultSettings, parsed, { applyLegacyMigration: true }));
    } catch (e) {
      console.error('Failed to parse SEO settings', e);
      setSettings(defaultSettings);
    }
  }, [storageKey]);

  const updateSettings = useCallback(
    (newSettings: Partial<SeoChecklistSettings>) => {
      if (!storageKey) return;
      setSettings((prev) => {
        const updated = mergeSettings(prev, newSettings);
        localStorage.setItem(storageKey, JSON.stringify(sanitizeForStorage(updated)));
        return updated;
      });
    },
    [storageKey],
  );

  return {
    settings,
    updateSettings,
  };
};
