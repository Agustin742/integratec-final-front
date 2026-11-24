import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, test } from 'vitest';
import { ProfileNavLink } from './profile-nav-link';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ProfileNavLink />
    </MemoryRouter>,
  );
}

test('is an icon-only link to the profile with an accessible name and a touch-sized target', () => {
  renderAt('/');
  const link = screen.getByRole('link', { name: 'Mi perfil' });

  expect(link).toHaveAttribute('href', '/profile');
  expect(link).toHaveClass('min-h-11', 'min-w-11');
  expect(link).toHaveClass('focus-visible:outline-ring');
  expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  expect(link).not.toHaveTextContent(/\S/);
});

test('exposes the active-route state on the profile page only', () => {
  const { unmount } = renderAt('/profile');
  expect(screen.getByRole('link', { name: 'Mi perfil' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  unmount();

  renderAt('/');
  expect(screen.getByRole('link', { name: 'Mi perfil' })).not.toHaveAttribute(
    'aria-current',
  );
});
