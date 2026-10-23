import { describe, expect, it } from 'vitest';
import { unlockedAchievements } from '../app/game/achievements.ts';
import { currentCard } from '../app/game/card.ts';
import { recordsFromMarks, type DayRecord } from '../app/game/day.ts';
import type { VerifyMethod } from '../app/game/marks.ts';
import { aggregate } from '../app/game/stats.ts';
import { config } from './helpers.ts';

const free = config.game.board.free_square.id;
/** A saved day where the given cells of that day's (weekly) card were checked. */
function day(key: string, cells: number[], method: VerifyMethod = 'self'): DayRecord {
  const card = currentCard(config, key);
  return { key, marks: recordsFromMarks(card, new Map(cells.map((c) => [c, method])), [], `${key}T08:00:00Z`), updatedAt: key };
}
const LANE: Record<string, number[]> = { r2: [10, 11, 13, 14], c2: [2, 7, 17, 22], d0: [0, 6, 18, 24], d1: [4, 8, 16, 20] };
const blessedLine = (key: string) => LANE[currentCard(config, key).blessedLines[0]!]!;

describe('aggregate (weekly cards)', () => {
  it('uses the weekly card by config', () => {
    expect(config.game.card.period).toBe('week');
  });

  it('is empty for no days and ignores empty days', () => {
    const { stats, collection } = aggregate(config, [{ key: '2026-10-23', marks: [], updatedAt: '' }], '2026-10-23');
    expect(stats.cardsPlayed).toBe(0);
    expect(collection.size).toBe(0);
  });

  it('counts squares, first-seen dates, verified checks and distinct squares', () => {
    const a = day('2026-10-19', [0, 1]);
    const b = day('2026-10-26', [0], 'auto');
    const { stats, collection } = aggregate(config, [b, a], '2026-10-26');
    expect(stats.cardsPlayed).toBe(2);
    expect(stats.verifiedCount).toBe(1);
    expect(collection.get(a.marks[0]!.squareId)!.first).toBe('2026-10-19');
    expect([...collection.values()].reduce((n, e) => n + e.count, 0)).toBe(3);
    expect(stats.distinctSquares).toBe(collection.size);
  });

  it('builds a line across several days of the same week and scores it once', () => {
    const lane = blessedLine('2026-10-19');
    const days = [day('2026-10-19', lane.slice(0, 2)), day('2026-10-21', lane.slice(2))];
    const { stats } = aggregate(config, days, '2026-10-21');
    expect(stats.cardsPlayed).toBe(2);
    expect(stats.bingoCards).toBe(1);
    expect(stats.totalScore).toBe(4 * 10 + config.game.scoring.bonus.line);
    expect(unlockedAchievements(config, stats).map((a) => a.id)).toContain('first_bingo');
  });

  it('does not join lines across different weeks', () => {
    const lane = blessedLine('2026-10-19');
    const { stats } = aggregate(config, [day('2026-10-19', lane.slice(0, 2)), day('2026-10-26', lane.slice(2))], '2026-10-26');
    expect(stats.bingoCards).toBe(0);
  });

  it('a check-in-only day keeps the streak alive but collects nothing', () => {
    const checkin = (key: string): DayRecord => ({ key, updatedAt: key, marks: [{ squareId: free, method: 'self', at: key }] });
    const { stats, collection } = aggregate(config, [checkin('2026-10-21'), checkin('2026-10-22'), day('2026-10-23', [0])], '2026-10-23');
    expect(stats.dailyStreak).toBe(3);
    expect(stats.cardsPlayed).toBe(3);
    expect(collection.size).toBe(1);
  });

  it('skips unknown squares in records', () => {
    const d: DayRecord = { key: '2026-10-23', updatedAt: '', marks: [{ squareId: 'retired_square', method: 'self', at: '' }] };
    expect(aggregate(config, [d], '2026-10-23').stats.cardsPlayed).toBe(0);
  });
});
