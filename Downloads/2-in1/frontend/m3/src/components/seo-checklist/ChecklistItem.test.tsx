import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChecklistItem } from './ChecklistItem';
import { describe, it, expect, vi } from 'vitest';
import { ChecklistItem as IChecklistItem } from '../../types/seoChecklist';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ChevronRight: () => <span>ChevronRight</span>,
  Info: () => <span>Info</span>,
  BrainCircuit: () => <span>BrainCircuit</span>,
  Map: () => <span>Map</span>,
  Store: () => <span>Store</span>,
  CheckCircle2: () => <span>CheckCircle2</span>,
  XCircle: () => <span>XCircle</span>,
  Image: () => <span>Image</span>,
  LocateFixed: () => <span>LocateFixed</span>,
  AlertTriangle: () => <span>AlertTriangle</span>,
  List: () => <span>List</span>,
  FileText: () => <span>FileText</span>,
  Target: () => <span>Target</span>,
  Search: () => <span>Search</span>,
  LayoutList: () => <span>LayoutList</span>,
  Code: () => <span>Code</span>,
  Copy: () => <span>Copy</span>,
  Link: () => <span>Link</span>,
  ExternalLink: () => <span>ExternalLink</span>,
  ChevronDown: () => <span>ChevronDown</span>,
  ChevronUp: () => <span>ChevronUp</span>,
  Type: () => <span>Type</span>,
  Check: () => <span>Check</span>,
  X: () => <span>X</span>,
}));

// Mock InternalLinksAnalysis
vi.mock('./InternalLinksAnalysis', () => ({
  InternalLinksAnalysis: () => (
    <div data-testid="internal-links-analysis">Internal Links Analysis</div>
  ),
}));

describe('ChecklistItem', () => {
  it('renders correctly with advanced content', () => {
    const item: IChecklistItem = {
      key: 'CONTENIDOS',
      label: '4. Contenidos',
      status_manual: 'NO',
      notes_manual: '',
      autoData: {
        competitorUrlsUsed: ['http://comp1.com'],
        gapSections: ['Section 1'],
        outlines: { h1: 'Title' },
      },
    };
    const onChange = vi.fn();
    render(<ChecklistItem item={item} onChange={onChange} />);

    // Click to expand
    fireEvent.click(screen.getByText('4. Contenidos'));

    expect(screen.getByText('http://comp1.com')).toBeDefined();
    expect(screen.getByText('Section 1')).toBeDefined();
    expect(screen.getByText('Outlines Sugeridos')).toBeDefined();
  });

  it('shows advanced warning', () => {
    const item: IChecklistItem = {
      key: 'CONTENIDOS',
      label: '4. Contenidos',
      status_manual: 'NO',
      notes_manual: '',
      autoData: {
        advancedExecuted: false,
        advancedBlockedReason: 'No credits',
      },
    };
    const onChange = vi.fn();
    render(<ChecklistItem item={item} onChange={onChange} />);

    fireEvent.click(screen.getByText('4. Contenidos'));

    expect(screen.getByText('Análisis Avanzado Deshabilitado')).toBeDefined();
    expect(screen.getByText('No credits')).toBeDefined();
  });

  it('renders structured data with robust JSON viewer', () => {
    const item: IChecklistItem = {
      key: 'DATOS_ESTRUCTURADOS',
      label: '3. Datos estructurados',
      status_manual: 'SI',
      notes_manual: '',
      autoData: {
        schemasParsed: ['Article'],
        jsonLd: { '@context': 'https://schema.org', '@type': 'Article' },
      },
    };
    const onChange = vi.fn();
    render(<ChecklistItem item={item} onChange={onChange} />);

    fireEvent.click(screen.getByText('3. Datos estructurados'));

    expect(screen.getByText('Article')).toBeDefined(); // Tag
    expect(screen.getByText('Bruto del Análisis')).toBeDefined();
    // Since JSON.stringify formats with newlines, exact text match might be tricky, but we can check if it contains parts
    // Or just that the component rendered without error.
  });

  it('renders IA labels in status selector', () => {
    const item: IChecklistItem = {
      key: 'CLUSTER',
      label: '1. Cluster',
      status_manual: 'SI_IA',
      notes_manual: '',
    };
    const onChange = vi.fn();
    render(<ChecklistItem item={item} onChange={onChange} />);

    expect(screen.getByDisplayValue('Si (IA)')).toBeDefined();
    expect(screen.getByRole('option', { name: 'Error claro (IA)' })).toBeDefined();
  });

  it('calls onChange when selecting an IA status', () => {
    const item: IChecklistItem = {
      key: 'CLUSTER',
      label: '1. Cluster',
      status_manual: 'NO',
      notes_manual: '',
    };
    const onChange = vi.fn();
    render(<ChecklistItem item={item} onChange={onChange} />);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'SI_IA' } });

    expect(onChange).toHaveBeenCalledWith({ status_manual: 'SI_IA' });
  });

  it('shows AI decision reason and timestamp when evaluation metadata is present', () => {
    const item: IChecklistItem = {
      key: 'SNIPPETS',
      label: '5. Snippets',
      status_manual: 'SI_IA',
      notes_manual: '',
      evaluationMeta: {
        evaluatedBy: 'ai',
        provider: 'openai',
        model: 'gpt-4o-mini',
        evaluatedAt: new Date('2026-01-10T14:30:00Z').getTime(),
        reason: 'Title y description cumplen longitud y relevancia.',
      },
    };

    render(<ChecklistItem item={item} onChange={vi.fn()} />);
    fireEvent.click(screen.getByText('5. Snippets'));

    expect(screen.getByText('Última decisión IA')).toBeDefined();
    expect(screen.getByText('Title y description cumplen longitud y relevancia.')).toBeDefined();
  });
});
