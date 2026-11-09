import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createScopedQueryKey } from '@/api/query-keys';
import { expectAccessible } from '@/test/accessibility';
import { render } from '@/test/render';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  createPaginatedQueryKey,
  getPaginationMeta,
  normalizePaginationQuery,
} from './pagination';
import { PaginationControls } from './pagination-controls';

describe('pagination helpers and controls', () => {
  it('matches the backend pagination contract constants', () => {
    expect(DEFAULT_PAGE).toBe(1);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(100);
    expect(MAX_PAGE).toBe(10_000);
  });

  describe('normalizePaginationQuery', () => {
    it('applies defaults and clamps page and pageSize within backend bounds', () => {
      expect(normalizePaginationQuery()).toEqual({
        page: 1,
        pageSize: 20,
      });

      expect(
        normalizePaginationQuery({
          page: 0,
          pageSize: 500,
          sort: '-createdAt',
        }),
      ).toEqual({
        page: 1,
        pageSize: 100,
        sort: '-createdAt',
      });

      expect(
        normalizePaginationQuery({ page: 99_999, pageSize: -5, sort: '   ' }),
      ).toEqual({
        page: 10_000,
        pageSize: 1,
      });
    });

    it('builds a deterministic scoped query key with normalized pagination parameters', () => {
      const key = createPaginatedQueryKey(
        { userId: 'user-1', classroomId: 'class-1' },
        'members',
        'directory',
        { page: 2, pageSize: 20, sort: 'displayName' },
      );

      expect(key).toEqual(
        createScopedQueryKey(
          { userId: 'user-1', classroomId: 'class-1' },
          'members',
          'directory',
          { page: 2, pageSize: 20, sort: 'displayName' },
        ),
      );
    });
  });

  describe('getPaginationMeta', () => {
    it('computes range and page flags for empty, first, middle, and last pages', () => {
      expect(getPaginationMeta({ page: 1, pageSize: 20, total: 0 })).toEqual({
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 1,
        hasPreviousPage: false,
        hasNextPage: false,
        rangeStart: 0,
        rangeEnd: 0,
      });

      expect(getPaginationMeta({ page: 1, pageSize: 20, total: 42 })).toEqual({
        page: 1,
        pageSize: 20,
        total: 42,
        totalPages: 3,
        hasPreviousPage: false,
        hasNextPage: true,
        rangeStart: 1,
        rangeEnd: 20,
      });

      expect(getPaginationMeta({ page: 3, pageSize: 20, total: 42 })).toEqual({
        page: 3,
        pageSize: 20,
        total: 42,
        totalPages: 3,
        hasPreviousPage: true,
        hasNextPage: false,
        rangeStart: 41,
        rangeEnd: 42,
      });
    });
  });

  describe('PaginationControls', () => {
    it('renders accessible navigation, disables boundary buttons, and invokes onPageChange', async () => {
      const onPageChange = vi.fn();
      const { container, rerender } = render(
        <PaginationControls
          page={1}
          pageSize={20}
          total={42}
          onPageChange={onPageChange}
        />,
      );

      const nav = screen.getByRole('navigation', { name: 'Paginación' });
      expect(nav).toHaveTextContent('Mostrando 1–20 de 42');
      expect(nav).toHaveTextContent('Página 1 de 3');

      const prevButton = screen.getByRole('button', {
        name: 'Página anterior',
      });
      const nextButton = screen.getByRole('button', {
        name: 'Página siguiente',
      });

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeEnabled();

      nextButton.focus();
      expect(nextButton).toHaveFocus();
      fireEvent.click(nextButton);
      expect(onPageChange).toHaveBeenCalledWith(2);

      rerender(
        <PaginationControls
          page={3}
          pageSize={20}
          total={42}
          onPageChange={onPageChange}
        />,
      );

      expect(
        screen.getByRole('button', { name: 'Página anterior' }),
      ).toBeEnabled();
      expect(
        screen.getByRole('button', { name: 'Página siguiente' }),
      ).toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: 'Página anterior' }));
      expect(onPageChange).toHaveBeenCalledWith(2);

      await expectAccessible(container);
    });

    it('renders zero-results summary cleanly when total is 0', () => {
      const onPageChange = vi.fn();
      render(
        <PaginationControls
          page={1}
          pageSize={20}
          total={0}
          onPageChange={onPageChange}
        />,
      );

      expect(
        screen.getByRole('navigation', { name: 'Paginación' }),
      ).toHaveTextContent('Sin resultados');
      expect(
        screen.getByRole('button', { name: 'Página anterior' }),
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: 'Página siguiente' }),
      ).toBeDisabled();
    });
  });
});
