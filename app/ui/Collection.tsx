import type { Config } from '../config/types.ts';
import type { CollectionEntry } from '../game/stats.ts';
import type { I18n } from '../i18n/index.ts';

interface Props {
  config: Config;
  i18n: I18n;
  collection: ReadonlyMap<string, CollectionEntry>;
  /** squares collected since the user last opened this tab */
  fresh: ReadonlySet<string>;
  onOpen(squareId: string): void;
}

export function Collection({ config, i18n, collection, fresh, onOpen }: Props) {
  const total = config.squares.length;
  const found = config.squares.filter((s) => collection.has(s.id)).length;
  const tiers = [...config.rarity.rarities].reverse();
  return (
    <section class="page" aria-labelledby="collection-title">
      <header class="page__head">
        <h1 id="collection-title" class="page__title">
          {i18n.t('collection.title')}
        </h1>
        <p class="page__meta">{i18n.t('collection.progress', { n: i18n.number(found), total: i18n.number(total) })}</p>
        <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={found}>
          <span class="bar__fill bar__fill--rainbow" style={{ width: `${(found / total) * 100}%` }} />
        </div>
        <p class="page__hint">{i18n.t('collection.hint')}</p>
      </header>

      {tiers.map((r) => {
        const squares = config.squares.filter((s) => s.rarity === r.id).sort((a, b) => (collection.has(b.id) ? 1 : 0) - (collection.has(a.id) ? 1 : 0));
        const got = squares.filter((s) => collection.has(s.id)).length;
        return (
          <section key={r.id} class={`dex-group r-${r.id}`} style={{ '--rc': r.color, '--rg': r.glow }}>
            <h2 class="dex-group__title">
              <span>
                {r.emoji} {i18n.rarity(r.id)}
              </span>
              <span class="dex-group__count">
                {got}/{squares.length}
              </span>
            </h2>
            <ul class="dex">
              {squares.map((s) => {
                const entry = collection.get(s.id);
                return (
                  <li key={s.id}>
                    <button
                      class={`dex__tile ${entry ? 'is-found' : 'is-missing'} ${fresh.has(s.id) ? 'is-new' : ''}`}
                      onClick={() => onOpen(s.id)}
                      aria-label={entry ? `${i18n.square(s.id).label}, ${i18n.t('collection.count', { n: entry.count })}` : i18n.t('collection.locked')}
                    >
                      <span class="dex__emoji" aria-hidden="true">
                        {s.emoji}
                      </span>
                      <span class="dex__name">{entry ? i18n.square(s.id).short : i18n.t('collection.locked')}</span>
                      {entry && <span class="dex__count">{i18n.t('collection.count', { n: entry.count })}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </section>
  );
}
