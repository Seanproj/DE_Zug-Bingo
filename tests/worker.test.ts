import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { berlinNow, findTrip, rateLimited, UPSTREAM } from '../worker/src/index.ts';
import { matchesTrain, parseStations, parseTime, parseTimetable, toObservation } from '../worker/src/timetables.ts';
import { evaluateTrip } from '../app/verify/rules.ts';
import { config } from './helpers.ts';

const fx = (n: string) => readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8');

describe('timetables parser', () => {
  it('parses YYMMddHHmm local times', () => {
    expect(parseTime('2610211801')).toBe('2026-10-21T18:01');
    expect(parseTime(undefined)).toBeUndefined();
    expect(parseTime('nope')).toBeUndefined();
  });

  it('reads stops, trip labels and events', () => {
    const plan = parseTimetable(fx('plan.xml'));
    expect(plan.station).toBe('Frankfurt(Main)Hbf');
    expect(plan.stops.size).toBe(3);
    const ice = plan.stops.get('-123456789-2610211801-5')!;
    expect(ice.tl).toMatchObject({ c: 'ICE', n: '123' });
    expect(ice.ar).toMatchObject({ pt: '2610211801', pp: '7' });
    expect(ice.ar!.ppth).toContain('Köln Hbf');
  });

  it('matches ICE by number and S-Bahn by line', () => {
    const stops = [...parseTimetable(fx('plan.xml')).stops.values()];
    expect(stops.filter((s) => matchesTrain(s, 'ICE', '123'))).toHaveLength(1);
    expect(stops.filter((s) => matchesTrain(s, 'S', '3'))).toHaveLength(1);
    expect(stops.filter((s) => matchesTrain(s, 'S', '35123'))).toHaveLength(1);
    expect(stops.filter((s) => matchesTrain(s, 'ICE', '124'))).toHaveLength(0);
  });

  it('merges changes into an observation the rules can judge', () => {
    const plan = parseTimetable(fx('plan.xml')).stops;
    const changes = parseTimetable(fx('fchg.xml')).stops;
    const station = { eva: '8000105', name: 'Frankfurt(Main)Hbf' };
    const ice = toObservation(plan.get('-123456789-2610211801-5')!, changes.get('-123456789-2610211801-5'), station, '2026-10-21T19:30', 'live');
    expect(ice.arrival).toEqual({ planned: '2026-10-21T18:01', changed: '2026-10-21T18:49', plannedPlatform: '7', changedPlatform: '9', cancelled: false });
    const v = evaluateTrip(config, ice);
    expect(v.delayMin).toBe(48);
    expect(v.verified).toEqual(expect.arrayContaining(['delay_5', 'delay_20', 'platform_change', 'eta_shift']));

    const s3 = toObservation(plan.get('99887766-2610211812-3')!, changes.get('99887766-2610211812-3'), station, '2026-10-21T19:30', 'live');
    expect(s3.train).toEqual({ category: 'S', number: '35123', line: '3' });
    expect(evaluateTrip(config, s3).verified).toContain('cancelled');

    const re = toObservation(plan.get('555-2610211830-1')!, undefined, station, '2026-10-21T19:30', 'live');
    expect(re.departure!.cancelled).toBe(true); // planned status ps="c"
  });

  it('parses station search results', () => {
    expect(parseStations(fx('stations.xml'))).toEqual([
      { eva: '8000105', name: 'Frankfurt(Main)Hbf' },
      { eva: '8070003', name: 'Frankfurt(M) Flughafen Fernbf' },
    ]);
  });
});

