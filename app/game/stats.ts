// Aggregate every saved day into PlayerStats (achievements, levels) and the collection (도감).
import type { Config } from '../config/types.ts';
import type { PlayerStats } from './achievements.ts';
import { emptyStats } from './achievements.ts';
import { evaluateBingo } from './bingo.ts';
import { currentCard } from './card.ts';
import { marksFromRecords, unionRecords, type DayRecord } from './day.ts';
import { scoreCard } from './score.ts';
import { computeStreak } from './streak.ts';

export interface CollectionEntry {
  count: number;
  /** YYYY-MM-DD of the first day it was checked */
  first: string;
}

export interface Progress {
  stats: PlayerStats;
  collection: Map<string, CollectionEntry>;
}

/**
 * Pure aggregation. Square counts come straight from the saved day records (layout-independent);
 * lines and score are recomputed per card (a day or a week, per game.yaml card.period) from the
 * union of that card's days. A day with only the 🫡 check-in still counts as played.
 */
export function aggregate(config: Config, days: Iterable<DayRecord>, today: string): Progress {
  const stats = emptyStats();
  const collection = new Map<string, CollectionEntry>();
  const played: string[] = [];
  const free = config.game.board.free_square.id;
  const byCard = new Map<string, DayRecord[]>();

  for (const day of [...days].sort((a, b) => (a.key < b.key ? -1 : 1))) {
    const valid = day.marks.filter((m) => m.squareId === free || config.squareById.has(m.squareId));
    if (valid.length === 0) continue;
    played.push(day.key);
    stats.cardsPlayed++;
    for (const m of valid) {
      if (m.squareId === free) continue;
      stats.squareCounts[m.squareId] = (stats.squareCounts[m.squareId] ?? 0) + 1;
      if (m.method === 'auto') stats.verifiedCount++;
      const entry = collection.get(m.squareId);
      if (entry) entry.count++;
      else collection.set(m.squareId, { count: 1, first: day.key });
    }
    const cardKey = currentCard(config, day.key).key;
    byCard.set(cardKey, [...(byCard.get(cardKey) ?? []), day]);
  }

  for (const [cardKey, cardDays] of byCard) {
    const card = currentCard(config, cardKey);
    const marks = marksFromRecords(card, unionRecords(cardDays.map((d) => d.marks)));
    const bingo = evaluateBingo(card, new Set(marks.keys()));
    stats.totalScore += scoreCard(config, card, marks).total;
    if (bingo.lines.length > 0) stats.bingoCards++;
    stats.maxLinesOnCard = Math.max(stats.maxLinesOnCard, bingo.lines.length);
    if (bingo.blackout) stats.blackouts++;
  }

  const streak = computeStreak(played, today);
  stats.dailyStreak = streak.current;
  stats.bestStreak = streak.best;
  stats.distinctSquares = collection.size;
  return { stats, collection };
}
