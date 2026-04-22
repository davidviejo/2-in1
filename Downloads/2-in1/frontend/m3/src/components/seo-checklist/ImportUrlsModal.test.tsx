import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ImportUrlsModal } from './ImportUrlsModal';

vi.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      brandTerms: [],
    },
  }),
}));

describe('ImportUrlsModal', () => {
  const originalCrypto = globalThis.crypto;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('importa URLs aunque randomUUID no esté disponible', async () => {
    const onImport = vi.fn();

    render(
      <ImportUrlsModal isOpen onClose={vi.fn()} onImport={onImport} existingPages={[]} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: { value: 'https://example.com/page-1\tkeyword uno' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });
    const importedPages = onImport.mock.calls[0][0];
    expect(importedPages).toHaveLength(1);
    expect(importedPages[0].id).toMatch(/^seo-page-/);
    expect(importedPages[0].url).toBe('https://example.com/page-1');
    expect(importedPages[0].kwPrincipal).toBe('keyword uno');
  });

  it('no crashea cuando hay URLs legacy inválidas en existingPages', async () => {
    const onImport = vi.fn();
    const malformedExistingPages = [{ id: '1', url: null } as any, { id: '2' } as any];

    render(
      <ImportUrlsModal
        isOpen
        onClose={vi.fn()}
        onImport={onImport}
        existingPages={malformedExistingPages}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: { value: 'https://example.com/page-2\tkeyword dos' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });
    expect(onImport.mock.calls[0][0]).toHaveLength(1);
    expect(onImport.mock.calls[0][0][0].url).toBe('https://example.com/page-2');
  });

  it('importa lotes grandes de URLs sin error', async () => {
    const onImport = vi.fn();
    const largeInput = Array.from({ length: 1200 }, (_, index) => {
      return `https://example.com/page-${index + 1}\tkw ${index + 1}`;
    }).join('\n');

    render(
      <ImportUrlsModal isOpen onClose={vi.fn()} onImport={onImport} existingPages={[]} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: { value: largeInput },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });
    expect(onImport.mock.calls[0][0]).toHaveLength(1200);
  });

  it('usa la URL nueva cuando recibe formato de migración "URL antigua | URL nueva"', async () => {
    const onImport = vi.fn();

    render(
      <ImportUrlsModal isOpen onClose={vi.fn()} onImport={onImport} existingPages={[]} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: {
        value:
          'https://example.com/url-antigua | https://example.com/url-nueva | keyword migrada | Product | ES | Cluster Migracion',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    const importedPages = onImport.mock.calls[0][0];
    expect(importedPages).toHaveLength(1);
    expect(importedPages[0].url).toBe('https://example.com/url-nueva');
    expect(importedPages[0].kwPrincipal).toBe('keyword migrada');
    expect(importedPages[0].pageType).toBe('Product');
    expect(importedPages[0].geoTarget).toBe('ES');
    expect(importedPages[0].cluster).toBe('Cluster Migracion');
  });

  it('acepta separador pipe para formato estándar sin migración', async () => {
    const onImport = vi.fn();

    render(
      <ImportUrlsModal isOpen onClose={vi.fn()} onImport={onImport} existingPages={[]} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: { value: 'https://example.com/page-pipe | keyword pipe | Article' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    const importedPages = onImport.mock.calls[0][0];
    expect(importedPages[0].url).toBe('https://example.com/page-pipe');
    expect(importedPages[0].kwPrincipal).toBe('keyword pipe');
    expect(importedPages[0].pageType).toBe('Article');
  });

  it('importa 10.000 URLs y muestra progreso asíncrono', async () => {
    const onImport = vi.fn();
    const largeInput = Array.from({ length: 10000 }, (_, index) => {
      return `https://example.com/page-${index + 1}\tkw ${index + 1}`;
    }).join('\n');

    render(
      <ImportUrlsModal isOpen onClose={vi.fn()} onImport={onImport} existingPages={[]} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: { value: largeInput },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    expect(screen.getByText(/Importando URLs/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Importando…' }).getAttribute('disabled')).not.toBeNull();

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });
    expect(onImport.mock.calls[0][0]).toHaveLength(10000);
  });
});
