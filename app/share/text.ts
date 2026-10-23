// Wordle-style text share. Language comes from i18n; the grid is language-neutral.
import type { Config } from '../config/types.ts';
import { evaluateBingo } from '../game/bingo.ts';
import type { Card } from '../game/card.ts';
import type { Marks } from '../game/marks.ts';
import { scoreCard } from '../game/score.ts';
import type { I18n } from '../i18n/index.ts';

export function shareGrid(config: Config, card: Pick<Card, 'size' | 'cells'>, marks: Marks): string {
  const rows: string[] = [];
  for (let r = 0; r < card.size; r++) {
    let row = '';
    for (let c = 0; c < card.size; c++) {
      const i = r * card.size + c;
      const cell = card.cells[i]!;
      if (cell.free) row += config.game.board.free_square.emoji;
      else if (marks.has(i)) row += config.rarityById.get(config.squareById.get(cell.squareId)!.rarity)!.share_emoji;
      else row += config.rarity.share.unchecked_emoji;
    }
    rows.push(row);
  }
  return rows.join('\n');
}

export function shareText(config: Config, i18n: I18n, card: Card, marks: Marks): string {
  const bingo = evaluateBingo(card, new Set(marks.keys()));
  const score = scoreCard(config, card, marks);
  const status = bingo.blackout
    ? i18n.t('share.blackout')
    : bingo.lines.length === 0
      ? i18n.t('share.lines_zero')
      : i18n.plural('share.lines', bingo.lines.length);
  const checked = [...marks.keys()].filter((i) => !card.cells[i]!.free).length;
  const lines = [
    `Zug-Bingo #${card.number} 🚆 ${status}`,
    shareGrid(config, card, marks),
    i18n.t('share.footer', { checked: i18n.number(checked), score: i18n.number(score.total) }),
  ];
  const { hashtag, url } = config.game.share;
  const tail = [hashtag, url].filter(Boolean).join(' ');
  if (tail) lines.push(tail);
  return lines.join('\n');
}
