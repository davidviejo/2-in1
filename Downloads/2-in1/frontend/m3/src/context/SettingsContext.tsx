import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { AppSettings, SettingsRepository, SettingsSource } from '../services/settingsRepository';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  saveSettings: (nextSettings?: Partial<AppSettings>) => Promise<boolean>;
  getApiKey: (provider: 'openai' | 'gemini' | 'mistral') => string | undefined;
  getApiKeySource: (provider: 'openai' | 'gemini' | 'mistral') => SettingsSource;
  serverSyncError: string | null;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => SettingsRepository.getSettings());
  const [serverSyncError, setServerSyncError] = useState<string | null>(null);
  const [serverSettings, setServerSettings] = useState<Partial<AppSettings>>({});

  useEffect(() => {
    const syncServerSettings = async () => {
      try {
        const nextServerSettings = await SettingsRepository.getServerSettings();
        setServerSettings(nextServerSettings);
        setSettings((prev) => {
          const merged = { ...prev, ...nextServerSettings };
          SettingsRepository.saveSettings(merged);
          return merged;
        });
        setServerSyncError(null);
      } catch (error) {
        console.warn('Server settings unavailable, using env/local fallback.', error);
        setServerSyncError('No se pudieron sincronizar los ajustes de servidor.');
      }
    };

    void syncServerSettings();
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const saveSettings = useCallback(
    async (nextSettings?: Partial<AppSettings>) => {
      const merged = { ...settings, ...(nextSettings || {}) };
      SettingsRepository.saveSettings(merged);

      try {
        await SettingsRepository.saveServerSettings(merged);
        const latestServerSettings = await SettingsRepository.getServerSettings();
        setServerSettings(latestServerSettings);
        setServerSyncError(null);
        setSettings(merged);
        return true;
      } catch (error) {
        console.warn('Failed to save server settings; local copy was saved.', error);
        setServerSyncError('No se pudo guardar en servidor. Se mantuvo copia local.');
        setSettings(merged);
        return false;
      }
    },
    [settings],
  );

  const getApiKey = useCallback(
    (provider: 'openai' | 'gemini' | 'mistral') => {
      return SettingsRepository.resolveApiKey(provider, settings, serverSettings);
    },
    [settings, serverSettings],
  );

  const getApiKeySource = useCallback(
    (provider: 'openai' | 'gemini' | 'mistral') => {
      return SettingsRepository.resolveApiKeySource(provider, settings, serverSettings);
    },
    [settings, serverSettings],
  );

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      saveSettings,
      getApiKey,
      getApiKeySource,
      serverSyncError,
    }),
    [settings, updateSettings, saveSettings, getApiKey, getApiKeySource, serverSyncError],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
