import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, memoryStore, openStore, type Store } from '../app/storage/db.ts';

const day = (key: string, n = 1) => ({
  key,
  marks: Array.from({ length: n }, (_, i) => ({ squareId: `sq${i}`, method: 'self' as const, at: `${key}T08:00:00Z` })),
  updatedAt: `${key}T08:00:00Z`,
});

const suite = (name: string, make: () => Promise<Store>) =>
  describe(name, () => {
    it('stores and reads days', async () => {
      const s = await make();
      expect(await s.getDay('2026-10-23')).toBeUndefined();
      await s.putDay(day('2026-10-23', 2));
      await s.putDay(day('2026-10-24'));
      expect((await s.getDay('2026-10-23'))?.marks).toHaveLength(2);
      expect((await s.allDays()).map((d) => d.key).sort()).toEqual(['2026-10-23', '2026-10-24']);
    });

    it('overwrites a day on put', async () => {
      const s = await make();
      await s.putDay(day('2026-10-23', 3));
      await s.putDay(day('2026-10-23', 1));
      expect((await s.getDay('2026-10-23'))?.marks).toHaveLength(1);
    });

    it('returns defaults, then saved settings', async () => {
      const s = await make();
      expect(await s.getSettings()).toEqual(DEFAULT_SETTINGS);
      await s.putSettings({ locale: 'de', haptics: false, onboarded: true });
      expect(await s.getSettings()).toEqual({ locale: 'de', haptics: false, onboarded: true });
    });
  });

suite('IndexedDB store', async () => openStore(new IDBFactory()));
suite('memory store', async () => memoryStore());

describe('openStore', () => {
  it('persists across reopen with the same factory', async () => {
    const factory = new IDBFactory();
    const a = await openStore(factory);
    expect(a.persistent).toBe(true);
    await a.putDay(day('2026-10-23'));
    const b = await openStore(factory);
    expect(await b.getDay('2026-10-23')).toBeDefined();
  });

  it('falls back to memory without IndexedDB', async () => {
    expect((await openStore(undefined)).persistent).toBe(false);
  });
});
