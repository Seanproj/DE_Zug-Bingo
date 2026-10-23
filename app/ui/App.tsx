import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { config } from '../config/index.ts';
import { levelFor, unlockedAchievements, unlockedTitles } from '../game/achievements.ts';
import { evaluateBingo } from '../game/bingo.ts';
import { currentCard } from '../game/card.ts';
import { addDays, dateKey, weekStart } from '../game/date.ts';
import { marksFromRecords, unionRecords, updatePeriodDays, type DayRecord } from '../game/day.ts';
import { checkCell, uncheckCell, type VerifyMethod } from '../game/marks.ts';
import { scoreCard } from '../game/score.ts';
import { aggregate } from '../game/stats.ts';
import { computeStreak } from '../game/streak.ts';
import { createI18n, detectLocale } from '../i18n/index.ts';
import { renderShareImage } from '../share/image.ts';
import { cardTitle, shareText } from '../share/text.ts';
import type { Settings, Store } from '../storage/db.ts';
import { Board } from './Board.tsx';
import { Collection } from './Collection.tsx';
import { burst, centerOf, haptic, rarityEffect } from './fx.ts';
import { useCountUp, useHeartbeat, useOnline } from './hooks.ts';
import { Profile } from './Profile.tsx';
import { HelpSheet, SettingsSheet, ShareSheet, SquareSheet } from './Sheets.tsx';

type Tab = 'today' | 'collection' | 'profile';
type Overlay =
  | { type: 'square'; cell: number }
  | { type: 'dex'; squareId: string }
  | { type: 'help'; onboarding: boolean }
  | { type: 'settings' }
  | { type: 'share' }
  | null;
interface Toast {
  id: number;
  text: string;
}
interface Celebration {
  id: number;
  title: string;
  subtitle: string;
  kind: 'bingo' | 'blackout' | 'mythic';
}
/** id → YYYY-MM-DD it was first unlocked (achievements, titles, "level:<id>") */
type Unlocks = Record<string, string>;

const RAINBOW = config.rarityById.get('mythic')!.gradient ?? ['#fff'];
const today = () => dateKey(new Date(), config.game.daily.timezone);
const languages = () => (typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]));

