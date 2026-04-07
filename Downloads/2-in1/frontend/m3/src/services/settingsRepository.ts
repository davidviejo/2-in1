import { resolveApiUrl } from './apiUrlHelper';

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

export type SettingsSource = 'server' | 'env' | 'local' | 'none';

const SETTINGS_KEY = 'mediaflow_app_settings';
const TRENDS_MEDIA_SETTINGS_KEY = 'mediaflow_trends_media_settings';
const LEGACY_SERP_MIGRATION_KEY = 'mediaflow_trends_media_serp_migration_v1';

const SERVER_SETTINGS_KEYS = [
  'openaiApiKey',
  'dataforseoLogin',
  'dataforseoPassword',
  'serpApiKey',
  'defaultSerpProvider',
] as const;

const LOCAL_SETTINGS_KEYS = [
  'geminiApiKey',
  'geminiModel',
  'mistralApiKey',
  'mistralModel',
  'openaiModel',
  'gscClientId',
  'brandTerms',
] as const;

export type ServerSettingsKey = (typeof SERVER_SETTINGS_KEYS)[number];
export type LocalSettingsKey = (typeof LOCAL_SETTINGS_KEYS)[number];

interface ServerSettingsResponse {
  settings: Partial<AppSettings>;
}

const extractServerSettings = (settings: Partial<AppSettings>): Partial<AppSettings> => ({
  openaiApiKey: settings.openaiApiKey,
  dataforseoLogin: settings.dataforseoLogin,
  dataforseoPassword: settings.dataforseoPassword,
  serpApiKey: settings.serpApiKey,
  defaultSerpProvider: settings.defaultSerpProvider,
});

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

  static getServerManagedKeys(): readonly ServerSettingsKey[] {
    return SERVER_SETTINGS_KEYS;
  }

  static getLocalManagedKeys(): readonly LocalSettingsKey[] {
    return LOCAL_SETTINGS_KEYS;
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
    if (settings.gscClientId) {
      localStorage.setItem('mediaflow_gsc_client_id', settings.gscClientId);
    }
  }

  static async getServerSettings(): Promise<Partial<AppSettings>> {
    const response = await fetch(`${resolveApiUrl()}/api/settings/config`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Could not load server settings (${response.status})`);
    }

    const payload = (await response.json()) as ServerSettingsResponse;
    return payload.settings || {};
  }

  static async saveServerSettings(settings: Partial<AppSettings>): Promise<void> {
    const serverPayload = extractServerSettings(settings);
    const response = await fetch(`${resolveApiUrl()}/api/settings/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(serverPayload),
    });

    if (!response.ok) {
      throw new Error(`Could not save server settings (${response.status})`);
    }
  }


  static getApiKey(provider: 'openai' | 'gemini' | 'mistral'): string | undefined {
    const localSettings = this.getSettings();
    return this.resolveApiKey(provider, localSettings);
  }

  static getApiKeySource(provider: 'openai' | 'gemini' | 'mistral'): SettingsSource {
    const localSettings = this.getSettings();
    return this.resolveApiKeySource(provider, localSettings);
  }

  static resolveApiKey(
    provider: 'openai' | 'gemini' | 'mistral',
    localSettings: AppSettings,
    serverSettings?: Partial<AppSettings>,
  ): string | undefined {
    const envKey = this.getEnvApiKey(provider);
    const localKey = this.getLocalApiKey(provider, localSettings);

    if (provider === 'openai') {
      const serverKey = serverSettings?.openaiApiKey;
      return serverKey || envKey || localKey;
    }

    return envKey || localKey;
  }

  static resolveApiKeySource(
    provider: 'openai' | 'gemini' | 'mistral',
    localSettings: AppSettings,
    serverSettings?: Partial<AppSettings>,
  ): SettingsSource {
    if (provider === 'openai' && serverSettings?.openaiApiKey) return 'server';
    if (this.getEnvApiKey(provider)) return 'env';
    if (this.getLocalApiKey(provider, localSettings)) return 'local';
    return 'none';
  }

  private static getLocalApiKey(provider: 'openai' | 'gemini' | 'mistral', settings: AppSettings): string | undefined {
    if (provider === 'openai') return settings.openaiApiKey;
    if (provider === 'gemini') return settings.geminiApiKey;
    return settings.mistralApiKey;
  }

  private static getEnvApiKey(provider: 'openai' | 'gemini' | 'mistral'): string | undefined {
    if (provider === 'openai') return import.meta.env.VITE_OPENAI_API_KEY;
    if (provider === 'gemini') return import.meta.env.VITE_GEMINI_API_KEY;
    return import.meta.env.VITE_MISTRAL_API_KEY;
  }
}
