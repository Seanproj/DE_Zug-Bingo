import { describe, expect, it } from 'vitest';
import { readConfigSources } from '../app/config/node.ts';
import { ConfigError, parseConfig } from '../app/config/schema.ts';
import type { LocaleStrings } from '../app/config/types.ts';
import { config } from './helpers.ts';

// Deep-cloned sources we can mutate per test.
const sources = () => structuredClone(readConfigSources()) as ReturnType<typeof readConfigSources> & {
  squares: { squares: Record<string, unknown>[] };
  rarity: { daily_card: { composition: Record<string, number> } };
  achievements: { achievements: { condition: Record<string, unknown> }[] };
  locales: Record<string, LocaleStrings>;
};

const problemsOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return (e as ConfigError).problems.join('\n');
  }
  throw new Error('expected ConfigError');
};

describe('config', () => {
  it('loads and cross-validates the shipped YAML (bundler + node loaders agree)', () => {
    expect(config.squares.length).toBeGreaterThanOrEqual(33);
    expect(config.squares.filter((s) => s.origin === 'original').length).toBeGreaterThanOrEqual(10);
    expect(parseConfig(readConfigSources()).squares).toEqual(config.squares);
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
    s.squares.squares.find((q) => q.id === 'on_time_ice')!.rarity = 'ultra';
    s.squares.squares.find((q) => q.id === 'delay_20')!.implies = ['nope'];
    const msg = problemsOf(() => parseConfig(s));
    expect(msg).toContain('unknown rarity "ultra"');
    expect(msg).toContain('implies unknown square "nope"');
  });

  it('rejects compositions that do not fill the board', () => {
    const s = sources();
    s.rarity.daily_card.composition.common = 8;
    expect(problemsOf(() => parseConfig(s))).toMatch(/sums to 23/);
  });

  it('rejects blessed lanes the composition cannot fill', () => {
    const s = sources();
    s.rarity.daily_card.composition.common = 7;
    s.rarity.daily_card.composition.uncommon = 8;
    expect(problemsOf(() => parseConfig(s))).toMatch(/blessed_lanes need 8 squares/);
  });

  it('rejects unknown achievement stats', () => {
    const s = sources();
    s.achievements.achievements[0]!.condition.stat = 'vibes';
    expect(problemsOf(() => parseConfig(s))).toMatch(/unknown stat "vibes"/);
  });
});

describe('locales', () => {
  it('ships ko, en, de', () => {
    expect(Object.keys(config.locales).sort()).toEqual(['de', 'en', 'ko']);
  });

  it('flags missing square text, overlong short labels and stray ui keys', () => {
    const s = sources();
    delete (s.locales.en!.squares as Record<string, unknown>).delay_5;
    s.locales.de!.squares.cancelled!.short = 'Viel zu lang für eine Zelle';
    delete s.locales.de!.ui['action.share'];
    s.locales.en!.ui['made.up'] = 'x';
    const msg = problemsOf(() => parseConfig(s));
    expect(msg).toContain('locales/en: squares.delay_5 needs label, short, flavor');
    expect(msg).toMatch(/locales\/de: squares.cancelled short .* exceeds 16/);
    expect(msg).toContain('locales/de: ui.action.share missing');
    expect(msg).toContain('locales/en: ui.made.up not in reference locale');
  });

  it('every ui placeholder in the reference exists in each translation', () => {
    const ref = config.locales[config.game.locales.reference]!.ui;
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [code, loc] of Object.entries(config.locales)) {
      for (const [key, text] of Object.entries(ref)) expect(vars(loc.ui[key]!), `${code} ${key}`).toEqual(vars(text));
    }
  });
});
