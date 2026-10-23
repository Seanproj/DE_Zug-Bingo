// Monte Carlo difficulty model for balance tuning (used by scripts/balance-report.ts).
// Model: each square happens independently with its probability (square override, else
// rarity default), then `implies` propagate. Real delays are correlated, so treat the
// numbers as relative difficulty, not a forecast.
import type { Config } from '../config/types.ts';
import { evaluateBingo } from './bingo.ts';
import { boardLines } from './board.ts';
import type { Card } from './card.ts';
import { impliedCells } from './marks.ts';
import { createRng } from './rng.ts';

export interface CardDifficulty {
  /** P(at least one line in a day) */
  pLine: number;
  /** P(at least two lines) */
  pTwoLines: number;
  pBlackout: number;
  expectedLines: number;
  expectedMarked: number;
  /** Best / worst single-line probability (independent model, implies ignored) */
  easiestLine: { id: string; p: number };
  hardestLine: { id: string; p: number };
}

export function squareProbability(config: Config, squareId: string): number {
  const sq = config.squareById.get(squareId);
  if (!sq) return 1; // free square
  return sq.probability ?? config.rarityById.get(sq.rarity)!.probability;
}

export function simulateCard(config: Config, card: Card, trials = 20_000, seed = 'balance'): CardDifficulty {
  const rng = createRng(`${seed}:${card.seed}`);
  const probs = card.cells.map((c) => (c.free ? 1 : squareProbability(config, c.squareId)));
  const implied = card.cells.map((_, i) => impliedCells(config, card, i));

  let line1 = 0,
    line2 = 0,
    blackout = 0,
    lines = 0,
    marked = 0;
  for (let t = 0; t < trials; t++) {
    const set = new Set<number>();
    probs.forEach((p, i) => {
      if (!card.cells[i]!.free && rng.next() < p) for (const j of implied[i]!) set.add(j);
    });
    const r = evaluateBingo(card, set);
    lines += r.lines.length;
    marked += set.size;
    if (r.lines.length >= 1) line1++;
    if (r.lines.length >= 2) line2++;
    if (r.blackout) blackout++;
  }

  const lineProbs = boardLines(card.size).map((l) => ({ id: l.id, p: l.cells.reduce((acc, i) => acc * probs[i]!, 1) }));
  lineProbs.sort((a, b) => b.p - a.p);
  return {
    pLine: line1 / trials,
    pTwoLines: line2 / trials,
    pBlackout: blackout / trials,
    expectedLines: lines / trials,
    expectedMarked: marked / trials,
    easiestLine: lineProbs[0]!,
    hardestLine: lineProbs[lineProbs.length - 1]!,
  };
}
