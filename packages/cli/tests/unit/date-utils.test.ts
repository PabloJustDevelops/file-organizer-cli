import { describe, it, expect } from 'vitest';
import { getDateValue, isDateInRange, formatDate } from '../../src/utils/date-utils.js';

describe('Date Utils', () => {
  const date = new Date('2024-03-15T10:30:00');

  describe('getDateValue', () => {
    it('formats year, month, day with padding', () => {
      expect(getDateValue(date, 'year')).toBe('2024');
      expect(getDateValue(date, 'month')).toBe('03');
      expect(getDateValue(date, 'day')).toBe('15');
    });

    it('formats monthName in English lowercase', () => {
      expect(getDateValue(date, 'monthName')).toBe('march');
    });

    it('formats year-month', () => {
      expect(getDateValue(date, 'year-month')).toBe('2024-03');
      expect(getDateValue(date, 'yearMonth')).toBe('2024-03');
    });

    it('falls back to year for unknown formats', () => {
      expect(getDateValue(date, 'unknown-format')).toBe('2024');
    });
  });

  describe('isDateInRange', () => {
    it('accepts dates inside the range', () => {
      expect(isDateInRange(date, '2024-01-01', '2024-12-31')).toBe(true);
    });

    it('rejects dates before `after`', () => {
      expect(isDateInRange(date, '2024-06-01')).toBe(false);
    });

    it('rejects dates after `before`', () => {
      expect(isDateInRange(date, undefined, '2024-01-01')).toBe(false);
    });

    it('treats boundary dates as inclusive', () => {
      expect(isDateInRange(date, '2024-03-15', '2024-03-15')).toBe(true);
    });

    it('passes when no bounds given', () => {
      expect(isDateInRange(date)).toBe(true);
    });

    it('fails closed on invalid date strings', () => {
      // Invalid input must not silently match everything
      expect(isDateInRange(date, 'not-a-date')).toBe(false);
      expect(isDateInRange(date, undefined, 'also-not-a-date')).toBe(false);
    });
  });

  describe('formatDate', () => {
    it('returns ISO date part', () => {
      expect(formatDate(date)).toBe('2024-03-15');
    });
  });
});
