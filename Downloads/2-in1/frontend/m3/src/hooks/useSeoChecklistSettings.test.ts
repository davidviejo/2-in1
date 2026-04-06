import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSeoChecklistSettings } from './useSeoChecklistSettings';

const mockUseProject = vi.fn();

vi.mock('../context/ProjectContext', () => ({
  useProject: () => mockUseProject(),
}));

describe('useSeoChecklistSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockUseProject.mockReturnValue({ currentClientId: 'client-a' });
  });

  it('reflects global settings updates when useGlobalDataforseo is enabled', () => {
    localStorage.setItem(
      'mediaflow_app_settings',
      JSON.stringify({
        dataforseoLogin: 'global-login-v1',
        dataforseoPassword: 'global-pass-v1',
      }),
    );

    const { result, rerender } = renderHook(() => useSeoChecklistSettings());

    expect(result.current.settings.serp.useGlobalDataforseo).toBe(true);
    expect(result.current.settings.serp.dataforseoLogin).toBe('global-login-v1');

    localStorage.setItem(
      'mediaflow_app_settings',
      JSON.stringify({
        dataforseoLogin: 'global-login-v2',
        dataforseoPassword: 'global-pass-v2',
      }),
    );

    mockUseProject.mockReturnValue({ currentClientId: 'client-b' });
    rerender();

    expect(result.current.settings.serp.dataforseoLogin).toBe('global-login-v2');
    expect(result.current.settings.serp.dataforseoPassword).toBe('global-pass-v2');
  });

  it('keeps local override when useGlobalDataforseo is disabled', () => {
    localStorage.setItem(
      'mediaflow_app_settings',
      JSON.stringify({
        dataforseoLogin: 'global-login',
        dataforseoPassword: 'global-pass',
      }),
    );

    const { result } = renderHook(() => useSeoChecklistSettings());

    act(() => {
      result.current.updateSettings({
        serp: {
          useGlobalDataforseo: false,
          dataforseoLogin: 'local-login',
          dataforseoPassword: 'local-pass',
        },
      } as any);
    });

    expect(result.current.settings.serp.useGlobalDataforseo).toBe(false);
    expect(result.current.settings.serp.dataforseoLogin).toBe('local-login');

    localStorage.setItem(
      'mediaflow_app_settings',
      JSON.stringify({
        dataforseoLogin: 'global-login-new',
        dataforseoPassword: 'global-pass-new',
      }),
    );

    act(() => {
      result.current.updateSettings({ serp: { enabled: true } as any });
    });

    expect(result.current.settings.serp.dataforseoLogin).toBe('local-login');
    expect(result.current.settings.serp.dataforseoPassword).toBe('local-pass');
  });

  it('migrates old schema by treating stored credentials as local override', () => {
    localStorage.setItem(
      'mediaflow_app_settings',
      JSON.stringify({
        dataforseoLogin: 'global-login',
        dataforseoPassword: 'global-pass',
      }),
    );

    localStorage.setItem(
      'mediaflow_seo_settings_client-a',
      JSON.stringify({
        serp: {
          dataforseoLogin: 'legacy-local-login',
          dataforseoPassword: 'legacy-local-pass',
        },
      }),
    );

    const { result } = renderHook(() => useSeoChecklistSettings());

    expect(result.current.settings.serp.useGlobalDataforseo).toBe(false);
    expect(result.current.settings.serp.dataforseoLogin).toBe('legacy-local-login');
    expect(result.current.settings.serp.dataforseoPassword).toBe('legacy-local-pass');
  });
});
