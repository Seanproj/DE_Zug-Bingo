import { describe, expect, it } from 'vitest';
import { generateDailyCard } from '../app/game/card.ts';
import { marksFromRecords, recordsFromMarks } from '../app/game/day.ts';
import { computeStreak } from '../app/game/streak.ts';
import { config } from './helpers.ts';

describe('day records', () => {
  const card = generateDailyCard(config, '2026-10-23');
  const idx = (id: string) => card.cells.findIndex((c) => c.squareId === id);

  it('round-trips marks through square-id records', () => {
    const marks = new Map([[0, 'self' as const], [5, 'auto' as const]]);
    const recs = recordsFromMarks(card, marks, [], '2026-10-23T08:00:00Z');
    expect(recs.map((r) => r.squareId)).toEqual([card.cells[0]!.squareId, card.cells[5]!.squareId]);
    expect(marksFromRecords(card, recs)).toEqual(marks);
  });

  it('keeps the first check time', () => {
    const first = recordsFromMarks(card, new Map([[0, 'self']]), [], 'T1');
    const again = recordsFromMarks(card, new Map([[0, 'self'], [1, 'self']]), first, 'T2');
    expect(again.map((r) => r.at)).toEqual(['T1', 'T2']);
  });

  it('ignores squares that are not on the card and the free square', () => {
    const marks = marksFromRecords(card, [
      { squareId: 'strike_day', method: 'self', at: 'x' },
      { squareId: config.game.board.free_square.id, method: 'self', at: 'x' },
      { squareId: card.cells[3]!.squareId, method: 'self', at: 'x' },
    ]);
    expect([...marks.keys()]).toEqual([3]);
    expect(idx('strike_day')).toBe(-1);
  });
});

describe('computeStreak', () => {
  it('counts a run ending today', () => {
    expect(computeStreak(['2026-10-21', '2026-10-22', '2026-10-23'], '2026-10-23')).toEqual({ current: 3, best: 3, playedToday: true });
  });

  it('keeps yesterday’s streak alive until today is played', () => {
    expect(computeStreak(['2026-10-21', '2026-10-22'], '2026-10-23')).toEqual({ current: 2, best: 2, playedToday: false });
  });

  it('breaks after a missed day but remembers the best run', () => {
    const s = computeStreak(['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-21'], '2026-10-23');
    expect(s).toEqual({ current: 0, best: 4, playedToday: false });
  });

  it('crosses month and DST boundaries', () => {
    expect(computeStreak(['2026-10-24', '2026-10-25', '2026-10-26'], '2026-10-26').current).toBe(3);
    expect(computeStreak(['2026-02-28', '2026-03-01'], '2026-03-01').current).toBe(2);
  });

  it('ignores future keys and duplicates', () => {
    expect(computeStreak(['2026-10-23', '2026-10-23', '2026-12-01'], '2026-10-23')).toEqual({ current: 1, best: 1, playedToday: true });
  });
});
