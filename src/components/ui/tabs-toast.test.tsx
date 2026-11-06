import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';
import { Toast, toast } from './toast';

describe('Tabs', () => {
  it('moves selection with arrow keys, skips disabled tabs and exposes associated panels', async () => {
    render(
      <Tabs defaultValue="first">
        <TabsList aria-label="Sections">
          <TabsTrigger value="first">First</TabsTrigger>
          <TabsTrigger value="disabled" disabled>
            Unavailable
          </TabsTrigger>
          <TabsTrigger value="last">Last</TabsTrigger>
        </TabsList>
        <TabsContent value="first">First content</TabsContent>
        <TabsContent value="last">Last content</TabsContent>
      </Tabs>,
    );
    const first = screen.getByRole('tab', { name: 'First' });
    const last = screen.getByRole('tab', { name: 'Last' });
    expect(screen.getByRole('tabpanel', { name: 'First' })).toHaveTextContent(
      'First content',
    );
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    await waitFor(() => expect(last).toHaveFocus());
    expect(last).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Last' })).toHaveTextContent(
      'Last content',
    );
    expect(screen.queryByText('First content')).not.toBeInTheDocument();
    fireEvent.keyDown(last, { key: 'ArrowLeft' });
    await waitFor(() => expect(first).toHaveFocus());
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  it('supports controlled values and manual keyboard activation', async () => {
    const onValueChange = vi.fn();
    render(
      <Tabs value="first" onValueChange={onValueChange} activationMode="manual">
        <TabsList aria-label="Sections">
          <TabsTrigger value="first">First</TabsTrigger>
          <TabsTrigger value="last">Last</TabsTrigger>
        </TabsList>
        <TabsContent value="first">First content</TabsContent>
        <TabsContent value="last">Last content</TabsContent>
      </Tabs>,
    );
    const first = screen.getByRole('tab', { name: 'First' });
    const last = screen.getByRole('tab', { name: 'Last' });
    first.focus();
    fireEvent.keyDown(first, { key: 'End' });
    await waitFor(() => expect(last).toHaveFocus());
    expect(onValueChange).not.toHaveBeenCalled();
    fireEvent.keyDown(last, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledWith('last');
    expect(first).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Toast', () => {
  afterEach(() => {
    act(() => {
      toast.dismiss();
    });
  });

  it('announces consumer content in a localized polite region and dismisses accessibly', async () => {
    render(<Toast />);
    act(() => {
      toast.success('Cambios guardados', {
        description: 'Ya podés continuar.',
        duration: Infinity,
      });
    });
    const region = screen.getByRole('region', {
      name: 'Notificaciones (Alt+T)',
    });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(await screen.findByText('Cambios guardados')).toBeVisible();
    expect(region).toHaveTextContent('Ya podés continuar.');
    const dismiss = screen.getByRole('button', { name: 'Cerrar notificación' });
    dismiss.focus();
    expect(dismiss).toHaveFocus();
    fireEvent.click(dismiss);
    await waitFor(() =>
      expect(screen.queryByText('Cambios guardados')).not.toBeInTheDocument(),
    );
  });

  it('renders as a clay panel with a display title and an in-panel close key', async () => {
    render(<Toast />);
    act(() => {
      toast.success('Cambios guardados', { duration: Infinity });
    });
    const title = await screen.findByText('Cambios guardados');
    const panel = title.closest('[data-sonner-toast]');
    expect(panel).toHaveAttribute('data-styled', 'false');
    expect(panel).toHaveClass('shadow-float', 'rounded-2xl');
    expect(title).toHaveClass('font-display');
    const dismiss = screen.getByRole('button', { name: 'Cerrar notificación' });
    expect(dismiss).toHaveClass('key-bevel');
  });

  it('renders error feedback without relying on an accent background', async () => {
    render(<Toast />);
    act(() => {
      toast.error('No se pudo guardar', { duration: Infinity });
    });
    expect(await screen.findByText('No se pudo guardar')).toBeVisible();
    expect(screen.getByRole('list')).toHaveStyle({
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
    });
    expect(
      screen.getByRole('button', { name: 'Cerrar notificación' }),
    ).toBeEnabled();
  });
});
