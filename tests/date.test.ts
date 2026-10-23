import { describe, expect, it } from 'vitest';
import { addDays, dailyNumber, dateKey, daysBetween } from '../app/game/date.ts';

describe('date', () => {
  it('uses the Berlin calendar day, not UTC', () => {
    // 23:30 UTC on Oct 22 is already 01:30 on Oct 23 in Berlin (CEST, UTC+2)
    expect(dateKey(new Date('2026-10-22T23:30:00Z'), 'Europe/Berlin')).toBe('2026-10-23');
    expect(dateKey(new Date('2026-10-22T21:59:00Z'), 'Europe/Berlin')).toBe('2026-10-22');
    // winter time (CET, UTC+1)
    expect(dateKey(new Date('2026-12-31T23:00:00Z'), 'Europe/Berlin')).toBe('2027-01-01');
  });

  it('counts daily numbers from the epoch', () => {
    expect(dailyNumber('2026-10-23', '2026-10-23')).toBe(1);
    expect(dailyNumber('2026-11-01', '2026-10-23')).toBe(10);
  });

  it('is DST-safe across the October switch', () => {
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});
