import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Dashboard from './Dashboard';

vi.mock('recharts', () => {
  const MockChart = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    BarChart: MockChart,
    Bar: MockChart,
    XAxis: () => <div />,
    YAxis: () => <div />,
    Tooltip: () => <div />,
    Cell: () => <div />,
    CartesianGrid: () => <div />,
    RadarChart: MockChart,
    PolarGrid: () => <div />,
    PolarAngleAxis: () => <div />,
    PolarRadiusAxis: () => <div />,
    Radar: () => <div />,
    AreaChart: MockChart,
    Area: () => <div />,
  };
});

vi.mock('../components/ui/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../hooks/useGSCAuth', () => ({
  useGSCAuth: () => ({
    gscAccessToken: null,
    googleUser: null,
    clientId: '',
    showGscConfig: false,
    setShowGscConfig: vi.fn(),
    handleSaveClientId: vi.fn(),
    handleLogoutGsc: vi.fn(),
    login: vi.fn(),
    setClientId: vi.fn(),
  }),
}));

vi.mock('../hooks/useGSCData', () => ({
  useGSCData: () => ({
    gscSites: [],
    selectedSite: '',
    setSelectedSite: vi.fn(),
    gscData: [],
    comparisonGscData: [],
    comparisonPeriod: null,
    isLoadingGsc: false,
    insights: {
      insights: [],
      groupedInsights: [],
      topQueries: {
        items: [
          {
            keys: ['seo test'],
            position: 3.2,
            clicks: 42,
          },
        ],
      },
    },
  }),
}));

vi.mock('../hooks/useSeoIgnoredItems', () => ({
  buildIgnoredEntryKey: vi.fn(),
  useSeoIgnoredItems: () => ({
    entries: [],
    isIgnored: () => false,
    ignoreRow: vi.fn(),
    unignoreKey: vi.fn(),
    importEntries: vi.fn(() => 0),
  }),
}));

describe('Dashboard', () => {
  it('renders top queries without crashing when topQueries data is available', () => {
    render(
      <MemoryRouter>
        <Dashboard modules={[]} globalScore={0} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Top Consultas')).toBeTruthy();
    expect(screen.getByText('seo test')).toBeTruthy();
  });
});
