import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { config } from '../config/index.ts';
import { evaluateBingo } from '../game/bingo.ts';
import { generateDailyCard } from '../game/card.ts';
import { dateKey } from '../game/date.ts';
import { marksFromRecords, recordsFromMarks, type MarkRecord } from '../game/day.ts';
import { checkCell, uncheckCell, type VerifyMethod } from '../game/marks.ts';
import { scoreCard } from '../game/score.ts';
import { computeStreak } from '../game/streak.ts';
import { createI18n, detectLocale } from '../i18n/index.ts';
import { shareText } from '../share/text.ts';
import type { Settings, Store } from '../storage/db.ts';
import { Board } from './Board.tsx';
import { burst, centerOf, haptic } from './fx.ts';
import { useCountUp, useHeartbeat, useOnline } from './hooks.ts';
import { HelpSheet, SettingsSheet, SquareSheet } from './Sheets.tsx';

type Overlay = { type: 'square'; cell: number } | { type: 'help'; onboarding: boolean } | { type: 'settings' } | null;
interface Toast {
  id: number;
  text: string;
}
interface Celebration {
  id: number;
  title: string;
  subtitle: string;
  blackout: boolean;
}

const RAINBOW = config.rarityById.get('mythic')!.gradient ?? ['#fff'];
const today = () => dateKey(new Date(), config.game.daily.timezone);
const languages = () => (typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]));

