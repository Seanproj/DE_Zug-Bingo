// Cloudflare Worker: thin, caching proxy in front of the DB Timetables API.
// Credentials live only in Worker secrets (DB_CLIENT_ID / DB_API_KEY) — never in the app.
// Without them (or with MOCK=1) it serves deterministic mock data.
import { parseTrain } from '../../app/verify/rules.ts';
import type { StationHit, TripObservation, TripQuery } from '../../app/verify/types.ts';
import { mockStations, mockTrip } from './mock.ts';
import { matchesTrain, parseStations, parseTimetable, toObservation } from './timetables.ts';

export interface Env {
  DB_CLIENT_ID?: string;
  DB_API_KEY?: string;
  MOCK?: string;
  /** comma-separated list, or "*" */
  ALLOWED_ORIGIN?: string;
}

export const UPSTREAM = 'https://apis.deutschebahn.com/db-api-marketplace/apis/timetables/v1';
/** seconds */
const TTL = { station: 86_400, plan: 3_600, fchg: 30 };
const RATE = { limit: 30, windowMs: 60_000 };

interface EdgeCache {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
}
const edgeCache = (): EdgeCache | undefined => (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default;

/** Best-effort per-isolate limiter (protects the upstream 60 req/min quota). */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < RATE.windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > RATE.limit;
}

export function berlinNow(date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(date)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

async function upstream(env: Env, path: string, ttl: number): Promise<string | null> {
  const url = `${UPSTREAM}${path}`;
  const cache = edgeCache();
  const key = new Request(url);
  const hit = await cache?.match(key);
  if (hit) return hit.text();
  const res = await fetch(url, { headers: { 'DB-Client-Id': env.DB_CLIENT_ID!, 'DB-Api-Key': env.DB_API_KEY!, accept: 'application/xml' } });
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) throw new HttpError(502, `upstream ${res.status}`);
  const body = await res.text();
  await cache?.put(key, new Response(body, { headers: { 'cache-control': `public, max-age=${ttl}` } }));
  return body;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const yymmdd = (date: string) => date.slice(2).replaceAll('-', '');
const pad = (n: number) => String(n).padStart(2, '0');

export async function findTrip(env: Env, q: TripQuery, nowLocal: string): Promise<TripObservation | null> {
  const train = parseTrain(q.train);
  if (!train) throw new HttpError(400, 'bad train');
  if (isMock(env)) return mockTrip(q, train.category, train.number, nowLocal);

  // The train may be filed under a neighbouring hour, so look at hour, hour−1, hour+1.
  for (const h of [q.hour, q.hour - 1, q.hour + 1].filter((h) => h >= 0 && h <= 23)) {
    const xml = await upstream(env, `/plan/${q.eva}/${yymmdd(q.date)}/${pad(h)}`, TTL.plan);
    if (!xml) continue;
    const plan = parseTimetable(xml);
    const stop = [...plan.stops.values()].find((s) => matchesTrain(s, train.category, train.number));
    if (!stop) continue;
    const changes = await upstream(env, `/fchg/${q.eva}`, TTL.fchg);
    const change = changes ? parseTimetable(changes).stops.get(stop.id) : undefined;
    const station: StationHit = { eva: q.eva, name: plan.station ?? q.eva };
    return toObservation(stop, change, station, nowLocal, 'live');
  }
  return null;
}

export async function findStations(env: Env, q: string): Promise<StationHit[]> {
  if (isMock(env)) return mockStations(q);
  const xml = await upstream(env, `/station/${encodeURIComponent(q)}`, TTL.station);
  return xml ? parseStations(xml).slice(0, 8) : [];
}

const isMock = (env: Env) => env.MOCK === '1' || !env.DB_CLIENT_ID || !env.DB_API_KEY;

function cors(req: Request, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGIN ?? '*').split(',').map((s) => s.trim());
  const origin = req.headers.get('origin') ?? '';
  const allow = allowed.includes('*') ? '*' : allowed.includes(origin) ? origin : allowed[0]!;
  return { 'access-control-allow-origin': allow, 'access-control-allow-methods': 'GET, OPTIONS', vary: 'origin' };
}

function json(data: unknown, status: number, headers: Record<string, string>, maxAge = 0): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': maxAge ? `public, max-age=${maxAge}` : 'no-store', ...headers },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'GET') return json({ error: 'method' }, 405, h);
    const url = new URL(req.url);
    const ip = req.headers.get('cf-connecting-ip') ?? 'local';
    try {
      if (url.pathname === '/api/health') return json({ ok: true, mode: isMock(env) ? 'mock' : 'live' }, 200, h);
      if (rateLimited(ip)) return json({ error: 'rate_limited' }, 429, h);

      if (url.pathname === '/api/stations') {
        const q = (url.searchParams.get('q') ?? '').trim();
        if (q.length < 2 || q.length > 60) return json([], 200, h);
        return json(await findStations(env, q), 200, h, 3600);
      }

      if (url.pathname === '/api/trip') {
        const eva = url.searchParams.get('eva') ?? '';
        const train = url.searchParams.get('train') ?? '';
        const date = url.searchParams.get('date') ?? '';
        const hour = Number(url.searchParams.get('hour'));
        if (!/^\d{6,8}$/.test(eva) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(hour) || hour < 0 || hour > 23 || train.length > 20)
          return json({ error: 'bad_request' }, 400, h);
        const obs = await findTrip(env, { eva, train, date, hour }, berlinNow());
        return obs ? json(obs, 200, h) : json({ error: 'not_found' }, 404, h);
      }
      return json({ error: 'not_found' }, 404, h);
    } catch (e) {
      const status = e instanceof HttpError ? e.status : 500;
      return json({ error: status === 400 ? 'bad_request' : 'upstream' }, status, h);
    }
  },
};
