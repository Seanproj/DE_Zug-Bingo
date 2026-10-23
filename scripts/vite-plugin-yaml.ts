// Inline *.yaml imports as JSON at build time, so the runtime bundle never ships a YAML parser.
import { parse } from 'yaml';
import type { Plugin } from 'vite';

export function yamlPlugin(): Plugin {
  return {
    name: 'zug-bingo:yaml',
    transform(code, id) {
      if (!/\.ya?ml$/.test(id)) return null;
      return { code: `export default ${JSON.stringify(parse(code))};`, map: null };
    },
  };
}
