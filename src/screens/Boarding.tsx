import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, Empty, Kpi } from '../components/ui';
import { api } from '../lib/api';
import type { BoardingEventName } from '../lib/types';

/**
 * SA-08 — the boarding log. Who got on which bus, when, marked by whom.
 *
 * This is the school's legal record. `boardings` refuses UPDATE and DELETE at
 * the database level, so what is on this screen is what was recorded at the
 * stop — including corrections, which appear as later rows rather than by
 * quietly replacing the original.
 */
export function Boarding(): React.ReactElement {
  const { data, isLoading, error } = useQuery({
    queryKey: ['boardings'],
    queryFn: () => api.boardings(),
    refetchInterval: 20_000,
  });

  if (isLoading) return <Empty>Loading…</Empty>;
  if (error || !data) return <Empty>Could not load the boarding log.</Empty>;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="font-head text-[22px] font-bold">Boarding log</h3>
        <div className="text-[12.5px] text-slate">
          {data.date} · newest first · immutable
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Boarded" value={data.totals.boarded} detail="Marked at the stop" tone="live" />
        <Kpi
          label="Not boarded"
          value={data.totals.notBoarded}
          detail="Driver waited, child did not come"
          tone={data.totals.notBoarded > 0 ? 'alert' : undefined}
        />
        <Kpi label="On leave" value={data.totals.onLeave} detail="Parent informed the school" />
        <Kpi label="Dropped" value={data.totals.dropped} detail="Handed over at school or stop" />
      </div>

      <Card title="Every boarding event" hint="Counted from the latest event for each child">
        {data.events.length === 0 ? (
          <Empty>
            Nothing recorded today. Events appear here the moment the attendant taps a child in
            the driver app.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Time</Th>
                  <Th>Child</Th>
                  <Th>Route &amp; stop</Th>
                  <Th>Event</Th>
                  <Th>Reason</Th>
                  <Th>Marked by</Th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((e) => (
                  <tr key={e.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-2.5 font-mono text-[12px]">{time(e.at)}</td>
                    <td className="px-4 py-2.5 font-semibold">
                      {e.childName}
                      {e.childClass ? (
                        <span className="pl-1.5 font-normal text-slate">· {e.childClass}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link to={`/trips/${e.tripId}`} className="hover:underline">
                        {e.routeName}
                      </Link>
                      <span className="text-slate"> · {e.stopName ?? '—'}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <EventPill event={e.event} />
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-slate">{reasonLabel(e.reason)}</td>
                    <td className="px-4 py-2.5 text-[12px]">
                      {e.markedBy}
                      <span className="pl-1.5 text-slate">({sourceLabel(e.source)})</span>
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

const EVENT_TONE: Record<BoardingEventName, string> = {
  boarded: 'bg-[#E1F4EC] text-[#0F7A50]',
  not_boarded: 'bg-[#FBE4E1] text-[#A62A1B]',
  dropped: 'bg-[#E3ECFD] text-[#2D6BE4]',
  on_leave: 'bg-paper text-ink2',
};

const EVENT_LABEL: Record<BoardingEventName, string> = {
  boarded: 'Boarded',
  not_boarded: 'Not boarded',
  dropped: 'Dropped',
  on_leave: 'On leave',
};

function EventPill({ event }: { event: BoardingEventName }): React.ReactElement {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${EVENT_TONE[event]}`}>
      {EVENT_LABEL[event]}
    </span>
  );
}

/** The fixed codes from DR-06, in words the office uses. */
function reasonLabel(reason: string | null): string {
  switch (reason) {
    case 'nobody_at_stop':
      return 'Nobody at the stop';
    case 'parent_informed':
      return 'Parent said not coming';
    case 'came_late_boarded':
      return 'Came late, driver waited';
    case 'leave_applied':
      return 'Leave applied';
    case 'school_gate':
      return 'At the school gate';
    default:
      return '—';
  }
}

function sourceLabel(source: string): string {
  switch (source) {
    case 'attendant':
      return 'attendant';
    case 'driver_app':
      return 'driver';
    case 'geofence':
      return 'automatic';
    case 'parent':
      return 'parent';
    default:
      return source;
  }
}

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <th className="px-4 py-2.5 font-head text-[10px] font-bold tracking-[0.12em] text-slate uppercase">
      {children}
    </th>
  );
}

function time(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
}
