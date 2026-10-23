import { describe, expect, it } from 'vitest';
import { createRng, sample, shuffle } from '../app/game/rng.ts';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng('daily:2026-10-23');
    const b = createRng('daily:2026-10-23');
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    const a = createRng('daily:2026-10-23');
    const b = createRng('daily:2026-10-24');
    expect(a.next()).not.toBe(b.next());
  });

  it('produces values in [0,1) and roughly uniform ints', () => {
    const rng = createRng('uniform');
    const buckets = Array(10).fill(0);
    for (let i = 0; i < 20_000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      buckets[rng.int(10)]++;
    }
    for (const n of buckets) expect(n).toBeGreaterThan(1700);
  });

  it('shuffle is a permutation and does not mutate input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(createRng('s'), input);
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('sample rejects impossible counts', () => {
    expect(() => sample(createRng('x'), [1, 2], 3)).toThrow();
  });
});
