import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getInitials, InitialsAvatar } from './initials-avatar';

describe('InitialsAvatar', () => {
  it('derives up to two initials', () => {
    expect(getInitials('Lucas Alumno')).toBe('LA');
    expect(getInitials('  prof. carlos pérez ')).toBe('PP');
    expect(getInitials('Madonna')).toBe('M');
    expect(getInitials('   ')).toBe('?');
  });

  it('is decorative and deterministic per name', () => {
    const { container, rerender } = render(
      <InitialsAvatar name="Ana García" />,
    );
    const first = container.firstElementChild?.className;
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container).toHaveTextContent('AG');
    rerender(<InitialsAvatar name="Ana García" />);
    expect(container.firstElementChild?.className).toBe(first);
  });
});
