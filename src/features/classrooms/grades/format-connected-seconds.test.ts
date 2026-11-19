import { describe, expect, test } from 'vitest';
import { formatConnectedSeconds } from './format-connected-seconds';
import { gradesMessages } from './messages';

const hourUnit = gradesMessages.format.durationHourUnit;
const minuteUnit = gradesMessages.format.durationMinuteUnit;

describe('formatConnectedSeconds (#46)', () => {
  test('formats hours plus minutes as a signed-text duration', () => {
    expect(formatConnectedSeconds(7500)).toBe(`2 ${hourUnit} 5 ${minuteUnit}`);
  });

  test('formats minutes only without a zero-hours segment', () => {
    expect(formatConnectedSeconds(2700)).toBe(`45 ${minuteUnit}`);
  });

  test('formats exact hours with a zero-minutes segment', () => {
    expect(formatConnectedSeconds(7200)).toBe(`2 ${hourUnit} 0 ${minuteUnit}`);
  });

  test('renders zero as a visible duration instead of an empty cell', () => {
    expect(formatConnectedSeconds(0)).toBe(`0 ${minuteUnit}`);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'guards the non-finite input %s to zero minutes',
    (value) => {
      expect(formatConnectedSeconds(value)).toBe(`0 ${minuteUnit}`);
    },
  );

  test('clamps negative seconds to zero minutes', () => {
    expect(formatConnectedSeconds(-30)).toBe(`0 ${minuteUnit}`);
  });
});
