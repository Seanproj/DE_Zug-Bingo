import { describe, expect, it } from 'vitest';
import type { Config } from '../app/config/types.ts';
import { createI18n, detectLocale } from '../app/i18n/index.ts';
import { config } from './helpers.ts';

const supported = config.game.locales.supported;

describe('detectLocale', () => {
  it('matches the first supported base language', () => {
    expect(detectLocale(['de-AT', 'en-US'], supported, 'en')).toBe('de');
    expect(detectLocale(['ko-KR'], supported, 'en')).toBe('ko');
    expect(detectLocale(['fr-FR', 'en-GB'], supported, 'en')).toBe('en');
  });

  it('falls back when nothing matches', () => {
    expect(detectLocale(['fr', 'ja'], supported, 'en')).toBe('en');
    expect(detectLocale([], supported, 'en')).toBe('en');
  });

  it('honours a supported override and ignores an unsupported one', () => {
    expect(detectLocale(['ko'], supported, 'en', 'de')).toBe('de');
    expect(detectLocale(['ko'], supported, 'en', 'xx')).toBe('ko');
  });
});

describe('createI18n', () => {
  it('fills variables', () => {
    expect(createI18n(config, 'en').t('header.streak', { n: 3 })).toBe('3-day streak');
    expect(createI18n(config, 'ko').t('header.streak', { n: 3 })).toBe('3일 연속');
  });

  it('pluralises per language', () => {
    const en = createI18n(config, 'en');
    expect(en.plural('share.lines', 1)).toBe('1 line!');
    expect(en.plural('share.lines', 2)).toBe('2 lines!');
    expect(createI18n(config, 'de').plural('share.lines', 1)).toBe('1 Reihe!');
    expect(createI18n(config, 'ko').plural('share.lines', 2)).toBe('2줄!');
  });

  it('localises squares, the free square and rarities', () => {
    expect(createI18n(config, 'en').square('cancelled').label).toBe('Train cancelled');
    expect(createI18n(config, 'de').square('cancelled').label).toBe('Zugausfall');
    expect(createI18n(config, 'ko').square(config.game.board.free_square.id).label).toBe('오늘도 기차를 탔다');
    expect(createI18n(config, 'de').rarity('mythic')).toBe('Mythisch');
  });

  it('shows the German original term only where it adds information', () => {
    expect(createI18n(config, 'ko').meta.show_term).toBe(true);
    expect(createI18n(config, 'en').meta.show_term).toBe(true);
    expect(createI18n(config, 'de').meta.show_term).toBe(false);
  });

  it('falls back to the fallback locale for missing strings, then to the key', () => {
    const patched: Config = structuredClone(config);
    delete patched.locales.de!.ui['action.share'];
    expect(createI18n(patched, 'de').t('action.share')).toBe('Share result');
    expect(createI18n(patched, 'de').t('no.such.key')).toBe('no.such.key');
  });

  it('formats lists and numbers per locale', () => {
    expect(createI18n(config, 'en').list(['a', 'b', 'c'])).toBe('a, b, and c');
    expect(createI18n(config, 'de').number(1440)).toBe('1.440');
  });
});
