// Achievement / title / level evaluation against aggregated player stats.
import type { Achievement, Condition, Config, Level, NumericStat, Title } from '../config/types.ts';

export type PlayerStats = Record<NumericStat, number> & {
  /** squareId → times collected */
  squareCounts: Record<string, number>;
  /** line name (e.g. "S3") → trips */
  lineTrips: Record<string, number>;
  /** station name → visits */
  stationVisits: Record<string, number>;
};

export function emptyStats(): PlayerStats {
  return {
    totalScore: 0,
    cardsPlayed: 0,
    bingoCards: 0,
    maxLinesOnCard: 0,
    blackouts: 0,
    dailyStreak: 0,
    bestStreak: 0,
    totalDelayMinutes: 0,
    compensationEur: 0,
    verifiedCount: 0,
    betWins: 0,
    distinctSquares: 0,
    squareCounts: {},
    lineTrips: {},
    stationVisits: {},
  };
}

export function meets(config: Config, stats: PlayerStats, c: Condition): boolean {
  switch (c.type) {
    case 'stat':
      return stats[c.stat] >= c.gte;
    case 'square':
      return (stats.squareCounts[c.square] ?? 0) >= c.gte;
    case 'rarity': {
      const minTier = config.rarityById.get(c.rarity)!.tier;
      let n = 0;
      for (const [id, count] of Object.entries(stats.squareCounts)) {
        const sq = config.squareById.get(id);
        if (sq && config.rarityById.get(sq.rarity)!.tier >= minTier) n += count;
      }
      return n >= c.gte;
    }
    case 'line_trips':
      return (stats.lineTrips[c.line] ?? 0) >= c.gte;
    case 'station_visits':
      return (stats.stationVisits[c.station] ?? 0) >= c.gte;
    case 'all':
      return c.of.every((sub) => meets(config, stats, sub));
  }
}

export function unlockedAchievements(config: Config, stats: PlayerStats): Achievement[] {
  return config.achievements.achievements.filter((a) => meets(config, stats, a.condition));
}

export function unlockedTitles(config: Config, stats: PlayerStats): Title[] {
  return config.achievements.titles.filter((t) => meets(config, stats, t.condition));
}

export interface LevelInfo {
  level: Level;
  /** 1-based, for "Lv.N" display */
  number: number;
  next?: Level;
  /** 0..1 progress towards `next` (1 at max level) */
  progress: number;
}

export function levelFor(config: Config, totalScore: number): LevelInfo {
  const levels = config.achievements.levels;
  let i = 0;
  while (i + 1 < levels.length && totalScore >= levels[i + 1]!.min_score) i++;
  const level = levels[i]!;
  const next = levels[i + 1];
  const progress = next ? (totalScore - level.min_score) / (next.min_score - level.min_score) : 1;
  return { level, number: i + 1, next, progress };
}
