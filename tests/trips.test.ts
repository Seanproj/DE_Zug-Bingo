import { describe, expect, it } from 'vitest';
import { canBet, oddsFor, placeBet, settleTrip, tripTotals, walletBalance, type TripRecord } from '../app/game/trips.ts';
import { config } from './helpers.ts';

const trip = (over: Partial<TripRecord> = {}): TripRecord => ({
  id: 't1', date: '2026-10-21', train: 'ICE 123', eva: '8000105', stationName: 'Frankfurt(Main)Hbf', hour: 18, createdAt: 'T0', ...over,
});
const result = (bucket: string | null, delayMin: number | null, final = true, line = 'ICE') => ({ delayMin, cancelled: bucket === 'cancelled', final, bucket, line, checkedAt: 'T2', source: 'mock' as const });

describe('odds', () => {
  it('is the inverse probability with one decimal', () => {
    expect(oddsFor(config, 'on_time')).toBe(1.7);
    expect(oddsFor(config, 'd5')).toBe(4);
    expect(oddsFor(config, 'd60')).toBe(33.3);
    expect(oddsFor(config, 'cancelled')).toBe(50);
    expect(() => oddsFor(config, 'nope')).toThrow();
  });
});

describe('bets', () => {
  it('only allows configured stakes within the balance', () => {
    expect(canBet(config, 100, 25)).toBe(true);
    expect(canBet(config, 20, 25)).toBe(false);
    expect(canBet(config, 100, 30)).toBe(false);
  });

  it('places once, before the trip is final', () => {
    const t = placeBet(config, trip(), 'd5', 10, 100, 'T1');
    expect(t.bet).toEqual({ bucket: 'd5', stake: 10, odds: 4, placedAt: 'T1' });
    expect(() => placeBet(config, t, 'd5', 10, 100, 'T1')).toThrow();
    expect(() => placeBet(config, trip({ result: result('d5', 7) }), 'd5', 10, 100, 'T1')).toThrow();
  });

  it('settles wins and losses only when final', () => {
    const bet = placeBet(config, trip(), 'd5', 10, 100, 'T1');
    expect(settleTrip({ ...bet, result: result(null, 7, false) }, 'T3').settled).toBeUndefined();
    expect(settleTrip({ ...bet, result: result('d5', 7) }, 'T3').settled).toEqual({ won: true, payout: 40, at: 'T3' });
    expect(settleTrip({ ...bet, result: result('on_time', 0) }, 'T3').settled).toEqual({ won: false, payout: 0, at: 'T3' });
    expect(settleTrip(trip({ result: result('on_time', 0) }), 'T3').settled).toEqual({ won: null, payout: 0, at: 'T3' });
  });

  it('settling twice is a no-op', () => {
    const s = settleTrip({ ...placeBet(config, trip(), 'd5', 10, 100, 'T1'), result: result('d5', 7) }, 'T3');
    expect(settleTrip(s, 'T9')).toBe(s);
  });
});

describe('wallet', () => {
  it('is derived from start points, check-ins, stakes and payouts', () => {
    const won = settleTrip({ ...placeBet(config, trip(), 'd5', 10, 100, 'T1'), result: result('d5', 7) }, 'T3');
    const lost = settleTrip({ ...placeBet(config, trip({ id: 't2' }), 'd60', 25, 100, 'T1'), result: result('d5', 7) }, 'T3');
    const open = placeBet(config, trip({ id: 't3' }), 'on_time', 50, 100, 'T1');
    // 100 + 3×10 − 10 + 40 − 25 − 50
    expect(walletBalance(config, 3, [won, lost, open])).toBe(85);
  });
});

describe('tripTotals', () => {
  it('counts wins, delay minutes, lines and stations from settled trips only', () => {
    const a = settleTrip({ ...placeBet(config, trip(), 'd20', 10, 100, 'T1'), result: result('d20', 45, true, 'S3') }, 'T3');
    const b = settleTrip(trip({ id: 'b', result: result('on_time', -2, true, 'S3') }), 'T3');
    const pending = trip({ id: 'c', result: result(null, 30, false) });
    expect(tripTotals([a, b, pending])).toEqual({
      betWins: 1, totalDelayMinutes: 45, lineTrips: { S3: 2 }, stationVisits: { 'Frankfurt(Main)Hbf': 2 },
    });
  });
});
