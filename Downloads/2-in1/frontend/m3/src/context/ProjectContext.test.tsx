import React, { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { ProjectProvider, useProject } from './ProjectContext';
import { vi, test, expect } from 'vitest';

// Mock dependencies
vi.mock('../services/clientRepository', () => ({
  ClientRepository: {
    getClients: vi.fn().mockReturnValue([]),
    getGeneralNotes: vi.fn().mockReturnValue([]),
    getCurrentClientId: vi.fn().mockReturnValue(''),
    saveClients: vi.fn(),
    saveCurrentClientId: vi.fn(),
    saveGeneralNotes: vi.fn(),
  },
}));

vi.mock('../strategies/StrategyFactory', () => ({
  StrategyFactory: {
    getStrategy: vi.fn(),
  },
}));

const onRenderMock = vi.fn();

// A memoized consumer. It should only re-render if props change (none here) OR context changes.
const ConsumerComponent = React.memo(() => {
  const context = useProject(); // Consuming context
  onRenderMock(context);
  return <div>Consumer</div>;
});

const ParentComponent = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Force Render {count}</button>
      <ProjectProvider>
        <ConsumerComponent />
      </ProjectProvider>
    </div>
  );
};

test('ProjectContext value stability', async () => {
  render(<ParentComponent />);

  // Initial render
  expect(onRenderMock).toHaveBeenCalledTimes(1);

  // Force re-render of ParentComponent.
  // This causes ProjectProvider to re-render.
  // Because ConsumerComponent is memoized and has no props, it should NOT re-render
  // UNLESS the context value provided by ProjectProvider has changed reference.
  const button = screen.getByText(/Force Render/);
  await act(async () => {
    button.click();
  });

  // Since we have optimized ProjectContext with useMemo, the context value should be stable.
  // The consumer should NOT re-render.
  expect(onRenderMock).toHaveBeenCalledTimes(1);
});


ConsumerComponent.displayName = 'ConsumerComponent';
