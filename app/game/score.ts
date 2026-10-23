// Score = Σ round(rarity points × verify multiplier) + bingo bonuses (all from config).
import type { Config } from '../config/types.ts';
import { evaluateBingo } from './bingo.ts';
import type { Card } from './card.ts';
import type { Marks, VerifyMethod } from './marks.ts';

export interface ScoreBreakdown {
  cells: { cell: number; squareId: string; method: VerifyMethod; points: number }[];
  squarePoints: number;
  lineBonus: number;
  blackoutBonus: number;
  total: number;
}

export function squarePoints(config: Config, squareId: string, method: VerifyMethod): number {
  const square = config.squareById.get(squareId);
  if (!square) return config.game.scoring.free_square_points;
  const base = config.rarityById.get(square.rarity)!.points;
  // A self-reported tap on a verifiable square is still worth the self multiplier.
  return Math.round(base * config.game.scoring.verify_multiplier[method]);
}

export function scoreCard(config: Config, card: Pick<Card, 'size' | 'cells'>, marks: Marks): ScoreBreakdown {
  const cells: ScoreBreakdown['cells'] = [];
  for (const [cell, method] of [...marks].sort((a, b) => a[0] - b[0])) {
    const c = card.cells[cell];
    if (!c || c.free) continue;
    cells.push({ cell, squareId: c.squareId, method, points: squarePoints(config, c.squareId, method) });
  }
  const bingo = evaluateBingo(card, new Set(marks.keys()));
  const { bonus } = config.game.scoring;
  const sq = cells.reduce((n, c) => n + c.points, 0);
  const lineBonus = bingo.lines.length * bonus.line;
  const blackoutBonus = bingo.blackout ? bonus.blackout : 0;
  return { cells, squarePoints: sq, lineBonus, blackoutBonus, total: sq + lineBonus + blackoutBonus };
}
