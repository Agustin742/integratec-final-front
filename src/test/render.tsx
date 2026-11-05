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
