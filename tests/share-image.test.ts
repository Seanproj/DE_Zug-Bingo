import { describe, expect, it } from 'vitest';
import { SHARE_H, SHARE_W, shareLayout } from '../app/share/image.ts';

describe('shareLayout', () => {
  const l = shareLayout(5);

  it('fits a 5×5 grid inside the 1080×1350 canvas with room for header and footer', () => {
    expect(l.cells).toHaveLength(25);
    expect(l.grid.x + l.grid.w).toBeLessThanOrEqual(SHARE_W);
    expect(l.grid.y).toBeGreaterThanOrEqual(300);
    expect(l.grid.y + l.grid.h).toBeLessThanOrEqual(SHARE_H - 160);
  });

  it('uses square, evenly spaced cells', () => {
    for (const c of l.cells) expect(c.w).toBe(c.h);
    expect(l.cells[1]!.x - l.cells[0]!.x).toBeCloseTo(l.cells[0]!.w + l.gap);
    expect(l.cells[5]!.y - l.cells[0]!.y).toBeCloseTo(l.cells[0]!.h + l.gap);
  });

  it('is horizontally centred', () => {
    const last = l.cells[4]!;
    expect(l.cells[0]!.x).toBeCloseTo(SHARE_W - (last.x + last.w));
  });
});
