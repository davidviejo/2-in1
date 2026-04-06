import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SeoChecklistDetail } from './SeoChecklistDetail';
import { SeoPage, ChecklistItem } from '../../types/seoChecklist';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="play-icon">Play</span>,
  Loader2: () => <span data-testid="loader-icon">Loader</span>,
  ArrowLeft: () => <span data-testid="arrow-left-icon">Back</span>,
  Pencil: () => <span data-testid="pencil-icon">Edit</span>,
  Check: () => <span data-testid="check-icon">Save</span>,
  X: () => <span data-testid="x-icon">Cancel</span>,
  ChevronDown: () => <span>Down</span>,
  ChevronUp: () => <span>Up</span>,
  AlertCircle: () => <span>Alert</span>,
  ExternalLink: () => <span>External</span>,
  Plus: () => <span data-testid="plus-icon">Add</span>,
  Trash2: () => <span data-testid="trash-icon">Delete</span>,
}));

// Mock ChecklistItem component to avoid deep rendering
vi.mock('./ChecklistItem', () => ({
  ChecklistItem: ({ item }: { item: ChecklistItem }) => (
    <div data-testid={`checklist-item-${item.key}`}>{item.label}</div>
  ),
}));


const mockSettings = {
  serp: {
    enabled: false,
    provider: 'dataforseo',
    maxKeywordsPerUrl: 10,
    maxCompetitorsPerKeyword: 3,
    dataforseoLogin: '',
    dataforseoPassword: '',
  },
  budgets: {
    maxUrlsPerBatch: 50,
    dailyBudget: 10,
    maxEstimatedCostPerBatch: 5,
  },
  competitorsMode: 'autoFromSerp' as const,
  brandTerms: [] as string[],
};

vi.mock('../../hooks/useSeoChecklistSettings', () => ({
  useSeoChecklistSettings: () => ({
    settings: mockSettings,
  }),
}));

// Mock analyzeUrl service
vi.mock('../../services/pythonEngineClient', () => ({
  analyzeUrl: vi.fn(),
}));

const mockPage: SeoPage = {
  id: 'page-1',
  url: 'https://example.com/test',
  kwPrincipal: 'test keyword',
  isBrandKeyword: false,
  pageType: 'Article',
  cluster: 'Test Cluster',
  checklist: {
    CLUSTER: { key: 'CLUSTER', label: 'Cluster', status_manual: 'SI', notes_manual: '' },
    // Add a few more keys to satisfy the component if it iterates all points,
    // but the mock ChecklistItem handles rendering.
    // However, SeoChecklistDetail iterates CHECKLIST_POINTS global constant.
    // We need to ensure page.checklist has keys for all points or handle missing ones?
    // The component assumes they exist.
    // Let's rely on type casting for the test mock or provide minimal necessary data.
  } as any,
};

// Ensure all checklist points are present in mockPage to avoid runtime errors during map
import { CHECKLIST_POINTS } from '../../types/seoChecklist';
CHECKLIST_POINTS.forEach((point) => {
  (mockPage.checklist as any)[point.key] = {
    key: point.key,
    label: point.label,
    status_manual: 'NA',
    notes_manual: '',
  };
});

describe('SeoChecklistDetail', () => {
  beforeEach(() => {
    mockSettings.brandTerms = [];
  });

  it('guarda como keyword de marca y sin kwPrincipal cuando la keyword incluye marca', () => {
    const onUpdatePage = vi.fn();
    mockSettings.brandTerms = ['acme'];

    render(
      <SeoChecklistDetail
        page={mockPage}
        onUpdatePage={onUpdatePage}
        onUpdateChecklistItem={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('Editar detalles'));
    fireEvent.change(screen.getByDisplayValue('test keyword'), {
      target: { value: 'mejor producto ACME 2026' },
    });
    fireEvent.click(screen.getByTitle('Guardar cambios'));

    expect(onUpdatePage).toHaveBeenCalledWith('page-1', {
      url: 'https://example.com/test',
      kwPrincipal: '',
      isBrandKeyword: true,
      pageType: 'Article',
      cluster: 'Test Cluster',
      competitors: [],
    });

  });

  it('renders correctly in view mode', () => {
    render(
      <SeoChecklistDetail
        page={mockPage}
        onUpdatePage={vi.fn()}
        onUpdateChecklistItem={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText('https://example.com/test')).toBeDefined();
    expect(screen.getByText('test keyword')).toBeDefined();
    expect(screen.getByText('Article')).toBeDefined();
    expect(screen.getByTestId('pencil-icon')).toBeDefined();
  });

  it('switches to edit mode and saves changes', () => {
    const onUpdatePage = vi.fn();
    render(
      <SeoChecklistDetail
        page={mockPage}
        onUpdatePage={onUpdatePage}
        onUpdateChecklistItem={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    // Click edit button
    fireEvent.click(screen.getByTitle('Editar detalles'));

    // Check inputs are present
    const urlInput = screen.getByDisplayValue('https://example.com/test');
    const kwInput = screen.getByDisplayValue('test keyword');
    const typeInput = screen.getByDisplayValue('Article');
    const clusterInput = screen.getByDisplayValue('Test Cluster');

    expect(urlInput).toBeDefined();
    expect(kwInput).toBeDefined();
    expect(typeInput).toBeDefined();
    expect(clusterInput).toBeDefined();

    // Modify values
    fireEvent.change(kwInput, { target: { value: 'new keyword' } });
    fireEvent.change(typeInput, { target: { value: 'Product' } });

    // Click save
    fireEvent.click(screen.getByTitle('Guardar cambios'));

    // Check onUpdatePage was called with new values
    expect(onUpdatePage).toHaveBeenCalledWith('page-1', {
      url: 'https://example.com/test',
      kwPrincipal: 'new keyword',
      isBrandKeyword: false,
      pageType: 'Product',
      cluster: 'Test Cluster',
      competitors: [],
    });

    // Check it went back to view mode (inputs gone)
    expect(screen.queryByDisplayValue('new keyword')).toBeNull();
  });

  it('switches to edit mode and cancels changes', () => {
    const onUpdatePage = vi.fn();
    render(
      <SeoChecklistDetail
        page={mockPage}
        onUpdatePage={onUpdatePage}
        onUpdateChecklistItem={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    // Click edit button
    fireEvent.click(screen.getByTitle('Editar detalles'));

    // Modify values
    const kwInput = screen.getByDisplayValue('test keyword');
    fireEvent.change(kwInput, { target: { value: 'cancelled keyword' } });

    // Click cancel
    fireEvent.click(screen.getByTitle('Cancelar'));

    // Check onUpdatePage was NOT called
    expect(onUpdatePage).not.toHaveBeenCalled();

    // Check it went back to view mode and original value is displayed
    expect(screen.getByText('test keyword')).toBeDefined();
  });

  it('permite excluir la kw principal cuando es una keyword de marca', () => {
    const onUpdatePage = vi.fn();
    render(
      <SeoChecklistDetail
        page={mockPage}
        onUpdatePage={onUpdatePage}
        onUpdateChecklistItem={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('Editar detalles'));

    const brandToggle = screen.getByLabelText(
      'Excluir asignación de KW principal porque es una keyword de marca',
    );
    fireEvent.click(brandToggle);
    fireEvent.click(screen.getByTitle('Guardar cambios'));

    expect(onUpdatePage).toHaveBeenCalledWith('page-1', {
      url: 'https://example.com/test',
      kwPrincipal: '',
      isBrandKeyword: true,
      pageType: 'Article',
      cluster: 'Test Cluster',
      competitors: [],
    });
  });
});
