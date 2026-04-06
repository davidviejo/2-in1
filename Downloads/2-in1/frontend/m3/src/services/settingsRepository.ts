export interface AppSettings {
  openaiApiKey?: string;
  openaiModel?: string;
  geminiApiKey?: string;
  geminiModel?: string;
  mistralApiKey?: string;
  mistralModel?: string;
  dataforseoLogin?: string;
  dataforseoPassword?: string;
  serpApiKey?: string;
  defaultSerpProvider?: 'dataforseo' | 'serpapi';
  gscClientId?: string;
  brandTerms?: string[];
}

const SETTINGS_KEY = 'mediaflow_app_settings';
const TRENDS_MEDIA_SETTINGS_KEY = 'mediaflow_trends_media_settings';
const LEGACY_SERP_MIGRATION_KEY = 'mediaflow_trends_media_serp_migration_v1';

export class SettingsRepository {
  private static migrateLegacyTrendsMediaSerpSettings(): Partial<AppSettings> {
    const migrationAlreadyDone = localStorage.getItem(LEGACY_SERP_MIGRATION_KEY) === 'true';
    if (migrationAlreadyDone) return {};

    const legacySettingsRaw = localStorage.getItem(TRENDS_MEDIA_SETTINGS_KEY);
    if (!legacySettingsRaw) {
      localStorage.setItem(LEGACY_SERP_MIGRATION_KEY, 'true');
      return {};
    }

    try {
      const legacySettings = JSON.parse(legacySettingsRaw) as {
        serpApiKey?: string;
        dataforseoLogin?: string;
        dataforseoPassword?: string;
        defaultSerpProvider?: 'dataforseo' | 'serpapi';
      };

      const migrated: Partial<AppSettings> = {};
      if (legacySettings.serpApiKey) migrated.serpApiKey = legacySettings.serpApiKey;
      if (legacySettings.dataforseoLogin) migrated.dataforseoLogin = legacySettings.dataforseoLogin;
      if (legacySettings.dataforseoPassword) migrated.dataforseoPassword = legacySettings.dataforseoPassword;
      if (legacySettings.defaultSerpProvider) {
        migrated.defaultSerpProvider = legacySettings.defaultSerpProvider;
      }

      localStorage.setItem(LEGACY_SERP_MIGRATION_KEY, 'true');
      return migrated;
    } catch (error) {
      console.error('Error migrating legacy trends-media SERP settings', error);
      localStorage.setItem(LEGACY_SERP_MIGRATION_KEY, 'true');
      return {};
    }
  }

  static getSettings(): AppSettings {
    const migratedFromLegacy = this.migrateLegacyTrendsMediaSerpSettings();
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        const parsedSettings = JSON.parse(saved) as AppSettings;
        const mergedSettings: AppSettings = {
          defaultSerpProvider: 'dataforseo',
          ...parsedSettings,
          ...migratedFromLegacy,
        };
        if (Object.keys(migratedFromLegacy).length > 0) {
          this.saveSettings(mergedSettings);
        }
        return mergedSettings;
      } catch (e) {
        console.error('Error parsing settings', e);
      }
    }
    // Fallback: Check for legacy GSC Client ID in localStorage if not in new settings
    // Note: useGSCAuth used 'mediaflow_gsc_client_id'
    const legacyGscId = localStorage.getItem('mediaflow_gsc_client_id');
    const fallbackSettings: AppSettings = {
      ...migratedFromLegacy,
      gscClientId: legacyGscId || undefined,
      brandTerms: [],
      openaiModel: 'gpt-4o',
      mistralModel: 'mistral-large-latest',
      geminiModel: 'gemini-1.5-pro',
      defaultSerpProvider: 'dataforseo',
    };

    if (Object.keys(migratedFromLegacy).length > 0) {
      this.saveSettings(fallbackSettings);
    }

    return fallbackSettings;
  }

  static saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Sync legacy GSC key for backward compatibility
    if (settings.gscClientId) {
      localStorage.setItem('mediaflow_gsc_client_id', settings.gscClientId);
    }
  }

  static getApiKey(provider: 'openai' | 'gemini' | 'mistral'): string | undefined {
    const settings = this.getSettings();
    if (provider === 'openai') return settings.openaiApiKey || import.meta.env.VITE_OPENAI_API_KEY;
    if (provider === 'gemini') return settings.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (provider === 'mistral')
      return settings.mistralApiKey || import.meta.env.VITE_MISTRAL_API_KEY;
    return undefined;
  }
}
