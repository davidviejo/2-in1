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
    ReferenceLine: () => <div />,
    Legend: () => <div />,
  };
});

vi.mock('../components/ui/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
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
    queryPageData: [
      {
        keys: ['seo test', 'https://example.com/seo-test'],
        position: 3.2,
        clicks: 42,
        impressions: 180,
        ctr: 0.23,
      },
    ],
    comparisonQueryPageData: [],
    pageDateData: [],
    comparisonPeriod: null,
    isLoadingGsc: false,
    syncProgress: {
      completedSteps: 0,
      totalSteps: 0,
      currentStepLabel: '',
      startedAt: null,
      analysis: {
        status: 'idle',
        currentChunk: 0,
        totalChunks: 0,
        percentage: 0,
        label: '',
      },
    },
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


vi.mock('../context/ProjectContext', () => ({
  useProject: () => ({
    currentClient: {
      id: 'c1',
      brandTerms: [],
      projectType: 'MEDIA',
      sector: 'Otro',
      geoScope: 'global',
    },
    updateCurrentClientProfile: vi.fn(),
    addTask: vi.fn(),
    projectScoreContext: null,
    saveClientSnapshot: vi.fn(),
  }),
}));


vi.mock('../hooks/useSeoInsightState', () => ({
  useSeoInsightState: () => ({
    entries: [],
    getInsightStatus: () => 'new',
    setInsightStatus: vi.fn(),
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
