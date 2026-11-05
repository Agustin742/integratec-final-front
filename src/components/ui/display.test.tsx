import { screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Badge } from './badge';
import { Skeleton } from './skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table';

const copy = {
  title: 'Cambios guardados',
  detail: 'El aula está actualizada.',
  error: 'No pudimos guardar. Intentá de nuevo.',
  badge: 'Disponible',
  loading: 'Cargando aulas…',
  region: 'Listado de aulas',
  caption: 'Aulas disponibles',
  column: 'Aula',
  value: 'Aula de prueba',
  empty: 'Todavía no hay aulas.',
  total: 'Total: 1',
};

describe('display feedback', () => {
  test('exposes non-urgent status and urgent errors with caller content', async () => {
    const { rerender, container } = render(
      <Alert>
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription>{copy.detail}</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(copy.detail);
    expect(
      screen.getByRole('heading', { name: copy.title, level: 2 }),
    ).toBeVisible();
    await expectAccessible(container);
    rerender(
      <Alert variant="destructive">
        <AlertDescription>{copy.error}</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(copy.error);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('lets the caller keep heading order when the alert sits under a title', () => {
    render(
      <Alert>
        <AlertTitle as="h3">{copy.title}</AlertTitle>
        <AlertDescription>{copy.detail}</AlertDescription>
      </Alert>,
    );
    expect(screen.getByRole('heading', { name: copy.title }).tagName).toBe(
      'H3',
    );
  });

  test('supports explicit announcement semantics and non-interactive badges', () => {
    render(
      <>
        <Alert role="note">{copy.detail}</Alert>
        <Badge variant="secondary">{copy.badge}</Badge>
      </>,
    );
    expect(screen.getByRole('note')).toHaveTextContent(copy.detail);
    expect(screen.getByText(copy.badge).tagName).toBe('SPAN');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('hides decorative placeholders while the caller announces loading', () => {
    const { container } = render(
      <div role="status" aria-label={copy.loading}>
        <Skeleton data-testid="placeholder" className="h-6 w-32" />
      </div>,
    );
    expect(screen.getByRole('status', { name: copy.loading })).toBeVisible();
    expect(screen.getByTestId('placeholder')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });
});

describe('Table', () => {
  test('retains table/caption/header semantics inside a focusable overflow region', async () => {
    const { container } = render(
      <Table containerLabel={copy.region}>
        <TableCaption>{copy.caption}</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>{copy.column}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>{copy.value}</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>{copy.total}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    const region = screen.getByRole('region', { name: copy.region });
    region.focus();
    expect(region).toHaveFocus();
    expect(region).toHaveClass('overflow-x-auto');
    const table = within(region).getByRole('table', { name: copy.caption });
    expect(
      within(table).getByRole('columnheader', { name: copy.column }),
    ).toHaveAttribute('scope', 'col');
    expect(within(table).getByRole('cell', { name: copy.value })).toBeVisible();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await expectAccessible(container);
  });

  test('supports row headers and caller-owned empty states without fabricating data', () => {
    render(
      <Table containerLabel={copy.region} aria-label={copy.caption}>
        <TableBody>
          <TableRow>
            <TableHead scope="row">{copy.column}</TableHead>
            <TableCell colSpan={2}>{copy.empty}</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(
      screen.getByRole('rowheader', { name: copy.column }),
    ).toHaveAttribute('scope', 'row');
    expect(screen.getByRole('cell', { name: copy.empty })).toHaveAttribute(
      'colspan',
      '2',
    );
  });
});
