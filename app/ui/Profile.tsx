import type { Config, NumericStat } from '../config/types.ts';
import { levelFor, meets, type PlayerStats } from '../game/achievements.ts';
import type { I18n } from '../i18n/index.ts';

interface Props {
  config: Config;
  i18n: I18n;
  stats: PlayerStats;
  title: string | null;
  onTitle(id: string | null): void;
  onSettings(): void;
  onHelp(): void;
}

const STAT_ROWS: NumericStat[] = ['totalScore', 'cardsPlayed', 'bingoCards', 'maxLinesOnCard', 'blackouts', 'bestStreak', 'distinctSquares', 'verifiedCount'];

export function Profile({ config, i18n, stats, title, onTitle, onSettings, onHelp }: Props) {
  const lv = levelFor(config, stats.totalScore);
  const achievements = config.achievements.achievements.map((a) => ({ a, ok: meets(config, stats, a.condition) }));
  const unlocked = achievements.filter((x) => x.ok).length;
  const titles = config.achievements.titles.map((t) => ({ t, ok: meets(config, stats, t.condition) }));
  return (
    <section class="page" aria-labelledby="profile-title">
      <h1 id="profile-title" class="visually-hidden">
        {i18n.t('profile.title')}
      </h1>

      <div class="levelcard">
        <p class="levelcard__lv">{i18n.t('profile.level', { n: lv.number })}</p>
        <p class="levelcard__name">{i18n.level(lv.level.id)}</p>
        <p class="levelcard__title">{title ? `🎖️ ${i18n.title(title)}` : i18n.t('profile.title_none')}</p>
        <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={1} aria-valuenow={lv.progress}>
          <span class="bar__fill bar__fill--rainbow" style={{ width: `${lv.progress * 100}%` }} />
        </div>
        <p class="levelcard__next">
          {lv.next ? i18n.t('profile.next', { points: i18n.number(lv.next.min_score - stats.totalScore) }) : i18n.t('profile.max')}
          {lv.next && <span> → {i18n.level(lv.next.id)}</span>}
        </p>
      </div>

      <h2 class="section-title">{i18n.t('profile.stats')}</h2>
      <dl class="stats">
        {STAT_ROWS.map((k) => (
          <div key={k} class="stats__item">
            <dt>{i18n.t(`stat.${k}`)}</dt>
            <dd>{i18n.number(stats[k])}</dd>
          </div>
        ))}
      </dl>

      <h2 class="section-title">
        {i18n.t('profile.titles')}
        <small>{i18n.t('profile.title_hint')}</small>
      </h2>
      <div class="titles">
        {titles.map(({ t, ok }) => (
          <button
            key={t.id}
            class={`titlechip ${ok ? '' : 'is-locked'}`}
            disabled={!ok}
            aria-pressed={title === t.id}
            onClick={() => onTitle(title === t.id ? null : t.id)}
          >
            {ok ? '🎖️' : '🔒'} {i18n.title(t.id)}
          </button>
        ))}
      </div>

      <h2 class="section-title">
        {i18n.t('profile.achievements')}
        <small>{i18n.t('profile.achievements_progress', { n: unlocked, total: achievements.length })}</small>
      </h2>
      <ul class="achievements">
        {achievements.map(({ a, ok }) => {
          const text = i18n.achievement(a.id);
          return (
            <li key={a.id} class={`ach ach--${a.tier} ${ok ? 'is-unlocked' : 'is-locked'}`}>
              <span class="ach__medal" aria-hidden="true">
                {ok ? a.emoji : '🔒'}
              </span>
              <span class="ach__text">
                <b>{text.name}</b>
                <span>{text.description}</span>
              </span>
              <span class="visually-hidden">{ok ? '' : i18n.t('profile.locked')}</span>
            </li>
          );
        })}
      </ul>

      <div class="rows">
        <button class="row" onClick={onSettings}>
          <span aria-hidden="true">⚙️</span> {i18n.t('profile.settings')}
          <span class="row__chev" aria-hidden="true">›</span>
        </button>
        <button class="row" onClick={onHelp}>
          <span aria-hidden="true">❓</span> {i18n.t('profile.help')}
          <span class="row__chev" aria-hidden="true">›</span>
        </button>
      </div>
    </section>
  );
}