export function App({ store, initialSettings }: { store: Store; initialSettings: Settings }) {
  const [settings, setSettings] = useState(initialSettings);
  const locale = detectLocale(languages(), config.game.locales.supported, config.game.locales.fallback, settings.locale);
  const i18n = useMemo(() => createI18n(config, locale), [locale]);

  const [tab, setTab] = useState<Tab>('today');
  const [key, setKey] = useState(today);
  const card = useMemo(() => currentCard(config, key), [key]);
  const [days, setDays] = useState<Map<string, DayRecord>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const unlocks = useRef<Unlocks | null>(null);
  const [seenDex, setSeenDex] = useState<Set<string> | null>(null);

  const [overlay, setOverlay] = useState<Overlay>(initialSettings.onboarded ? null : { type: 'help', onboarding: true });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [fresh, setFresh] = useState<Set<number>>(new Set());
  const [freshLines, setFreshLines] = useState<Set<string>>(new Set());
  const [shareImage, setShareImage] = useState<Blob | null>(null);
  const seq = useRef(0);

  const FREE = config.game.board.free_square.id;
  /** saved days that belong to the current card (the whole week, or just today) */
  const periodDays = useMemo(
    () => [...days.values()].filter((d) => (card.period === 'week' ? weekStart(d.key) === card.key : d.key === card.key)),
    [days, card],
  );
  const marks = useMemo(() => marksFromRecords(card, unionRecords(periodDays.map((d) => d.marks))), [card, periodDays]);
  const todayMarks = days.get(key)?.marks ?? [];
  const checkedIn = todayMarks.some((m) => m.squareId === FREE);
  const todayCells = useMemo(() => {
    const ids = new Set(todayMarks.map((m) => m.squareId));
    return new Set(card.cells.flatMap((c, i) => (!c.free && ids.has(c.squareId) && marks.has(i) ? [i] : [])));
  }, [days, key, card, marks]);
  const bingo = useMemo(() => evaluateBingo(card, new Set(marks.keys())), [card, marks]);
  const score = useMemo(() => scoreCard(config, card, marks), [card, marks]);
  const progress = useMemo(() => aggregate(config, days.values(), key), [days, key]);
  const level = levelFor(config, progress.stats.totalScore);
  const shownScore = useCountUp(score.total);
  const oneAway = useMemo(() => new Set(bingo.oneAway.map((o) => o.cell)), [bingo]);
  const newInDex = useMemo(
    () => new Set(seenDex ? [...progress.collection.keys()].filter((id) => !seenDex.has(id)) : []),
    [progress, seenDex],
  );

  // Always-current view of state for listeners and timers.
  const latest = useRef({ card, marks, key, settings, i18n, days, periodDays });
  latest.current = { card, marks, key, settings, i18n, days, periodDays };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // Load everything once; a new day only switches the key.
  useEffect(() => {
    (async () => {
      const [all, saved, dex] = await Promise.all([store.allDays(), store.getMeta<Unlocks>('unlocks'), store.getMeta<string[]>('seenDex')]);
      const map = new Map(all.map((d) => [d.key, d]));
      setDays(map);
      // First run of this version: everything already earned counts as seen (no toast storm).
      const p = aggregate(config, map.values(), today());
      const initial = saved ?? earnedNow(p.stats);
      unlocks.current = initial;
      if (!saved) void store.putMeta('unlocks', initial);
      setSeenDex(new Set(dex ?? p.collection.keys()));
      setLoaded(true);
    })();
  }, []);

  const earnedNow = (stats: typeof progress.stats): Unlocks => {
    const day = latest.current.key;
    const out: Unlocks = {};
    for (const a of unlockedAchievements(config, stats)) out[a.id] = day;
    for (const t of unlockedTitles(config, stats)) out[`title:${t.id}`] = day;
    out[`level:${levelFor(config, stats.totalScore).level.id}`] = day;
    return out;
  };

  // Announce new achievements, titles and level-ups.
  useEffect(() => {
    if (!loaded || !unlocks.current) return;
    const now = earnedNow(progress.stats);
    const fresh = Object.keys(now).filter((id) => !(id in unlocks.current!));
    if (!fresh.length) return;
    for (const id of fresh) {
      if (id.startsWith('title:')) toast(i18n.t('toast.title_unlocked', { name: i18n.title(id.slice(6)) }));
      else if (id.startsWith('level:')) toast(i18n.t('toast.level_up', { n: level.number, name: i18n.level(id.slice(6)) }));
      else toast(i18n.t('toast.achievement', { name: i18n.achievement(id).name }));
    }
    unlocks.current = { ...unlocks.current, ...Object.fromEntries(fresh.map((id) => [id, key])) };
    void store.putMeta('unlocks', unlocks.current);
  }, [progress, loaded]);

  // Visiting the collection clears its "new" badges.
  useEffect(() => {
    if (tab !== 'collection' || !seenDex || newInDex.size === 0) return;
    const t = setTimeout(() => {
      const all = new Set([...seenDex, ...progress.collection.keys()]);
      setSeenDex(all);
      void store.putMeta('seenDex', [...all]);
    }, 2500);
    return () => clearTimeout(t);
  }, [tab, newInDex]);

  const toast = (text: string) => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3000);
  };

  const flash = <T,>(set: (v: Set<T>) => void, values: T[], ms: number) => {
    set(new Set(values));
    setTimeout(() => set(new Set()), ms);
  };

  const celebrate = (c: Omit<Celebration, 'id'>, ms = 1900) => {
    const id = ++seq.current;
    setCelebration({ id, ...c });
    setTimeout(() => setCelebration((x) => (x?.id === id ? null : x)), ms);
  };

  /** Apply new marks: persist, then celebrate whatever changed. */
  const apply = (next: Map<number, VerifyMethod>, origin?: { cell: number; el?: HTMLElement }, checkin?: boolean) => {
    const { card, marks, key, settings, i18n, days, periodDays } = latest.current;
    const before = evaluateBingo(card, new Set(marks.keys()));
    const after = evaluateBingo(card, new Set(next.keys()));
    const added = [...next.keys()].filter((c) => !marks.has(c));

    const now = new Date().toISOString();
    const changed = updatePeriodDays({
      card,
      days: periodDays,
      today: key,
      next,
      now,
      checkin,
      freeId: config.game.board.free_square.id,
      generatorVersion: config.game.generator_version,
    });
    if (changed.length) {
      const map = new Map(days);
      for (const d of changed) {
        map.set(d.key, d);
        void store.putDay(d);
      }
      setDays(map);
      latest.current.days = map;
    }
    flash(setFresh, added, 1000);

    let delayBingo = 0;
    if (origin && added.includes(origin.cell)) {
      const sq = config.squareById.get(card.cells[origin.cell]!.squareId)!;
      const rarity = config.rarityById.get(sq.rarity)!;
      haptic(rarity.haptic, settings.haptics);
      rarityEffect(rarity, origin.el, i18n.square(sq.id).label, {
        announce: (title, subtitle) => {
          celebrate({ title, subtitle, kind: 'mythic' }, 2200);
          delayBingo = 1600;
        },
      });
      const implied = added.filter((c) => c !== origin.cell).map((c) => i18n.square(card.cells[c]!.squareId).short);
      if (implied.length) toast(i18n.t('toast.implied', { list: i18n.list(implied) }));
    }

    const newLines = after.lines.filter((l) => !before.lines.includes(l));
    const blackout = after.blackout && !before.blackout;
    if (!blackout && !newLines.length) return;
    flash(setFreshLines, newLines, 1600 + delayBingo);
    setTimeout(() => {
      haptic(blackout ? config.game.feedback.haptic.blackout : config.game.feedback.haptic.line, latest.current.settings.haptics);
      celebrate({
        title: blackout ? 'BLACKOUT' : 'BINGO!',
        subtitle: blackout ? i18n.t('toast.blackout') : i18n.plural('toast.bingo', after.lines.length),
        kind: blackout ? 'blackout' : 'bingo',
      });
      const board = document.querySelector('.board');
      if (board) {
        const [x, y] = centerOf(board);
        burst(x, y, { count: blackout ? 220 : 120, colors: RAINBOW, power: blackout ? 15 : 12 });
      }
    }, delayBingo);
  };

  /** 🫡 daily check-in on the free square: keeps the streak alive on quiet days. */
  const checkIn = (el: HTMLElement) => {
    const played = [...days.values()].filter((d) => d.marks.length > 0).map((d) => d.key);
    apply(marks, undefined, true);
    haptic(config.rarityById.get('uncommon')!.haptic, settings.haptics);
    const [x, y] = centerOf(el);
    burst(x, y, { count: 24, colors: ['#ffd36a', '#fff3c4', '#ffffff'], power: 5 });
    toast(i18n.t('toast.checkin', { n: computeStreak([...played, key], key).current }));
  };

  const onTap = (cell: number, el: HTMLElement) => {
    if (!loaded) return;
    if (card.cells[cell]!.free) return checkedIn ? setOverlay({ type: 'square', cell }) : checkIn(el);
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

  const byline = `${i18n.t('profile.level', { n: level.number })} ${i18n.level(level.level.id)}${settings.title ? ` · ${i18n.title(settings.title)}` : ''}`;

  const openShare = () => {
    setShareImage(null);
    setOverlay({ type: 'share' });
    renderShareImage({ config, i18n, card, marks, byline }).then(setShareImage, () => setShareImage(null));
  };

  const shareAsText = async () => {
    const text = shareText(config, i18n, card, marks, { today: todayCells.size });
    try {
      if (navigator.share) return void (await navigator.share({ text }));
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

  const shareAsImage = async () => {
    if (!shareImage) return;
    const file = new File([shareImage], `zug-bingo-${card.number}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) return void (await navigator.share({ files: [file], text: shareText(config, i18n, card, marks, { today: todayCells.size }) }));
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(i18n.t('share.saved'));
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
      const next = currentCard(config, k);
      setKey(k);
      if (next.key !== latest.current.card.key) {
        setOverlay(null);
        toast(latest.current.i18n.t(next.period === 'week' ? 'toast.new_week' : 'toast.new_day', { n: next.number }));
      }
    }
  });

  const checkedCount = [...marks.keys()].filter((i) => !card.cells[i]!.free).length;
  const fmtDay = (k: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...o, timeZone: 'UTC' }).format(new Date(`${k}T12:00:00Z`));
  const dateLabel =
    card.period === 'week'
      ? i18n.t('header.until', { date: fmtDay(addDays(card.key, 6), { weekday: 'short', day: 'numeric', month: 'short' }) })
      : fmtDay(key, { weekday: 'short', day: 'numeric', month: 'short' });
  const sheetCell = overlay?.type === 'square' ? card.cells[overlay.cell]! : null;
  const tabs: { id: Tab; icon: string; badge?: number }[] = [
    { id: 'today', icon: '🎯' },
    { id: 'collection', icon: '📖', badge: newInDex.size },
    { id: 'profile', icon: '🎖️' },
  ];

  return (
    <div class={`app app--${tab}`} data-loaded={loaded}>
      {tab === 'today' && (
        <>
          <header class="top">
            <div class="top__row">
              <p class="top__kicker">
                ZUG-BINGO <b>{cardTitle(card)}</b>
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
                <li
                  class={`chip ${progress.stats.dailyStreak > 0 ? 'chip--fire' : ''}`}
                  title={i18n.t('header.streak', { n: progress.stats.dailyStreak })}
                >
                  🔥 <b>{progress.stats.dailyStreak}</b>
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
              today={todayCells}
              checkedIn={checkedIn}
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
        </>
      )}

      {tab === 'collection' && (
        <main class="main">
          <Collection config={config} i18n={i18n} collection={progress.collection} fresh={newInDex} onOpen={(squareId) => setOverlay({ type: 'dex', squareId })} />
        </main>
      )}

      {tab === 'profile' && (
        <main class="main">
          <Profile
            config={config}
            i18n={i18n}
            stats={progress.stats}
            title={settings.title}
            onTitle={(title) => updateSettings({ ...settings, title })}
            onSettings={() => setOverlay({ type: 'settings' })}
            onHelp={() => setOverlay({ type: 'help', onboarding: false })}
          />
          <footer class="foot">
            {i18n.t('footer.disclaimer')}
            <br />
            {i18n.t('footer.data')}
          </footer>
        </main>
      )}

      <div class="dock">
        {tab === 'today' && (
          <div class="actionbar">
            <button class="iconbtn" aria-label={i18n.t('action.help')} onClick={() => setOverlay({ type: 'help', onboarding: false })}>
              ?
            </button>
            <button class={`btn btn--share ${bingo.lines.length ? 'is-hot' : ''}`} onClick={openShare}>
              <span aria-hidden="true">↗</span> {i18n.t('action.share')}
            </button>
          </div>
        )}
        <nav class="tabbar" aria-label="tabs">
          {tabs.map((t) => (
            <button key={t.id} class="tabbar__tab" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <span class="tabbar__iconwrap">
                <span class="tabbar__icon" aria-hidden="true">
                  {t.icon}
                </span>
                {!!t.badge && <span class="tabbar__badge">{t.badge}</span>}
              </span>
              <span class="tabbar__label">{i18n.t(`tab.${t.id}`)}</span>
            </button>
          ))}
        </nav>
      </div>

      <div class="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div class="toast" key={t.id}>
            {t.text}
          </div>
        ))}
      </div>

      {celebration && (
        <div class={`celebrate celebrate--${celebration.kind}`} key={celebration.id} aria-hidden="true">
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
      {overlay?.type === 'dex' && (
        <SquareSheet
          config={config}
          i18n={i18n}
          squareId={overlay.squareId}
          free={false}
          checked={false}
          entry={progress.collection.get(overlay.squareId) ?? null}
          onClose={closeOverlay}
        />
      )}
      {overlay?.type === 'share' && <ShareSheet i18n={i18n} image={shareImage} onImage={shareAsImage} onText={shareAsText} onClose={closeOverlay} />}
      {overlay?.type === 'settings' && (
        <SettingsSheet config={config} i18n={i18n} settings={settings} onChange={updateSettings} onClose={closeOverlay} />
      )}
      {overlay?.type === 'help' && <HelpSheet config={config} i18n={i18n} onboarding={overlay.onboarding} onClose={closeOverlay} />}
    </div>
  );
}
