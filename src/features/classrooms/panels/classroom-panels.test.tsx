import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useLayoutEffect } from 'react';
import { describe, expect, it } from 'vitest';
import {
  ClassroomPanelsProvider,
  useClassroomPanels,
  type ClassroomPanelsProps,
} from './classroom-panels';

function SyntheticPanel() {
  return <input aria-label="Draft" defaultValue="" />;
}
const registry = [
  { key: 'sample', title: 'Synthetic panel', component: SyntheticPanel },
];
const confirmed = { confirmed: true, keys: ['sample'] } as const;
let capturedOpen: ReturnType<typeof useClassroomPanels>['openPanel'];
function Controls({ visible }: { visible: boolean }) {
  const { openPanel } = useClassroomPanels();
  useLayoutEffect(() => {
    capturedOpen = openPanel;
  }, [openPanel]);
  return (
    visible && (
      <button onClick={(event) => openPanel('sample', event.currentTarget)}>
        Open
      </button>
    )
  );
}
function Example({
  showTrigger = true,
  ...props
}: Partial<ClassroomPanelsProps> & { showTrigger?: boolean }) {
  return (
    <>
      <button id="workspace">Workspace</button>
      <ClassroomPanelsProvider
        userId="user-a"
        classroomId="room-a"
        registry={registry}
        availability={confirmed}
        fallbackFocus={() => document.getElementById('workspace')}
        description="Synthetic instructions"
        {...props}
      >
        <Controls visible={showTrigger} />
      </ClassroomPanelsProvider>
    </>
  );
}
function open() {
  const trigger = screen.getByRole('button', { name: 'Open' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}
async function closed() {
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
}

describe('standalone classroom panels', () => {
  it.each([
    undefined,
    { confirmed: false },
    { confirmed: true, keys: [] },
    { confirmed: true, keys: ['unknown'] },
  ] as const)(
    'denies unavailable input %j without moving focus',
    (availability) => {
      render(<Example availability={availability} />);
      const trigger = open();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
      act(() => expect(capturedOpen('unknown')).toBe(false));
      expect(trigger).toHaveFocus();
    },
  );

  it('checks current availability even through a retained callback', () => {
    const view = render(<Example />);
    const oldOpen = capturedOpen;
    view.rerender(<Example availability={{ confirmed: false }} />);
    const trigger = open();
    act(() => expect(oldOpen('sample', trigger)).toBe(false));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    view.rerender(<Example />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('denies an available but unregistered key', () => {
    render(<Example registry={[]} />);
    open();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a named modal, traps keyboard focus, closes and returns to the invoker', async () => {
    const view = render(<Example />);
    const outside = screen.getByRole('button', { name: 'Workspace' });
    const trigger = open();
    const dialog = screen.getByRole('dialog', { name: 'Synthetic panel' });
    expect(dialog).toHaveAccessibleDescription('Synthetic instructions');
    const input = screen.getByRole('textbox');
    view.rerender(<Example routeOwner="new-location" />);
    expect(screen.getByRole('textbox')).toBe(input);
    const close = screen.getByRole('button', { name: 'Cerrar' });
    input.focus();
    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(input).toHaveFocus();
    outside.focus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    fireEvent.keyDown(input, { key: 'Escape' });
    await closed();
    await waitFor(() => expect(trigger).toHaveFocus());
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    await closed();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it.each(['availability', 'unconfirmed', 'registry'] as const)(
    'disposes state on %s loss without resurrection',
    async (loss) => {
      const view = render(<Example />);
      open();
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'private draft' },
      });
      view.rerender(
        <Example
          {...(loss === 'registry'
            ? { registry: [] }
            : {
                availability:
                  loss === 'unconfirmed'
                    ? { confirmed: false }
                    : { confirmed: true, keys: [] },
              })}
        />,
      );
      await closed();
      view.rerender(<Example />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      open();
      expect(screen.getByRole('textbox')).toHaveValue('');
    },
  );

  it.each(['userId', 'classroomId'] as const)(
    'fences old callbacks and disposes drafts on %s change',
    async (scope) => {
      const view = render(<Example />);
      open();
      const oldOpen = capturedOpen;
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'old draft' },
      });
      view.rerender(<Example {...{ [scope]: 'different' }} />);
      await closed();
      act(() => expect(oldOpen('sample')).toBe(false));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      open();
      expect(screen.getByRole('textbox')).toHaveValue('');
      view.rerender(<Example />);
      await closed();
      expect(screen.queryByDisplayValue('old draft')).not.toBeInTheDocument();
    },
  );

  it.each(['removed', 'disabled', 'hidden', 'non-dom'] as const)(
    'returns to workspace for %s invoker',
    async (kind) => {
      const view = render(<Example />);
      const fallback = screen.getByRole('button', { name: 'Workspace' });
      if (kind === 'non-dom') {
        act(() => expect(capturedOpen('sample')).toBe(true));
      } else {
        const trigger = open();
        if (kind === 'removed') view.rerender(<Example showTrigger={false} />);
        else if (kind === 'hidden') trigger.hidden = true;
        else trigger.setAttribute('disabled', '');
      }
      fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
      await closed();
      await waitFor(() => expect(fallback).toHaveFocus());
    },
  );
});
