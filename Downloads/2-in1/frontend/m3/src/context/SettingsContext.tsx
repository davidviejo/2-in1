import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { AppSettings, SettingsRepository } from '../services/settingsRepository';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  getApiKey: (provider: 'openai' | 'gemini' | 'mistral') => string | undefined;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(() => SettingsRepository.getSettings());

  useEffect(() => {
    SettingsRepository.saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const getApiKey = useCallback((provider: 'openai' | 'gemini' | 'mistral') => {
    return SettingsRepository.getApiKey(provider);
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, getApiKey }),
    [settings, updateSettings, getApiKey],
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
