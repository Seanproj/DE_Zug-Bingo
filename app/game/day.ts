// Persisted per-day progress. Marks are stored by square id (not cell index) so a saved day
// stays meaningful even if the card layout changes (new generator_version).
import type { Card } from './card.ts';
import type { Marks, VerifyMethod } from './marks.ts';

export interface MarkRecord {
  squareId: string;
  method: VerifyMethod;
  /** ISO timestamp of the first check */
  at: string;
}

export interface DayRecord {
  /** YYYY-MM-DD */
  key: string;
  marks: MarkRecord[];
  updatedAt: string;
  /** generator_version the card was played with (lines/score are recomputed from the current generator) */
  generatorVersion?: number;
}

/** Saved records → cell marks on `card`. Squares no longer on the card are ignored. */
export function marksFromRecords(card: Pick<Card, 'cells'>, records: readonly MarkRecord[]): Map<number, VerifyMethod> {
  const indexOf = new Map(card.cells.map((c, i) => [c.squareId, i]));
  const marks = new Map<number, VerifyMethod>();
  for (const r of records) {
    const i = indexOf.get(r.squareId);
    if (i !== undefined && !card.cells[i]!.free) marks.set(i, r.method);
  }
  return marks;
}

/** Cell marks → records, keeping the original timestamp of squares that were already checked. */
export function recordsFromMarks(card: Pick<Card, 'cells'>, marks: Marks, previous: readonly MarkRecord[], now: string): MarkRecord[] {
  const prevAt = new Map(previous.map((r) => [r.squareId, r.at]));
  return [...marks]
    .sort((a, b) => a[0] - b[0])
    .map(([cell, method]) => {
      const squareId = card.cells[cell]!.squareId;
      return { squareId, method, at: prevAt.get(squareId) ?? now };
    });
}

/** Merge several days' records: one entry per square, earliest time, 'auto' wins over 'self'. */
export function unionRecords(days: readonly (readonly MarkRecord[])[]): MarkRecord[] {
  const out = new Map<string, MarkRecord>();
  for (const records of days)
    for (const r of records) {
      const prev = out.get(r.squareId);
      if (!prev) out.set(r.squareId, { ...r });
      else out.set(r.squareId, { squareId: r.squareId, method: prev.method === 'auto' || r.method === 'auto' ? 'auto' : 'self', at: prev.at < r.at ? prev.at : r.at });
    }
  return [...out.values()];
}

const sameMarks = (a: readonly MarkRecord[], b: readonly MarkRecord[]) =>
  a.length === b.length && a.every((m, i) => m.squareId === b[i]!.squareId && m.method === b[i]!.method && m.at === b[i]!.at);

export interface PeriodUpdate {
  /** the card the marks refer to (a multi-day card such as the weekly card) */
  card: Pick<Card, 'cells'>;
  /** every saved day that belongs to this card's period */
  days: readonly DayRecord[];
  today: string;
  /** desired union of marks on the card after the change */
  next: Marks;
  now: string;
  /** set/clear today's free-square check-in; undefined = leave as is */
  checkin?: boolean;
  freeId: string;
  generatorVersion?: number;
}

/**
 * Turn a desired card state into per-day records: new checks land on today, removed squares
 * disappear from whichever day held them, auto-verification upgrades in place. Returns only
 * the records that changed (today's record is created when needed).
 */
export function updatePeriodDays({ card, days, today, next, now, checkin, freeId, generatorVersion }: PeriodUpdate): DayRecord[] {
  const want = new Map<string, VerifyMethod>();
  for (const [cell, method] of next) {
    const c = card.cells[cell];
    if (c && !c.free) want.set(c.squareId, method);
  }
  const onCard = new Set(card.cells.map((c) => c.squareId));
  const seen = new Set<string>();
  const changed: DayRecord[] = [];
  const all = days.some((d) => d.key === today) ? days : [...days, { key: today, marks: [], updatedAt: now, generatorVersion }];

  // Pass 1: other days keep or drop; pass 2 (today) also receives new squares.
  const ordered = [...all.filter((d) => d.key !== today), ...all.filter((d) => d.key === today)];
  for (const day of ordered) {
    const isToday = day.key === today;
    let marks = day.marks
      .filter((m) => m.squareId === freeId || !onCard.has(m.squareId) || want.has(m.squareId))
      .map((m) => {
        if (m.squareId === freeId || !want.has(m.squareId)) return m;
        seen.add(m.squareId);
        return want.get(m.squareId) === 'auto' && m.method !== 'auto' ? { ...m, method: 'auto' as const } : m;
      });
    if (isToday) {
      for (const [squareId, method] of want) if (!seen.has(squareId)) marks.push({ squareId, method, at: now });
      const hasCheckin = marks.some((m) => m.squareId === freeId);
      if (checkin === true && !hasCheckin) marks = [{ squareId: freeId, method: 'self', at: now }, ...marks];
      if (checkin === false && hasCheckin) marks = marks.filter((m) => m.squareId !== freeId);
    }
    if (!sameMarks(marks, day.marks) || (isToday && !days.some((d) => d.key === today) && marks.length))
      changed.push({ ...day, marks, updatedAt: now, ...(generatorVersion !== undefined ? { generatorVersion } : {}) });
  }
  return changed;
}
