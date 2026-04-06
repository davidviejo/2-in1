import React, { useState } from 'react';
import { render, screen, act } from '@testing-library/react';
import { SettingsProvider, useSettings } from './SettingsContext';
import { vi, describe, it, expect } from 'vitest';

// Mock dependencies
vi.mock('../services/settingsRepository', () => ({
  SettingsRepository: {
    getSettings: vi.fn().mockReturnValue({}),
    saveSettings: vi.fn(),
    getApiKey: vi.fn(),
  },
}));

const onRenderMock = vi.fn();

const ConsumerComponent = React.memo(() => {
  useSettings(); // consume context
  onRenderMock();
  return <div>Consumer</div>;
});

const ParentComponent = () => {
  const [count, setCount] = useState(0);
  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Force Render</button>
      <SettingsProvider>
        <ConsumerComponent />
      </SettingsProvider>
    </div>
  );
};

describe('SettingsContext Performance', () => {
  it('should not re-render consumers when provider re-renders with same value', async () => {
    render(<ParentComponent />);

    // Initial render
    expect(onRenderMock).toHaveBeenCalledTimes(1);

    // Force re-render of ParentComponent.
    // This causes SettingsProvider to re-render.
    // Because ConsumerComponent is memoized and has no props, it should NOT re-render
    // UNLESS the context value provided by SettingsProvider has changed reference.
    const button = screen.getByText(/Force Render/);
    await act(async () => {
      button.click();
    });

    // Should remain 1 because context value hasn't changed
    expect(onRenderMock).toHaveBeenCalledTimes(1);
  });
});


ConsumerComponent.displayName = 'ConsumerComponent';
