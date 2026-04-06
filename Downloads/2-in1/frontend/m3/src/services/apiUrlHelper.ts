const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const getWindowLocation = (): Location | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.location;
};

const normalizeConfiguredUrl = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimTrailingSlash(trimmed) : null;
};

const buildLocalBackendUrl = (port: string): string => {
  const location = getWindowLocation();
  const protocol = location?.protocol === 'https:' ? 'https:' : 'http:';
  const hostname = location?.hostname || '127.0.0.1';

  return `${protocol}//${hostname}:${port}`;
};

export const resolveApiUrl = (): string => {
  const configured = normalizeConfiguredUrl(import.meta.env.VITE_API_URL);
  if (configured) {
    return configured;
  }

  return buildLocalBackendUrl(import.meta.env.VITE_API_PORT || '5000');
};

export const resolveEngineUrl = (): string => {
  const configured = normalizeConfiguredUrl(import.meta.env.VITE_PYTHON_ENGINE_URL);
  if (configured) {
    return configured;
  }

  return resolveApiUrl();
};
