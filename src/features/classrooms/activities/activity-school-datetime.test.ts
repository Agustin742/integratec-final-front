import { describe, expect, test } from 'vitest';
import { DEFAULT_SCHOOL_TIME_ZONE } from '@/lib/dates';
import {
  datetimeLocalToInstantUtc,
  instantToDatetimeLocal,
  isValidSchoolDatetimeLocal,
  resolveSchoolTimeZone,
} from './activity-school-datetime';

describe('activity school datetime conversions (#39)', () => {
  test('converts a school-zone datetime-local into an explicit-UTC instant', () => {
    // Buenos Aires is UTC-3: 20:00 local on 2026-11-30 is 23:00 UTC.
    expect(
      datetimeLocalToInstantUtc('2026-11-30T20:00', {
        timeZone: DEFAULT_SCHOOL_TIME_ZONE,
      }),
    ).toBe('2026-11-30T23:00:00.000Z');
  });

  test('round-trips a UTC instant back into a school-zone datetime-local string', () => {
    expect(
      instantToDatetimeLocal('2026-11-30T23:00:00.000Z', {
        timeZone: DEFAULT_SCHOOL_TIME_ZONE,
      }),
    ).toBe('2026-11-30T20:00');
  });

  test('truncates seconds on display so the shown value is what a resubmit sends', () => {
    expect(
      instantToDatetimeLocal('2026-11-30T23:00:30.000Z', {
        timeZone: DEFAULT_SCHOOL_TIME_ZONE,
      }),
    ).toBe('2026-11-30T20:00');
  });

  test('honors the real offset of a DST-observing zone on both sides of a transition', () => {
    // America/New_York: EST (UTC-5) before 2026-03-08, EDT (UTC-4) after.
    expect(
      datetimeLocalToInstantUtc('2026-03-07T12:00', {
        timeZone: 'America/New_York',
      }),
    ).toBe('2026-03-07T17:00:00.000Z');
    expect(
      datetimeLocalToInstantUtc('2026-03-08T12:00', {
        timeZone: 'America/New_York',
      }),
    ).toBe('2026-03-08T16:00:00.000Z');
    expect(
      instantToDatetimeLocal('2026-03-08T16:00:00.000Z', {
        timeZone: 'America/New_York',
      }),
    ).toBe('2026-03-08T12:00');
  });

  test('rejects wall-clock times that do not exist in the zone (DST gap)', () => {
    // 02:30 on 2026-03-08 does not exist in America/New_York.
    expect(
      isValidSchoolDatetimeLocal('2026-03-08T02:30', {
        timeZone: 'America/New_York',
      }),
    ).toBe(false);
    expect(() =>
      datetimeLocalToInstantUtc('2026-03-08T02:30', {
        timeZone: 'America/New_York',
      }),
    ).toThrow(/daylight-saving gap/);
  });

  test('accepts ambiguous fall-back wall times deterministically', () => {
    // 01:30 on 2026-11-01 happens twice in America/New_York; the first
    // occurrence is chosen, and the wall clock survives the round trip.
    const instant = datetimeLocalToInstantUtc('2026-11-01T01:30', {
      timeZone: 'America/New_York',
    });
    expect(
      instantToDatetimeLocal(instant, { timeZone: 'America/New_York' }),
    ).toBe('2026-11-01T01:30');
  });

  test('rejects malformed and impossible calendar datetime-local values with clear errors', () => {
    expect(isValidSchoolDatetimeLocal('')).toBe(false);
    expect(isValidSchoolDatetimeLocal('2026-11-30')).toBe(false);
    expect(isValidSchoolDatetimeLocal('not-a-date')).toBe(false);
    expect(isValidSchoolDatetimeLocal('2026-02-30T10:00')).toBe(false);
    expect(() => datetimeLocalToInstantUtc('2026-02-30T10:00')).toThrow(
      /calendar date or time is out of range/,
    );
  });

  test('falls back safely to the default school time zone on empty or invalid IANA zones', () => {
    expect(resolveSchoolTimeZone('')).toBe(DEFAULT_SCHOOL_TIME_ZONE);
    expect(resolveSchoolTimeZone('   ')).toBe(DEFAULT_SCHOOL_TIME_ZONE);
    expect(resolveSchoolTimeZone('Mars/Olympus_Mons')).toBe(
      DEFAULT_SCHOOL_TIME_ZONE,
    );
    expect(
      datetimeLocalToInstantUtc('2026-11-30T20:00', {
        timeZone: 'Invalid/Zone',
      }),
    ).toBe('2026-11-30T23:00:00.000Z');
    expect(
      instantToDatetimeLocal('2026-11-30T23:00:00.000Z', { timeZone: '' }),
    ).toBe('2026-11-30T20:00');
  });

  test('defaults to the school time zone, never the browser zone', () => {
    expect(datetimeLocalToInstantUtc('2026-11-30T20:00')).toBe(
      '2026-11-30T23:00:00.000Z',
    );
    expect(instantToDatetimeLocal('2026-11-30T23:00:00.000Z')).toBe(
      '2026-11-30T20:00',
    );
  });
});
