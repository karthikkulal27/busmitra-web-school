export interface LiveFix {
  busId: string;
  tripId: string;
  lat: number;
  lng: number;
  /** metres per second, as the GPS chip reported it */
  speed: number | null;
  /** degrees clockwise from true north */
  heading: number | null;
  at: string;
  receivedAt: string;
}

/**
 * Deliberately not "on time" / "late". A delay figure needs per-stop ETAs,
 * which need arrival detection — phase 4. These five are what the data can
 * actually answer today.
 */
export type TripStatus = 'running' | 'no_signal' | 'lost' | 'finished' | 'not_started';

export interface TripView {
  tripId: string;
  routeId: string;
  routeName: string;
  shift: string;
  busId: string;
  plate: string;
  driverPhone: string;
  driverName: string | null;
  startedAt: string;
  endedAt: string | null;
  serviceDate: string;
  status: TripStatus;
  live: LiveFix | null;
}

export interface Overview {
  school: {
    id: string;
    name: string;
    code: string;
    city: string;
    timezone: string;
    localTime: string;
  };
  date: string;
  isToday: boolean;
  fleet: {
    buses: number;
    activeBuses: number;
    running: number;
    noSignal: number;
    finished: number;
  };
  trips: TripView[];
}

export interface BusView {
  busId: string;
  plate: string;
  seats: number;
  active: boolean;
  tripId: string | null;
  routeId: string | null;
  routeName: string | null;
  startedAt: string | null;
  driverPhone: string | null;
  driverName: string | null;
  status: TripStatus;
  live: LiveFix | null;
}

export interface Stop {
  id: string;
  seq: number;
  name: string;
  lat: number;
  lng: number;
  geofence_m: number;
  scheduled_time: string | null;
  /** Null until the driver taps "Reached stop" (DR-04). */
  reached_at: string | null;
  boarded_count: number | null;
  absent_count: number | null;
}

export type BoardingEventName = 'boarded' | 'not_boarded' | 'dropped' | 'on_leave';

export interface BoardingEvent {
  id: string;
  at: string;
  event: BoardingEventName;
  reason: string | null;
  markedBy: string;
  source: string;
  childName: string;
  childClass: string | null;
  routeName: string;
  stopName: string | null;
  tripId: string;
  plate: string;
}

export interface BoardingLog {
  date: string;
  totals: { boarded: number; notBoarded: number; onLeave: number; dropped: number };
  events: BoardingEvent[];
}

export interface TripDetail {
  trip: TripView;
  stops: Stop[];
  history: { points: number; firstAt: string | null; lastAt: string | null };
}

export interface Track {
  tripId: string;
  points: number;
  coordinates: [number, number][];
}

export interface Session {
  token: string;
  staff: { id: string; name: string; role: 'office' | 'principal' | 'transport' };
  school: { id: string; name: string; code: string };
}

export interface Alert {
  id: string;
  at: string;
  type: string;
  severity: 'info' | 'warn' | 'critical';
  payload: Record<string, unknown>;
  handledBy: string | null;
  handledAt: string | null;
  tripId: string | null;
  routeName: string | null;
  plate: string | null;
}

export interface RouteOption {
  id: string;
  name: string;
  shift: string;
  children: number;
  parents: number;
}

export interface SentMessage {
  id: string;
  body: string;
  createdBy: string;
  sentAt: string | null;
  recipients: number;
  sent: number;
  failed: number;
}

export interface ChildRow {
  id: string;
  name: string;
  admissionNo: string | null;
  className: string | null;
  routeName: string | null;
  stopId: string | null;
  stopName: string | null;
  parentName: string | null;
  parentPhone: string | null;
}

export interface ImportPreviewChild {
  rowNumber: number;
  name: string;
  admissionNo: string | null;
  className: string | null;
  rawStop: string | null;
  parentName: string | null;
  parentPhone: string | null;
  needsReview: boolean;
  match: { stopId: string; stopName: string; routeName: string; score: number; how: string } | null;
}

export interface ImportPreview {
  file: string;
  sheetName: string;
  headerRow: number;
  mapping: { header: string; index: number; field: string | null; confident: boolean }[];
  stops: { id: string; name: string; routeName: string }[];
  totals: { rows: number; matched: number; needsReview: number; noPhone: number };
  unmatchedSpellings: { raw: string; suggestion: { stopName: string; score: number } | null }[];
  children: ImportPreviewChild[];
}

