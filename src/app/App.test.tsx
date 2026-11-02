import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';
import type { AvatarConfiguration } from '../features/avatar/AvatarCustomizer';
import type { AppearanceCatalogue } from '../features/avatar/avatar-appearance';

const confirmed = vi.hoisted(() => ({
  configuration: { nickname: 'Sol', body: 'female' },
  catalogue: { marker: 'catalogue' },
}));
vi.mock('../features/avatar/AvatarEntry', () => ({
  AvatarEntry: ({ onConfirm }: { onConfirm(configuration: unknown, catalogue: unknown): void }) =>
    <button onClick={() => onConfirm(confirmed.configuration, confirmed.catalogue)}>Confirm local draft</button>,
}));
vi.mock('../features/world/ReceptionPreview', () => ({
  ReceptionPreview: (props: { configuration?: AvatarConfiguration; catalogue?: AppearanceCatalogue }) =>
    <p data-testid="reception">{JSON.stringify([props.configuration, props.catalogue])}</p>,
}));
afterEach(() => window.history.replaceState(null, '', '/'));

it.each(['/', '/wardrobe'])('starts in the wardrobe at %s, without the old link bar or draft note', path => {
  window.history.replaceState(null, '', path);
  render(<App />);
  expect(screen.getByRole('button', { name: 'Confirm local draft' })).toBeDefined();
  expect(screen.queryByTestId('reception')).toBeNull();
  expect(screen.queryByRole('navigation')).toBeNull();
  expect(screen.queryByRole('link')).toBeNull();
  expect(screen.queryByRole('note')).toBeNull();
  expect(screen.queryByText(/solo en este navegador/i)).toBeNull();
});
it('enters reception with the confirmed configuration and catalogue, and reopens the wardrobe from a styled button', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm local draft' }));
  expect(screen.getByTestId('reception').textContent).toBe(JSON.stringify([confirmed.configuration, confirmed.catalogue]));
  expect(screen.queryByRole('alert')).toBeNull();
  const reopen = screen.getByRole('button', { name: 'Vestidor' });
  expect(reopen.className).toBe('reception-wardrobe-button');
  expect(screen.queryByRole('link')).toBeNull();
  fireEvent.click(reopen);
  expect(screen.queryByTestId('reception')).toBeNull();
  expect(screen.getByRole('button', { name: 'Confirm local draft' })).toBeDefined();
});
