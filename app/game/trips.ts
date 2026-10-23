// Trips (내 여정) and prediction bets — game points only, never real money.
// The wallet is *derived* (start + check-in bonuses − stakes + payouts), so it can't drift.
import type { Config } from '../config/types.ts';

export interface Bet {
  bucket: string;
  stake: number;
  odds: number;
  placedAt: string;
}

export interface TripResult {
  delayMin: number | null;
  cancelled: boolean;
  final: boolean;
  bucket: string | null;
  /** "S3", "RE5", "ICE" — for line titles */
  line: string;
  checkedAt: string;
  source: 'live' | 'mock';
}

export interface TripRecord {
  id: string;
  /** YYYY-MM-DD (Berlin) */
  date: string;
  train: string;
  eva: string;
  stationName: string;
  hour: number;
  createdAt: string;
  bet?: Bet;
  result?: TripResult;
  /** set once the bet (if any) is settled and the trip counted */
  settled?: { won: boolean | null; payout: number; at: string };
  /** square ids already stamped from this trip */
  stamped?: string[];
}

/** Odds = 1 / probability, one decimal. */
export function oddsFor(config: Config, bucket: string): number {
  const b = config.game.prediction.buckets.find((x) => x.id === bucket);
  if (!b) throw new Error(`unknown bucket ${bucket}`);
  return Math.round(10 / b.probability) / 10;
}

export function walletBalance(config: Config, checkinDays: number, trips: readonly TripRecord[]): number {
  const { start_points, daily_bonus } = config.game.prediction;
  let points = start_points + daily_bonus * checkinDays;
  for (const t of trips) {
    if (t.bet) points -= t.bet.stake;
    if (t.settled) points += t.settled.payout;
  }
  return points;
}

export function canBet(config: Config, balance: number, stake: number): boolean {
  return config.game.prediction.stakes.includes(stake) && stake <= balance;
}

export function placeBet(config: Config, trip: TripRecord, bucket: string, stake: number, balance: number, now: string): TripRecord {
  if (trip.bet) throw new Error('trip already has a bet');
  if (trip.result?.final) throw new Error('trip already finished');
  if (!canBet(config, balance, stake)) throw new Error('stake not allowed');
  return { ...trip, bet: { bucket, stake, odds: oddsFor(config, bucket), placedAt: now } };
}

/** Settle once the result is final. Wins pay stake × odds (rounded); losses pay 0; no bet → won: null. */
export function settleTrip(trip: TripRecord, now: string): TripRecord {
  if (trip.settled || !trip.result?.final) return trip;
  if (!trip.bet) return { ...trip, settled: { won: null, payout: 0, at: now } };
  const won = trip.result.bucket === trip.bet.bucket;
  return { ...trip, settled: { won, payout: won ? Math.round(trip.bet.stake * trip.bet.odds) : 0, at: now } };
}

export interface TripTotals {
  betWins: number;
  totalDelayMinutes: number;
  lineTrips: Record<string, number>;
  stationVisits: Record<string, number>;
}

/** Feed settled trips into player stats (achievements, titles). */
export function tripTotals(trips: readonly TripRecord[]): TripTotals {
  const out: TripTotals = { betWins: 0, totalDelayMinutes: 0, lineTrips: {}, stationVisits: {} };
  for (const t of trips) {
    if (!t.settled || !t.result) continue;
    if (t.settled.won) out.betWins++;
    if (t.result.delayMin && t.result.delayMin > 0) out.totalDelayMinutes += t.result.delayMin;
    out.lineTrips[t.result.line] = (out.lineTrips[t.result.line] ?? 0) + 1;
    out.stationVisits[t.stationName] = (out.stationVisits[t.stationName] ?? 0) + 1;
  }
  return out;
}
