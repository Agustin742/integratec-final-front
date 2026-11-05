import { StrictMode, type ReactElement } from 'react';
import {
  render as renderWithTestingLibrary,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';

export function render(
  ui: ReactElement,
  options?: RenderOptions,
): RenderResult {
  return renderWithTestingLibrary(<StrictMode>{ui}</StrictMode>, options);
}
