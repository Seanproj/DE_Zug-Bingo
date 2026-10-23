import { describe, expect, it } from 'vitest';
import { emptyStats, levelFor, meets, unlockedAchievements, unlockedTitles } from '../app/game/achievements.ts';
import { config } from './helpers.ts';

describe('achievements', () => {
  it('a fresh player has nothing', () => {
    expect(unlockedAchievements(config, emptyStats())).toEqual([]);
    expect(unlockedTitles(config, emptyStats())).toEqual([]);
  });

  it('unlocks stat-based achievements', () => {
    const s = { ...emptyStats(), bingoCards: 1, maxLinesOnCard: 3 };
    expect(unlockedAchievements(config, s).map((a) => a.id)).toEqual(['first_bingo', 'triple_line']);
  });

  it('rarity condition counts that tier and above', () => {
    const c = { type: 'rarity', rarity: 'legendary', gte: 2 } as const;
    expect(meets(config, { ...emptyStats(), squareCounts: { delay_120: 1, early_arrival: 1 } }, c)).toBe(true);
    expect(meets(config, { ...emptyStats(), squareCounts: { delay_120: 1, cancelled: 5 } }, c)).toBe(false);
  });

  it('grants titles from square counts and composite conditions', () => {
    const s = { ...emptyStats(), squareCounts: { on_time_ice: 1 }, totalDelayMinutes: 600, bestStreak: 14 };
    expect(unlockedTitles(config, s).map((t) => t.id)).toEqual(['on_time_witness', 'zen_commuter']);
  });

  it('line and station conditions', () => {
    const s = { ...emptyStats(), lineTrips: { S3: 50 }, stationVisits: { 'Frankfurt(Main)Hbf': 29 } };
    const ids = unlockedTitles(config, s).map((t) => t.id);
    expect(ids).toContain('s3_martyr');
    expect(ids).not.toContain('ffm_regular');
  });
});

describe('levels', () => {
  it('maps score to level with progress', () => {
    expect(levelFor(config, 0)).toMatchObject({ number: 1, progress: 0 });
    expect(levelFor(config, 250).level.id).toBe('fahrgast');
    expect(levelFor(config, 250).progress).toBeCloseTo(0.5);
    expect(levelFor(config, 500).level.id).toBe('pendler');
    const max = levelFor(config, 1e9);
    expect(max.level.id).toBe('gleis_legende');
    expect(max.next).toBeUndefined();
    expect(max.progress).toBe(1);
  });
});
