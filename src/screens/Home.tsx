import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { FleetMap } from '../components/FleetMap';
import { Card, Empty, Kpi, Plate, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { describe as describeAlert } from './Alerts';
import { ageSeconds, useFleet } from '../lib/fleet';
import { Link } from 'react-router-dom';
import type { TripView } from '../lib/types';

/**
 * SA-02 — the screen the clerk keeps open all morning.
 *
 * "Needs attention" is fed by the alert worker. What is still missing against
 * the prototype is "children picked up" and "running late": the first needs
 * boardings across the whole fleet rather than one route, the second needs a
 * per-stop ETA. Neither is invented here.
 */
export function Home(): React.ReactElement {
  const navigate = useNavigate();
  const fixes = useFleet((s) => s.fixes);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.overview(),
    // The socket carries positions; this only refreshes the trip list itself.
    refetchInterval: 30_000,
  });

  // alertSeq changes when the worker raises something, so this refetches on the
  // event rather than on a timer.
  const alertSeq = useFleet((s) => s.alertSeq);
  const { data: alerts } = useQuery({
    queryKey: ['alerts', 'home', alertSeq],
    queryFn: () => api.alerts(1),
    refetchInterval: 60_000,
  });
  const openAlerts = (alerts?.alerts ?? []).filter((a) => !a.handledAt).slice(0, 6);

  const buses = useMemo(
    () => (data?.trips ?? []).map((t) => ({ busId: t.busId, plate: t.plate })),
    [data],
  );

  if (isLoading) return <Empty>Loading…</Empty>;
  if (error || !data) return <Empty>Could not load the morning run.</Empty>;

  const running = data.trips.filter((t) => t.status === 'running').length;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="font-head text-[22px] font-bold">
          {data.isToday ? 'Morning run' : `Trips on ${data.date}`}
        </h3>
        <div className="text-[12.5px] text-slate">
          {data.trips.length} trip{data.trips.length === 1 ? '' : 's'} · school time{' '}
          <span className="font-mono">{data.school.localTime}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Running now"
          value={running}
          unit={`/ ${data.fleet.activeBuses}`}
          detail={`${data.fleet.activeBuses - running} not on a trip`}
          tone={running > 0 ? 'live' : undefined}
        />
        <Kpi
          label="Trips today"
          value={data.trips.length}
          detail={`${data.fleet.finished} finished`}
        />
        <Kpi
          label="No signal"
          value={data.fleet.noSignal}
          detail="Phone out of coverage or app closed"
          tone={data.fleet.noSignal > 0 ? 'alert' : undefined}
        />
        <Kpi label="Buses" value={data.fleet.buses} detail={`${data.fleet.activeBuses} active`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card
          title="Fleet right now"
          hint="Positions arrive over the socket, not by polling"
          bodyClass="h-[320px]"
        >
          {buses.length > 0 ? (
            <FleetMap buses={buses} onBusClick={(busId) => openBus(data.trips, busId, navigate)} />
          ) : (
            <Empty>No trips today yet.</Empty>
          )}
        </Card>

        <Card
          title="Needs attention"
          action={
            <Link to="/alerts" className="text-[12px] font-semibold text-slate hover:text-ink">
              All alerts
            </Link>
          }
          bodyClass="max-h-[320px] overflow-auto"
        >
          {openAlerts.length === 0 ? (
            <Empty>Nothing needs attention.</Empty>
          ) : (
            openAlerts.map((a) => (
              <Link
                key={a.id}
                to={a.tripId ? `/trips/${a.tripId}` : '/alerts'}
                className="flex gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-paper"
              >
                <span
                  className={`mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-[9px] text-[13px] font-bold ${
                    a.severity === 'critical'
                      ? 'bg-[#FBE4E1] text-alert'
                      : a.severity === 'warn'
                        ? 'bg-[#FFF2D6] text-[#8A5B00]'
                        : 'bg-paper text-ink2'
                  }`}
                >
                  {a.severity === 'critical' ? '!' : a.severity === 'warn' ? '▲' : '●'}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold leading-snug">
                    {describeAlert(a)}
                  </span>
                  <span className="block text-[11.5px] text-slate">
                    {a.routeName ?? ''} {a.plate ?? ''}
                  </span>
                </span>
                <span className="ml-auto flex-none font-mono text-[11px] text-slate">
                  {clock(a.at)}
                </span>
              </Link>
            ))
          )}
        </Card>
      </div>

      <Card title="Trips today">
        {data.trips.length === 0 ? (
          <Empty>Nothing has started. The driver app creates a trip when the driver taps Start.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Route</Th>
                  <Th>Bus</Th>
                  <Th>Driver</Th>
                  <Th>Started</Th>
                  <Th>Speed</Th>
                  <Th>Last fix</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {data.trips.map((t) => {
                  // Same rule as SA-04: live fixes are keyed by bus, so a
                  // finished trip must not borrow the speed of the next trip
                  // on that bus and appear to still be driving.
                  const busFix = fixes[t.busId] ?? t.live;
                  const fix = busFix && busFix.tripId === t.tripId ? busFix : null;
                  const age = ageSeconds(fix, now);
                  return (
                    <tr
                      key={t.tripId}
                      onClick={() => navigate(`/trips/${t.tripId}`)}
                      className="cursor-pointer border-b border-line last:border-0 hover:bg-paper"
                    >
                      <td className="px-4 py-3 font-semibold">
                        {t.routeName}
                        {t.serviceDate !== data.date ? (
                          <span className="ml-2 rounded-full bg-[#FFF2D6] px-2 py-0.5 font-mono text-[10px] font-bold text-[#8A5B00]">
                            since {t.serviceDate}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <Plate>{t.plate}</Plate>
                      </td>
                      <td className="px-4 py-3">
                        {t.driverName ?? <span className="font-mono text-slate">{t.driverPhone}</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px]">{clock(t.startedAt)}</td>
                      <td className="px-4 py-3 font-mono text-[12px]">
                        {fix?.speed != null ? `${Math.round(fix.speed * 3.6)} km/h` : '—'}
                      </td>
                      <td
                        className={`px-4 py-3 font-mono text-[12px] ${
                          age !== null && age > 60 ? 'text-alert' : ''
                        }`}
                      >
                        {age === null ? '—' : `${age}s ago`}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={t.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function openBus(
  trips: TripView[],
  busId: string,
  navigate: (to: string) => void,
): void {
  const trip = trips.find((t) => t.busId === busId);
  if (trip) navigate(`/trips/${trip.tripId}`);
}

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <th className="px-4 py-2.5 font-head text-[10px] font-bold tracking-[0.12em] text-slate uppercase">
      {children}
    </th>
  );
}

export function clock(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}
