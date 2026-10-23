// Deterministic fake data so the app can be built and demoed without API credentials.
// The scenario depends only on the train number, so the same input always tells the same story.
import type { StationHit, TripObservation, TripQuery } from '../../app/verify/types.ts';

export const MOCK_STATIONS: StationHit[] = [
  { eva: '8000105', name: 'Frankfurt(Main)Hbf' },
  { eva: '8011160', name: 'Berlin Hbf' },
  { eva: '8000261', name: 'München Hbf' },
  { eva: '8002549', name: 'Hamburg Hbf' },
  { eva: '8000207', name: 'Köln Hbf' },
  { eva: '8000096', name: 'Stuttgart Hbf' },
  { eva: '8000085', name: 'Düsseldorf Hbf' },
  { eva: '8010205', name: 'Leipzig Hbf' },
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function mockStations(q: string): StationHit[] {
  const needle = norm(q);
  return MOCK_STATIONS.filter((s) => norm(s.name).includes(needle)).slice(0, 8);
}

/** scenario: [arrival delay minutes | 'cancelled', platform changed] */
const SCENARIOS: [number | 'cancelled', boolean][] = [
  [0, false], [7, false], [23, true], [65, false], [131, false], ['cancelled', false], [-2, false], [12, true], [45, false], [3, false],
];

const pad = (n: number) => String(n).padStart(2, '0');
const shift = (local: string, min: number) => {
  const d = new Date(Date.parse(`${local}:00Z`) + min * 60_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

export function mockTrip(q: TripQuery, category: string, number: string, nowLocal: string): TripObservation | null {
  const station = MOCK_STATIONS.find((s) => s.eva === q.eva);
  if (!station) return null;
  const n = Number(number.replace(/\D/g, '')) || 0;
  const [delay, platformChanged] = SCENARIOS[n % SCENARIOS.length]!;
  const planned = `${q.date}T${pad(q.hour)}:${pad((n * 7) % 60)}`;
  const platform = String((n % 12) + 1);
  return {
    station,
    train: { category, number, ...(category === 'S' || category === 'RE' || category === 'RB' ? { line: number } : {}) },
    arrival: {
      planned,
      changed: delay === 'cancelled' || delay === 0 ? undefined : shift(planned, delay),
      plannedPlatform: platform,
      changedPlatform: platformChanged ? String(((n + 3) % 12) + 1) : undefined,
      cancelled: delay === 'cancelled',
    },
    nowLocal,
    source: 'mock',
  };
}
