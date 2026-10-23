// Offline-first persistence (IndexedDB). Falls back to memory when IndexedDB is unavailable
// (private mode, blocked storage) so the game always works — it just won't survive a reload.
import type { DayRecord } from '../game/day.ts';

export interface Settings {
  /** null = follow the device language */
  locale: string | null;
  haptics: boolean;
  onboarded: boolean;
  /** equipped title id */
  title: string | null;
}

export const DEFAULT_SETTINGS: Settings = { locale: null, haptics: true, onboarded: false, title: null };

export interface Store {
  readonly persistent: boolean;
  getDay(key: string): Promise<DayRecord | undefined>;
  putDay(day: DayRecord): Promise<void>;
  allDays(): Promise<DayRecord[]>;
  getSettings(): Promise<Settings>;
  putSettings(settings: Settings): Promise<void>;
  /** Small JSON blobs (e.g. unlocked achievements). */
  getMeta<T>(key: string): Promise<T | undefined>;
  putMeta<T>(key: string, value: T): Promise<void>;
}

const DB_NAME = 'zug-bingo';
const DB_VERSION = 1;

const req = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = factory.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('days')) db.createObjectStore('days', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error('IndexedDB blocked'));
  });
}

export function idbStore(db: IDBDatabase): Store {
  const tx = (name: string, mode: IDBTransactionMode) => db.transaction(name, mode).objectStore(name);
  return {
    persistent: true,
    getDay: (key) => req(tx('days', 'readonly').get(key)) as Promise<DayRecord | undefined>,
    putDay: async (day) => void (await req(tx('days', 'readwrite').put(day))),
    allDays: () => req(tx('days', 'readonly').getAll()) as Promise<DayRecord[]>,
    getSettings: async () => ({ ...DEFAULT_SETTINGS, ...((await req(tx('kv', 'readonly').get('settings'))) as Partial<Settings> | undefined) }),
    putSettings: async (s) => void (await req(tx('kv', 'readwrite').put(s, 'settings'))),
    getMeta: async <T,>(key: string) => (await req(tx('kv', 'readonly').get(`meta:${key}`))) as T | undefined,
    putMeta: async (key, value) => void (await req(tx('kv', 'readwrite').put(value, `meta:${key}`))),
  };
}

export function memoryStore(): Store {
  const days = new Map<string, DayRecord>();
  let settings = { ...DEFAULT_SETTINGS };
  const meta = new Map<string, unknown>();
  return {
    persistent: false,
    getDay: async (key) => structuredClone(days.get(key)),
    putDay: async (day) => void days.set(day.key, structuredClone(day)),
    allDays: async () => [...days.values()].map((d) => structuredClone(d)),
    getSettings: async () => ({ ...DEFAULT_SETTINGS, ...settings }),
    putSettings: async (s) => void (settings = { ...s }),
    getMeta: async <T,>(key: string) => structuredClone(meta.get(key)) as T | undefined,
    putMeta: async (key, value) => void meta.set(key, structuredClone(value)),
  };
}

export async function openStore(factory: IDBFactory | undefined = globalThis.indexedDB): Promise<Store> {
  if (!factory) return memoryStore();
  try {
    return idbStore(await open(factory));
  } catch {
    return memoryStore();
  }
}
