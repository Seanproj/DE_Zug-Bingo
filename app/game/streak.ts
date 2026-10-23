// Daily participation streaks. A day counts as played when at least one square was checked.
import { addDays } from './date.ts';

export interface Streak {
  /** Consecutive played days ending today — or yesterday, so the streak survives until you play today. */
  current: number;
  best: number;
  playedToday: boolean;
}

export function computeStreak(playedKeys: Iterable<string>, today: string): Streak {
  const played = new Set(playedKeys);
  const sorted = [...played].filter((k) => k <= today).sort();

  let best = 0;
  let run = 0;
  let prev: string | undefined;
  for (const key of sorted) {
    run = prev !== undefined && addDays(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }

  const playedToday = played.has(today);
  let cursor = playedToday ? today : addDays(today, -1);
  let current = 0;
  while (played.has(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }
  return { current, best, playedToday };
}
