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
