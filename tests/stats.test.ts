import { describe, expect, it } from 'vitest';
import { unlockedAchievements } from '../app/game/achievements.ts';
import { generateDailyCard } from '../app/game/card.ts';
import { recordsFromMarks, type DayRecord } from '../app/game/day.ts';
import type { VerifyMethod } from '../app/game/marks.ts';
import { aggregate } from '../app/game/stats.ts';
import { config } from './helpers.ts';

/** A saved day where the given cells of that day's card were checked. */
function day(key: string, cells: number[], method: VerifyMethod = 'self'): DayRecord {
  const card = generateDailyCard(config, key);
  return { key, marks: recordsFromMarks(card, new Map(cells.map((c) => [c, method])), [], `${key}T08:00:00Z`), updatedAt: key };
}
const blessedLine = (key: string) => {
  const card = generateDailyCard(config, key);
  const id = card.blessedLines[0]!;
  const map: Record<string, number[]> = { r2: [10, 11, 13, 14], c2: [2, 7, 17, 22], d0: [0, 6, 18, 24], d1: [4, 8, 16, 20] };
  return map[id]!;
};

describe('aggregate', () => {
  it('is empty for no days and ignores days without checks', () => {
    const { stats, collection } = aggregate(config, [{ key: '2026-10-23', marks: [], updatedAt: '' }], '2026-10-23');
    expect(stats.cardsPlayed).toBe(0);
    expect(collection.size).toBe(0);
  });

  it('counts squares, first-seen dates, verified checks and distinct squares', () => {
    const a = day('2026-10-23', [0, 1]);
    const b = day('2026-10-24', [0], 'auto');
    const { stats, collection } = aggregate(config, [b, a], '2026-10-24');
    expect(stats.cardsPlayed).toBe(2);
    expect(stats.verifiedCount).toBe(1);
    const first = a.marks[0]!.squareId;
    expect(collection.get(first)!.first).toBe('2026-10-23');
    const total = [...collection.values()].reduce((n, e) => n + e.count, 0);
    expect(total).toBe(3);
    expect(stats.distinctSquares).toBe(collection.size);
  });

  it('recomputes lines and score per day and feeds achievements', () => {
    const key = '2026-10-23';
    const { stats } = aggregate(config, [day(key, blessedLine(key))], key);
    expect(stats.bingoCards).toBe(1);
    expect(stats.maxLinesOnCard).toBeGreaterThanOrEqual(1);
    // 4 commons × 10 + 1 line bonus
    expect(stats.totalScore).toBe(4 * 10 + config.game.scoring.bonus.line);
    expect(unlockedAchievements(config, stats).map((a) => a.id)).toContain('first_bingo');
  });

  it('tracks streaks across saved days', () => {
    const days = ['2026-10-21', '2026-10-22', '2026-10-23'].map((k) => day(k, [0]));
    const { stats } = aggregate(config, days, '2026-10-23');
    expect(stats.dailyStreak).toBe(3);
    expect(stats.bestStreak).toBe(3);
  });

  it('skips unknown and free squares in records', () => {
    const d: DayRecord = {
      key: '2026-10-23',
      updatedAt: '',
      marks: [
        { squareId: 'retired_square', method: 'self', at: '' },
        { squareId: config.game.board.free_square.id, method: 'self', at: '' },
      ],
    };
    expect(aggregate(config, [d], '2026-10-23').stats.cardsPlayed).toBe(0);
  });
});
