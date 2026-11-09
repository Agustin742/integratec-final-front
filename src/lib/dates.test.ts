import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  DEFAULT_SCHOOL_TIME_ZONE,
  formatDateOnly,
  formatDeadline,
  formatInstant,
} from './dates';

describe('dates formatting helpers', () => {
  it('exposes the default es-AR locale and school time zone (FD10, FD11)', () => {
    expect(DEFAULT_LOCALE).toBe('es-AR');
    expect(DEFAULT_SCHOOL_TIME_ZONE).toBe('America/Argentina/Buenos_Aires');
  });

  describe('formatInstant', () => {
    it('formats an unambiguous ISO 8601 instant in explicit locale and time zone across day boundaries', () => {
      // 2026-11-06T01:30:00.000Z is 2026-11-05 22:30 in Buenos Aires (UTC-3)
      const instant = '2026-11-06T01:30:00.000Z';

      const inBuenosAires = formatInstant(instant, {
        locale: 'es-AR',
        timeZone: 'America/Argentina/Buenos_Aires',
      });
      const inUtc = formatInstant(instant, {
        locale: 'es-AR',
        timeZone: 'UTC',
      });

      expect(inBuenosAires).toContain('05/11/2026');
      expect(inBuenosAires).toContain('22:30');
      expect(inUtc).toContain('06/11/2026');
      expect(inUtc).toContain('01:30');
    });

    it('accepts ISO 8601 instants with explicit numeric offsets, compact ±HHMM offsets, and lowercase z', () => {
      const colonOffset = formatInstant('2026-11-05T19:45:00-03:00', {
        locale: 'es-AR',
        timeZone: 'UTC',
      });
      expect(colonOffset).toContain('05/11/2026');
      expect(colonOffset).toContain('22:45');

      const compactOffset = formatInstant('2026-11-05T19:45:00+0000', {
        locale: 'es-AR',
        timeZone: 'UTC',
      });
      expect(compactOffset).toContain('05/11/2026');
      expect(compactOffset).toContain('19:45');

      const lowercaseZ = formatInstant('2026-11-05T00:05:00.000z', {
        locale: 'es-AR',
        timeZone: 'UTC',
      });
      expect(lowercaseZ).toContain('05/11/2026');
      expect(lowercaseZ).toContain('00:05');
      expect(lowercaseZ).not.toContain('24:05');
    });

    it('rejects strings without an explicit time zone offset or invalid dates', () => {
      expect(() => formatInstant('2026-11-05')).toThrow(/instant/i);
      expect(() => formatInstant('2026-11-05T14:30:00')).toThrow(/instant/i);
      expect(() => formatInstant('not-a-date')).toThrow(/instant/i);
    });
  });

  describe('formatDeadline', () => {
    it('formats UTC deadlines in the school time zone by default and indicates the time zone (FD11)', () => {
      const utcDeadline = '2026-11-10T02:59:00.000Z';
      const formatted = formatDeadline(utcDeadline);

      // 02:59 UTC on Nov 10 is 23:59 on Nov 9 in America/Argentina/Buenos_Aires
      expect(formatted).toContain('09/11/2026');
      expect(formatted).toContain('23:59');
      expect(formatted).toContain('America/Argentina/Buenos_Aires');
    });

    it('uses a custom school IANA time zone when provided by the API', () => {
      const utcDeadline = '2026-11-10T02:59:00.000Z';
      const formatted = formatDeadline(utcDeadline, {
        timeZone: 'Europe/Madrid',
      });

      // 02:59 UTC on Nov 10 is 03:59 on Nov 10 in Europe/Madrid (UTC+1 in November)
      expect(formatted).toContain('10/11/2026');
      expect(formatted).toContain('03:59');
      expect(formatted).toContain('Europe/Madrid');
    });
  });

  describe('formatDateOnly', () => {
    it('formats YYYY-MM-DD calendar dates without shifting across time zones', () => {
      expect(formatDateOnly('2026-11-01')).toBe('01/11/2026');
      expect(formatDateOnly('2026-01-01')).toBe('01/01/2026');
      expect(formatDateOnly('2028-02-29')).toBe('29/02/2028');
    });

    it('supports long date style without shifting the calendar day', () => {
      const longDate = formatDateOnly('2026-11-05', { dateStyle: 'long' });
      expect(longDate.toLowerCase()).toContain('5');
      expect(longDate.toLowerCase()).toContain('noviembre');
      expect(longDate).toContain('2026');
    });

    it('rejects timestamps or impossible calendar dates', () => {
      expect(() => formatDateOnly('2026-11-05T00:00:00Z')).toThrow(
        /date-only/i,
      );
      expect(() => formatDateOnly('2026-02-29')).toThrow(/date-only/i);
      expect(() => formatDateOnly('2026-13-01')).toThrow(/date-only/i);
      expect(() => formatDateOnly('05/11/2026')).toThrow(/date-only/i);
    });
  });
});
