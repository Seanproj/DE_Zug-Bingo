// Turn a live observation into verified squares and a settled prediction bucket. Pure.
import type { Config, PredictionBucket } from '../config/types.ts';
import type { StopEvent, TripObservation } from './types.ts';

export interface TripVerdict {
  /** arrival (or departure) delay in minutes; null when the stop has no times */
  delayMin: number | null;
  /** true once the train has actually arrived (or was cancelled) — delay squares and bets settle then */
  final: boolean;
  cancelled: boolean;
  platformChanged: boolean;
  forecastChanged: boolean;
  /** square ids proven by the data */
  verified: string[];
  /** verifiable squares this proxy cannot prove yet (need multiple trains or a route) */
  unsupported: string[];
  /** settled prediction bucket id, only when final */
  bucket: string | null;
}

const minutes = (local: string) => Date.parse(`${local}:00Z`) / 60_000;

/** Parse "ICE 123" / "ICE123" / "s3" → category + number (category upper-cased). */
export function parseTrain(input: string): { category: string; number: string } | null {
  const m = input.trim().match(/^([A-Za-zÄÖÜäöü]+)\s*-?\s*(\d+[A-Za-z]?)$/);
  return m ? { category: m[1]!.toUpperCase(), number: m[2]! } : null;
}

function event(obs: TripObservation): StopEvent | undefined {
  return obs.arrival ?? obs.departure;
}

export function bucketFor(buckets: readonly PredictionBucket[], delayMin: number | null, cancelled: boolean): string | null {
  if (cancelled) return buckets.find((b) => b.cancelled)?.id ?? null;
  if (delayMin === null) return null;
  return buckets.find((b) => !b.cancelled && (b.min === undefined || delayMin >= b.min) && (b.max === undefined || delayMin <= b.max))?.id ?? null;
}

export function evaluateTrip(config: Config, obs: TripObservation): TripVerdict {
  const ev = event(obs);
  const cancelled = !!(obs.arrival?.cancelled || (!obs.arrival && obs.departure?.cancelled));
  const actual = ev?.changed ?? ev?.planned;
  const delayMin = ev?.planned && actual ? minutes(actual) - minutes(ev.planned) : null;
  const final = cancelled || (actual !== undefined && minutes(actual) + config.game.verify.settle_grace_min <= minutes(obs.nowLocal));
  const platformChanged = !!(ev?.changedPlatform && ev.plannedPlatform && ev.changedPlatform !== ev.plannedPlatform);
  const forecastChanged = !!(ev?.changed && ev.planned && ev.changed !== ev.planned);

  const verified: string[] = [];
  const unsupported: string[] = [];
  for (const sq of config.squares) {
    if (!sq.verifiable || !sq.verify) continue;
    const r = sq.verify;
    let ok: boolean | null;
    switch (r.type) {
      case 'delay_min':
        ok = final && !cancelled && delayMin !== null && delayMin >= Number(r.minutes);
        break;
      case 'platform_change':
        ok = platformChanged;
        break;
      case 'cancelled':
        ok = cancelled;
        break;
      case 'on_time': {
        const types = (r.train_types as string[] | undefined) ?? [];
        ok = final && !cancelled && delayMin !== null && delayMin <= Number(r.max_delay_min ?? 0) && (!types.length || types.includes(obs.train.category));
        break;
      }
      case 'early_arrival':
        ok = final && !cancelled && delayMin !== null && delayMin <= -Number(r.min_early_min ?? 1);
        break;
      case 'forecast_changed':
        ok = forecastChanged;
        break;
      default:
        ok = null; // missed/made connection, faster alternative, short turn, skipped stop, growing delay, events
    }
    if (ok === null) unsupported.push(sq.id);
    else if (ok) verified.push(sq.id);
  }

  return {
    delayMin,
    final,
    cancelled,
    platformChanged,
    forecastChanged,
    verified,
    unsupported,
    bucket: final ? bucketFor(config.game.prediction.buckets, delayMin, cancelled) : null,
  };
}
