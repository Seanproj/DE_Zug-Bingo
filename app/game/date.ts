// Calendar helpers. The daily card flips at 00:00 in the configured timezone (Europe/Berlin).

/** YYYY-MM-DD of `instant` as seen in `timeZone`. */
export function dateKey(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

const toUtcDays = (key: string) => {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / 86_400_000;
};

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round(toUtcDays(to) - toUtcDays(from));
}

/** Zug-Bingo #N — the epoch date is #1. */
export function dailyNumber(key: string, epoch: string): number {
  return daysBetween(epoch, key) + 1;
}

/** key shifted by `days` (may be negative). */
export function addDays(key: string, days: number): string {
  return new Date((toUtcDays(key) + days) * 86_400_000).toISOString().slice(0, 10);
}