export function App({ store, initialSettings }: { store: Store; initialSettings: Settings }) {
  const [settings, setSettings] = useState(initialSettings);
  const locale = detectLocale(languages(), config.game.locales.supported, config.game.locales.fallback, settings.locale);
  const i18n = useMemo(() => createI18n(config, locale), [locale]);

  const [key, setKey] = useState(today);
  const card = useMemo(() => generateDailyCard(config, key), [key]);
  const [marks, setMarks] = useState<Map<number, VerifyMethod>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [played, setPlayed] = useState<Set<string>>(new Set());
  const records = useRef<MarkRecord[]>([]);

  const [overlay, setOverlay] = useState<Overlay>(initialSettings.onboarded ? null : { type: 'help', onboarding: true });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [freshLines, setFreshLines] = useState<Set<string>>(new Set());
  const seq = useRef(0);

  const bingo = useMemo(() => evaluateBingo(card, new Set(marks.keys())), [card, marks]);
  const score = useMemo(() => scoreCard(config, card, marks), [card, marks]);
  const streak = useMemo(() => computeStreak(marks.size ? [...played, key] : played, key), [played, marks, key]);
  const shownScore = useCountUp(score.total);
  const oneAway = useMemo(() => new Set(bingo.oneAway.map((o) => o.cell)), [bingo]);

  // Always-current view of state for event listeners registered once.
  const latest = useRef({ card, marks, key, settings, i18n });
  latest.current = { card, marks, key, settings, i18n };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Load the day's progress (on start and on rollover).
  useEffect(() => {
    let alive = true;
    setLoaded(false);
    (async () => {
      const [day, all] = await Promise.all([store.getDay(key), store.allDays()]);
      if (!alive) return;
      records.current = day?.marks ?? [];
      setMarks(marksFromRecords(card, records.current));
      setPlayed(new Set(all.filter((d) => d.marks.length > 0).map((d) => d.key)));
      setLoaded(true);
    })();
    return () => void (alive = false);
  }, [key]);

  const toast = (text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800);
  };

  const flash = <T,>(set: (v: Set<T>) => void, values: T[], ms: number) => {
    set(new Set(values));
    setTimeout(() => set(new Set()), ms);
  };

  /** Apply new marks: persist, then celebrate whatever changed. */
  const apply = (next: Map<number, VerifyMethod>, origin?: { cell: number; el?: HTMLElement }) => {
    const { card, marks, key, settings, i18n } = latest.current;
    const before = evaluateBingo(card, new Set(marks.keys()));
    const after = evaluateBingo(card, new Set(next.keys()));
    const added = [...next.keys()].filter((c) => !marks.has(c));

    setMarks(next);
    const now = new Date().toISOString();
    records.current = recordsFromMarks(card, next, records.current, now);
    void store.putDay({ key, marks: records.current, updatedAt: now });

    flash(setFresh, added, 900);

    if (origin && added.includes(origin.cell)) {
      const sq = config.squareById.get(card.cells[origin.cell]!.squareId)!;
      const rarity = config.rarityById.get(sq.rarity)!;
      haptic(rarity.haptic, settings.haptics);
      if (origin.el && rarity.tier >= 2) {
        const [x, y] = centerOf(origin.el);
        const colors = rarity.id === 'mythic' ? RAINBOW : [rarity.color, '#ffffff'];
        burst(x, y, { count: 8 + rarity.tier * 10, colors, power: 3 + rarity.tier * 1.4 });
      }
      const implied = added.filter((c) => c !== origin.cell).map((c) => i18n.square(card.cells[c]!.squareId).short);
      if (implied.length) toast(i18n.t('toast.implied', { list: i18n.list(implied) }));
    }

    const newLines = after.lines.filter((l) => !before.lines.includes(l));
    if (after.blackout && !before.blackout) {
      celebrate(i18n.t('toast.blackout'), true);
      flash(setFreshLines, newLines, 1600);
      haptic(config.game.feedback.haptic.blackout, settings.haptics);
    } else if (newLines.length) {
      celebrate(i18n.plural('toast.bingo', after.lines.length), false);
      flash(setFreshLines, newLines, 1600);
      haptic(config.game.feedback.haptic.line, settings.haptics);
    }
  };

  const celebrate = (subtitle: string, blackout: boolean) => {
    const id = ++seq.current;
    setCelebration({ id, title: blackout ? 'BLACKOUT' : 'BINGO!', subtitle, blackout });
    setTimeout(() => setCelebration((c) => (c?.id === id ? null : c)), 1900);
    const board = document.querySelector('.board');
    if (board) {
      const [x, y] = centerOf(board);
      burst(x, y, { count: blackout ? 220 : 120, colors: RAINBOW, power: blackout ? 15 : 12 });
    }
  };

  const onTap = (cell: number, el: HTMLElement) => {
    if (!loaded || card.cells[cell]!.free) return;
    if (marks.has(cell)) setOverlay({ type: 'square', cell });
    else apply(checkCell(config, card, marks, cell, 'self'), { cell, el });
  };

  const toggleFromSheet = (cell: number) => {
    if (marks.has(cell)) apply(uncheckCell(marks, cell));
    else apply(checkCell(config, card, marks, cell, 'self'), { cell, el: document.getElementById(`cell-${cell}`) ?? undefined });
    setOverlay(null);
  };

  const updateSettings = (s: Settings) => {
    setSettings(s);
    void store.putSettings(s);
  };

  const closeOverlay = () => {
    if (overlay?.type === 'help' && overlay.onboarding) updateSettings({ ...settings, onboarded: true });
    setOverlay(null);
  };

  const share = async () => {
    const text = shareText(config, i18n, card, marks);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast(i18n.t('toast.copied'));
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(text);
        toast(i18n.t('toast.copied'));
      } catch {
        toast(i18n.t('toast.share_failed'));
      }
    }
  };

  // 📵 Funkloch mode: going offline is a bonus square, not an error.
  const online = useOnline((isOnline) => {
    const { card, marks, i18n } = latest.current;
    if (isOnline) return toast(i18n.t('toast.online'));
    const cell = card.cells.findIndex((c) => c.squareId === 'funkloch');
    if (cell >= 0 && !marks.has(cell)) {
      apply(checkCell(config, card, marks, cell, 'self'), { cell, el: document.getElementById(`cell-${cell}`) ?? undefined });
      toast(i18n.t('toast.offline_bonus', { square: i18n.square('funkloch').short }));
    } else toast(i18n.t('toast.offline'));
  });

  // New card at midnight (Berlin) even if the app stays open.
  useHeartbeat(() => {
    const k = today();
    if (k !== latest.current.key) {
      setOverlay(null);
      setKey(k);
      toast(latest.current.i18n.t('toast.new_day', { n: generateDailyCard(config, k).number }));
    }
  });

  const checkedCount = [...marks.keys()].filter((i) => !card.cells[i]!.free).length;
  const dateLabel = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
  const sheetCell = overlay?.type === 'square' ? card.cells[overlay.cell]! : null;

  return (
    <div class="app" data-loaded={loaded}>
      <header class="top">
        <div class="top__row">
          <p class="top__kicker">
            ZUG-BINGO <b>#{card.number}</b>
            <span class="top__date">{dateLabel}</span>
          </p>
          {!online && <span class="pill pill--offline">📵 Funkloch</span>}
        </div>
        <div class="top__stats">
          <div class="score">
            <span class="score__value">{i18n.number(shownScore)}</span>
            <span class="score__label">{i18n.t('header.score')}</span>
          </div>
          <ul class="chips">
            <li class={`chip ${streak.current > 0 ? 'chip--fire' : ''}`} title={i18n.t('header.streak', { n: streak.current })}>
              🔥 <b>{streak.current}</b>
            </li>
            <li class="chip">
              ✓ <b>{i18n.t('header.checked', { n: checkedCount })}</b>
            </li>
            <li class={`chip ${bingo.lines.length ? 'chip--bingo' : ''}`}>
              🎯 <b>{bingo.lines.length}</b>
            </li>
          </ul>
        </div>
      </header>

      <main class="main">
        <Board
          config={config}
          i18n={i18n}
          card={card}
          marks={marks}
          lines={bingo.lines}
          fresh={fresh}
          freshLines={freshLines}
          oneAway={oneAway}
          onTap={onTap}
          onHold={(cell) => setOverlay({ type: 'square', cell })}
        />
        <p class="hint">
          <span class="hint__swatch" aria-hidden="true" />
          {i18n.t('board.blessed_hint')}
        </p>
        <footer class="foot">
          {i18n.t('footer.disclaimer')}
          <br />
          {i18n.t('footer.data')}
        </footer>
      </main>

      <nav class="actionbar" aria-label="actions">
        <button class="iconbtn" aria-label={i18n.t('action.help')} onClick={() => setOverlay({ type: 'help', onboarding: false })}>
          ?
        </button>
        <button class={`btn btn--share ${bingo.lines.length ? 'is-hot' : ''}`} onClick={share}>
          <span aria-hidden="true">↗</span> {i18n.t('action.share')}
        </button>
        <button class="iconbtn" aria-label={i18n.t('action.settings')} onClick={() => setOverlay({ type: 'settings' })}>
          ⚙
        </button>
      </nav>

      <div class="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div class="toast" key={t.id}>
            {t.text}
          </div>
        ))}
      </div>

      {celebration && (
        <div class={`celebrate ${celebration.blackout ? 'celebrate--blackout' : ''}`} key={celebration.id} aria-hidden="true">
          <p class="celebrate__title">{celebration.title}</p>
          <p class="celebrate__sub">{celebration.subtitle}</p>
        </div>
      )}

      {sheetCell && overlay?.type === 'square' && (
        <SquareSheet
          config={config}
          i18n={i18n}
          squareId={sheetCell.squareId}
          free={sheetCell.free}
          checked={marks.has(overlay.cell)}
          onToggle={() => toggleFromSheet(overlay.cell)}
          onClose={closeOverlay}
        />
      )}
      {overlay?.type === 'settings' && (
        <SettingsSheet config={config} i18n={i18n} settings={settings} onChange={updateSettings} onClose={closeOverlay} />
      )}
      {overlay?.type === 'help' && <HelpSheet config={config} i18n={i18n} onboarding={overlay.onboarding} onClose={closeOverlay} />}
    </div>
  );
}
