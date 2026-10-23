// Card generation. Pure and deterministic: same seed + same config ⇒ same card.
import type { CardPool, Config, LineCap, RarityId, Square } from '../config/types.ts';
import { centerIndex, linesByCell } from './board.ts';
import { dailyNumber } from './date.ts';
import { createRng, sample, shuffle, type Rng } from './rng.ts';

export interface CardCell {
  squareId: string;
  free: boolean;
}

export interface Card {
  kind: CardPool;
  /** Daily: YYYY-MM-DD. */
  key: string;
  /** Daily: Zug-Bingo #N. */
  number: number;
  seed: string;
  size: number;
  generatorVersion: number;
  cells: CardCell[];
}

export interface GenerateOptions {
  seed: string;
  pool: CardPool;
  composition: Record<RarityId, number>;
  lineCaps: LineCap[];
}

/** Place squares on the board. Returns the grid of square ids (center excluded = null). */
function place(rng: Rng, config: Config, picked: Square[], lineCaps: LineCap[]): (string | null)[] {
  const size = config.game.board.size;
  const center = centerIndex(size);
  const byCell = linesByCell(size);
  const tierOf = (s: Square) => config.rarityById.get(s.rarity)!.tier;
  const grid: (string | null)[] = Array(size * size).fill(null);
  // counts[capIndex][lineId] = squares of tier ≥ cap.min_tier already in that line
  const counts = lineCaps.map(() => new Map<string, number>());

  const minCapTier = Math.min(...lineCaps.map((c) => c.min_tier), Infinity);
  const constrained = picked
    .filter((s) => tierOf(s) >= minCapTier)
    .sort((a, b) => tierOf(b) - tierOf(a)); // stable: ties keep pick order
  const rest = picked.filter((s) => tierOf(s) < minCapTier);

  const fits = (cell: number, tier: number) =>
    lineCaps.every((cap, k) => tier < cap.min_tier || byCell[cell]!.every((l) => (counts[k]!.get(l.id) ?? 0) < cap.max));
  const bump = (cell: number, tier: number, delta: number) =>
    lineCaps.forEach((cap, k) => {
      if (tier < cap.min_tier) return;
      for (const l of byCell[cell]!) counts[k]!.set(l.id, (counts[k]!.get(l.id) ?? 0) + delta);
    });

  let budget = 200_000;
  const solve = (i: number): boolean => {
    if (i === constrained.length) return true;
    if (--budget < 0) throw new Error('card placement budget exhausted — line_caps too strict?');
    const sq = constrained[i]!;
    const tier = tierOf(sq);
    const open = grid.map((v, idx) => (v === null && idx !== center ? idx : -1)).filter((idx) => idx >= 0);
    for (const cell of shuffle(rng, open)) {
      if (!fits(cell, tier)) continue;
      grid[cell] = sq.id;
      bump(cell, tier, 1);
      if (solve(i + 1)) return true;
      bump(cell, tier, -1);
      grid[cell] = null;
    }
    return false;
  };
  if (!solve(0)) throw new Error('no placement satisfies line_caps');

  const remaining = grid.map((v, idx) => (v === null && idx !== center ? idx : -1)).filter((idx) => idx >= 0);
  shuffle(rng, rest).forEach((sq, k) => (grid[remaining[k]!] = sq.id));
  return grid;
}

export function generateCard(config: Config, opts: GenerateOptions): Omit<Card, 'key' | 'number'> {
  const { size, free_square } = config.game.board;
  const rng = createRng(`${opts.seed}#v${config.game.generator_version}`);

  // Pick per rarity in tier order from an id-sorted pool, so YAML reordering never changes cards.
  const picked: Square[] = [];
  for (const r of config.rarity.rarities) {
    const pool = config.squares
      .filter((s) => s.rarity === r.id && s.pools.includes(opts.pool))
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    picked.push(...sample(rng, pool, opts.composition[r.id] ?? 0));
  }

  const grid = place(rng, config, picked, opts.lineCaps);
  const center = centerIndex(size);
  const cells = grid.map((id, idx) =>
    idx === center ? { squareId: free_square.id, free: true } : { squareId: id!, free: false },
  );
  return { kind: opts.pool, seed: opts.seed, size, generatorVersion: config.game.generator_version, cells };
}

export function dailySeed(config: Config, key: string): string {
  return `${config.game.daily.seed_prefix}:${key}`;
}

/** Today's shared card. `key` is a YYYY-MM-DD in the daily timezone (see date.ts). */
export function generateDailyCard(config: Config, key: string): Card {
  const card = generateCard(config, {
    seed: dailySeed(config, key),
    pool: 'daily',
    composition: config.rarity.daily_card.composition,
    lineCaps: config.rarity.daily_card.line_caps,
  });
  return { ...card, key, number: dailyNumber(key, config.game.daily.epoch) };
}
