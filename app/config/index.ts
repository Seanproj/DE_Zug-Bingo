// Bundler entry: YAML is inlined at build time via Vite's ?raw imports.
import game from '../../config/game.yaml?raw';
import rarity from '../../config/rarity.yaml?raw';
import squares from '../../config/squares.yaml?raw';
import achievements from '../../config/achievements.yaml?raw';
import { parseConfig } from './schema.ts';

export const config = parseConfig({ game, rarity, squares, achievements });
export * from './types.ts';
