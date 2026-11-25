import { screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@/test/render';
import { Classroom3DTopBar } from './classroom-3d-top-bar';

vi.mock('@/features/chat-page/chats-nav-link', () => ({
  ChatsNavLink: () => null,
}));
vi.mock('@/features/profile/profile-nav-link', () => ({
  ProfileNavLink: () => null,
}));
vi.mock('@/features/notifications/notification-host', () => ({
  ClaimedNotificationCenter: () => null,
}));

describe('Classroom3DTopBar', () => {
  it('renders the call action inside the header, beside the other actions', () => {
    render(
      <MemoryRouter>
        <Classroom3DTopBar
          classroomName="Aula"
          roleLabel="Docente"
          headingRef={createRef()}
          modeToggleLabel="Ver en 2D"
          onToggleMode={vi.fn()}
          callAction={<button type="button">Iniciar clase en llamada</button>}
        />
      </MemoryRouter>,
    );
    const header = screen.getByTestId('classroom-3d-top-bar');
    expect(
      within(header).getByRole('button', { name: 'Iniciar clase en llamada' }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole('button', { name: 'Ver en 2D' }),
    ).toBeInTheDocument();
  });
});
