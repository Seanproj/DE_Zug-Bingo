// Card generation. Pure and deterministic: same seed + same config ⇒ same card.
import type { BlessedLanes, CardPool, Config, LineCap, RarityId, Square } from '../config/types.ts';
import { boardLines, centerIndex, linesByCell } from './board.ts';
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
  /** 🫡 Lines through the free square that hold only low-tier squares — the day's "realistic" goal. */
  blessedLines: string[];
}

export interface GenerateOptions {
  seed: string;
  pool: CardPool;
  composition: Record<RarityId, number>;
  lineCaps: LineCap[];
  blessedLanes?: BlessedLanes;
}

interface Placement {
  grid: (string | null)[];
  blessedLines: string[];
}

/**
 * Place squares on the board (center stays null):
 *   1. blessed lanes — pick lines through the center, fill them with low-tier squares
 *   2. squares covered by line_caps — backtracking so no line exceeds its cap
 *   3. everything else — shuffled into the remaining cells
 */
function place(rng: Rng, config: Config, picked: Square[], lineCaps: LineCap[], lanes?: BlessedLanes): Placement {
  const size = config.game.board.size;
  const center = centerIndex(size);
  const byCell = linesByCell(size);
  const tierOf = (s: Square) => config.rarityById.get(s.rarity)!.tier;
  const grid: (string | null)[] = Array(size * size).fill(null);
  // counts[capIndex][lineId] = squares of tier ≥ cap.min_tier already in that line
  const counts = lineCaps.map(() => new Map<string, number>());

  const fits = (cell: number, tier: number) =>
    lineCaps.every((cap, k) => tier < cap.min_tier || byCell[cell]!.every((l) => (counts[k]!.get(l.id) ?? 0) < cap.max));
  const bump = (cell: number, tier: number, delta: number) =>
    lineCaps.forEach((cap, k) => {
      if (tier < cap.min_tier) return;
      for (const l of byCell[cell]!) counts[k]!.set(l.id, (counts[k]!.get(l.id) ?? 0) + delta);
    });

  let pool = picked.slice();
  const blessedLines: string[] = [];
  if (lanes && lanes.count > 0) {
    const through = boardLines(size).filter((l) => l.cells.includes(center));
    const chosen = shuffle(rng, through).slice(0, lanes.count);
    const cells = [...new Set(chosen.flatMap((l) => l.cells))].filter((i) => i !== center);
    const low = shuffle(rng, pool.filter((s) => tierOf(s) <= lanes.max_tier));
    if (low.length < cells.length) throw new Error('not enough low-tier squares for blessed lanes');
    cells.forEach((cell, k) => {
      grid[cell] = low[k]!.id;
      bump(cell, tierOf(low[k]!), 1);
    });
    const used = new Set(low.slice(0, cells.length));
    pool = pool.filter((s) => !used.has(s));
    blessedLines.push(...chosen.map((l) => l.id).sort());
  }

  const minCapTier = Math.min(...lineCaps.map((c) => c.min_tier), Infinity);
  const constrained = pool
    .filter((s) => tierOf(s) >= minCapTier)
    .sort((a, b) => tierOf(b) - tierOf(a)); // stable: ties keep pick order
  const rest = pool.filter((s) => tierOf(s) < minCapTier);

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
  return { grid, blessedLines };
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

  const { grid, blessedLines } = place(rng, config, picked, opts.lineCaps, opts.blessedLanes);
  const center = centerIndex(size);
  const cells = grid.map((id, idx) =>
    idx === center ? { squareId: free_square.id, free: true } : { squareId: id!, free: false },
  );
  return { kind: opts.pool, seed: opts.seed, size, generatorVersion: config.game.generator_version, cells, blessedLines };
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
    blessedLanes: config.rarity.daily_card.blessed_lanes,
  });
  return { ...card, key, number: dailyNumber(key, config.game.daily.epoch) };
}
