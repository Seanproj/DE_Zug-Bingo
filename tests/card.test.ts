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

  it.each(days.slice(0, 30))('%s: blessed lanes pass through the center and hold only low tiers', (key) => {
    const card = generateDailyCard(config, key);
    const lanes = config.rarity.daily_card.blessed_lanes!;
    expect(card.blessedLines).toHaveLength(lanes.count);
    for (const id of card.blessedLines) {
      const line = boardLines(card.size).find((l) => l.id === id)!;
      expect(line.cells).toContain(centerIndex(card.size));
      for (const i of line.cells) if (!card.cells[i]!.free) expect(tier(card.cells[i]!.squareId)).toBeLessThanOrEqual(lanes.max_tier);
    }
  });

  it('blessed lane choice varies across days', () => {
    const combos = new Set(days.map((k) => generateDailyCard(config, k).blessedLines.join('+')));
    expect(combos.size).toBe(6); // C(4,2)
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

import { generateWeeklyCard } from '../app/game/card.ts';
import { isoWeek, weekStart, weekday, weeklyNumber } from '../app/game/date.ts';

describe('weeks', () => {
  it('finds Monday and ISO week numbers', () => {
    expect(weekday('2026-10-19')).toBe(0);
    expect(weekday('2026-10-25')).toBe(6);
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(isoWeek('2026-10-23')).toEqual({ year: 2026, week: 43 });
    expect(isoWeek('2027-01-01')).toEqual({ year: 2026, week: 53 });
    expect(isoWeek('2026-01-01')).toEqual({ year: 2026, week: 1 });
  });

  it('numbers weeks from the epoch Monday', () => {
    expect(weeklyNumber('2026-10-23', '2026-10-19')).toBe(1);
    expect(weeklyNumber('2026-10-26', '2026-10-19')).toBe(2);
  });
});

describe('weekly card generation', () => {
  it('is the same card for every day of the week and changes on Monday', () => {
    const mon = generateWeeklyCard(config, '2026-10-19');
    expect(generateWeeklyCard(config, '2026-10-25')).toEqual(mon);
    expect(mon.key).toBe('2026-10-19');
    expect(mon.period).toBe('week');
    expect(mon.number).toBe(1);
    expect(generateWeeklyCard(config, '2026-10-26').cells).not.toEqual(mon.cells);
  });

  it('differs from the daily card of the same date', () => {
    expect(generateWeeklyCard(config, '2026-10-19').cells).not.toEqual(generateDailyCard(config, '2026-10-19').cells);
  });

  it('is pinned (regression guard — bump generator_version if this changes on purpose)', () => {
    expect(generateWeeklyCard(config, '2026-10-19').cells.map((c) => c.squareId)).toMatchSnapshot();
  });

  it.each(Array.from({ length: 26 }, (_, i) => addDays('2026-10-19', i * 7)))('%s: exact weekly composition', (key) => {
    const card = generateWeeklyCard(config, key);
    const counts: Record<string, number> = {};
    for (const c of card.cells) if (!c.free) counts[config.squareById.get(c.squareId)!.rarity] = (counts[config.squareById.get(c.squareId)!.rarity] ?? 0) + 1;
    expect(counts).toEqual(config.rarity.weekly_card.composition);
  });
});
