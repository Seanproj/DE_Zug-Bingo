// Bingo detection. The free center always counts as marked.
import { boardLines } from './board.ts';
import type { Card } from './card.ts';

export interface BingoResult {
  /** Completed line ids in board order (r*, c*, d0, d1). */
  lines: string[];
  blackout: boolean;
  /** Lines missing exactly one cell — "한 칸 남음!" hints for the UI. */
  oneAway: { line: string; cell: number }[];
}

/** `marked` holds cell indices the player has checked (free cell optional). */
export function evaluateBingo(card: Pick<Card, 'size' | 'cells'>, marked: ReadonlySet<number>): BingoResult {
  const isMarked = (i: number) => card.cells[i]!.free || marked.has(i);
  const lines: string[] = [];
  const oneAway: BingoResult['oneAway'] = [];
  for (const line of boardLines(card.size)) {
    const missing = line.cells.filter((i) => !isMarked(i));
    if (missing.length === 0) lines.push(line.id);
    else if (missing.length === 1) oneAway.push({ line: line.id, cell: missing[0]! });
  }
  const blackout = card.cells.every((_, i) => isMarked(i));
  return { lines, blackout, oneAway };
}
