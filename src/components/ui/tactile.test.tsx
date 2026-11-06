import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SidebarNav, SidebarNavItem } from '@/components/layout/sidebar-nav';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Badge } from './badge';
import { Button } from './button';
import { Skeleton } from './skeleton';

describe('Button tactile key', () => {
  it('renders a bevel on solid and outline keys', () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="secondary">Sand</Button>
        <Button variant="destructive">Remove</Button>
        <Button variant="outline">Quiet</Button>
      </>,
    );
    for (const name of ['Save', 'Sand', 'Remove', 'Quiet'])
      expect(screen.getByRole('button', { name })).toHaveClass('key-bevel');
  });

  it('keeps ghost and link buttons flat', () => {
    render(
      <>
        <Button variant="ghost">Ghost</Button>
        <Button variant="link">Link</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Ghost' })).not.toHaveClass(
      'key-bevel',
    );
    expect(screen.getByRole('button', { name: 'Link' })).not.toHaveClass(
      'key-bevel',
    );
  });

  it('flattens a disabled key but keeps the busy key bevelled without a pop', () => {
    render(
      <>
        <Button disabled>Off</Button>
        <Button busy>Busy</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Off' })).not.toHaveClass(
      'key-bevel',
    );
    const busy = screen.getByRole('button', { name: 'Busy' });
    expect(busy).toHaveClass('key-bevel');
    expect(busy).not.toHaveClass('motion-press');
  });

  it('uses the display face for labels', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass(
      'font-display',
    );
  });
});

describe('Badge palette variants', () => {
  it.each(['success', 'info', 'warning', 'danger'] as const)(
    'maps the %s variant to its semantic surface',
    (variant) => {
      render(<Badge variant={variant}>{variant}</Badge>);
      expect(screen.getByText(variant)).toHaveClass(
        `bg-${variant}`,
        `text-${variant}-foreground`,
      );
    },
  );
});

describe('Alert variants', () => {
  it.each(['success', 'info', 'warning'] as const)(
    'announces %s politely with a decorative icon chip',
    (variant) => {
      render(
        <Alert variant={variant}>
          <AlertTitle>Title</AlertTitle>
          <AlertDescription>Body</AlertDescription>
        </Alert>,
      );
      const alert = screen.getByRole('status');
      expect(alert).toHaveClass(`bg-${variant}`);
      expect(alert.querySelector('[aria-hidden="true"]')).not.toBeNull();
    },
  );

  it('uses a tinted surface instead of a colored side stripe', () => {
    render(
      <Alert variant="destructive">
        <AlertDescription>Body</AlertDescription>
      </Alert>,
    );
    const alert = screen.getByRole('alert');
    expect(alert.className).not.toMatch(/border-(l|r)-/);
    expect(alert).toHaveClass('bg-danger');
  });
});

describe('Sidebar navigation pills', () => {
  it('marks only the current item with aria-current', () => {
    render(
      <SidebarNav>
        <SidebarNavItem href="#a" current>
          A
        </SidebarNavItem>
        <SidebarNavItem href="#b">B</SidebarNavItem>
      </SidebarNav>,
    );
    expect(screen.getByRole('link', { name: 'A' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'B' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('Skeleton shimmer', () => {
  it('shimmers only when motion is allowed', () => {
    render(<Skeleton data-testid="s" />);
    expect(screen.getByTestId('s').className).toContain(
      'motion-safe:animate-shimmer',
    );
  });
});
