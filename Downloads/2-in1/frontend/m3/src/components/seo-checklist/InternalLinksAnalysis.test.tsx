import React from 'react';
import { render, screen } from '@testing-library/react';
import { InternalLinksAnalysis, InternalLinkData } from './InternalLinksAnalysis';
import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Link: () => <span>Link</span>,
  ExternalLink: () => <span>ExternalLink</span>,
  ChevronDown: () => <span>ChevronDown</span>,
  ChevronUp: () => <span>ChevronUp</span>,
  Type: () => <span>Type</span>,
  Check: () => <span>Check</span>,
  X: () => <span>X</span>,
}));

describe('InternalLinksAnalysis', () => {
  it('renders links correctly', () => {
    const links: InternalLinkData[] = [
      { anchor: 'Home', url_to: '/home', type: 'dofollow', target_blank: true },
      { anchor: 'About', url_to: '/about', type: 'nofollow' },
    ];
    render(<InternalLinksAnalysis internal_links={links} />);

    const homeElements = screen.getAllByText('Home');
    expect(homeElements.length).toBeGreaterThan(0);

    const urlElements = screen.getAllByText('/home');
    expect(urlElements.length).toBeGreaterThan(0);

    const dofollowElements = screen.getAllByText('dofollow');
    expect(dofollowElements.length).toBeGreaterThan(0);
  });

  it('shows top anchors', () => {
    const links: InternalLinkData[] = [
      { anchor: 'Home', url_to: '/home', type: 'dofollow' },
      { anchor: 'Home', url_to: '/home2', type: 'dofollow' },
      { anchor: 'About', url_to: '/about', type: 'dofollow' },
    ];
    render(<InternalLinksAnalysis internal_links={links} />);

    const homeElements = screen.getAllByText('Home');
    expect(homeElements.length).toBeGreaterThan(0);

    // Expecting count '2' for Home in the Top Anchors section
    // '2' might appear elsewhere if we are unlucky, but likely only in the count badge or summary
    const count2 = screen.getAllByText('2');
    expect(count2.length).toBeGreaterThan(0);
  });
});
