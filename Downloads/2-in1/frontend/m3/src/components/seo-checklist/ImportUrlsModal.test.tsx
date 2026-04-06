import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ImportUrlsModal } from './ImportUrlsModal';
import { SeoPage } from '../../types/seoChecklist';

vi.mock('lucide-react', () => ({
  X: () => <span>X</span>,
  Clipboard: () => <span>Clipboard</span>,
  Upload: () => <span>Upload</span>,
}));

vi.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    settings: {
      brandTerms: [],
    },
  }),
}));

const existingPages: SeoPage[] = [];

describe('ImportUrlsModal', () => {
  it('importa líneas con solo URL y deja kwPrincipal vacía', () => {
    const onImport = vi.fn();

    render(
      <ImportUrlsModal isOpen={true} onClose={vi.fn()} onImport={onImport} existingPages={existingPages} />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'https://example.com/solo-url' },
    });

    fireEvent.click(screen.getByRole('button', { name: /importar urls/i }));

    expect(onImport).toHaveBeenCalledTimes(1);
    const importedPages = onImport.mock.calls[0][0] as SeoPage[];

    expect(importedPages).toHaveLength(1);
    expect(importedPages[0].url).toBe('https://example.com/solo-url');
    expect(importedPages[0].kwPrincipal).toBe('');
    expect(importedPages[0].isBrandKeyword).toBe(false);
  });

  it('muestra resumen de descartes por fila (vacía, inválida, duplicada)', () => {
    const onImport = vi.fn();

    render(
      <ImportUrlsModal
        isOpen={true}
        onClose={vi.fn()}
        onImport={onImport}
        existingPages={[{ ...buildPage('https://example.com/duplicada') }]}
      />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '\nhttp://\nhttps://example.com/duplicada',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /importar urls/i }));

    expect(screen.getByText('Resumen de importación')).toBeDefined();
    expect(screen.getByText(/Filas vacías:\s*1/)).toBeDefined();
    expect(screen.getByText(/URL inválida:\s*1/)).toBeDefined();
    expect(screen.getByText(/URL duplicada:\s*1/)).toBeDefined();
    expect(onImport).not.toHaveBeenCalled();
  });
});

function buildPage(url: string): SeoPage {
  return {
    id: 'existing-1',
    url,
    kwPrincipal: 'kw',
    pageType: 'Article',
    checklist: {} as SeoPage['checklist'],
  };
}
