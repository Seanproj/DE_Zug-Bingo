// Shape shared by the Workers proxy (worker/) and the app. Times are Europe/Berlin local
// wall-clock strings "YYYY-MM-DDTHH:mm" exactly as the Timetables API reports them.

export interface StopEvent {
  /** planned time */
  planned?: string;
  /** changed (forecast or actual) time, when the API reports one */
  changed?: string;
  plannedPlatform?: string;
  changedPlatform?: string;
  /** event status "c" in plan (ps) or changes (cs) */
  cancelled: boolean;
}

export interface TripObservation {
  station: { eva: string; name: string };
  train: { category: string; number: string; line?: string };
  arrival?: StopEvent;
  departure?: StopEvent;
  /** Berlin local time when the proxy fetched the data */
  nowLocal: string;
  source: 'live' | 'mock';
}

export interface StationHit {
  eva: string;
  name: string;
}

export interface TripQuery {
  /** station EVA number */
  eva: string;
  /** e.g. "ICE 123", "RE 5", "S3" */
  train: string;
  /** YYYY-MM-DD (Berlin) */
  date: string;
  /** planned hour 0–23 at that station (arrival or departure) */
  hour: number;
}
