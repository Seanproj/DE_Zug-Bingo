// Minimal parser for the DB Timetables API XML (plan / fchg / station). No DOM in Workers,
// so we read the flat, attribute-only structure with regular expressions.
import type { StationHit, StopEvent, TripObservation } from '../../app/verify/types.ts';

type Attrs = Record<string, string>;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e] ?? m),
  );

export function attrs(tag: string): Attrs {
  const out: Attrs = {};
  for (const m of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) out[m[1]!] = decode(m[2]!);
  return out;
}

/** "2610211805" (YYMMddHHmm, Berlin local) → "2026-10-21T18:05" */
export function parseTime(t: string | undefined): string | undefined {
  if (!t || !/^\d{10}$/.test(t)) return undefined;
  return `20${t.slice(0, 2)}-${t.slice(2, 4)}-${t.slice(4, 6)}T${t.slice(6, 8)}:${t.slice(8, 10)}`;
}

export interface RawStop {
  id: string;
  tl?: Attrs;
  ar?: Attrs;
  dp?: Attrs;
}

/** Parse a <timetable> document (plan or fchg) into stops keyed by id. */
export function parseTimetable(xml: string): { station?: string; eva?: string; stops: Map<string, RawStop> } {
  const head = xml.match(/<timetable\b([^>]*)>/);
  const meta = head ? attrs(head[1]!) : {};
  const stops = new Map<string, RawStop>();
  for (const m of xml.matchAll(/<s\b([^>]*?)(?:\/>|>([\s\S]*?)<\/s>)/g)) {
    const a = attrs(m[1]!);
    const body = m[2] ?? '';
    const pick = (name: string) => {
      const e = body.match(new RegExp(`<${name}\\b([^>]*?)\\/?>`));
      return e ? attrs(e[1]!) : undefined;
    };
    stops.set(a.id!, { id: a.id!, tl: pick('tl'), ar: pick('ar'), dp: pick('dp') });
  }
  return { station: meta.station, eva: meta.eva, stops };
}

export function parseStations(xml: string): StationHit[] {
  return [...xml.matchAll(/<station\b([^>]*?)\/?>/g)].map((m) => {
    const a = attrs(m[1]!);
    return { eva: a.eva!, name: a.name! };
  }).filter((s) => s.eva && s.name);
}

/** Does this stop belong to the train the user typed? Matches "ICE 123" by number or "S 3" by line. */
export function matchesTrain(stop: RawStop, category: string, number: string): boolean {
  const c = stop.tl?.c?.toUpperCase();
  if (c !== category.toUpperCase()) return false;
  const line = stop.dp?.l ?? stop.ar?.l;
  return stop.tl?.n === number || line === number || line === `${category}${number}`;
}

function toEvent(plan: Attrs | undefined, change: Attrs | undefined): StopEvent | undefined {
  if (!plan && !change) return undefined;
  return {
    planned: parseTime(plan?.pt),
    changed: parseTime(change?.ct ?? plan?.ct),
    plannedPlatform: plan?.pp,
    changedPlatform: change?.cp ?? plan?.cp,
    cancelled: (change?.cs ?? plan?.cs ?? plan?.ps) === 'c',
  };
}

export function toObservation(plan: RawStop, change: RawStop | undefined, station: StationHit, nowLocal: string, source: TripObservation['source']): TripObservation {
  const line = plan.dp?.l ?? plan.ar?.l;
  return {
    station,
    train: { category: plan.tl?.c ?? '', number: plan.tl?.n ?? '', ...(line ? { line } : {}) },
    arrival: plan.ar ? toEvent(plan.ar, change?.ar) : undefined,
    departure: plan.dp ? toEvent(plan.dp, change?.dp) : undefined,
    nowLocal,
    source,
  };
}
