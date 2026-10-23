import { describe, expect, it } from 'vitest';
import { boardLines, centerIndex } from '../app/game/board.ts';
import { generateDailyCard } from '../app/game/card.ts';
import { addDays } from '../app/game/date.ts';
import { config } from './helpers.ts';

const tier = (id: string) => config.rarityById.get(config.squareById.get(id)!.rarity)!.tier;
const days = Array.from({ length: 120 }, (_, i) => addDays('2026-10-23', i));

describe('daily card generation', () => {
  it('is deterministic: same date ⇒ identical card', () => {
    expect(generateDailyCard(config, '2026-10-23')).toEqual(generateDailyCard(config, '2026-10-23'));
  });

  it('is pinned (regression guard — bump generator_version if this changes on purpose)', () => {
    const ids = generateDailyCard(config, '2026-10-23').cells.map((c) => c.squareId);
    expect(ids).toMatchSnapshot();
  });

  it('differs between days', () => {
    const a = generateDailyCard(config, '2026-10-23').cells.map((c) => c.squareId);
    const b = generateDailyCard(config, '2026-10-24').cells.map((c) => c.squareId);
    expect(a).not.toEqual(b);
  });

  it('numbers cards from the epoch', () => {
    expect(generateDailyCard(config, config.game.daily.epoch).number).toBe(1);
    expect(generateDailyCard(config, addDays(config.game.daily.epoch, 141)).number).toBe(142);
  });

  it.each(days)('%s: free center, 24 distinct daily squares, exact composition, line caps', (key) => {
    const card = generateDailyCard(config, key);
    const size = config.game.board.size;
    expect(card.cells).toHaveLength(size * size);

    const center = card.cells[centerIndex(size)]!;
    expect(center).toEqual({ squareId: config.game.board.free_square.id, free: true });
    expect(card.cells.filter((c) => c.free)).toHaveLength(1);

    const ids = card.cells.filter((c) => !c.free).map((c) => c.squareId);
    expect(new Set(ids).size).toBe(24);
    for (const id of ids) expect(config.squareById.get(id)!.pools).toContain('daily');

    const counts: Record<string, number> = {};
    for (const id of ids) {
      const r = config.squareById.get(id)!.rarity;
      counts[r] = (counts[r] ?? 0) + 1;
    }
    expect(counts).toEqual(config.rarity.daily_card.composition);

    for (const cap of config.rarity.daily_card.line_caps) {
      for (const line of boardLines(size)) {
        const n = line.cells.filter((i) => !card.cells[i]!.free && tier(card.cells[i]!.squareId) >= cap.min_tier).length;
        expect(n, `${line.id} min_tier ${cap.min_tier}`).toBeLessThanOrEqual(cap.max);
      }
    }
  });

  it('uses most of the daily pool across a month (variety)', () => {
    const seen = new Set(days.slice(0, 30).flatMap((k) => generateDailyCard(config, k).cells.map((c) => c.squareId)));
    const pool = config.squares.filter((s) => s.pools.includes('daily'));
    expect(seen.size - 1).toBe(pool.length);
  });

  it('is independent of YAML square order', async () => {
    const shuffled = { ...config, squares: [...config.squares].reverse() };
    expect(generateDailyCard(shuffled, '2026-11-11')).toEqual(generateDailyCard(config, '2026-11-11'));
  });
});
