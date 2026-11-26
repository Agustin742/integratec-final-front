import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Classroom2DLayout } from './classroom-2d-layout';
import { ClassroomPanelsProvider } from './panels/classroom-panels';

function setup(callAction?: React.ReactNode) {
  render(
    <ClassroomPanelsProvider
      userId="u"
      classroomId="c"
      registry={[
        { key: 'members', title: 'Integrantes', component: () => null },
      ]}
      availability={{ confirmed: true, keys: ['members'] }}
      description="d"
      fallbackFocus={() => null}
    >
      <Classroom2DLayout
        panels={[
          { key: 'members', title: 'Integrantes', component: () => null },
        ]}
        callAction={callAction}
      />
    </ClassroomPanelsProvider>,
  );
}

describe('Classroom2DLayout call entry', () => {
  it('lists the call action with the other classroom features', () => {
    setup(<button type="button">Iniciar clase en llamada</button>);
    const nav = screen.getByRole('navigation');
    expect(within(nav).getAllByRole('listitem')).toHaveLength(2);
    expect(
      within(nav).getByRole('button', { name: 'Iniciar clase en llamada' }),
    ).toBeInTheDocument();
  });

  it('shows only the panels without a call action', () => {
    setup();
    expect(
      within(screen.getByRole('navigation')).getAllByRole('listitem'),
    ).toHaveLength(1);
  });
});
