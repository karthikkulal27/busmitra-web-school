import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { FleetMap } from '../components/FleetMap';
import { Card, Empty, Kpi, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { ageSeconds, useFleet } from '../lib/fleet';
import { clock } from './Home';

/**
 * SA-04 — one bus, live.
 *
 * The prototype's stop rail shows arrival times and boarded counts against each
 * stop. Nothing detects arrival until the geofence work in phase 4 and nothing
 * records boardings until phase 3, so the rail here shows the scheduled time
 * and says so, rather than showing ticks that mean nothing.
 */
export function TripDetail(): React.ReactElement {
  const { tripId = '' } = useParams();
  const fixes = useFleet((s) => s.fixes);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: () => api.trip(tripId),
    refetchInterval: 30_000,
  });

  const { data: track } = useQuery({
    queryKey: ['track', tripId],
    queryFn: () => api.track(tripId),
    refetchInterval: 20_000,
  });

  const buses = useMemo(
    () => (data ? [{ busId: data.trip.busId, plate: data.trip.plate }] : []),
    [data],
  );

  if (isLoading) return <Empty>Loading…</Empty>;
  if (error || !data) return <Empty>Could not load this trip.</Empty>;

  const trip = data.trip;
  // Live fixes are keyed by bus, not by trip. On a screen about one trip, a
  // position belonging to a later trip on the same bus would show a finished
  // trip still driving around, so take it only when the trip ids agree.
  const busFix = fixes[trip.busId] ?? trip.live;
  const fix = busFix && busFix.tripId === trip.tripId ? busFix : null;
  const age = ageSeconds(fix, now);
  const kmh = fix?.speed != null ? Math.round(fix.speed * 3.6) : null;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-head text-[22px] font-bold">{trip.routeName}</h3>
          <div className="text-[12.5px] text-slate capitalize">
            {trip.shift} · {trip.serviceDate}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusPill status={trip.status} />
          <a
            href={`tel:${trip.driverPhone}`}
            className="rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] font-semibold hover:bg-paper"
          >
            Call driver
          </a>
          <Link
            to="/live"
            className="rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px] font-semibold hover:bg-paper"
          >
            Back to map
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Bus" value={trip.plate} detail={trip.driverName ?? trip.driverPhone} />
        <Kpi
          label="Speed now"
          value={kmh ?? '—'}
          unit={kmh === null ? undefined : 'km/h'}
          detail={age === null ? 'No position yet' : `Last fix ${age}s ago`}
          tone={age !== null && age > 60 ? 'alert' : undefined}
        />
        <Kpi label="Started" value={clock(trip.startedAt)} detail={trip.endedAt ? `Ended ${clock(trip.endedAt)}` : 'Still running'} />
        <Kpi
          label="Positions recorded"
          value={data.history.points}
          detail={data.history.lastAt ? `Last ${clock(data.history.lastAt)}` : 'None yet'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="On the road" hint="Green line is where the bus has actually been" bodyClass="h-[380px]">
          <FleetMap
            buses={buses}
            stops={data.stops}
            track={track?.coordinates}
            followBusId={trip.busId}
            onlyTripId={trip.tripId}
          />
        </Card>

        <Card title="Stops" hint={`${data.stops.length} on this route`} bodyClass="max-h-[380px] overflow-auto">
          {data.stops.length === 0 ? (
            <Empty>This route has no stops yet.</Empty>
          ) : (
            <ul className="p-4">
              {data.stops.map((s) => {
                const done = s.reached_at !== null;
                return (
                  <li
                    key={s.id}
                    className={`relative border-l-2 pb-4 pl-5 last:pb-0 ${
                      done ? 'border-live' : 'border-line'
                    }`}
                  >
                    <span
                      className={`absolute -left-[7px] top-1 block h-3 w-3 rounded-full border-2 ${
                        done ? 'border-live bg-live' : 'border-[#C3CCD8] bg-white'
                      }`}
                    />
                    <div className="flex items-baseline gap-2">
                      <b className="text-[13.5px]">{s.name}</b>
                      <span className="ml-auto font-mono text-[11.5px] text-slate">
                        {done ? `${clock(s.reached_at)} ✓` : (s.scheduled_time ?? '—')}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-slate">
                      Stop {s.seq}
                      {done ? (
                        <>
                          {' · '}
                          {s.boarded_count ?? 0} boarded
                          {(s.absent_count ?? 0) > 0 ? (
                            <span className="text-alert"> · {s.absent_count} absent</span>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="border-t border-line bg-paper px-4 py-2.5 text-[11.5px] leading-snug text-slate">
            A tick means the driver tapped “Reached stop”. Automatic arrival
            detection from the geofence comes in phase 4.
          </p>
        </Card>
      </div>
    </div>
  );
}
