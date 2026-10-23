// Typed shape of config/*.yaml after parsing + validation (see schema.ts).

export type RarityId = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface Rarity {
  id: RarityId;
  tier: number;
  emoji: string;
  points: number;
  color: string;
  gradient?: string[];
  glow: string;
  share_emoji: string;
  probability: number;
  /** navigator.vibrate pattern on check */
  haptic: number[];
  effect: RarityEffect;
}

export const RARITY_EFFECTS = ['tap', 'pulse', 'spark', 'holo', 'gold', 'rainbow'] as const;
export type RarityEffect = (typeof RARITY_EFFECTS)[number];

export type CardPool = 'daily' | 'trip' | 'event' | 'season';

export interface VerifyRule {
  type: string;
  [key: string]: unknown;
}

export interface Square {
  id: string;
  /** Original German term as seen on boards/announcements. */
  term: string;
  emoji: string;
  rarity: RarityId;
  verifiable: boolean;
  verify?: VerifyRule;
  category: string;
  implies: string[];
  pools: CardPool[];
  probability?: number;
  origin: 'handoff' | 'original';
}

export interface FreeSquare {
  id: string;
  term: string;
  emoji: string;
}

export interface LineCap {
  min_tier: number;
  max: number;
}

export interface GameConfig {
  generator_version: number;
  locales: { supported: string[]; reference: string; fallback: string };
  board: { size: number; free_square: FreeSquare };
  daily: { timezone: string; epoch: string; seed_prefix: string };
  /** Which card the app plays: one per day or one per week (Mon–Sun, daily.timezone). */
  card: { period: 'day' | 'week' };
  weekly: { epoch: string; seed_prefix: string; active_days: number };
  scoring: {
    verify_multiplier: { auto: number; self: number };
    free_square_points: number;
    bonus: { line: number; blackout: number };
  };
  feedback: { haptic: { line: number[]; blackout: number[] } };
  share: { hashtag: string; url: string };
}

export interface BlessedLanes {
  count: number;
  max_tier: number;
}

export interface CardSpec {
  composition: Record<RarityId, number>;
  line_caps: LineCap[];
  blessed_lanes?: BlessedLanes;
}

export interface RarityConfig {
  rarities: Rarity[];
  share: { unchecked_emoji: string };
  daily_card: CardSpec;
  weekly_card: CardSpec;
}

export type Condition =
  | { type: 'stat'; stat: NumericStat; gte: number }
  | { type: 'square'; square: string; gte: number }
  | { type: 'rarity'; rarity: RarityId; gte: number }
  | { type: 'line_trips'; line: string; gte: number }
  | { type: 'station_visits'; station: string; gte: number }
  | { type: 'all'; of: Condition[] };

export const NUMERIC_STATS = [
  'totalScore',
  'cardsPlayed',
  'bingoCards',
  'maxLinesOnCard',
  'blackouts',
  'dailyStreak',
  'bestStreak',
  'totalDelayMinutes',
  'compensationEur',
  'verifiedCount',
  'betWins',
  'distinctSquares',
] as const;
export type NumericStat = (typeof NUMERIC_STATS)[number];

export interface Achievement {
  id: string;
  emoji: string;
  tier: 'bronze' | 'silver' | 'gold' | 'special';
  condition: Condition;
}

export interface Title {
  id: string;
  condition: Condition;
}

export interface Level {
  id: string;
  min_score: number;
}

export interface SquareText {
  label: string;
  short: string;
  flavor: string;
}

/** config/locales/<code>.yaml */
export interface LocaleStrings {
  meta: { name: string; short_max: number; show_term: boolean };
  rarities: Record<RarityId, string>;
  free_square: SquareText;
  squares: Record<string, SquareText>;
  achievements: Record<string, { name: string; description: string }>;
  titles: Record<string, string>;
  levels: Record<string, string>;
  ui: Record<string, string>;
}

export interface AchievementsConfig {
  achievements: Achievement[];
  titles: Title[];
  levels: Level[];
}

/** Everything the game core needs, already cross-validated. */
export interface Config {
  game: GameConfig;
  rarity: RarityConfig;
  squares: Square[];
  achievements: AchievementsConfig;
  locales: Record<string, LocaleStrings>;
  /** Lookup helpers built once at parse time. */
  rarityById: Map<RarityId, Rarity>;
  squareById: Map<string, Square>;
}

/** Parsed-but-unvalidated YAML documents (Vite inlines them as JSON at build time). */
export interface RawConfigSources {
  game: unknown;
  rarity: unknown;
  squares: unknown;
  achievements: unknown;
  locales: Record<string, unknown>;
}
