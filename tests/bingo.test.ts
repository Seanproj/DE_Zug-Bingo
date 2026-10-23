import { describe, expect, it } from 'vitest';
import { boardLines } from '../app/game/board.ts';
import { evaluateBingo } from '../app/game/bingo.ts';
import { sampleFixture } from './helpers.ts';

const card = sampleFixture();
const set = (...cells: number[]) => new Set(cells);

describe('board lines', () => {
  it('has 5 rows, 5 columns, 2 diagonals', () => {
    const lines = boardLines(5);
    expect(lines).toHaveLength(12);
    expect(lines.find((l) => l.id === 'd0')!.cells).toEqual([0, 6, 12, 18, 24]);
    expect(lines.find((l) => l.id === 'd1')!.cells).toEqual([4, 8, 12, 16, 20]);
    expect(lines.find((l) => l.id === 'c2')!.cells).toEqual([2, 7, 12, 17, 22]);
  });
});

describe('evaluateBingo', () => {
  it('nothing marked ⇒ no lines', () => {
    const r = evaluateBingo(card, set());
    expect(r.lines).toEqual([]);
    expect(r.blackout).toBe(false);
  });

  it('detects a row', () => {
    expect(evaluateBingo(card, set(0, 1, 2, 3, 4)).lines).toEqual(['r0']);
  });

  it('detects a column', () => {
    expect(evaluateBingo(card, set(4, 9, 14, 19, 24)).lines).toEqual(['c4']);
  });

  it('counts the free center: 4 cells complete the middle row / column / diagonals', () => {
    expect(evaluateBingo(card, set(10, 11, 13, 14)).lines).toEqual(['r2']);
    expect(evaluateBingo(card, set(2, 7, 17, 22)).lines).toEqual(['c2']);
    expect(evaluateBingo(card, set(0, 6, 18, 24)).lines).toEqual(['d0']);
    expect(evaluateBingo(card, set(4, 8, 16, 20)).lines).toEqual(['d1']);
  });

  it('counts overlapping lines independently', () => {
    const r = evaluateBingo(card, set(0, 1, 2, 3, 4, 5, 10, 15, 20, 6, 18, 24));
    expect(r.lines.sort()).toEqual(['c0', 'd0', 'r0']);
  });

  it('4 of 5 is not a line, but reports one-away', () => {
    const r = evaluateBingo(card, set(0, 1, 2, 3));
    expect(r.lines).toEqual([]);
    expect(r.oneAway).toContainEqual({ line: 'r0', cell: 4 });
  });

  it('blackout = all 24 non-free cells, giving all 12 lines', () => {
    const all = set(...Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12));
    const r = evaluateBingo(card, all);
    expect(r.blackout).toBe(true);
    expect(r.lines).toHaveLength(12);
    expect(r.oneAway).toEqual([]);
  });

  it('23 cells is not a blackout', () => {
    const almost = set(...Array.from({ length: 25 }, (_, i) => i).filter((i) => i !== 12 && i !== 0));
    expect(evaluateBingo(card, almost).blackout).toBe(false);
  });

  it('ignores marks on the free cell', () => {
    expect(evaluateBingo(card, set(12))).toEqual(evaluateBingo(card, set()));
  });
});
