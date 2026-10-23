import { describe, expect, it } from 'vitest';
import type { TripObservation } from '../app/verify/types.ts';
import { bucketFor, evaluateTrip, parseTrain } from '../app/verify/rules.ts';
import { config } from './helpers.ts';

const obs = (over: Partial<TripObservation> & { arr?: Partial<TripObservation['arrival']> }, category = 'ICE'): TripObservation => ({
  station: { eva: '8000105', name: 'Frankfurt(Main)Hbf' },
  train: { category, number: '123' },
  arrival: { planned: '2026-10-21T18:00', plannedPlatform: '7', cancelled: false, ...over.arr },
  nowLocal: '2026-10-21T20:30',
  source: 'mock',
  ...over,
});

describe('parseTrain', () => {
  it('accepts common spellings', () => {
    expect(parseTrain('ICE 123')).toEqual({ category: 'ICE', number: '123' });
    expect(parseTrain('ice123')).toEqual({ category: 'ICE', number: '123' });
    expect(parseTrain('S3')).toEqual({ category: 'S', number: '3' });
    expect(parseTrain('RE-5')).toEqual({ category: 'RE', number: '5' });
    expect(parseTrain('123')).toBeNull();
  });
});

describe('evaluateTrip', () => {
  it('verifies the delay ladder once arrived', () => {
    const v = evaluateTrip(config, obs({ arr: { changed: '2026-10-21T19:05' } }));
    expect(v.delayMin).toBe(65);
    expect(v.final).toBe(true);
    expect(v.verified).toEqual(expect.arrayContaining(['delay_5', 'delay_20', 'delay_60', 'eta_shift']));
    expect(v.verified).not.toContain('delay_120');
    expect(v.bucket).toBe('d60');
  });

  it('does not settle delays before the train has arrived, but already knows a forecast change', () => {
    const v = evaluateTrip(config, obs({ arr: { changed: '2026-10-21T19:05' }, nowLocal: '2026-10-21T18:30' }));
    expect(v.final).toBe(false);
    expect(v.verified).toEqual(['eta_shift']);
    expect(v.bucket).toBeNull();
  });

  it('ICE exactly on time is Mythic; a regional train on time is not', () => {
    expect(evaluateTrip(config, obs({})).verified).toContain('on_time_ice');
    expect(evaluateTrip(config, obs({}, 'RE')).verified).not.toContain('on_time_ice');
    expect(evaluateTrip(config, obs({ arr: { changed: '2026-10-21T18:01' } })).verified).not.toContain('on_time_ice');
  });

  it('early arrival', () => {
    const v = evaluateTrip(config, obs({ arr: { changed: '2026-10-21T17:57' } }));
    expect(v.verified).toEqual(expect.arrayContaining(['early_arrival', 'on_time_ice']));
    expect(v.bucket).toBe('on_time');
  });

  it('platform change and cancellation', () => {
    expect(evaluateTrip(config, obs({ arr: { changedPlatform: '9' } })).verified).toContain('platform_change');
    expect(evaluateTrip(config, obs({ arr: { changedPlatform: '7' } })).verified).not.toContain('platform_change');
    const c = evaluateTrip(config, obs({ arr: { cancelled: true }, nowLocal: '2026-10-21T10:00' }));
    expect(c.final).toBe(true);
    expect(c.verified).toContain('cancelled');
    expect(c.verified).not.toContain('delay_5');
    expect(c.bucket).toBe('cancelled');
  });

  it('lists squares that need more than one stop as unsupported (self-report still works)', () => {
    const v = evaluateTrip(config, obs({}));
    expect(v.unsupported).toEqual(expect.arrayContaining(['missed_conn', 'saved_conn', 'faster_alt', 'short_turn', 'stop_skipped', 'delay_growing']));
    expect(v.unsupported).not.toContain('delay_5');
  });

  it('falls back to the departure event at an origin station', () => {
    const v = evaluateTrip(config, { ...obs({}), arrival: undefined, departure: { planned: '2026-10-21T18:00', changed: '2026-10-21T18:25', cancelled: false } });
    expect(v.delayMin).toBe(25);
    expect(v.verified).toContain('delay_20');
  });
});

describe('bucketFor', () => {
  const b = config.game.prediction.buckets;
  it('tiles every delay into exactly one bucket', () => {
    expect(bucketFor(b, -3, false)).toBe('on_time');
    expect(bucketFor(b, 4, false)).toBe('on_time');
    expect(bucketFor(b, 5, false)).toBe('d5');
    expect(bucketFor(b, 19, false)).toBe('d5');
    expect(bucketFor(b, 20, false)).toBe('d20');
    expect(bucketFor(b, 60, false)).toBe('d60');
    expect(bucketFor(b, 600, false)).toBe('d60');
    expect(bucketFor(b, null, true)).toBe('cancelled');
    expect(bucketFor(b, null, false)).toBeNull();
  });
});
