import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RouteMap } from '../components/RouteMap';
import { Card, Empty } from '../components/ui';
import { api } from '../lib/api';
import type { EditorStop, EditorRoute } from '../lib/types';

/**
 * SA-05 — routes and stops. Set-up work, done once in June.
 *
 * Drag to reorder; the map redraws. Reordering is written in one transaction
 * against a deferred unique (route_id, seq) constraint, so the halfway state
 * where two stops share a number never has to be worked around.
 */
export function RoutesScreen(): React.ReactElement {
  const queryClient = useQueryClient();
  const [routeId, setRouteId] = useState<string | null>(null);
  const [stopId, setStopId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditorStop | null>(null);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [newRoute, setNewRoute] = useState(false);

  const { data, isLoading } = useQuery({ queryKey: ['setup-routes'], queryFn: () => api.setupRoutes() });

  const routes = data?.routes ?? [];
  const route = routes.find((r) => r.id === routeId) ?? routes[0] ?? null;
  const stops = route?.stops ?? [];

  useEffect(() => {
    if (!routeId && route) setRouteId(route.id);
  }, [route, routeId]);

  useEffect(() => {
    const found = stops.find((s) => s.id === stopId) ?? null;
    setDraft(found ? { ...found } : null);
  }, [stopId, stops]);

  const refresh = (): void => {
    void queryClient.invalidateQueries({ queryKey: ['setup-routes'] });
  };

  const createRoute = useMutation({
    mutationFn: (input: { name: string; shift: string; busId: string | null }) =>
      api.createRoute(input),
    onSuccess: (res) => {
      setRouteId(res.routeId);
      setStopId(null);
      setNewRoute(false);
      setNote('Route created. Add its stops below.');
      refresh();
    },
    onError: () => setNote('Could not create the route.'),
  });

  const saveStop = useMutation({
    mutationFn: (s: EditorStop) => api.saveStop(route!.id, s),
    onSuccess: () => {
      setNote('Stop saved.');
      refresh();
    },
    onError: () => setNote('Could not save the stop.'),
  });

  const reorder = useMutation({
    mutationFn: (ids: string[]) => api.reorderStops(route!.id, ids),
    onSuccess: () => {
      setNote('Order saved.');
      refresh();
    },
    onError: () => setNote('Could not save the new order.'),
  });

  const removeStop = useMutation({
    mutationFn: (id: string) => api.deleteStop(route!.id, id),
    onSuccess: () => {
      setStopId(null);
      setNote('Stop deleted.');
      refresh();
    },
    onError: (err: unknown) =>
      setNote(
        (err as { code?: string }).code === 'stop_has_children'
          ? 'Children are assigned to this stop. Move them first.'
          : 'Could not delete the stop.',
      ),
  });

  function drop(to: number): void {
    if (dragFrom === null || dragFrom === to || !route) return;
    const ids = stops.map((s) => s.id);
    const [moved] = ids.splice(dragFrom, 1);
    if (moved) ids.splice(to, 0, moved);
    setDragFrom(null);
    reorder.mutate(ids);
  }

  if (isLoading) return <Empty>Loading…</Empty>;

  // A school with no routes yet — every other school got theirs from the seed,
  // which is why this screen went so long with no way to make the first one.
  if (!route) {
    return (
      <div className="flex flex-col gap-4 p-5">
        <div>
          <h3 className="font-head text-[22px] font-bold">Routes</h3>
          <div className="text-[12.5px] text-slate">Nothing drawn yet</div>
        </div>
        {note ? (
          <p className="rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px]">{note}</p>
        ) : null}
        <NewRouteForm
          pending={createRoute.isPending}
          onCreate={(input) => createRoute.mutate(input)}
          onCancel={null}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-head text-[22px] font-bold">Routes</h3>
          <div className="text-[12.5px] text-slate">
            {routes.length} route{routes.length === 1 ? '' : 's'} ·{' '}
            {routes.reduce((n, r) => n + r.stops.length, 0)} stops
          </div>
        </div>
        {note ? (
          <span className="rounded-[9px] bg-paper px-3 py-1.5 text-[12px] text-ink2">{note}</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {routes.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              setRouteId(r.id);
              setStopId(null);
            }}
            className={`rounded-[9px] px-3 py-2 text-[13px] font-semibold ${
              r.id === route.id ? 'bg-ink text-white' : 'bg-white text-ink2 hover:bg-paper'
            }`}
          >
            {r.name}
            <span className="pl-2 font-mono text-[11px] opacity-70">{r.stops.length}</span>
          </button>
        ))}
        <button
          onClick={() => setNewRoute((v) => !v)}
          className="rounded-[9px] border border-dashed border-line px-3 py-2 text-[13px] font-semibold text-slate hover:text-ink"
        >
          + New route
        </button>
      </div>

      {newRoute ? (
        <NewRouteForm
          pending={createRoute.isPending}
          onCreate={(input) => createRoute.mutate(input)}
          onCancel={() => setNewRoute(false)}
        />
      ) : null}

      <RouteBus route={route} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card title="Stop order" hint="Drag to reorder" bodyClass="max-h-[520px] overflow-auto">
          {stops.length === 0 ? (
            <Empty>No stops on this route yet.</Empty>
          ) : (
            <ul>
              {stops.map((s, i) => (
                <li
                  key={s.id}
                  draggable
                  onDragStart={() => setDragFrom(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(i)}
                  onClick={() => setStopId(s.id)}
                  className={`flex cursor-grab items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 hover:bg-paper ${
                    s.id === stopId ? 'bg-paper' : ''
                  }`}
                >
                  <span className="w-5 font-mono text-[12px] text-slate">{s.seq}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">{s.name}</span>
                    <span className="block text-[11.5px] text-slate">
                      {s.children} child{s.children === 1 ? '' : 'ren'} · geofence {s.geofenceM} m ·
                      waits {s.waitSeconds}s
                    </span>
                  </span>
                  <span className="ml-auto font-mono text-[11.5px] text-slate">
                    {s.scheduledTime ?? '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line p-3">
            <button
              onClick={() =>
                setDraft({
                  id: '',
                  name: '',
                  seq: stops.length + 1,
                  lat: 12.914,
                  lng: 74.842,
                  geofenceM: 80,
                  waitSeconds: 60,
                  scheduledTime: null,
                  children: 0,
                })
              }
              className="w-full rounded-[9px] border border-line py-2 text-[13px] font-semibold hover:bg-paper"
            >
              + Add stop
            </button>
          </div>
        </Card>

        <Card
          title={draft ? (draft.id ? `Stop ${draft.seq} · ${draft.name || 'unnamed'}` : 'New stop') : 'Stop'}
          hint={draft ? 'Click the map to move it' : 'Pick a stop on the left'}
          bodyClass=""
        >
          {!draft ? (
            <Empty>Select a stop to edit it.</Empty>
          ) : (
            <>
              <div className="h-[260px]">
                <RouteMap
                  stops={draft.id ? stops.map((s) => (s.id === draft.id ? draft : s)) : [...stops, draft]}
                  selectedStopId={draft.id || null}
                  onPick={(lat, lng) => setDraft({ ...draft, lat, lng })}
                />
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <Field label="Stop name shown to parents">
                  <input
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    className="w-full rounded-[9px] border border-line px-3 py-2 text-[13.5px] outline-none focus:border-ink"
                  />
                </Field>
                <Field label="Pickup time">
                  <input
                    value={draft.scheduledTime ?? ''}
                    onChange={(e) =>
                      setDraft({ ...draft, scheduledTime: e.target.value || null })
                    }
                    placeholder="07:25"
                    className="w-full rounded-[9px] border border-line px-3 py-2 font-mono text-[13.5px] outline-none focus:border-ink"
                  />
                </Field>
                <Field label="Geofence radius (metres)">
                  <input
                    type="number"
                    min={20}
                    max={500}
                    value={draft.geofenceM}
                    onChange={(e) => setDraft({ ...draft, geofenceM: Number(e.target.value) })}
                    className="w-full rounded-[9px] border border-line px-3 py-2 font-mono text-[13.5px] outline-none focus:border-ink"
                  />
                </Field>
                <Field label="How long the bus waits (seconds)">
                  <input
                    type="number"
                    min={0}
                    max={600}
                    value={draft.waitSeconds}
                    onChange={(e) => setDraft({ ...draft, waitSeconds: Number(e.target.value) })}
                    className="w-full rounded-[9px] border border-line px-3 py-2 font-mono text-[13.5px] outline-none focus:border-ink"
                  />
                </Field>

                <p className="sm:col-span-2 text-[11.5px] leading-relaxed text-slate">
                  The yellow circle is the geofence at its real size. A 50 m default false-fires
                  on Surathkal service roads — widen it where the bus cannot pull in close.
                  Position:{' '}
                  <span className="font-mono">
                    {draft.lat.toFixed(5)}, {draft.lng.toFixed(5)}
                  </span>
                </p>

                <div className="flex items-center gap-2 sm:col-span-2">
                  <button
                    onClick={() => saveStop.mutate(draft)}
                    disabled={draft.name.trim().length < 2 || saveStop.isPending}
                    className="rounded-[9px] bg-ink px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
                  >
                    {saveStop.isPending ? 'Saving…' : 'Save stop'}
                  </button>
                  {draft.id ? (
                    <button
                      onClick={() => removeStop.mutate(draft.id)}
                      className="rounded-[9px] border border-line px-3 py-2.5 text-[13px] font-semibold hover:bg-paper"
                    >
                      Delete
                    </button>
                  ) : null}
                  {draft.children > 0 ? (
                    <span className="text-[11.5px] text-slate">
                      {draft.children} child{draft.children === 1 ? '' : 'ren'} assigned here
                    </span>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div>
      <label className="mb-1.5 block font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}


/**
 * Which bus runs this route.
 *
 * Small control, load-bearing consequence: this plus the driver's own assigned
 * bus is the whole of GET /driver/duty. Leave it unset and the driver's app
 * opens to a disabled Start button, because there is nothing to start.
 */
function RouteBus({ route }: { route: EditorRoute }): React.ReactElement {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['fleet'], queryFn: () => api.fleet() });
  const buses = (data?.buses ?? []).filter((b) => b.active);
  const current = route.busId;

  const save = useMutation({
    mutationFn: (busId: string | null) => api.updateRoute(route.id, { busId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['setup-routes'] });
      void queryClient.invalidateQueries({ queryKey: ['fleet'] });
    },
  });

  return (
    <Card title="Bus on this route">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <select
          value={current ?? ''}
          onChange={(e) => save.mutate(e.target.value || null)}
          className="rounded-[9px] border border-line px-3 py-2 text-[14px]"
        >
          <option value="">No bus assigned</option>
          {buses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.plate}
            </option>
          ))}
        </select>
        {save.isPending ? <span className="text-[12.5px] text-slate">Saving…</span> : null}
        <p className="text-[12px] leading-relaxed text-slate">
          The driver's app reads this. Without a bus here, whoever is assigned to drive
          {' '}{route.name} opens the app to a disabled Start button.
        </p>
      </div>
    </Card>
  );
}

/**
 * The first thing a new school needs on this screen.
 *
 * A route is two decisions — what it is called and which half of the day it
 * runs — plus the bus, which is deliberately optional here. Schools draw routes
 * in June and decide vehicles in July, and forcing the vehicle now would mean
 * inventing one. The picker on the route itself is where that gets settled.
 */
function NewRouteForm({
  pending,
  onCreate,
  onCancel,
}: {
  pending: boolean;
  onCreate: (input: { name: string; shift: string; busId: string | null }) => void;
  onCancel: (() => void) | null;
}): React.ReactElement {
  const [name, setName] = useState('');
  const [shift, setShift] = useState('morning');

  return (
    <Card title="New route">
      <form
        className="grid gap-3 p-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ name: name.trim(), shift, busId: null });
        }}
      >
        <label className="block">
          <Lbl>Route name</Lbl>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="R1 Kadri – School"
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
          />
        </label>
        <label className="block">
          <Lbl>Shift</Lbl>
          <select
            value={shift}
            onChange={(e) => setShift(e.target.value)}
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
          >
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
          </select>
        </label>
        <div className="flex items-end gap-3 pb-0.5">
          <button
            type="submit"
            disabled={name.trim().length < 2 || pending}
            className="rounded-[9px] bg-ink px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create route'}
          </button>
          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              className="text-[12.5px] font-semibold text-slate hover:text-ink"
            >
              Cancel
            </button>
          ) : null}
        </div>
        <p className="text-[12px] text-slate sm:col-span-3">
          The bus comes later — pick it on the route once it exists. Stops are added
          on the map below.
        </p>
      </form>
    </Card>
  );
}

function Lbl({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="mb-1.5 block font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
      {children}
    </span>
  );
}
