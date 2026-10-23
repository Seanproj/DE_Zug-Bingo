import { describe, expect, it } from 'vitest';
import { generateDailyCard, generateWeeklyCard } from '../app/game/card.ts';
import { simulateCard, squareProbability } from '../app/game/simulate.ts';
import { config, sampleFixture } from './helpers.ts';

describe('simulateCard', () => {
  it('is reproducible', () => {
    const card = generateDailyCard(config, '2026-10-23');
    expect(simulateCard(config, card, 2000)).toEqual(simulateCard(config, card, 2000));
  });

  it('returns probabilities in range with easiest ≥ hardest line', () => {
    const card = sampleFixture();
    const d = simulateCard(config, card, 1000);
    expect(d.pLine).toBeGreaterThanOrEqual(0);
    expect(d.pLine).toBeLessThanOrEqual(1);
    const best = d.easiestLine;
    expect(typeof best.id).toBe('string');
    expect(best.p).toBeGreaterThanOrEqual(d.hardestLine.p);
  });

  it('uses square overrides before rarity defaults', () => {
    expect(squareProbability(config, 'delay_5')).toBe(config.squareById.get('delay_5')!.probability);
    expect(squareProbability(config, config.game.board.free_square.id)).toBe(1);
  });

  it('weekly cards land in the target band (≥1 line in 40–70% of weeks)', () => {
    for (const key of ['2026-10-19', '2026-12-21', '2027-03-01']) {
      const { pLine } = simulateCard(config, generateWeeklyCard(config, key), 4000, 'balance', config.game.weekly.active_days);
      expect(pLine, key).toBeGreaterThan(0.4);
      expect(pLine, key).toBeLessThan(0.7);
    }
  });

  it('a single realistic day on a 5×5 card is (deliberately) out of reach', () => {
    const { pLine } = simulateCard(config, generateDailyCard(config, '2026-10-23'), 4000);
    expect(pLine).toBeLessThan(0.05);
  });

  it('accumulating days makes squares more likely', () => {
    const card = generateWeeklyCard(config, '2026-10-19');
    expect(simulateCard(config, card, 2000, 'x', 5).expectedMarked).toBeGreaterThan(simulateCard(config, card, 2000, 'x', 1).expectedMarked);
  });
});
