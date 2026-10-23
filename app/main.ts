// Phase 0 design preview: renders today's Daily card read-only.
// Interactive card UI arrives in Phase 1 (app/ui/).
import './styles.css';
import { config } from './config/index.ts';
import { boardLines } from './game/board.ts';
import { generateDailyCard } from './game/card.ts';
import { dateKey } from './game/date.ts';

const key = dateKey(new Date(), config.game.daily.timezone);
const card = generateDailyCard(config, key);
const blessed = new Set(card.blessedLines.flatMap((id) => boardLines(card.size).find((l) => l.id === id)!.cells));
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

const cells = card.cells
  .map((cell, i) => {
    if (cell.free) {
      const f = config.game.board.free_square;
      return `<div class="cell cell--free" style="--i:${i}"><span class="cell__emoji">${f.emoji}</span><span class="cell__label">${esc(f.label)}</span></div>`;
    }
    const sq = config.squareById.get(cell.squareId)!;
    const r = config.rarityById.get(sq.rarity)!;
    return `<div class="cell r-${r.id}${blessed.has(i) ? ' cell--blessed' : ''}" style="--i:${i};--rc:${r.color};--rg:${r.glow}" title="${esc(sq.flavor)}">
      <span class="cell__emoji">${sq.emoji}</span>
      <span class="cell__label">${esc(sq.short)}</span>
      <span class="cell__de">${esc(sq.de)}</span>
      ${sq.verifiable ? '<span class="cell__auto" aria-label="자동 인증 가능">✓</span>' : ''}
    </div>`;
  })
  .join('');

const legend = config.rarity.rarities
  .map((r) => `<li class="r-${r.id}" style="--rc:${r.color}"><i></i>${r.label}<b>${r.points}</b></li>`)
  .join('');

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="top">
    <p class="top__kicker">ZUG-BINGO <span>#${card.number}</span></p>
    <h1 class="top__date">${key}</h1>
    <p class="top__hint">🫡 은은하게 빛나는 줄이 오늘의 <b>축복 라인</b>이에요.</p>
  </header>
  <main>
    <div class="board" style="--n:${card.size}">${cells}</div>
    <ul class="legend">${legend}</ul>
  </main>
  <footer class="foot">
    비공식 팬 프로젝트 · Deutsche Bahn과 무관합니다<br />Daten: Deutsche Bahn (CC BY 4.0)
  </footer>`;
