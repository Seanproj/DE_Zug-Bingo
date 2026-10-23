// Applying a check to a card, including `implies` chains (120분 지연 ⇒ 60/20/5분 지연).
import type { Config } from '../config/types.ts';
import type { Card } from './card.ts';

export type VerifyMethod = 'auto' | 'self';

/** cell index → how it was checked */
export type Marks = ReadonlyMap<number, VerifyMethod>;

/** Cells a check on `cell` would mark: the cell itself plus every implied square present on the card. */
export function impliedCells(config: Config, card: Pick<Card, 'cells'>, cell: number): number[] {
  const indexOf = new Map(card.cells.map((c, i) => [c.squareId, i]));
  const out: number[] = [];
  const seen = new Set<string>();
  const visit = (squareId: string) => {
    if (seen.has(squareId)) return;
    seen.add(squareId);
    const idx = indexOf.get(squareId);
    if (idx !== undefined) out.push(idx);
    for (const next of config.squareById.get(squareId)?.implies ?? []) visit(next);
  };
  visit(card.cells[cell]!.squareId);
  return out;
}

/**
 * Check `cell`. Implied cells inherit the method; an existing 'auto' mark is never
 * downgraded to 'self'. Free cells are ignored. Returns a new map.
 */
export function checkCell(config: Config, card: Pick<Card, 'cells'>, marks: Marks, cell: number, method: VerifyMethod): Map<number, VerifyMethod> {
  const next = new Map(marks);
  if (card.cells[cell]?.free) return next;
  for (const i of impliedCells(config, card, cell)) {
    if (card.cells[i]!.free) continue;
    if (next.get(i) !== 'auto') next.set(i, method);
  }
  return next;
}

/** Uncheck only the tapped cell (implied cells stay — the player may have earned them separately). */
export function uncheckCell(marks: Marks, cell: number): Map<number, VerifyMethod> {
  const next = new Map(marks);
  next.delete(cell);
  return next;
}
