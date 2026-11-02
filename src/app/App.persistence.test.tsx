import { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { appearancePreferenceKey } from '../features/avatar/avatar-preferences';

vi.mock('../features/avatar/CustomizedAvatarPreview', async importOriginal => ({
  ...await importOriginal<typeof import('../features/avatar/CustomizedAvatarPreview')>(),
  CustomizedAvatarPreview: ({ onStatusChange }: { onStatusChange(status: 'ready'): void }) => {
    useEffect(() => onStatusChange('ready'), [onStatusChange]);
    return <p>Ready preview</p>;
  },
}));
vi.mock('../features/world/ReceptionPreview', () => ({
  ReceptionPreview: () => <p>Reception canvas</p>,
}));
afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
});

it('retains local-save failure feedback after the real wardrobe confirms and unmounts', () => {
  window.localStorage.setItem('unrelated', 'keep');
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Synthetic storage failure', 'QuotaExceededError');
  });
  render(<App />);
  fireEvent.change(screen.getByRole('textbox', { name: /Apodo obligatorio/ }), {
    target: { value: 'Test student' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Entrar a la oficina →' }));

  expect(screen.getByText('Reception canvas')).toBeDefined();
  expect(screen.getByRole('button', { name: 'Vestidor' })).toBeDefined();
  expect(screen.queryByRole('form', { name: 'Armá tu combinación' })).toBeNull();
  expect(screen.getByRole('alert').textContent).toBe(
    'No pudimos guardar o recuperar tu selección en este navegador. Podés continuar sin guardarla; no se guarda en una cuenta.',
  );
  expect(write).toHaveBeenCalledTimes(1);
  expect(window.localStorage.getItem(appearancePreferenceKey)).toBeNull();
  expect(window.localStorage.getItem('unrelated')).toBe('keep');
  expect(window.localStorage.length).toBe(1);
});
