// Node entry (scripts): reads the same YAML files from disk.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { parseConfig } from './schema.ts';
import type { Config, RawConfigSources } from './types.ts';

const dir = fileURLToPath(new URL('../../config/', import.meta.url));
const read = (name: string) => parse(readFileSync(dir + name, 'utf8'));

export function readConfigSources(): RawConfigSources {
  const locales: Record<string, unknown> = {};
  for (const f of readdirSync(dir + 'locales')) if (f.endsWith('.yaml')) locales[f.slice(0, -5)] = read(`locales/${f}`);
  return {
    game: read('game.yaml'),
    rarity: read('rarity.yaml'),
    squares: read('squares.yaml'),
    achievements: read('achievements.yaml'),
    locales,
  };
}

export function loadConfig(): Config {
  return parseConfig(readConfigSources());
}
