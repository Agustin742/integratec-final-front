import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';
vi.mock('../features/avatar/AvatarPreview', () => ({ AvatarPreview: () => <p>Original calibration canvas</p> }));
vi.mock('../features/avatar/AvatarEntry', () => ({ AvatarEntry: ({ onConfirm }: { onConfirm(): void }) => <button onClick={() => onConfirm()}>Confirm local draft</button> }));
vi.mock('../features/world/ReceptionPreview', () => ({ ReceptionPreview: () => <p>Reception canvas</p> }));
afterEach(() => window.history.replaceState(null, '', '/'));
it('keeps reception as the default and opens the original wardrobe at its discoverable route', () => {
  render(<App />);
  expect(screen.getByText('Reception canvas')).toBeDefined();
  fireEvent.click(screen.getByRole('link', { name: 'Vestidor' }));
  expect(window.location.pathname).toBe('/wardrobe');
  expect(screen.queryByText('Reception canvas')).toBeNull();
  expect(screen.getByRole('button', { name: 'Confirm local draft' })).toBeDefined();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm local draft' }));
  expect(window.location.pathname).toBe('/');
  expect(screen.getByText('Reception canvas')).toBeDefined();
});
it('supports direct wardrobe entry, browser history and returning without confirmation', () => {
  window.history.replaceState(null, '', '/wardrobe');
  render(<App />);
  expect(screen.getByText(/solo en este navegador/i)).toBeDefined();
  fireEvent.click(screen.getByRole('link', { name: 'Volver a recepción' }));
  expect(screen.getByText('Reception canvas')).toBeDefined();
  window.history.replaceState(null, '', '/wardrobe');
  fireEvent.popState(window);
  expect(screen.getByRole('button', { name: 'Confirm local draft' })).toBeDefined();
});
