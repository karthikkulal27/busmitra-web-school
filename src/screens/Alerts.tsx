import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, Empty, Kpi } from '../components/ui';
import { api } from '../lib/api';
import type { Alert } from '../lib/types';

/**
 * SA-09 — alerts.
 *
 * SOS is not here: it needs a button in the driver app (DR-07), which is not
 * built. Everything on this screen is produced by the alert worker from data
 * that exists, so nothing is a placeholder.
 */
export function Alerts(): React.ReactElement {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.alerts(7),
    refetchInterval: 15_000,
  });

  const handle = useMutation({
    mutationFn: (id: string) => api.handleAlert(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  if (isLoading) return <Empty>Loading…</Empty>;
  if (error || !data) return <Empty>Could not load alerts.</Empty>;

  const critical = data.alerts.filter((a) => a.severity === 'critical' && !a.handledAt);
  const open = data.alerts.filter((a) => !a.handledAt);

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="font-head text-[22px] font-bold">Alerts</h3>
        <div className="text-[12.5px] text-slate">Last {data.days} days</div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Needs attention"
          value={open.length}
          detail="Not yet reviewed"
          tone={open.length > 0 ? 'alert' : undefined}
        />
        <Kpi label="Critical" value={critical.length} detail="Child still aboard, SOS" tone={critical.length > 0 ? 'alert' : undefined} />
        <Kpi label="Total" value={data.alerts.length} detail={`Last ${data.days} days`} />
        <Kpi
          label="Handled"
          value={data.alerts.filter((a) => a.handledAt).length}
          detail="Reviewed by the office"
          tone="live"
        />
      </div>

      {critical.map((a) => (
        <section
          key={a.id}
          className="overflow-hidden rounded-[12px] border-2 border-alert bg-white"
        >
          <header className="flex items-center gap-3 border-b border-[#EDB6AE] bg-[#FBE4E1] px-4 py-3">
            <h4 className="font-head text-[15px] font-bold text-alert">{title(a)}</h4>
            <span className="ml-auto rounded-full bg-alert px-2.5 py-1 text-[11px] font-bold text-white">
              Unresolved
            </span>
          </header>
          <div className="px-4 py-3 text-[13px]">
            <p className="leading-relaxed">{describe(a)}</p>
            <div className="mt-3 flex items-center gap-2">
              {a.tripId ? (
                <Link
                  to={`/trips/${a.tripId}`}
                  className="rounded-[9px] border border-line px-3 py-2 text-[12.5px] font-semibold hover:bg-paper"
                >
                  Open the trip
                </Link>
              ) : null}
              <button
                onClick={() => handle.mutate(a.id)}
                className="rounded-[9px] bg-ink px-3 py-2 text-[12.5px] font-semibold text-white"
              >
                Mark handled
              </button>
            </div>
          </div>
        </section>
      ))}

      <Card title="Alert history" hint="Newest first">
        {data.alerts.length === 0 ? (
          <Empty>Nothing in the last {data.days} days.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>When</Th>
                  <Th>Type</Th>
                  <Th>What happened</Th>
                  <Th>Route</Th>
                  <Th>Handled by</Th>
                </tr>
              </thead>
              <tbody>
                {data.alerts.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-2.5 font-mono text-[12px]">{when(a.at)}</td>
                    <td className="px-4 py-2.5">
                      <SeverityPill alert={a} />
                    </td>
                    <td className="px-4 py-2.5">{describe(a)}</td>
                    <td className="px-4 py-2.5 text-[12px]">
                      {a.tripId ? (
                        <Link to={`/trips/${a.tripId}`} className="hover:underline">
                          {a.routeName ?? '—'}
                        </Link>
                      ) : (
                        (a.routeName ?? '—')
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px]">
                      {a.handledAt ? (
                        <span>{a.handledBy}</span>
                      ) : (
                        <button
                          onClick={() => handle.mutate(a.id)}
                          className="text-slate hover:text-ink hover:underline"
                        >
                          Not reviewed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = {
  geofence_arrival: 'Reached stop',
  overspeed: 'Over speed',
  long_halt: 'Long halt',
  child_not_boarded: 'Child not boarded',
  child_still_aboard: 'Child still aboard',
  route_deviation: 'Route deviation',
  trip_late_start: 'Trip started late',
  sos: 'SOS',
  pretrip_failed: 'Left with a check unticked',
};

export function title(a: Alert): string {
  return `${TYPE_LABEL[a.type] ?? a.type}${a.plate ? ` — ${a.routeName ?? ''} ${a.plate}` : ''}`;
}

/** Plain sentences, not JSON. The clerk has to act on this in two seconds. */
export function describe(a: Alert): string {
  const p = a.payload as Record<string, never>;
  switch (a.type) {
    case 'geofence_arrival':
      return `Reached ${String(p['stopName'] ?? 'a stop')} (stop ${String(p['seq'] ?? '?')})`;
    case 'overspeed':
      return `${String(p['kmh'] ?? '?')} km/h in a ${String(p['limitKmh'] ?? '?')} zone`;
    case 'long_halt':
      return `Stopped ${String(p['minutes'] ?? '?')} min without moving`;
    case 'child_still_aboard': {
      const names = (p['children'] as unknown as { name: string }[] | undefined) ?? [];
      const list = names.map((c) => c.name).join(', ');
      return `${String(p['count'] ?? names.length)} child${
        Number(p['count'] ?? names.length) === 1 ? '' : 'ren'
      } marked aboard and never dropped: ${list}`;
    }
    case 'child_not_boarded': {
      const name = String(p['childName'] ?? 'A child');
      return `${name} did not board at ${String(p['stopName'] ?? 'their stop')}`;
    }
    case 'route_deviation':
      return `${String(p['metres'] ?? '?')} m off the route (limit ${String(
        p['thresholdM'] ?? '?',
      )} m)`;
    case 'trip_late_start':
      return `${String(p['routeName'] ?? 'A route')} has not started — due ${String(
        p['dueBy'] ?? '?',
      )}, ${String(p['minutesLate'] ?? '?')} min ago`;
    case 'pretrip_failed': {
      const failed = (p['failed'] as unknown as string[] | undefined) ?? [];
      return `Bus started the trip with: ${failed.join(', ')}`;
    }
    case 'sos': {
      const reason =
        {
          breakdown: 'Vehicle breakdown',
          accident: 'Accident',
          medical: 'Medical emergency',
          other: 'Driver pressed SOS',
        }[String(p['reason'])] ?? 'Driver pressed SOS';
      const aboard = Number(p['childrenAboard'] ?? 0);
      // The driver's number is on the alert itself. On the one alert where
      // seconds count, the clerk must not have to go and look it up.
      const phone = p['driverPhone'] ? ` · driver ${String(p['driverPhone'])}` : '';
      return `${reason} — ${aboard} child${aboard === 1 ? '' : 'ren'} aboard${phone}`;
    }
    default:
      return a.type;
  }
}

function SeverityPill({ alert }: { alert: Alert }): React.ReactElement {
  const tone =
    alert.severity === 'critical'
      ? 'bg-[#FBE4E1] text-[#A62A1B]'
      : alert.severity === 'warn'
        ? 'bg-[#FFF2D6] text-[#8A5B00]'
        : 'bg-paper text-ink2';
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>
      {TYPE_LABEL[alert.type] ?? alert.type}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <th className="px-4 py-2.5 font-head text-[10px] font-bold tracking-[0.12em] text-slate uppercase">
      {children}
    </th>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
  return today
    ? `Today ${time}`
    : `${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ${time}`;
}