export interface EditorStop {
  id: string;
  name: string;
  seq: number;
  lat: number;
  lng: number;
  geofenceM: number;
  waitSeconds: number;
  scheduledTime: string | null;
  children: number;
}

export interface EditorRoute {
  id: string;
  name: string;
  shift: string;
  /** The bus that runs it. Null until the school picks one on SA-05. */
  busId: string | null;
  stops: EditorStop[];
}

export interface ReportSummary {
  range: { from: string; to: string };
  totals: {
    trips: number;
    onTimePercent: number | null;
    measuredTrips: number;
    averageDelayMinutes: number | null;
    distanceKm: number;
    speedViolations: number;
  };
  alertCounts: Record<string, number>;
  routes: {
    routeId: string;
    routeName: string;
    trips: number;
    onTimePercent: number | null;
    averageDelayMinutes: number | null;
    distanceKm: number;
    violations: number;
  }[];
  byDay: { day: string; averageDelayMinutes: number; trips: number }[];
}

export interface PrincipalView {
  school: { name: string; localTime: string; date: string };
  viewer: { name: string; role: string };
  rightNow: {
    busesRunning: number;
    busesTotal: number;
    noSignal: number;
    routes: { tripId: string; routeName: string; plate: string; moving: boolean }[];
  };
  thisWeek: {
    onTimePercent: number | null;
    measuredTrips: number;
    childrenTravelling: number;
    childrenWithoutParentNumber: number;
  };
  safety: { childStillAboard: number; sos: number; overspeed: number; longHalt: number };
  decisions: { text: string; detail: string; severity: string }[];
}

export interface StaffMember {
  id: string;
  name: string;
  phone: string;
  role: string;
  licenceExpiry: string | null;
  daysToLicence: number | null;
  policeVerifiedOn: string | null;
  score: number | null;
  plate: string | null;
  onTrip: boolean;
}

export interface StaffView {
  staff: StaffMember[];
  buses: { id: string; plate: string; fitnessExpiry: string | null; daysToFitness: number | null }[];
  counts: {
    drivers: number;
    attendants: number;
    onTrip: number;
    expiringLicences: number;
    expiringFitness: number;
    speedWarningsThisWeek: number;
  };
  warnDays: number;
}

export interface SettingsView {
  school: {
    name: string;
    code: string;
    city: string;
    timezone: string;
    /** Centres every map. Null falls back to Mangalore. */
    lat: number | null;
    lng: number | null;
  };
  timings: { assemblyTime: string | null; closingTime: string | null; busesLeaveBy: string | null };
  contacts: { officePhone: string | null; transportPhone: string | null };
  alerts: {
    speedLimitKmh: number;
    longHaltMinutes: number;
    routeDeviationM: number;
    tripLateAfterMinutes: number;
  };
  fixed: { childStillAboard: string; childNotBoarded: string };
  notYetConfigurable: string[];
}

export interface LeaveRow {
  id: string;
  childName: string;
  className: string | null;
  routeName: string | null;
  type: string;
  reason: string | null;
  at: string;
  parentName: string | null;
}

export interface StopChangeRow {
  id: string;
  childName: string;
  className: string | null;
  shift: string;
  fromStop: string | null;
  toStop: string;
  note: string | null;
  status: string;
  at: string;
  decidedBy: string | null;
  parentName: string | null;
}

export interface RequestsView {
  date: string;
  leave: LeaveRow[];
  stopChanges: StopChangeRow[];
  pending: number;
}

/** SA-08. Named for the fleet list; BusRow is the live map's row. */
export interface FleetBus {
  id: string;
  plate: string;
  seats: number;
  model: string | null;
  active: boolean;
  fitness_expiry: string | null;
  fitness_label: string | null;
  fitness_lapsed: boolean;
  fitness_soon: boolean;
  routes: number;
  driver_name: string | null;
  on_trip: boolean;
}

/** SA-12. */
export interface HolidayRow {
  id: string;
  on_date: string;
  label: string;
  name: string;
  buses_running: boolean;
  past: boolean;
}

/** A ticket as the school that raised it sees it. */
export interface SchoolTicket {
  id: string;
  number: number;
  subject: string;
  body: string;
  priority: 'urgent' | 'normal';
  status: string;
  created_at: string;
  child_name: string | null;
  replies: { author: string; body: string; at: string }[];
}
