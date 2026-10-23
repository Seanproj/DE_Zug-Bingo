import { describe, expect, it } from 'vitest';
import { generateDailyCard } from '../app/game/card.ts';
import type { VerifyMethod } from '../app/game/marks.ts';
import { createI18n } from '../app/i18n/index.ts';
import { shareGrid, shareText } from '../app/share/text.ts';
import { config, fixtureCard } from './helpers.ts';

const ids = [
  'delay_120', 'delay_60', 'delay_20', 'delay_5', 'on_time_ice',
  'wifi_dead', 'priority', 'apology', 'funkloch', 'construction',
  'door_broken', 'coffee_out', 'FREE', 'wait_oncoming', 'delay_inherited',
  'platform_change', 'cancelled', 'repair', 'signal', 'toilet_closed',
  'info_follows', 'overcrowded', 'reverse_order', 'ac_broken', 'standing',
];
const card = fixtureCard(ids);
const m = (cells: number[], method: VerifyMethod = 'self') => new Map(cells.map((c) => [c, method]));

describe('shareGrid', () => {
  it('uses rarity emoji for checked cells, ⬜ for unchecked and 🫡 for the center', () => {
    expect(shareGrid(config, card, m([0, 1, 4, 5, 16]))).toBe(
      ['🟧🟦⬜⬜🌈', '🟩⬜⬜⬜⬜', '⬜⬜🫡⬜⬜', '⬜🟪⬜⬜⬜', '⬜⬜⬜⬜⬜'].join('\n'),
    );
  });
});

describe('shareText', () => {
  it('reports lines in the chosen language', () => {
    const row = m([0, 1, 2, 3, 4]);
    const en = shareText(config, createI18n(config, 'en'), card, row).split('\n');
    expect(en[0]).toBe('Zug-Bingo #1 🚆 1 line!');
    expect(en).toHaveLength(8);
    expect(en[7]).toBe('#ZugBingo');
    expect(shareText(config, createI18n(config, 'ko'), card, row).split('\n')[0]).toBe('Zug-Bingo #1 🚆 1줄!');
    expect(shareText(config, createI18n(config, 'de'), card, row).split('\n')[0]).toBe('Zug-Bingo #1 🚆 1 Reihe!');
  });

  it('shows a no-line status and a footer with checked count and score', () => {
    const text = shareText(config, createI18n(config, 'en'), card, m([5, 6])).split('\n');
    expect(text[0]).toBe('Zug-Bingo #1 🚆 still trying');
    expect(text[6]).toBe('2 squares · 20 pts');
  });

  it('works for a generated daily card', () => {
    const daily = generateDailyCard(config, '2026-11-01');
    expect(shareText(config, createI18n(config, 'ko'), daily, m([])).startsWith('Zug-Bingo #10 🚆')).toBe(true);
  });
});
