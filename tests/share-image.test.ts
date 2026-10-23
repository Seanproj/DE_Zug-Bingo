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

import { wrapText } from '../app/share/image.ts';

describe('wrapText', () => {
  const measure = (s: string) => s.length * 10; // 10px per char

  it('wraps Latin text on spaces, never inside words', () => {
    expect(wrapText(measure, 'Anschluss weg', 100, 2)).toEqual(['Anschluss', 'weg']);
  });

  it('refuses when a word cannot fit (caller shrinks the font)', () => {
    expect(wrapText(measure, 'Bauarbeiten', 100, 2)).toBeNull();
  });

  it('breaks at soft hyphens and shows a hyphen', () => {
    expect(wrapText(measure, '„Signal\u00ADstörung“', 100, 2)).toEqual(['„Signal-', 'störung“']);
  });

  it('wraps Korean by character', () => {
    expect(wrapText(measure, '반대편열차대기', 50, 2)).toEqual(['반대편열차', '대기']);
  });

  it('keeps Korean words together when there are spaces', () => {
    expect(wrapText(measure, '반대편 열차 대기', 60, 2)).toEqual(['반대편 열차', '대기']);
  });
});
