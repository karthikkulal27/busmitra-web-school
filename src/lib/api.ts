import { config } from '../config';
import { useSession, tokenOf } from './session';
import type {
  Alert,
  ChildRow,
  EditorRoute,
  FleetBus,
  HolidayRow,
  EditorStop,
  ImportPreview,
  PrincipalView,
  ReportSummary,
  RequestsView,
  SettingsView,
  StaffView,
  BoardingLog,
  BusView,
  Overview,
  RouteOption,
  SentMessage,
  Session,
  TripDetail,
  SchoolTicket,
  Track,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = tokenOf();
  const res = await fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    // The token expired or the school revoked this person. Drop straight to
    // SA-01 rather than showing an empty console that looks broken.
    useSession.getState().signOut();
    throw new ApiError(401, 'unauthorised');
  }

  const body = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, (body as { error?: string }).error ?? 'request_failed');
  }
  return body as T;
}

export const api = {
  requestOtp: (schoolCode: string, phone: string) =>
    request<{ sent: boolean }>('/auth/console/otp/request', {
      method: 'POST',
      body: JSON.stringify({ schoolCode, phone }),
    }),

  verifyOtp: (schoolCode: string, phone: string, code: string) =>
    request<Session>('/auth/console/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ schoolCode, phone, code }),
    }),

  overview: (date?: string) =>
    request<Overview>(`/console/overview${date ? `?date=${date}` : ''}`),

  buses: () => request<{ buses: BusView[] }>('/console/buses'),

  trip: (tripId: string) => request<TripDetail>(`/console/trips/${tripId}`),

  track: (tripId: string) => request<Track>(`/console/trips/${tripId}/track`),

  boardings: (date?: string) =>
    request<BoardingLog>(`/console/boardings${date ? `?date=${date}` : ''}`),

  tripBoardings: (tripId: string) =>
    request<{ tripId: string; events: BoardingLog['events'] }>(
      `/console/trips/${tripId}/boardings`,
    ),

  alerts: (days = 7) => request<{ days: number; alerts: Alert[] }>(`/console/alerts?days=${days}`),

  handleAlert: (id: string) =>
    request<{ id: string; handledAt: string }>(`/console/alerts/${id}/handle`, {
      method: 'POST',
    }),

  routes: () => request<{ routes: RouteOption[] }>('/console/routes'),

  messages: () => request<{ messages: SentMessage[] }>('/console/messages'),

  sendMessage: (input: { routeIds: string[]; wholeSchool: boolean; body: string }) =>
    request<{ messageId: string; recipients: number; sent: number; failed: number }>(
      '/console/messages',
      { method: 'POST', body: JSON.stringify(input) },
    ),

  children: () =>
    request<{
      children: ChildRow[];
      /** Travels with the children: the screen that lists them assigns them. */
      stops: { id: string; name: string; routeName: string }[];
      counts: { total: number; noParentPhone: number; noStop: number };
    }>('/setup/children'),

  /** multipart, so it bypasses the JSON request helper's content-type. */
  importPreview: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${config.apiUrl}/setup/children/import/preview`, {
      method: 'POST',
      headers: { authorization: `Bearer ${tokenOf() ?? ''}` },
      body: form,
    });
    if (!res.ok) throw new ApiError(res.status, 'import_failed');
    return (await res.json()) as ImportPreview;
  },

  importCommit: (children: unknown[]) =>
    request<{ created: number; updated: number; skipped: number; parentsLinked: number }>(
      '/setup/children/import/commit',
      { method: 'POST', body: JSON.stringify({ children }) },
    ),

  setupRoutes: () => request<{ routes: EditorRoute[] }>('/setup/routes'),

  /** Find a place by name, so a stop is not placed by panning and guessing. */
  geocode: (q: string) =>
    request<{
      places: { name: string; lat: number; lng: number }[];
      unavailable?: boolean;
    }>(`/setup/geocode?q=${encodeURIComponent(q)}`),

  /**
   * SA-05. The endpoint has always existed; the screen had no way to call it,
   * so a school whose routes did not come from the seed could not make one.
   */
  createRoute: (input: { name: string; shift: string; busId: string | null }) =>
    request<{ routeId: string }>('/setup/routes', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // SA-08 — the fleet list. Distinct from `buses` above, which is the live map's
  // view of what is moving right now; this one is the vehicle records.
  fleet: () => request<{ buses: FleetBus[] }>('/setup/buses'),

  // SA-06. The importer is for four hundred children in an afternoon; these two
  // are for the admission that arrives in October and the family that moves in
  // November. A school that has to re-import a spreadsheet for one child keeps
  // the spreadsheet as the real record.
  createChild: (input: Record<string, unknown>) =>
    request<{ childId: string }>('/setup/children', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateChild: (id: string, input: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/setup/children/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  /** SA-07. Someone leaves, or comes back. Never deleted. */
  setStaffActive: (id: string, active: boolean) =>
    request<{ ok: boolean }>(`/admin/staff/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }),

  /** Our own tickets, with whatever BusMitra replied. */
  myTickets: () => request<{ tickets: SchoolTicket[] }>('/console/tickets'),

  /** Raise a ticket with BusMitra. Lands in the operator's inbox. */
  raiseTicket: (input: Record<string, unknown>) =>
    request<{ ticketId: string; number: number }>('/console/tickets', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  /** SA-05 — which bus runs this route. Half of what the driver app's duty needs. */
  updateRoute: (id: string, input: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/setup/routes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  createBus: (input: Record<string, unknown>) =>
    request<{ busId: string }>('/setup/buses', { method: 'POST', body: JSON.stringify(input) }),
  updateBus: (id: string, input: Record<string, unknown>) =>
    request<{ ok: boolean }>(`/setup/buses/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),

  // SA-07 — add or edit a person.
  saveStaff: (input: Record<string, unknown>) =>
    request<{ staffId: string }>('/admin/staff', { method: 'POST', body: JSON.stringify(input) }),

  // SA-12 — days no bus is expected.
  holidays: () => request<{ holidays: HolidayRow[] }>('/admin/holidays'),
  addHoliday: (input: Record<string, unknown>) =>
    request<{ ok: boolean }>('/admin/holidays', { method: 'POST', body: JSON.stringify(input) }),
  removeHoliday: (id: string) =>
    request<{ ok: boolean }>(`/admin/holidays/${id}`, { method: 'DELETE' }),

  saveStop: (routeId: string, stop: EditorStop) =>
    request<{ stopId: string }>(`/setup/routes/${routeId}/stops`, {
      method: 'POST',
      body: JSON.stringify({
        ...(stop.id ? { id: stop.id } : {}),
        name: stop.name,
        lat: stop.lat,
        lng: stop.lng,
        geofenceM: stop.geofenceM,
        waitSeconds: stop.waitSeconds,
        scheduledTime: stop.scheduledTime,
      }),
    }),

  reorderStops: (routeId: string, stopIds: string[]) =>
    request<{ ok: boolean }>(`/setup/routes/${routeId}/stops/order`, {
      method: 'PUT',
      body: JSON.stringify({ stopIds }),
    }),

  deleteStop: (routeId: string, stopId: string) =>
    request<{ ok: boolean }>(`/setup/routes/${routeId}/stops/${stopId}`, { method: 'DELETE' }),

  reports: (from: string, to: string) =>
    request<ReportSummary>(`/reports/summary?from=${from}&to=${to}`),

  principal: () => request<PrincipalView>('/reports/principal'),

  staff: () => request<StaffView>('/admin/staff'),

  settings: () => request<SettingsView>('/admin/settings'),

  requests: () => request<RequestsView>('/console/requests'),

  decideStopChange: (id: string, status: 'approved' | 'rejected') =>
    request<{ id: string; status: string }>(`/console/stop-changes/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  saveSettings: (input: Record<string, unknown>) =>
    request<{ ok: boolean }>('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
};
