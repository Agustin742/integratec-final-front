import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { App } from './App';
vi.mock('../features/avatar/AvatarPreview', () => ({ AvatarPreview: () => <p>Original calibration canvas</p> }));
vi.mock('../features/world/ReceptionPreview', () => ({ ReceptionPreview: () => <p>Reception canvas</p> }));
it('defaults to the honest local study and explicitly switches to the preserved calibration without duplicate canvases', () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/local navigation and interaction study/i);
  expect(screen.getByText('Reception canvas')).toBeDefined(); expect(screen.queryByText('Original calibration canvas')).toBeNull();
  expect(screen.getByText(/Local object interactions only/i)).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: /Avatar calibration/ }));
  expect(screen.getByText('Original calibration canvas')).toBeDefined(); expect(screen.queryByText('Reception canvas')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Reception navigation/ }));
  expect(screen.getByText('Reception canvas')).toBeDefined(); expect(screen.queryByText('Original calibration canvas')).toBeNull();
});
