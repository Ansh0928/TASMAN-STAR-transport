import { describe, it, expect } from 'vitest';
import { toAEST, fromAEST, formatAEST, nowAEST } from './dates';

describe('toAEST', () => {
  it('converts UTC midnight to AEST (UTC+10)', () => {
    const utcMidnight = new Date('2024-06-15T00:00:00.000Z');
    const aest = toAEST(utcMidnight);
    expect(aest.getHours()).toBe(10);
    expect(aest.getDate()).toBe(15);
  });

  it('converts UTC 14:00 to AEST next day 00:00', () => {
    const utc = new Date('2024-06-15T14:00:00.000Z');
    const aest = toAEST(utc);
    expect(aest.getHours()).toBe(0);
    expect(aest.getDate()).toBe(16);
  });

  it('accepts ISO string input', () => {
    const aest = toAEST('2024-06-15T00:00:00.000Z');
    expect(aest.getHours()).toBe(10);
  });

  it('handles year boundary (UTC Dec 31 23:00 → AEST Jan 1 09:00)', () => {
    const utc = new Date('2024-12-31T23:00:00.000Z');
    const aest = toAEST(utc);
    expect(aest.getFullYear()).toBe(2025);
    expect(aest.getMonth()).toBe(0);
    expect(aest.getDate()).toBe(1);
    expect(aest.getHours()).toBe(9);
  });

  it('handles leap year date', () => {
    const utc = new Date('2024-02-29T20:00:00.000Z');
    const aest = toAEST(utc);
    expect(aest.getDate()).toBe(1);
    expect(aest.getMonth()).toBe(2); // March
  });

  it('Brisbane has no DST - offset is always +10', () => {
    const winter = toAEST(new Date('2024-07-01T00:00:00.000Z'));
    const summer = toAEST(new Date('2024-01-01T00:00:00.000Z'));
    expect(winter.getHours()).toBe(10);
    expect(summer.getHours()).toBe(10);
  });
});

describe('fromAEST', () => {
  it('converts AEST 10:00 to UTC 00:00', () => {
    const aestDate = new Date(2024, 5, 15, 10, 0, 0);
    const utc = fromAEST(aestDate);
    expect(utc.getUTCHours()).toBe(0);
  });

  it('converts AEST midnight to UTC previous day 14:00', () => {
    const aestDate = new Date(2024, 5, 15, 0, 0, 0);
    const utc = fromAEST(aestDate);
    expect(utc.getUTCHours()).toBe(14);
    expect(utc.getUTCDate()).toBe(14);
  });
});

describe('formatAEST', () => {
  it('formats with default format string', () => {
    const result = formatAEST('2024-06-15T00:00:00.000Z');
    expect(result).toBe('15/06/2024 10:00');
  });

  it('formats with custom format string', () => {
    const result = formatAEST('2024-06-15T00:00:00.000Z', 'yyyy-MM-dd');
    expect(result).toBe('2024-06-15');
  });

  it('formats with time-only format', () => {
    const result = formatAEST('2024-06-15T03:30:00.000Z', 'HH:mm:ss');
    expect(result).toBe('13:30:00');
  });

  it('accepts Date object', () => {
    const result = formatAEST(new Date('2024-06-15T00:00:00.000Z'));
    expect(result).toBe('15/06/2024 10:00');
  });
});

describe('nowAEST', () => {
  it('returns a Date object', () => {
    const now = nowAEST();
    expect(now).toBeInstanceOf(Date);
  });

  it('returns a reasonable time (not in the distant past or future)', () => {
    const now = nowAEST();
    const currentYear = new Date().getFullYear();
    expect(now.getFullYear()).toBeGreaterThanOrEqual(currentYear - 1);
    expect(now.getFullYear()).toBeLessThanOrEqual(currentYear + 1);
  });
});
