import { describe, expect, it } from 'vitest';
import { generateDailyCard } from '../app/game/card.ts';
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
    expect(squareProbability(config, 'delay_5')).toBe(config.rarityById.get('common')!.probability);
    expect(squareProbability(config, config.game.board.free_square.id)).toBe(1);
  });

  it('daily cards land in the target difficulty band (≥1 line on 10–35% of days)', () => {
    for (const key of ['2026-10-23', '2026-12-24', '2027-03-01']) {
      const { pLine } = simulateCard(config, generateDailyCard(config, key), 4000);
      expect(pLine, key).toBeGreaterThan(0.1);
      expect(pLine, key).toBeLessThan(0.35);
    }
  });
});
