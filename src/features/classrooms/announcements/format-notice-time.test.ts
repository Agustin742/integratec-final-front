import { describe, expect, it } from 'vitest';
import { formatNoticeAge } from './format-notice-time';

const NOW = Date.parse('2026-11-24T15:00:00.000Z');

describe('formatNoticeAge', () => {
  it('phrases recent notices relatively', () => {
    expect(formatNoticeAge('2026-11-24T14:59:40.000Z', NOW)).toBe('recién');
    expect(formatNoticeAge('2026-11-24T14:30:00.000Z', NOW)).toBe(
      'hace 30 minutos',
    );
    expect(formatNoticeAge('2026-11-24T12:00:00.000Z', NOW)).toBe(
      'hace 3 horas',
    );
    expect(formatNoticeAge('2026-11-23T14:00:00.000Z', NOW)).toBe('ayer');
    expect(formatNoticeAge('2026-11-21T15:00:00.000Z', NOW)).toBe(
      'hace 3 días',
    );
  });

  it('falls back to an absolute date after a week', () => {
    expect(formatNoticeAge('2026-11-10T15:00:00.000Z', NOW)).toBe(
      '10 de nov de 2026',
    );
  });

  it('never claims a negative age for a slightly future instant', () => {
    expect(formatNoticeAge('2026-11-24T15:00:30.000Z', NOW)).toBe('recién');
  });
});
