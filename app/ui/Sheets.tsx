import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import type { Config } from '../config/types.ts';
import { squarePoints } from '../game/score.ts';
import type { I18n } from '../i18n/index.ts';
import type { Settings } from '../storage/db.ts';

export function Sheet({ onClose, label, children }: { onClose(): void; label: string; children: ComponentChildren }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus() ?? panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);
  return (
    <div class="sheet" role="dialog" aria-modal="true" aria-label={label}>
      <div class="sheet__backdrop" onClick={onClose} />
      <div class="sheet__panel" ref={panel} tabIndex={-1}>
        <div class="sheet__handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}

interface SquareSheetProps {
  config: Config;
  i18n: I18n;
  squareId: string;
  checked: boolean;
  free: boolean;
  onToggle(): void;
  onClose(): void;
}

export function SquareSheet({ config, i18n, squareId, checked, free, onToggle, onClose }: SquareSheetProps) {
  const text = i18n.square(squareId);
  const square = config.squareById.get(squareId);
  const rarity = square && config.rarityById.get(square.rarity)!;
  const mult = config.game.scoring.verify_multiplier;
  const implied = (square?.implies ?? []).map((id) => i18n.square(id).short);
  return (
    <Sheet onClose={onClose} label={text.label}>
      <div class={`detail ${rarity ? `r-${rarity.id}` : 'detail--free'}`} style={{ '--rc': rarity?.color, '--rg': rarity?.glow }}>
        <div class="detail__art">
          <span class="detail__emoji">{square?.emoji ?? config.game.board.free_square.emoji}</span>
          {rarity && (
            <span class="detail__rarity">
              {rarity.emoji} {i18n.rarity(rarity.id)} · {i18n.number(rarity.points)}
            </span>
          )}
        </div>
        <h2 class="detail__title">{text.label}</h2>
        {square && i18n.meta.show_term && <p class="detail__term">{square.term}</p>}
        <p class="detail__flavor">“{text.flavor}”</p>
        {square && (
          <ul class="detail__meta">
            <li>
              <span aria-hidden="true">{square.verifiable ? '✅' : '🙋'}</span>
              {square.verifiable ? i18n.t('sheet.verify_auto', { mult: mult.auto }) : i18n.t('sheet.verify_self', { mult: mult.self })}
            </li>
            <li>
              <span aria-hidden="true">🎯</span>
              {i18n.t('sheet.points', { points: i18n.number(squarePoints(config, squareId, 'self')) })}
            </li>
            {implied.length > 0 && (
              <li>
                <span aria-hidden="true">🔗</span>
                {i18n.t('sheet.implies', { list: i18n.list(implied) })}
              </li>
            )}
          </ul>
        )}
      </div>
      <div class="sheet__actions">
        {!free && (
          <button class={`btn ${checked ? 'btn--ghost' : 'btn--primary'}`} data-autofocus onClick={onToggle}>
            {checked ? i18n.t('sheet.uncheck') : i18n.t('sheet.check')}
          </button>
        )}
        <button class="btn btn--ghost" onClick={onClose} data-autofocus={free || undefined}>
          {i18n.t('sheet.close')}
        </button>
      </div>
    </Sheet>
  );
}

interface SettingsSheetProps {
  config: Config;
  i18n: I18n;
  settings: Settings;
  onChange(s: Settings): void;
  onClose(): void;
}

export function SettingsSheet({ config, i18n, settings, onChange, onClose }: SettingsSheetProps) {
  const options: { value: string | null; label: string }[] = [
    { value: null, label: i18n.t('settings.language_auto') },
    ...config.game.locales.supported.map((code) => ({ value: code, label: config.locales[code]!.meta.name })),
  ];
  return (
    <Sheet onClose={onClose} label={i18n.t('settings.title')}>
      <h2 class="sheet__title">{i18n.t('settings.title')}</h2>
      <fieldset class="field">
        <legend>{i18n.t('settings.language')}</legend>
        <div class="segmented">
          {options.map((o) => (
            <button
              key={String(o.value)}
              class="segmented__opt"
              aria-pressed={settings.locale === o.value}
              lang={o.value ?? undefined}
              onClick={() => onChange({ ...settings, locale: o.value })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </fieldset>
      <div class="field field--row">
        <span>{i18n.t('settings.haptics')}</span>
        <button
          class="switch"
          role="switch"
          aria-checked={settings.haptics}
          aria-label={i18n.t('settings.haptics')}
          onClick={() => onChange({ ...settings, haptics: !settings.haptics })}
        >
          <span class="switch__knob" />
        </button>
      </div>
      <p class="sheet__fine">
        {i18n.t('footer.disclaimer')}
        <br />
        {i18n.t('footer.data')}
      </p>
      <div class="sheet__actions">
        <button class="btn btn--ghost" data-autofocus onClick={onClose}>
          {i18n.t('sheet.close')}
        </button>
      </div>
    </Sheet>
  );
}

export function HelpSheet({ config, i18n, onboarding, onClose }: { config: Config; i18n: I18n; onboarding: boolean; onClose(): void }) {
  const items: [string, string][] = [
    ['👆', 'help.tap'],
    ['✋', 'help.hold'],
    ['🎯', 'help.lines'],
    ['🫡', 'help.blessed'],
    ['🌈', 'help.rarity'],
    ['📵', 'help.offline'],
    ['🕛', 'help.daily'],
  ];
  return (
    <Sheet onClose={onClose} label={i18n.t('help.title')}>
      {onboarding ? (
        <div class="onboard">
          <p class="onboard__kicker">ZUG-BINGO</p>
          <h2 class="onboard__title">{i18n.t('onboard.title')}</h2>
          <p class="onboard__body">{i18n.t('onboard.body')}</p>
        </div>
      ) : (
        <h2 class="sheet__title">{i18n.t('help.title')}</h2>
      )}
      <ul class="help">
        {items.map(([icon, key]) => (
          <li key={key}>
            <span class="help__icon" aria-hidden="true">
              {icon}
            </span>
            <span>{i18n.t(key)}</span>
          </li>
        ))}
      </ul>
      <ul class="rarity-table">
        {config.rarity.rarities.map((r) => (
          <li key={r.id} class={`r-${r.id}`} style={{ '--rc': r.color }}>
            <span class="rarity-table__swatch" aria-hidden="true" />
            <span>
              {r.emoji} {i18n.rarity(r.id)}
            </span>
            <b>{i18n.number(r.points)}</b>
          </li>
        ))}
      </ul>
      <div class="sheet__actions">
        <button class="btn btn--primary" data-autofocus onClick={onClose}>
          {onboarding ? i18n.t('onboard.cta') : i18n.t('sheet.close')}
        </button>
      </div>
    </Sheet>
  );
}
