// Bundler entry: YAML is turned into JSON at build time by scripts/vite-plugin-yaml.ts.
import game from '../../config/game.yaml';
import rarity from '../../config/rarity.yaml';
import squares from '../../config/squares.yaml';
import achievements from '../../config/achievements.yaml';
import ko from '../../config/locales/ko.yaml';
import en from '../../config/locales/en.yaml';
import de from '../../config/locales/de.yaml';
import { parseConfig } from './schema.ts';

export const config = parseConfig({ game, rarity, squares, achievements, locales: { ko, en, de } });
export * from './types.ts';
