// Browser client for the Workers proxy. Never holds credentials — the proxy does.
import type { Config } from '../config/types.ts';
import type { StationHit, TripObservation, TripQuery } from './types.ts';

export type FetchError = 'offline' | 'not_found' | 'rate_limited' | 'bad_request' | 'network';
export type Result<T> = { ok: true; value: T } | { ok: false; error: FetchError };

async function get<T>(config: Config, path: string, signal?: AbortSignal): Promise<Result<T>> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, error: 'offline' };
  const timeout = AbortSignal.timeout(config.game.verify.timeout_ms);
  try {
    const res = await fetch(`${config.game.verify.endpoint}${path}`, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    if (res.ok) return { ok: true, value: (await res.json()) as T };
    return { ok: false, error: res.status === 404 ? 'not_found' : res.status === 429 ? 'rate_limited' : res.status === 400 ? 'bad_request' : 'network' };
  } catch (e) {
    if ((e as Error).name === 'AbortError' && signal?.aborted) throw e;
    return { ok: false, error: 'network' };
  }
}

export const searchStations = (config: Config, q: string, signal?: AbortSignal) =>
  get<StationHit[]>(config, `/stations?q=${encodeURIComponent(q)}`, signal);

export const fetchTrip = (config: Config, q: TripQuery) =>
  get<TripObservation>(config, `/trip?${new URLSearchParams({ eva: q.eva, train: q.train, date: q.date, hour: String(q.hour) })}`);
