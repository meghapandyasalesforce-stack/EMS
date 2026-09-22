/**
 * Unit tests for Birthday & Work Anniversary celebration helpers.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getMonthDayInTimezone,
  getCalendarMonthDay,
  daysUntilMonthDay,
  matchesMonthDay,
  getTodayPartsInTimezone,
  getDatePartsDaysFromToday,
  calculateCompletedYears,
  calculateMarriageCompletedYears,
  buildCelebrationEventKey,
  isOrgNineAmWindow,
  hasReachedOrgNineAm,
  isOrgMorningNotifyWindow,
  resolveMorningNotifyTimezone,
  formatCelebrationDateLabel,
} from '../../helpers/celebrationDateHelper.js';

describe('celebrationDateHelper', () => {
  describe('matchesMonthDay', () => {
    it('matches birthday by month/day ignoring birth year', () => {
      const birthDate = new Date('1998-08-25T00:00:00.000Z');
      expect(matchesMonthDay(birthDate, 8, 25, 'Asia/Kolkata')).toBe(true);
      expect(matchesMonthDay(birthDate, 8, 24, 'Asia/Kolkata')).toBe(false);
      expect(matchesMonthDay(birthDate, 8, 26, 'Asia/Kolkata')).toBe(false);
    });

    it('does not match birthday 6 or 8 days away', () => {
      const birthDate = new Date('1998-08-25T00:00:00.000Z');
      expect(matchesMonthDay(birthDate, 8, 19, 'Asia/Kolkata')).toBe(false);
      expect(matchesMonthDay(birthDate, 8, 27, 'Asia/Kolkata')).toBe(false);
    });
  });

  describe('getDatePartsDaysFromToday', () => {
    it('returns exactly 7 calendar days ahead in org timezone', () => {
      const ref = new Date('2026-08-18T03:30:00.000Z'); // 9:00 AM IST
      const inSeven = getDatePartsDaysFromToday('Asia/Kolkata', 7, ref);
      expect(inSeven.month).toBe(8);
      expect(inSeven.day).toBe(25);
      expect(inSeven.year).toBe(2026);
    });
  });

  describe('calculateCompletedYears', () => {
    it('calculates completed work anniversary years correctly', () => {
      const joiningDate = new Date('2023-08-25T00:00:00.000Z');
      expect(calculateCompletedYears(joiningDate, 2026, 'Asia/Kolkata')).toBe(3);
      expect(calculateCompletedYears(joiningDate, 2023, 'Asia/Kolkata')).toBe(0);
    });
  });

  describe('calculateMarriageCompletedYears', () => {
    it('calculates completed marriage anniversary years correctly', () => {
      const marriageDate = new Date('2020-05-15T00:00:00.000Z');
      expect(calculateMarriageCompletedYears(marriageDate, 2026, 'Asia/Kolkata')).toBe(6);
      expect(calculateMarriageCompletedYears(marriageDate, 2020, 'Asia/Kolkata')).toBe(0);
    });

    it('returns 0 for missing or invalid dates or future dates', () => {
      expect(calculateMarriageCompletedYears(null, 2026, 'Asia/Kolkata')).toBe(0);
      expect(calculateMarriageCompletedYears('invalid-date', 2026, 'Asia/Kolkata')).toBe(0);
      expect(calculateMarriageCompletedYears(new Date('2030-01-01'), 2026, 'Asia/Kolkata')).toBe(0);
    });
  });

  describe('buildCelebrationEventKey', () => {
    it('builds deterministic idempotency keys', () => {
      expect(buildCelebrationEventKey('birthday-today', 'emp1', 2026)).toBe(
        'birthday-today:emp1:2026'
      );
    });
  });

  describe('isOrgNineAmWindow', () => {
    it('returns true only at 9:00 AM org local time', () => {
      const nineAmIst = new Date('2026-08-18T03:30:00.000Z');
      const nineOhOneIst = new Date('2026-08-18T03:31:00.000Z');
      expect(isOrgNineAmWindow('Asia/Kolkata', nineAmIst)).toBe(true);
      expect(isOrgNineAmWindow('Asia/Kolkata', nineOhOneIst)).toBe(false);
    });

    it('hasReachedOrgNineAm is true at and after 9:00 AM', () => {
      const eightFiftyNine = new Date('2026-08-18T03:29:00.000Z');
      const fourPm = new Date('2026-08-18T10:30:00.000Z');
      expect(hasReachedOrgNineAm('Asia/Kolkata', eightFiftyNine)).toBe(false);
      expect(hasReachedOrgNineAm('Asia/Kolkata', new Date('2026-08-18T03:30:00.000Z'))).toBe(true);
      expect(hasReachedOrgNineAm('Asia/Kolkata', fourPm)).toBe(true);
    });

    it('isOrgMorningNotifyWindow is true only during 9:00–9:59 AM', () => {
      const eightFiftyNine = new Date('2026-08-18T03:29:00.000Z');
      const nineAm = new Date('2026-08-18T03:30:00.000Z');
      const nineFiftyNine = new Date('2026-08-18T04:29:00.000Z');
      const tenAm = new Date('2026-08-18T04:30:00.000Z');
      const fourPm = new Date('2026-08-18T10:30:00.000Z');
      expect(isOrgMorningNotifyWindow('Asia/Kolkata', eightFiftyNine)).toBe(false);
      expect(isOrgMorningNotifyWindow('Asia/Kolkata', nineAm)).toBe(true);
      expect(isOrgMorningNotifyWindow('Asia/Kolkata', nineFiftyNine)).toBe(true);
      expect(isOrgMorningNotifyWindow('Asia/Kolkata', tenAm)).toBe(false);
      expect(isOrgMorningNotifyWindow('Asia/Kolkata', fourPm)).toBe(false);
    });

    it('resolveMorningNotifyTimezone maps bare UTC to Asia/Kolkata for morning alerts', () => {
      expect(resolveMorningNotifyTimezone('UTC')).toBe('Asia/Kolkata');
      expect(resolveMorningNotifyTimezone('Asia/Kolkata')).toBe('Asia/Kolkata');
      expect(resolveMorningNotifyTimezone('America/New_York')).toBe('America/New_York');
    });
  });

  describe('formatCelebrationDateLabel', () => {
    it('formats date as "25 August"', () => {
      expect(formatCelebrationDateLabel(8, 25)).toBe('25 August');
    });
  });

  describe('getTodayPartsInTimezone', () => {
    it('returns correct local date parts', () => {
      const ref = new Date('2026-08-25T03:30:00.000Z');
      const today = getTodayPartsInTimezone('Asia/Kolkata', ref);
      expect(today.month).toBe(8);
      expect(today.day).toBe(25);
      expect(today.year).toBe(2026);
    });
  });

  describe('getMonthDayInTimezone', () => {
    it('extracts month/day from stored date in org timezone', () => {
      const parts = getMonthDayInTimezone(new Date('1998-08-25T00:00:00.000Z'), 'Asia/Kolkata');
      expect(parts).toEqual({ month: 8, day: 25 });
    });
  });

  describe('daysUntilMonthDay', () => {
    const refNineAmIst = new Date('2026-08-18T03:30:00.000Z');

    it('returns 0 when birthday is today, even after midnight', () => {
      expect(daysUntilMonthDay(new Date('1998-08-18T00:00:00.000Z'), 'Asia/Kolkata', refNineAmIst)).toBe(0);
    });

    it('returns 7 when birthday is exactly 7 calendar days away', () => {
      expect(daysUntilMonthDay(new Date('1998-08-25T00:00:00.000Z'), 'Asia/Kolkata', refNineAmIst)).toBe(7);
    });

    it('returns 6 and 8 for nearby dates', () => {
      expect(daysUntilMonthDay(new Date('1998-08-24T00:00:00.000Z'), 'Asia/Kolkata', refNineAmIst)).toBe(6);
      expect(daysUntilMonthDay(new Date('1998-08-26T00:00:00.000Z'), 'Asia/Kolkata', refNineAmIst)).toBe(8);
    });

    it('treats UTC-midnight date-only values as calendar dates', () => {
      expect(getCalendarMonthDay(new Date('1998-08-25T00:00:00.000Z'), 'Asia/Kolkata')).toEqual({
        month: 8,
        day: 25,
      });
    });
  });
});
