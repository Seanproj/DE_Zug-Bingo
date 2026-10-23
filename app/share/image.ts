// 1080×1350 (Instagram portrait) share card, drawn on a canvas. Layout is pure and tested;
// drawing needs a browser CanvasRenderingContext2D.
import type { Config } from '../config/types.ts';
import { boardLines } from '../game/board.ts';
import { evaluateBingo } from '../game/bingo.ts';
import type { Card } from '../game/card.ts';
import type { Marks } from '../game/marks.ts';
import { scoreCard } from '../game/score.ts';
import type { I18n } from '../i18n/index.ts';
import { addDays } from '../game/date.ts';
import { cardTitle } from './text.ts';

export const SHARE_W = 1080;
export const SHARE_H = 1350;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ShareLayout {
  grid: Rect;
  cells: Rect[];
  gap: number;
}

/** Cell rectangles for a size×size grid centred horizontally, starting at `top`. */
export function shareLayout(size: number, top = 330, side = 120, gap = 14): ShareLayout {
  const gridW = SHARE_W - side * 2;
  const cell = (gridW - gap * (size - 1)) / size;
  const cells: Rect[] = [];
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++) cells.push({ x: side + c * (cell + gap), y: top + r * (cell + gap), w: cell, h: cell });
  return { grid: { x: side, y: top, w: gridW, h: gridW }, cells, gap };
}

const FONT = `'Pretendard Variable', Pretendard, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Segoe UI', system-ui, sans-serif`;
const MONO = `ui-monospace, 'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace`;
const EMOJI = `'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif`;

function roundRect(ctx: CanvasRenderingContext2D, { x, y, w, h }: Rect, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

/** Break into ≤ maxLines lines: words for Latin text (soft hyphens allowed), characters for CJK. */
export function wrapText(measure: (s: string) => number, text: string, maxW: number, maxLines: number): string[] | null {
  const cjk = CJK.test(text) && !text.includes(' ');
  const tokens = cjk ? [...text] : text.split(/(?<= )|(?<=\u00AD)/);
  const lines: string[] = [];
  let line = '';
  for (const tok of tokens) {
    const next = line + tok;
    if (measure(next.replace(/\u00AD/g, '').trimEnd()) <= maxW || !line) line = next;
    else {
      lines.push(line);
      line = tok;
    }
  }
  if (line) lines.push(line);
  const clean = lines.map((l) => (l.endsWith('\u00AD') ? l.replace(/\u00AD/g, '') + '-' : l.replace(/\u00AD/g, '')).trim());
  if (clean.length > maxLines || clean.some((l) => measure(l) > maxW)) return null;
  return clean;
}

/** Largest font size (≤ start) at which `text` fits in maxLines; returns lines + size. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, start: number, min: number) {
  for (let size = start; size >= min; size--) {
    ctx.font = `800 ${size}px ${FONT}`;
    const lines = wrapText((s) => ctx.measureText(s).width, text, maxW, maxLines);
    if (lines) return { lines, size };
  }
  ctx.font = `800 ${min}px ${FONT}`;
  return { lines: [text.replace(/\u00AD/g, '')], size: min };
}

export interface ShareImageInput {
  config: Config;
  i18n: I18n;
  card: Card;
  marks: Marks;
  /** e.g. "Lv.3 단골 승객 · 환승의 신" */
  byline?: string;
}

