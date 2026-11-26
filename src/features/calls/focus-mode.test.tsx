import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FocusModeNotice, isWorldLocked } from './focus-mode';

describe('isWorldLocked', () => {
  it('locks the 3D world for students only while focus mode is on', () => {
    expect(isWorldLocked('STUDENT', true)).toBe(true);
    expect(isWorldLocked('STUDENT', false)).toBe(false);
  });

  it('never locks teachers or other roles', () => {
    expect(isWorldLocked('TEACHER', true)).toBe(false);
    expect(isWorldLocked('PARENT', true)).toBe(false);
  });
});

describe('FocusModeNotice', () => {
  it('explains the focus mode calmly', () => {
    render(<FocusModeNotice />);
    expect(
      screen.getByText('Tu profe activó el modo foco durante la clase'),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
