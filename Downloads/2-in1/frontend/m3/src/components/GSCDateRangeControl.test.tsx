import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GSCDateRangeControl } from './GSCDateRangeControl';

describe('GSCDateRangeControl', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a quick-range label when the period is recent', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));

    render(
      <GSCDateRangeControl
        startDate="2026-04-14"
        endDate="2026-04-21"
        onRangeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /últimos 7 días/i })).toBeTruthy();
  });

  it('shows "Personalizado" when the period is in the past even if the span is 7 days', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:00:00Z'));

    render(
      <GSCDateRangeControl
        startDate="2025-01-01"
        endDate="2025-01-08"
        onRangeChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /personalizado/i })).toBeTruthy();
  });
});
