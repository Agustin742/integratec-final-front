import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from './dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from './sheet';

const variants = [
  {
    name: 'Dialog',
    Root: Dialog,
    Content: DialogContent,
    Title: DialogTitle,
    Description: DialogDescription,
    Trigger: DialogTrigger,
  },
  {
    name: 'Sheet',
    Root: Sheet,
    Content: SheetContent,
    Title: SheetTitle,
    Description: SheetDescription,
    Trigger: SheetTrigger,
  },
];

describe.each(variants)(
  '$name modal contract',
  ({ Root, Content, Title, Description, Trigger }) => {
    function Example() {
      return (
        <>
          <button type="button">Outside action</button>
          <Root>
            <Trigger asChild>
              <button type="button">Open panel</button>
            </Trigger>
            <Content>
              <Title>Panel title</Title>
              <Description>Panel instructions</Description>
              <button type="button">First action</button>
              <button type="button">Last action</button>
            </Content>
          </Root>
        </>
      );
    }

    it('exposes its name and description and hides the background from accessible queries', async () => {
      render(<Example />);
      fireEvent.click(screen.getByRole('button', { name: 'Open panel' }));
      const panel = await screen.findByRole('dialog', { name: 'Panel title' });
      expect(panel).toHaveAccessibleDescription('Panel instructions');
      expect(
        screen.queryByRole('button', { name: 'Outside action' }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Outside action', hidden: true }),
      ).toBeInTheDocument();
      expect(document.body).toHaveStyle({ pointerEvents: 'none' });
      await waitFor(() =>
        expect(panel).toContainElement(document.activeElement as HTMLElement),
      );
    });

    it('contains focus, loops boundary Tab keys and restores the trigger after Escape', async () => {
      render(<Example />);
      const outside = screen.getByRole('button', { name: 'Outside action' });
      const trigger = screen.getByRole('button', { name: 'Open panel' });
      trigger.focus();
      fireEvent.click(trigger);
      const panel = await screen.findByRole('dialog');
      const first = screen.getByRole('button', { name: 'First action' });
      const close = screen.getByRole('button', { name: 'Cerrar' });
      first.focus();
      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
      expect(close).toHaveFocus();
      fireEvent.keyDown(close, { key: 'Tab' });
      expect(first).toHaveFocus();
      outside.focus();
      expect(panel).toContainElement(document.activeElement as HTMLElement);
      fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      await waitFor(() => expect(trigger).toHaveFocus());
      expect(outside).toBeVisible();
      expect(screen.getByRole('button', { name: 'Outside action' })).toBe(
        outside,
      );
      expect(document.body.style.pointerEvents).toBe('');
    });

    it('closes using its localized native close control', async () => {
      render(<Example />);
      const trigger = screen.getByRole('button', { name: 'Open panel' });
      trigger.focus();
      fireEvent.click(trigger);
      fireEvent.click(await screen.findByRole('button', { name: 'Cerrar' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
      );
      await waitFor(() => expect(trigger).toHaveFocus());
    });
  },
);
