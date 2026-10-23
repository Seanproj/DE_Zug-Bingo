import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ConfigError, parseConfig } from '../app/config/schema.ts';
import { config } from './helpers.ts';

const raw = (n: string) => readFileSync(new URL(`../config/${n}.yaml`, import.meta.url), 'utf8');
const sources = () => ({ game: raw('game'), rarity: raw('rarity'), squares: raw('squares'), achievements: raw('achievements') });

describe('config', () => {
  it('loads and cross-validates the shipped YAML', () => {
    expect(config.squares.length).toBeGreaterThanOrEqual(33);
    expect(config.squares.filter((s) => s.origin === 'original').length).toBeGreaterThanOrEqual(10);
  });

  it('contains every square from HANDOFF §3', () => {
    const handoff = [
      'delay_5', 'delay_20', 'delay_60', 'delay_120', 'platform_change', 'cancelled', 'short_turn',
      'on_time_ice', 'ersatzverkehr', 'reverse_order', 'wifi_dead', 'bistro_closed', 'ac_broken',
      'repair', 'signal', 'priority', 'apology', 'standing', 'missed_conn', 'saved_conn',
      'faster_alt', 'funkloch', 'strike_day',
    ];
    for (const id of handoff) expect(config.squareById.get(id)?.origin, id).toBe('handoff');
  });

  it('keeps event-only squares out of the daily pool', () => {
    expect(config.squareById.get('strike_day')!.pools).toEqual(['event']);
  });

  it('reports every problem in a broken config', () => {
    const s = sources();
    s.squares = s.squares.replace('rarity: mythic', 'rarity: ultra').replace('implies: [delay_5]', 'implies: [nope]');
    try {
      parseConfig(s);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      const msg = (e as ConfigError).problems.join('\n');
      expect(msg).toContain('unknown rarity "ultra"');
      expect(msg).toContain('implies unknown square "nope"');
    }
  });

  it('rejects compositions that do not fill the board', () => {
    const s = sources();
    s.rarity = s.rarity.replace(/common: 7\n/, 'common: 6\n');
    expect(() => parseConfig(s)).toThrow(/sums to 23/);
  });

  it('rejects unknown achievement stats', () => {
    const s = sources();
    s.achievements = s.achievements.replace('stat: bingoCards', 'stat: vibes');
    expect(() => parseConfig(s)).toThrow(/unknown stat "vibes"/);
  });
});
