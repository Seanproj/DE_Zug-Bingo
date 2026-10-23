import { describe, expect, it } from 'vitest';
import { generateWeeklyCard } from '../app/game/card.ts';
import { marksFromRecords, unionRecords, updatePeriodDays, type DayRecord } from '../app/game/day.ts';
import type { VerifyMethod } from '../app/game/marks.ts';
import { config } from './helpers.ts';

const card = generateWeeklyCard(config, '2026-10-19');
const free = config.game.board.free_square.id;
const sq = (cell: number) => card.cells[cell]!.squareId;
const rec = (key: string, cells: [number, VerifyMethod][], checkin = false): DayRecord => ({
  key,
  updatedAt: key,
  marks: [...(checkin ? [{ squareId: free, method: 'self' as const, at: `${key}T07` }] : []), ...cells.map(([c, m]) => ({ squareId: sq(c), method: m, at: `${key}T08` }))],
});
const run = (days: DayRecord[], next: [number, VerifyMethod][], checkin?: boolean) =>
  updatePeriodDays({ card, days, today: '2026-10-21', next: new Map(next), now: '2026-10-21T09', checkin, freeId: free });

describe('unionRecords', () => {
  it('keeps one entry per square, earliest time, auto wins', () => {
    const u = unionRecords([
      [{ squareId: 'a', method: 'self', at: '2' }],
      [{ squareId: 'a', method: 'auto', at: '3' }, { squareId: 'b', method: 'self', at: '1' }],
    ]);
    expect(u).toEqual([{ squareId: 'a', method: 'auto', at: '2' }, { squareId: 'b', method: 'self', at: '1' }]);
  });
});

describe('updatePeriodDays', () => {
  const mon = rec('2026-10-19', [[0, 'self'], [1, 'self']], true);

  it('adds new checks to today and leaves earlier days alone', () => {
    const changed = run([mon], [[0, 'self'], [1, 'self'], [2, 'self']]);
    expect(changed).toHaveLength(1);
    expect(changed[0]!.key).toBe('2026-10-21');
    expect(changed[0]!.marks.map((m) => m.squareId)).toEqual([sq(2)]);
  });

  it('removes an unchecked square from the day that held it, keeping its check-in', () => {
    const changed = run([mon], [[1, 'self']]);
    expect(changed).toHaveLength(1);
    expect(changed[0]!.key).toBe('2026-10-19');
    expect(changed[0]!.marks.map((m) => m.squareId)).toEqual([free, sq(1)]);
  });

  it('upgrades self → auto in place without moving the square to today', () => {
    const changed = run([mon], [[0, 'auto'], [1, 'self']]);
    expect(changed.map((d) => d.key)).toEqual(['2026-10-19']);
    expect(changed[0]!.marks.find((m) => m.squareId === sq(0))!.method).toBe('auto');
  });

  it('records and clears today’s check-in', () => {
    const on = run([mon], [[0, 'self'], [1, 'self']], true);
    expect(on).toHaveLength(1);
    expect(on[0]!.marks).toEqual([{ squareId: free, method: 'self', at: '2026-10-21T09' }]);
    const today = on[0]!;
    const off = run([mon, today], [[0, 'self'], [1, 'self']], false);
    expect(off[0]!.marks).toEqual([]);
  });

  it('is a no-op when nothing changes', () => {
    expect(run([mon], [[0, 'self'], [1, 'self']])).toEqual([]);
  });

  it('round-trips: union of the updated days equals the requested marks', () => {
    const days = [mon, rec('2026-10-20', [[3, 'auto']])];
    const next: [number, VerifyMethod][] = [[1, 'self'], [3, 'auto'], [7, 'self']];
    const changed = run(days, next);
    const merged = new Map(days.map((d) => [d.key, d]));
    for (const d of changed) merged.set(d.key, d);
    expect(marksFromRecords(card, unionRecords([...merged.values()].map((d) => d.marks)))).toEqual(new Map(next));
  });
});
