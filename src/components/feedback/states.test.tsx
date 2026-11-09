import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/errors';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import {
  EmptyState,
  ErrorState,
  LiveRegion,
  LoadingState,
  StaleDataNotice,
} from './states';

describe('feedback state primitives', () => {
  it('renders LoadingState, EmptyState, and ErrorState as visually and programmatically distinct regions', async () => {
    const { container } = render(
      <div>
        <LoadingState label="Cargando actividades..." skeletonLines={2} />
        <EmptyState
          title="Todavía no hay entregas"
          description="Cuando tus estudiantes suban un archivo aparecerá acá."
          action={<button type="button">Crear actividad</button>}
        />
        <ErrorState
          title="No pudimos cargar las entregas"
          description="Ocurrió un problema de conexión."
          nextAction="Verificá tu conexión e intentá nuevamente."
        />
      </div>,
    );

    const loadingRegion = screen.getByRole('status', {
      name: 'Cargando actividades...',
    });
    expect(loadingRegion).toHaveAttribute('aria-busy', 'true');
    expect(loadingRegion).toHaveAttribute('data-state-kind', 'loading');

    const emptyRegion = screen.getByRole('region', {
      name: 'Todavía no hay entregas',
    });
    expect(emptyRegion).toHaveAttribute('data-state-kind', 'empty');
    expect(
      screen.getByRole('button', { name: 'Crear actividad' }),
    ).toBeVisible();

    const errorAlert = screen.getByRole('alert');
    expect(errorAlert).toHaveAttribute('data-state-kind', 'error');
    expect(errorAlert).toHaveTextContent('No pudimos cargar las entregas');
    expect(errorAlert).toHaveTextContent(
      'Verificá tu conexión e intentá nuevamente.',
    );

    await expectAccessible(container);
  });

  it('maps an ApiError in ErrorState and triggers bounded retry via pointer and keyboard', async () => {
    const onRetry = vi.fn();
    const apiError = new ApiError({
      kind: 'network',
      status: null,
      code: null,
      userMessage:
        'No pudimos conectarnos con el servidor. Verificá tu conexión e intentá de nuevo.',
    });

    const { rerender } = render(
      <ErrorState
        error={apiError}
        nextAction="Intentá actualizar la vista."
        onRetry={onRetry}
      />,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(
      'No pudimos conectarnos con el servidor. Verificá tu conexión e intentá de nuevo.',
    );
    expect(alert).toHaveTextContent('Intentá actualizar la vista.');

    const retryButton = screen.getByRole('button', { name: 'Reintentar' });
    retryButton.focus();
    expect(retryButton).toHaveFocus();
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(
      <ErrorState
        error={apiError}
        nextAction="Intentá actualizar la vista."
        onRetry={onRetry}
        isRetrying
      />,
    );

    const busyButton = screen.getByRole('button', { name: 'Reintentando...' });
    expect(busyButton).toHaveAttribute('aria-busy', 'true');
    fireEvent.click(busyButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('preserves existing content while displaying StaleDataNotice when a refresh fails', async () => {
    const onRetry = vi.fn();
    const { container } = render(
      <div>
        <StaleDataNotice onRetry={onRetry} />
        <ul aria-label="Lista en caché">
          <li>Actividad 1: Fracciones</li>
        </ul>
      </div>,
    );

    const staleStatus = screen.getByRole('status');
    expect(staleStatus).toHaveAttribute('data-state-kind', 'stale');
    expect(staleStatus).toHaveTextContent(
      'Mostrando los últimos datos disponibles',
    );
    expect(screen.getByText('Actividad 1: Fracciones')).toBeVisible();

    const retryButton = screen.getByRole('button', {
      name: 'Actualizar datos',
    });
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);

    await expectAccessible(container);
  });

  it('announces async results through LiveRegion with polite or assertive politeness', async () => {
    const { container, rerender } = render(
      <LiveRegion message="3 resultados encontrados." />,
    );

    const politeRegion = screen.getByRole('status');
    expect(politeRegion).toHaveAttribute('aria-live', 'polite');
    expect(politeRegion).toHaveAttribute('aria-atomic', 'true');
    expect(politeRegion).toHaveTextContent('3 resultados encontrados.');

    rerender(
      <LiveRegion
        politeness="assertive"
        message="Error al sincronizar el intento."
      />,
    );

    const assertiveRegion = screen.getByRole('alert');
    expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive');
    expect(assertiveRegion).toHaveTextContent(
      'Error al sincronizar el intento.',
    );

    await expectAccessible(container);
  });
});