describe('worker (mock mode)', () => {
  const env = {};
  const get = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://proxy.test${path}`, init), env);

  it('reports mock mode without credentials', async () => {
    expect(await (await get('/api/health')).json()).toEqual({ ok: true, mode: 'mock' });
  });

  it('searches stations and finds deterministic trips', async () => {
    const stations = (await (await get('/api/stations?q=frank')).json()) as { eva: string }[];
    expect(stations[0]!.eva).toBe('8000105');
    const res = await get('/api/trip?eva=8000105&train=ICE%20123&date=2026-10-21&hour=18');
    expect(res.status).toBe(200);
    const obs = await res.json();
    expect(obs).toMatchObject({ source: 'mock', train: { category: 'ICE', number: '123' } });
    const again = await (await get('/api/trip?eva=8000105&train=ICE%20123&date=2026-10-21&hour=18')).json();
    expect({ ...again, nowLocal: '' }).toEqual({ ...obs, nowLocal: '' });
  });

  it('validates input and answers CORS preflight', async () => {
    expect((await get('/api/trip?eva=x&train=ICE1&date=2026-10-21&hour=18')).status).toBe(400);
    expect((await get('/api/trip?eva=8000105&train=hello&date=2026-10-21&hour=18')).status).toBe(400);
    expect((await get('/api/trip?eva=8000105&train=ICE1&date=2026-10-21&hour=24')).status).toBe(400);
    const pre = await get('/api/trip', { method: 'OPTIONS' });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    expect((await get('/api/trip', { method: 'POST' })).status).toBe(405);
  });
});

describe('worker (live mode, upstream stubbed)', () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = { DB_CLIENT_ID: 'id-123', DB_API_KEY: 'key-456' };

  it('sends credentials only to the upstream and merges plan + changes', async () => {
    const calls: { url: string; headers: Headers }[] = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ url, headers: new Headers(init.headers) });
      if (url.includes('/plan/8000105/261021/18')) return new Response(fx('plan.xml'));
      if (url.includes('/fchg/8000105')) return new Response(fx('fchg.xml'));
      return new Response('', { status: 404 });
    });
    const obs = await findTrip(env, { eva: '8000105', train: 'ICE 123', date: '2026-10-21', hour: 18 }, '2026-10-21T19:30');
    expect(obs?.source).toBe('live');
    expect(obs?.arrival?.changed).toBe('2026-10-21T18:49');
    expect(calls[0]!.url).toBe(`${UPSTREAM}/plan/8000105/261021/18`);
    expect(calls[0]!.headers.get('DB-Client-Id')).toBe('id-123');
    expect(calls[0]!.headers.get('DB-Api-Key')).toBe('key-456');
  });

  it('looks at neighbouring hours and returns null when the train is unknown', async () => {
    const asked: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(url.replace(UPSTREAM, ''));
      return url.includes('/plan/') ? new Response(fx('plan.xml')) : new Response(fx('fchg.xml'));
    });
    expect(await findTrip(env, { eva: '8000105', train: 'ICE 999', date: '2026-10-21', hour: 18 }, 'x')).toBeNull();
    expect(asked).toEqual(['/plan/8000105/261021/18', '/plan/8000105/261021/17', '/plan/8000105/261021/19']);
  });

  it('never leaks credentials in error responses', async () => {
    vi.stubGlobal('fetch', async () => new Response('boom', { status: 500 }));
    const res = await worker.fetch(new Request('https://proxy.test/api/trip?eva=8000105&train=ICE1&date=2026-10-21&hour=18'), env);
    expect(res.status).toBe(502);
    expect(await res.text()).not.toMatch(/id-123|key-456/);
  });
});

describe('helpers', () => {
  it('formats Berlin local time', () => {
    expect(berlinNow(new Date('2026-10-21T16:30:00Z'))).toBe('2026-10-21T18:30');
    expect(berlinNow(new Date('2026-12-21T16:30:00Z'))).toBe('2026-12-21T17:30');
  });

  it('rate-limits after 30 requests per minute per client', () => {
    for (let i = 0; i < 30; i++) expect(rateLimited('ip-x', 1000 + i)).toBe(false);
    expect(rateLimited('ip-x', 1100)).toBe(true);
    expect(rateLimited('ip-x', 1000 + 61_000 + 100)).toBe(false);
  });
});
