import { describe, expect, it } from 'vitest';
import { checkCell, impliedCells, uncheckCell, type VerifyMethod } from '../app/game/marks.ts';
import { scoreCard, squarePoints } from '../app/game/score.ts';
import { config, fixtureCard } from './helpers.ts';

// Row 0 = the whole delay ladder + one mythic; rest commons.
const ids = [
  'delay_120', 'delay_60', 'delay_20', 'delay_5', 'on_time_ice',
  'wifi_dead', 'priority', 'apology', 'funkloch', 'construction',
  'door_broken', 'coffee_out', 'FREE', 'wait_oncoming', 'delay_inherited',
  'platform_change', 'bistro_closed', 'repair', 'signal', 'toilet_closed',
  'info_follows', 'overcrowded', 'reverse_order', 'ac_broken', 'standing',
];
const card = fixtureCard(ids);
const m = (entries: [number, VerifyMethod][]) => new Map(entries);

describe('squarePoints', () => {
  it('multiplies rarity points by verify multiplier (1.5 auto / 1.0 self)', () => {
    expect(squarePoints(config, 'delay_5', 'self')).toBe(10);
    expect(squarePoints(config, 'delay_5', 'auto')).toBe(15);
    expect(squarePoints(config, 'on_time_ice', 'auto')).toBe(750);
    expect(squarePoints(config, 'delay_120', 'auto')).toBe(375);
  });

  it('rounds half points (uncommon 25 × 1.5 = 37.5 → 38)', () => {
    expect(squarePoints(config, 'delay_20', 'auto')).toBe(38);
  });

  it('free square is worth free_square_points', () => {
    expect(squarePoints(config, config.game.board.free_square.id, 'auto')).toBe(0);
  });
});

describe('scoreCard', () => {
  it('sums marked cells and ignores the free cell', () => {
    const s = scoreCard(config, card, m([[5, 'self'], [6, 'self'], [12, 'auto']]));
    expect(s.squarePoints).toBe(20);
    expect(s.lineBonus).toBe(0);
    expect(s.total).toBe(20);
  });

  it('adds line bonus per completed line', () => {
    // Row 0 fully auto-verified: 375 + 75 + 38 + 15 + 750 = 1253, + 1 line bonus
    const s = scoreCard(config, card, m([0, 1, 2, 3, 4].map((i) => [i, 'auto'])));
    expect(s.squarePoints).toBe(1253);
    expect(s.lineBonus).toBe(config.game.scoring.bonus.line);
    expect(s.total).toBe(1253 + config.game.scoring.bonus.line);
  });

  it('adds the blackout bonus on top of all 12 line bonuses', () => {
    const all = m(Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12).map((i) => [i, 'self']));
    const s = scoreCard(config, card, all);
    expect(s.lineBonus).toBe(12 * config.game.scoring.bonus.line);
    expect(s.blackoutBonus).toBe(config.game.scoring.bonus.blackout);
  });
});

describe('implies', () => {
  it('120-min delay also marks 60/20/5 when on the card', () => {
    expect(impliedCells(config, card, 0).sort()).toEqual([0, 1, 2, 3]);
  });

  it('implied cells inherit the method, but auto is never downgraded', () => {
    let marks = checkCell(config, card, m([]), 2, 'auto'); // delay_20 auto ⇒ delay_5 auto
    expect([...marks]).toEqual([[2, 'auto'], [3, 'auto']]);
    marks = checkCell(config, card, marks, 0, 'self');
    expect(marks.get(0)).toBe('self');
    expect(marks.get(1)).toBe('self');
    expect(marks.get(2)).toBe('auto');
  });

  it('checking the free cell is a no-op; uncheck only removes the tapped cell', () => {
    expect(checkCell(config, card, m([]), 12, 'self').size).toBe(0);
    const marks = checkCell(config, card, m([]), 0, 'self');
    expect([...uncheckCell(marks, 0).keys()].sort()).toEqual([1, 2, 3]);
  });
});
