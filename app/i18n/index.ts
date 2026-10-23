// Locale selection + string lookup. Pure: give it the config and a locale code.
// Fallback chain for any key: chosen locale → game.locales.fallback → reference → the key itself.
import type { Config, LocaleStrings, RarityId, SquareText } from '../config/types.ts';

export type Vars = Record<string, string | number>;

export interface I18n {
  locale: string;
  meta: LocaleStrings['meta'];
  t(key: string, vars?: Vars): string;
  /** Picks `${key}_one` / `${key}_other` (or `${key}_zero` for 0 when present) via Intl.PluralRules. */
  plural(key: string, n: number, vars?: Vars): string;
  square(id: string): SquareText;
  rarity(id: RarityId): string;
  achievement(id: string): { name: string; description: string };
  title(id: string): string;
  level(id: string): string;
  /** "a, b and c" in the current language. */
  list(items: string[]): string;
  number(n: number): string;
}

/**
 * First supported locale matching the user's preferences ("de-AT" → "de"), else the fallback.
 * `override` (from settings) wins when supported.
 */
export function detectLocale(prefs: readonly string[], supported: readonly string[], fallback: string, override?: string | null): string {
  if (override && supported.includes(override)) return override;
  for (const pref of prefs) {
    const base = pref.toLowerCase().split('-')[0]!;
    if (supported.includes(base)) return base;
  }
  return fallback;
}

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : text);

export function createI18n(config: Config, locale: string): I18n {
  const { fallback, reference } = config.game.locales;
  const chain = [...new Set([locale, fallback, reference])].map((c) => config.locales[c]).filter((l): l is LocaleStrings => !!l);
  const primary = chain[0]!;
  const pick = <T>(get: (l: LocaleStrings) => T | undefined): T | undefined => {
    for (const l of chain) {
      const v = get(l);
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return undefined;
  };
  const rules = new Intl.PluralRules(locale);

  const t = (key: string, vars?: Vars) => fill(pick((l) => l.ui[key]) ?? key, vars);
  return {
    locale,
    meta: primary.meta,
    t,
    plural(key, n, vars) {
      const all = { n: this.number(n), ...vars };
      if (n === 0 && pick((l) => l.ui[`${key}_zero`])) return t(`${key}_zero`, all);
      const form = rules.select(n);
      return pick((l) => l.ui[`${key}_${form}`]) ? t(`${key}_${form}`, all) : t(`${key}_other`, all);
    },
    square: (id) =>
      id === config.game.board.free_square.id
        ? pick((l) => l.free_square)!
        : pick((l) => l.squares[id]) ?? { label: id, short: id, flavor: '' },
    rarity: (id) => pick((l) => l.rarities[id]) ?? id,
    achievement: (id) => pick((l) => l.achievements[id]) ?? { name: id, description: '' },
    title: (id) => pick((l) => l.titles[id]) ?? id,
    level: (id) => pick((l) => l.levels[id]) ?? id,
    list: (items) => new Intl.ListFormat(locale, { type: 'conjunction' }).format(items),
    number: (n) => new Intl.NumberFormat(locale).format(n),
  };
}
