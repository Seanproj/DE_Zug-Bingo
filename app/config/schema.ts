// Parse + validate the YAML sources. Throws ConfigError with every problem found,
// so a broken config fails loudly in tests and at build time instead of mid-game.
import {
  NUMERIC_STATS,
  type AchievementsConfig,
  type CardPool,
  type Condition,
  type Config,
  type GameConfig,
  type LocaleStrings,
  type RarityConfig,
  type RarityId,
  type RawConfigSources,
  type Square,
} from './types.ts';

export class ConfigError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid config:\n  - ${problems.join('\n  - ')}`);
    this.name = 'ConfigError';
  }
}

const RARITY_IDS: RarityId[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const POOLS: CardPool[] = ['daily', 'trip', 'event', 'season'];
const DEFAULT_POOLS: CardPool[] = ['daily', 'trip'];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isProb = (v: unknown) => isNum(v) && v >= 0 && v <= 1;
const isPattern = (v: unknown) => Array.isArray(v) && v.length > 0 && v.every((x) => isNum(x) && x >= 0);

export function parseConfig(src: RawConfigSources): Config {
  const problems: string[] = [];
  const req = (cond: unknown, msg: string) => {
    if (!cond) problems.push(msg);
  };

  const game = src.game as GameConfig;
  const rarity = src.rarity as RarityConfig;
  const rawSquares = (src.squares as { squares?: Partial<Square>[] })?.squares ?? [];
  const achievements = src.achievements as AchievementsConfig;
  const locales = src.locales as Record<string, LocaleStrings>;

  // ── game.yaml
  req(Number.isInteger(game?.generator_version), 'game.generator_version must be an integer');
  const size = game?.board?.size;
  req(Number.isInteger(size) && size >= 3 && size % 2 === 1, 'game.board.size must be an odd integer ≥ 3');
  req(isStr(game?.board?.free_square?.id), 'game.board.free_square.id is required');
  req(isStr(game?.daily?.timezone), 'game.daily.timezone is required');
  req(/^\d{4}-\d{2}-\d{2}$/.test(game?.daily?.epoch ?? ''), 'game.daily.epoch must be YYYY-MM-DD');
  req(isNum(game?.scoring?.verify_multiplier?.auto), 'game.scoring.verify_multiplier.auto must be a number');
  req(isNum(game?.scoring?.verify_multiplier?.self), 'game.scoring.verify_multiplier.self must be a number');
  req(isNum(game?.scoring?.bonus?.line) && isNum(game?.scoring?.bonus?.blackout), 'game.scoring.bonus.{line,blackout} required');
  req(isPattern(game?.feedback?.haptic?.line) && isPattern(game?.feedback?.haptic?.blackout), 'game.feedback.haptic.{line,blackout} must be ms lists');
  req(typeof game?.share?.hashtag === 'string' && typeof game?.share?.url === 'string', 'game.share.{hashtag,url} required');

  // ── rarity.yaml
  const rarities = rarity?.rarities ?? [];
  const rarityById = new Map(rarities.map((r) => [r.id, r]));
  for (const id of RARITY_IDS) req(rarityById.has(id), `rarity "${id}" is missing`);
  rarities.forEach((r, i) => {
    req(RARITY_IDS.includes(r.id), `unknown rarity id "${r.id}"`);
    req(r.tier === i, `rarity "${r.id}" tier must be ${i} (list order = tier order)`);
    req(isNum(r.points) && r.points >= 0, `rarity "${r.id}" needs points`);
    req(isProb(r.probability), `rarity "${r.id}" probability must be in [0,1]`);
    req(isStr(r.color) && isStr(r.share_emoji), `rarity "${r.id}" needs color and share_emoji`);
    req(isPattern(r.haptic), `rarity "${r.id}" haptic must be a list of ms`);
  });
  for (let i = 1; i < rarities.length; i++) {
    req(rarities[i]!.points > rarities[i - 1]!.points, `rarity points must increase with tier (${rarities[i]!.id})`);
  }

  // ── squares.yaml
  const squares: Square[] = rawSquares.map((s) => ({
    ...(s as Square),
    implies: s.implies ?? [],
    pools: s.pools ?? DEFAULT_POOLS,
  }));
  const squareById = new Map<string, Square>();
  for (const s of squares) {
    req(isStr(s.id) && /^[a-z0-9_]+$/.test(s.id), `square id "${s.id}" must be snake_case`);
    req(!squareById.has(s.id), `duplicate square id "${s.id}"`);
    req(s.id !== game?.board?.free_square?.id, `square id "${s.id}" collides with the free square`);
    squareById.set(s.id, s);
    req(isStr(s.term) && isStr(s.emoji), `square "${s.id}" needs term, emoji`);
    req(rarityById.has(s.rarity), `square "${s.id}" has unknown rarity "${s.rarity}"`);
    req(typeof s.verifiable === 'boolean', `square "${s.id}" needs verifiable: true/false`);
    req(!s.verifiable || isStr(s.verify?.type), `verifiable square "${s.id}" needs verify.type`);
    req(s.origin === 'handoff' || s.origin === 'original', `square "${s.id}" origin must be handoff|original`);
    req(s.pools.every((p) => POOLS.includes(p)), `square "${s.id}" has unknown pool`);
    req(s.probability === undefined || isProb(s.probability), `square "${s.id}" probability must be in [0,1]`);
  }
  for (const s of squares) {
    for (const t of s.implies) {
      req(squareById.has(t), `square "${s.id}" implies unknown square "${t}"`);
      req(t !== s.id, `square "${s.id}" implies itself`);
    }
  }

  // ── daily card composition must be satisfiable by the daily pool
  const comp = rarity?.daily_card?.composition ?? ({} as Record<RarityId, number>);
  const cells = Number.isInteger(size) ? size * size - 1 : 0;
  const total = RARITY_IDS.reduce((n, id) => n + (comp[id] ?? 0), 0);
  req(total === cells, `daily_card.composition sums to ${total}, board needs ${cells}`);
  for (const id of RARITY_IDS) {
    const available = squares.filter((s) => s.rarity === id && s.pools.includes('daily')).length;
    req((comp[id] ?? 0) <= available, `daily_card.composition.${id}=${comp[id]} but only ${available} daily squares`);
  }
  for (const cap of rarity?.daily_card?.line_caps ?? []) {
    req(Number.isInteger(cap.min_tier) && Number.isInteger(cap.max) && cap.max >= 1, 'line_caps entries need integer min_tier and max ≥ 1');
    const count = RARITY_IDS.filter((id) => (rarityById.get(id)?.tier ?? -1) >= cap.min_tier).reduce(
      (n, id) => n + (comp[id] ?? 0),
      0,
    );
    // Rows partition the board, so each row holding ≤ max squares is a hard upper bound.
    req(count <= cap.max * size, `line_caps min_tier ${cap.min_tier}: ${count} squares cannot fit ${cap.max}/line`);
  }

  const lanes = rarity?.daily_card?.blessed_lanes;
  if (lanes) {
    req(Number.isInteger(lanes.count) && lanes.count >= 0 && lanes.count <= 4, 'blessed_lanes.count must be 0..4 (lines through the center)');
    req(Number.isInteger(lanes.max_tier), 'blessed_lanes.max_tier must be an integer');
    const low = RARITY_IDS.filter((id) => (rarityById.get(id)?.tier ?? 99) <= lanes.max_tier).reduce((n, id) => n + (comp[id] ?? 0), 0);
    // Lines through the center only share the free cell, so each lane needs size-1 squares.
    const need = lanes.count * (size - 1);
    req(low >= need, `blessed_lanes need ${need} squares of tier ≤ ${lanes.max_tier}, composition has ${low}`);
  }

  // ── achievements.yaml
  const checkCondition = (c: Condition | undefined, where: string): void => {
    if (!c) return void problems.push(`${where}: condition missing`);
    switch (c.type) {
      case 'stat':
        req((NUMERIC_STATS as readonly string[]).includes(c.stat), `${where}: unknown stat "${c.stat}"`);
        break;
      case 'square':
        req(squareById.has(c.square), `${where}: unknown square "${c.square}"`);
        break;
      case 'rarity':
        req(rarityById.has(c.rarity), `${where}: unknown rarity "${c.rarity}"`);
        break;
      case 'line_trips':
        req(isStr(c.line), `${where}: line required`);
        break;
      case 'station_visits':
        req(isStr(c.station), `${where}: station required`);
        break;
      case 'all':
        req(Array.isArray(c.of) && c.of.length > 0, `${where}: all.of must be a non-empty list`);
        (c.of ?? []).forEach((sub, i) => checkCondition(sub, `${where}.of[${i}]`));
        return;
      default:
        problems.push(`${where}: unknown condition type "${(c as { type: string }).type}"`);
        return;
    }
    req(isNum((c as { gte: number }).gte), `${where}: gte must be a number`);
  };
  const seen = new Set<string>();
  for (const a of achievements?.achievements ?? []) {
    req(!seen.has(a.id), `duplicate achievement/title id "${a.id}"`);
    seen.add(a.id);
    checkCondition(a.condition, `achievement "${a.id}"`);
  }
  for (const t of achievements?.titles ?? []) {
    req(!seen.has(t.id), `duplicate achievement/title id "${t.id}"`);
    seen.add(t.id);
    checkCondition(t.condition, `title "${t.id}"`);
  }
  const levels = achievements?.levels ?? [];
  req(levels[0]?.min_score === 0, 'first level must have min_score 0');
  for (let i = 1; i < levels.length; i++) {
    req(levels[i]!.min_score > levels[i - 1]!.min_score, `levels must be in ascending min_score (${levels[i]!.id})`);
  }

  // ── locales/*.yaml — every supported locale must carry every text, ui keys mirror the reference
  const supported = game?.locales?.supported ?? [];
  const reference = locales?.[game?.locales?.reference];
  req(supported.includes(game?.locales?.reference) && supported.includes(game?.locales?.fallback), 'game.locales.reference/fallback must be supported');
  for (const code of supported) {
    const loc = locales?.[code];
    if (!loc) {
      problems.push(`locale "${code}" is missing (config/locales/${code}.yaml)`);
      continue;
    }
    const where = `locales/${code}`;
    req(isStr(loc.meta?.name) && isNum(loc.meta?.short_max), `${where}: meta.name and meta.short_max required`);
    const text = (t: Partial<{ label: string; short: string; flavor: string }> | undefined, what: string) => {
      req(isStr(t?.label) && isStr(t?.short) && isStr(t?.flavor), `${where}: ${what} needs label, short, flavor`);
      req((t?.short ?? '').length <= (loc.meta?.short_max ?? 0), `${where}: ${what} short "${t?.short}" exceeds ${loc.meta?.short_max} chars`);
    };
    text(loc.free_square, 'free_square');
    for (const s of squares) text(loc.squares?.[s.id], `squares.${s.id}`);
    for (const id of Object.keys(loc.squares ?? {})) req(squareById.has(id), `${where}: text for unknown square "${id}"`);
    for (const id of RARITY_IDS) req(isStr(loc.rarities?.[id]), `${where}: rarities.${id} missing`);
    for (const a of achievements?.achievements ?? [])
      req(isStr(loc.achievements?.[a.id]?.name) && isStr(loc.achievements?.[a.id]?.description), `${where}: achievements.${a.id} needs name, description`);
    for (const t of achievements?.titles ?? []) req(isStr(loc.titles?.[t.id]), `${where}: titles.${t.id} missing`);
    for (const l of levels) req(isStr(loc.levels?.[l.id]), `${where}: levels.${l.id} missing`);
    for (const key of Object.keys(reference?.ui ?? {})) req(isStr(loc.ui?.[key]), `${where}: ui.${key} missing`);
    for (const key of Object.keys(loc.ui ?? {})) req(key in (reference?.ui ?? {}), `${where}: ui.${key} not in reference locale`);
  }

  if (problems.length) throw new ConfigError(problems);
  return { game, rarity, squares, achievements, locales, rarityById, squareById };
}
