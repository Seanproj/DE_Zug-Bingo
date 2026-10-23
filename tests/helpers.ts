import { config } from '../app/config/index.ts';
import type { Card } from '../app/game/card.ts';

export { config };

/** Hand-built 5×5 card: cell i holds `ids[i]`, center is free. */
export function fixtureCard(ids: string[]): Card {
  return {
    kind: 'daily',
    period: 'day',
    key: '2026-01-01',
    number: 1,
    seed: 'fixture',
    size: 5,
    generatorVersion: 0,
    blessedLines: [],
    cells: ids.map((id, i) => (i === 12 ? { squareId: config.game.board.free_square.id, free: true } : { squareId: id, free: false })),
  };
}

/** A real 5×5 fixture using 24 distinct daily squares (rarities mixed). */
export function sampleFixture(): Card {
  const ids = config.squares.filter((s) => s.pools.includes('daily')).map((s) => s.id).slice(0, 24);
  ids.splice(12, 0, 'FREE');
  return fixtureCard(ids);
}
