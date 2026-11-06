import type { QueryClient } from '@tanstack/react-query';
import {
  render as renderWithTestingLibrary,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import { StrictMode, type ReactElement, type ReactNode } from 'react';
import { ApiQueryProvider, createAppQueryClient } from '../api/query-client';

export interface AppRenderOptions extends RenderOptions {
  readonly queryClient?: QueryClient;
}

/**
 * Renders a tree with the application providers under `StrictMode`.
 *
 * `StrictMode` is applied through the React Testing Library `wrapper`, so it
 * survives `rerender`. Do not wrap a `rerender` target in `StrictMode` as well:
 * the extra element changes the child type at that position, React remounts the
 * subtree, and any element reference captured before the rerender goes stale.
 */
export function render(
  ui: ReactElement,
  options: AppRenderOptions = {},
): RenderResult {
  const {
    queryClient = createAppQueryClient(),
    wrapper: CustomWrapper,
    ...renderOptions
  } = options;

  function Wrapper({ children }: { readonly children: ReactNode }) {
    const content = CustomWrapper ? (
      <CustomWrapper>{children}</CustomWrapper>
    ) : (
      children
    );
    return (
      <StrictMode>
        <ApiQueryProvider client={queryClient}>{content}</ApiQueryProvider>
      </StrictMode>
    );
  }

  return renderWithTestingLibrary(ui, {
    ...renderOptions,
    wrapper: Wrapper,
  });
}