export function drawShareImage(ctx: CanvasRenderingContext2D, { config, i18n, card, marks, byline }: ShareImageInput): void {
  const bingo = evaluateBingo(card, new Set(marks.keys()));
  const score = scoreCard(config, card, marks);
  const layout = shareLayout(card.size);
  const rainbow = config.rarityById.get('mythic')!.gradient ?? ['#fff'];
  const L = layout.grid.x;
  const R = SHARE_W - L;

  // background
  ctx.fillStyle = '#0b0f17';
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  const glow = ctx.createRadialGradient(SHARE_W / 2, -200, 50, SHARE_W / 2, -200, 1100);
  glow.addColorStop(0, 'rgba(59,158,255,0.28)');
  glow.addColorStop(1, 'rgba(59,158,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  // header
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#9aa6bd';
  ctx.font = `700 30px ${MONO}`;
  ctx.letterSpacing = '8px';
  ctx.fillText(`ZUG-BINGO ${cardTitle(card)}`, L, 120);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = '#5f6b85';
  ctx.font = `600 28px ${MONO}`;
  const fmt = new Intl.DateTimeFormat(i18n.locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const at = (k: string) => new Date(`${k}T12:00:00Z`);
  const date = card.period === 'week' ? fmt.formatRange(at(card.key), at(addDays(card.key, 6))) : fmt.format(at(card.key));
  ctx.textAlign = 'right';
  ctx.fillText(date, R, 120);
  ctx.textAlign = 'left';

  const status = bingo.blackout ? 'BLACKOUT' : bingo.lines.length ? `BINGO ×${bingo.lines.length}` : `${i18n.number(score.total)}`;
  ctx.font = `900 112px ${MONO}`;
  const grad = ctx.createLinearGradient(L, 0, L + ctx.measureText(status).width, 0);
  rainbow.forEach((c, i) => grad.addColorStop(i / (rainbow.length - 1), c));
  ctx.fillStyle = bingo.lines.length || bingo.blackout ? grad : '#e9eef7';
  ctx.fillText(status, L - 4, 245);
  ctx.fillStyle = '#9aa6bd';
  ctx.font = `600 32px ${FONT}`;
  const checked = [...marks.keys()].filter((i) => !card.cells[i]!.free).length;
  ctx.fillText(
    `${i18n.t('header.checked', { n: checked })} · ${i18n.t('sheet.points', { points: i18n.number(score.total) })}`,
    L,
    295,
  );

  // cells
  card.cells.forEach((cell, i) => {
    const rect = layout.cells[i]!;
    const sq = config.squareById.get(cell.squareId);
    const rarity = sq && config.rarityById.get(sq.rarity)!;
    const isChecked = cell.free || marks.has(i);
    const color = rarity?.color ?? '#ffd36a';
    roundRect(ctx, rect, 28);
    if (cell.free) {
      ctx.fillStyle = '#2a2614';
      ctx.fill();
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = '#ffd36a';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (isChecked) {
      if (rarity!.id === 'mythic') {
        const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
        rainbow.forEach((c, k) => g.addColorStop(k / (rainbow.length - 1), c));
        ctx.fillStyle = g;
      } else ctx.fillStyle = rarity!.id === 'common' ? '#eef2f9' : color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 30;
      ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#161d2c';
      ctx.fill();
      ctx.strokeStyle = color + '88';
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    // emoji
    ctx.globalAlpha = isChecked ? 1 : 0.45;
    ctx.textAlign = 'center';
    ctx.font = `64px ${EMOJI}`;
    ctx.fillText(sq?.emoji ?? config.game.board.free_square.emoji, rect.x + rect.w / 2, rect.y + 86);
    // label
    ctx.globalAlpha = isChecked ? 1 : 0.6;
    ctx.fillStyle = cell.free ? '#ffd36a' : isChecked ? '#0b0f17' : '#e9eef7';
    const { lines, size } = fitText(ctx, i18n.square(cell.squareId).short, rect.w - 18, 2, 25, 17);
    lines.forEach((l, k) => ctx.fillText(l, rect.x + rect.w / 2, rect.y + 124 + k * (size + 3) - (lines.length - 1) * 8));
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  });

  // bingo lines
  const geo = boardLines(card.size);
  const cellW = layout.cells[0]!.w;
  const center = (i: number) => [layout.cells[i]!.x + cellW / 2, layout.cells[i]!.y + cellW / 2] as const;
  ctx.lineCap = 'round';
  for (const id of bingo.lines) {
    const line = geo.find((l) => l.id === id)!;
    const [x1, y1] = center(line.cells[0]!);
    const [x2, y2] = center(line.cells[line.cells.length - 1]!);
    for (const [w, c] of [[26, 'rgba(255,211,106,0.35)'], [9, '#fff8e1']] as const) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = w;
      ctx.strokeStyle = c;
      ctx.stroke();
    }
  }

  // footer
  const fy = layout.grid.y + layout.grid.h + 66;
  if (byline) {
    ctx.fillStyle = '#e9eef7';
    ctx.font = `700 32px ${FONT}`;
    ctx.fillText(byline, L, fy);
  }
  ctx.fillStyle = '#5f6b85';
  ctx.font = `500 24px ${FONT}`;
  ctx.fillText(`${i18n.t('share.img_unofficial')} · ${i18n.t('footer.data')}`, L, SHARE_H - 52);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9aa6bd';
  ctx.font = `700 26px ${MONO}`;
  ctx.fillText(config.game.share.hashtag, R, SHARE_H - 52);
  ctx.textAlign = 'left';
}

/** Render to a PNG blob (browser only). */
export async function renderShareImage(input: ShareImageInput): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  drawShareImage(canvas.getContext('2d')!, input);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
