import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ToolsHub from './ToolsHub';
import { api } from '../services/api';

vi.mock('../services/api', () => ({
  api: {
    getToolsCatalog: vi.fn(),
    getLauncherCatalog: vi.fn(),
    launcherStatus: vi.fn(),
    launcherInstall: vi.fn(),
    launcherStart: vi.fn(),
    launcherStop: vi.fn(),
    launcherLogs: vi.fn(),
  },
}));

const appFixture = {
  id: 'app-1',
  name: 'App Uno',
  description: 'Descripción app',
  path: '/app-uno',
  section: 'frontend' as const,
  status: 'migrada' as const,
  runtime: {
    enabled: true,
    requires_credentials: false,
    degraded: false,
  },
};

describe('ToolsHub launcher panel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(api.getToolsCatalog).mockResolvedValue({ tools: [] });
    vi.mocked(api.getLauncherCatalog).mockResolvedValue({
      sections: [{ id: 'frontend', title: 'Frontend', description: 'Apps frontend' }],
      apps: [appFixture],
    });
    vi.mocked(api.launcherStatus).mockResolvedValue({ app_id: 'app-1', status: 'stopped', pid: null });
    vi.mocked(api.launcherInstall).mockResolvedValue({ app_id: 'app-1', status: 'stopped', action: 'install' });
    vi.mocked(api.launcherStart).mockResolvedValue({ app_id: 'app-1', status: 'running', action: 'start', pid: 4555 });
    vi.mocked(api.launcherStop).mockResolvedValue({ app_id: 'app-1', status: 'stopped', action: 'stop' });
    vi.mocked(api.launcherLogs).mockResolvedValue({ app_id: 'app-1', lines: ['linea-1', 'linea-2'] });
  });

  it('shows runtime status transition and polls every 5 seconds', async () => {
    let pollingCallback: (() => void | Promise<void>) | undefined;

    vi.spyOn(window, 'setInterval').mockImplementation(((cb: TimerHandler) => {
      pollingCallback = cb as () => void;
      return 1 as unknown as number;
    }) as typeof window.setInterval);

    render(<ToolsHub />);

    expect(await screen.findByText(/estado: stopped/i)).toBeTruthy();

    vi.mocked(api.launcherStatus).mockResolvedValueOnce({ app_id: 'app-1', status: 'running', pid: 3333 });
    await act(async () => {
      await pollingCallback?.();
    });

    await waitFor(() => {
      expect(screen.getByText(/estado: running/i)).toBeTruthy();
    });
    expect(screen.getByText(/PID: 3333/i)).toBeTruthy();

    expect(api.launcherStatus).toHaveBeenCalledTimes(2);
  });

  it('enables and disables action buttons based on runtime state', async () => {
    render(<ToolsHub />);

    const startButton = await screen.findByRole('button', { name: /^Iniciar$/i });
    const stopButton = screen.getByRole('button', { name: /^Parar$/i });

    expect(startButton.hasAttribute('disabled')).toBe(false);
    expect(stopButton.hasAttribute('disabled')).toBe(true);

    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/estado: running/i)).toBeTruthy();
    });
    expect(screen.getByText(/PID: 4555/i)).toBeTruthy();

    expect(screen.getByRole('button', { name: /^Iniciar$/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /^Parar$/i }).hasAttribute('disabled')).toBe(false);
  });

  it('shows per-app error messages when start/stop actions fail', async () => {
    vi.mocked(api.launcherStart).mockRejectedValueOnce(new Error('start failed'));

    render(<ToolsHub />);

    const startButton = await screen.findByRole('button', { name: /^Iniciar$/i });
    fireEvent.click(startButton);

    expect(await screen.findByText(/No se pudo ejecutar la acción start para la app./i)).toBeTruthy();

    vi.mocked(api.launcherStart).mockResolvedValueOnce({ app_id: 'app-1', status: 'running', action: 'start' });
    fireEvent.click(screen.getByRole('button', { name: /^Iniciar$/i }));
    await screen.findByText(/estado: running/i);

    vi.mocked(api.launcherStop).mockRejectedValueOnce(new Error('stop failed'));
    fireEvent.click(screen.getByRole('button', { name: /^Parar$/i }));

    expect(await screen.findByText(/No se pudo ejecutar la acción stop para la app./i)).toBeTruthy();
  });

  it('prevents start/install when app runtime is degraded', async () => {
    vi.mocked(api.getLauncherCatalog).mockResolvedValueOnce({
      sections: [{ id: 'frontend', title: 'Frontend', description: 'Apps frontend' }],
      apps: [
        {
          ...appFixture,
          runtime: {
            enabled: false,
            requires_credentials: false,
            degraded: true,
          },
        },
      ],
    });

    render(<ToolsHub />);

    await screen.findByText(/Runtime degradado/i);
    expect(screen.getByRole('button', { name: /^Iniciar$/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /^Instalar$/i }).hasAttribute('disabled')).toBe(true);
  });
});
