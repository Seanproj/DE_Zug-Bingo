// Node entry (scripts): reads the same YAML files from disk.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseConfig } from './schema.ts';
import type { Config } from './types.ts';

const dir = fileURLToPath(new URL('../../config/', import.meta.url));
const read = (name: string) => readFileSync(dir + name, 'utf8');

export function loadConfig(): Config {
  return parseConfig({
    game: read('game.yaml'),
    rarity: read('rarity.yaml'),
    squares: read('squares.yaml'),
    achievements: read('achievements.yaml'),
  });
}
