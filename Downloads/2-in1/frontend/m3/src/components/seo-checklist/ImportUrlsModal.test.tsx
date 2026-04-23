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
      expect(onImport).toHaveBeenCalledTimes(3);
    });
    const totalImported = onImport.mock.calls.reduce(
      (acc, [chunk]) => acc + ((chunk as unknown[]).length || 0),
      0,
    );
    expect(totalImported).toBe(1200);
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

  it('acepta columnas separadas por múltiples espacios cuando no llegan tabuladores', async () => {
    const onImport = vi.fn();

    render(
      <ImportUrlsModal isOpen onClose={vi.fn()} onImport={onImport} existingPages={[]} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: {
        value: 'https://www.rafibra.es/  reparación de depósitos de gasolina  Página  Español  -',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    const importedPages = onImport.mock.calls[0][0];
    expect(importedPages[0].url).toBe('https://www.rafibra.es/');
    expect(importedPages[0].kwPrincipal).toBe('reparación de depósitos de gasolina');
    expect(importedPages[0].pageType).toBe('Página');
    expect(importedPages[0].geoTarget).toBe('Español');
    expect(importedPages[0].cluster).toBe('-');
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
      expect(onImport).toHaveBeenCalledTimes(20);
    });
    const totalImported = onImport.mock.calls.reduce(
      (acc, [chunk]) => acc + ((chunk as unknown[]).length || 0),
      0,
    );
    expect(totalImported).toBe(10000);
  });

  it('distingue duplicadas ya existentes de duplicadas dentro del propio import', async () => {
    const onImport = vi.fn();

    render(
      <ImportUrlsModal
        isOpen
        onClose={vi.fn()}
        onImport={onImport}
        existingPages={[
          {
            id: 'existing-1',
            url: 'https://example.com/existing',
            kwPrincipal: '',
            pageType: 'Article',
            geoTarget: '',
            cluster: '',
            checklist: {} as any,
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: {
        value: [
          'https://example.com/existing',
          'https://example.com/new-one',
          'https://example.com/new-one',
        ].join('\n'),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    expect(onImport.mock.calls[0][0]).toHaveLength(1);
    expect(onImport.mock.calls[0][0][0].url).toBe('https://example.com/new-one');
    expect(screen.getByText(/URL ya existente en checklist: 1/i)).toBeTruthy();
    expect(screen.getByText(/URL duplicada dentro de este mismo import: 1/i)).toBeTruthy();
  });

  it('omite fila de encabezado y no importa pseudo-URLs inválidas', async () => {
    const onImport = vi.fn();

    render(
      <ImportUrlsModal isOpen onClose={vi.fn()} onImport={onImport} existingPages={[]} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: {
        value: [
          'URL\tKeyword Principal\tTipo Página\tGeo (Opcional)\tCluster (Opcional)',
          'pccomponentes\t-\t-\tES\t-',
          'https://www.pccomponentes.com/\tpccomponentes\t-\tES\t-',
        ].join('\n'),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    const importedPages = onImport.mock.calls[0][0];
    expect(importedPages).toHaveLength(1);
    expect(importedPages[0].url).toBe('https://www.pccomponentes.com/');
  });

  it('separa URLs concatenadas sin salto de línea al pegar desde hojas de cálculo', async () => {
    const onImport = vi.fn();

    render(
      <ImportUrlsModal isOpen onClose={vi.fn()} onImport={onImport} existingPages={[]} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example.com\/page1/i), {
      target: {
        value: [
          'https://www.pccomponentes.com/\tpccomponentes\t-\tES\t-',
          'https://www.pccomponentes.com/como-ver-anime-naruto-completo-sin-rellenohttps://www.pccomponentes.com/\tnaruto sin relleno\t-\tES\t-',
        ].join('\n'),
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Importar URLs' }));

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
    });

    const importedPages = onImport.mock.calls[0][0];
    expect(importedPages).toHaveLength(2);
    expect(importedPages[0].url).toBe('https://www.pccomponentes.com/');
    expect(importedPages[1].url).toBe(
      'https://www.pccomponentes.com/como-ver-anime-naruto-completo-sin-relleno',
    );
  });
});
