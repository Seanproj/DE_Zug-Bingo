import type { Config } from '../config/types.ts';
import { boardLines } from '../game/board.ts';
import type { Card } from '../game/card.ts';
import type { Marks } from '../game/marks.ts';
import type { I18n } from '../i18n/index.ts';
import { usePress } from './hooks.ts';

interface BoardProps {
  config: Config;
  i18n: I18n;
  card: Card;
  marks: Marks;
  lines: string[];
  /** cells to animate as just-checked */
  fresh: ReadonlySet<number>;
  /** lines to animate as just-completed */
  freshLines: ReadonlySet<string>;
  oneAway: ReadonlySet<number>;
  onTap(cell: number, el: HTMLElement): void;
  onHold(cell: number): void;
}

export function Board({ config, i18n, card, marks, lines, fresh, freshLines, oneAway, onTap, onHold }: BoardProps) {
  const geometry = boardLines(card.size);
  const blessedCells = new Set(card.blessedLines.flatMap((id) => geometry.find((l) => l.id === id)!.cells));
  return (
    <div class="board-wrap">
      <div class="board" role="grid" aria-label={i18n.t('board.label')} style={{ '--n': card.size }}>
        {Array.from({ length: card.size }, (_, r) => (
          <div role="row" class="board__row" key={r}>
            {card.cells.slice(r * card.size, (r + 1) * card.size).map((cell, c) => {
              const i = r * card.size + c;
              return (
                <Cell
                  key={cell.squareId}
                  config={config}
                  i18n={i18n}
                  index={i}
                  squareId={cell.squareId}
                  free={cell.free}
                  checked={cell.free || marks.has(i)}
                  fresh={fresh.has(i)}
                  blessed={blessedCells.has(i)}
                  oneAway={oneAway.has(i)}
                  onTap={onTap}
                  onHold={onHold}
                />
              );
            })}
          </div>
        ))}
      </div>
      <BingoLines size={card.size} lines={lines} fresh={freshLines} />
    </div>
  );
}

interface CellProps {
  config: Config;
  i18n: I18n;
  index: number;
  squareId: string;
  free: boolean;
  checked: boolean;
  fresh: boolean;
  blessed: boolean;
  oneAway: boolean;
  onTap(cell: number, el: HTMLElement): void;
  onHold(cell: number): void;
}

function Cell({ config, i18n, index, squareId, free, checked, fresh, blessed, oneAway, onTap, onHold }: CellProps) {
  const text = i18n.square(squareId);
  const square = config.squareById.get(squareId);
  const rarity = square ? config.rarityById.get(square.rarity)! : undefined;
  const press = usePress(
    () => onTap(index, document.getElementById(`cell-${index}`)!),
    () => onHold(index),
  );
  const cls = [
    'cell',
    free ? 'cell--free' : `r-${rarity!.id}`,
    checked && !free && 'is-checked',
    fresh && 'is-fresh',
    blessed && 'is-blessed',
    oneAway && 'is-one-away',
  ]
    .filter(Boolean)
    .join(' ');
  const term = square && i18n.meta.show_term ? square.term : undefined;
  const aria = [
    text.label,
    rarity && i18n.rarity(rarity.id),
    checked && !free && i18n.t('cell.checked'),
    oneAway && i18n.t('board.one_away'),
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <div
      id={`cell-${index}`}
      role="gridcell"
      tabIndex={free ? -1 : 0}
      aria-label={aria}
      aria-selected={checked}
      class={cls}
      data-fx={rarity?.effect}
      style={{ '--i': index, '--rc': rarity?.color, '--rg': rarity?.glow }}
      {...(free ? {} : press)}
    >
      <span class="cell__emoji" aria-hidden="true">
        {square?.emoji ?? config.game.board.free_square.emoji}
      </span>
      <span class="cell__label" aria-hidden="true">
        {text.short}
      </span>
      {term && (
        <span class="cell__term" aria-hidden="true">
          {term}
        </span>
      )}
      {square?.verifiable && !checked && (
        <span class="cell__auto" title={i18n.t('cell.auto')} aria-hidden="true">
          ✓
        </span>
      )}
      {checked && !free && <span class="cell__stamp" aria-hidden="true" />}
    </div>
  );
}

function BingoLines({ size, lines, fresh }: { size: number; lines: string[]; fresh: ReadonlySet<string> }) {
  const inset = 0.18;
  const ends = (id: string): [number, number, number, number] => {
    const k = Number(id.slice(1));
    const mid = k + 0.5;
    if (id[0] === 'r') return [inset, mid, size - inset, mid];
    if (id[0] === 'c') return [mid, inset, mid, size - inset];
    return id === 'd0' ? [inset, inset, size - inset, size - inset] : [size - inset, inset, inset, size - inset];
  };
  return (
    <svg class="bingo-lines" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {lines.map((id) => {
        const [x1, y1, x2, y2] = ends(id);
        return (
          <g key={id} class={fresh.has(id) ? 'is-fresh' : undefined}>
            <line class="bingo-lines__glow" x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} />
            <line class="bingo-lines__core" x1={x1} y1={y1} x2={x2} y2={y2} pathLength={1} />
          </g>
        );
      })}
    </svg>
  );
}
