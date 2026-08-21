import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

/**
 * SA-13 — principal view.
 *
 * A different screen, not a permission-filtered copy of SA-02: the clerk acts,
 * the principal decides. One paragraph of prose in large type, then only the
 * things that need a decision. Opens on a phone browser — principals do not sit
 * at a PC, which is why there is no sidebar and nothing to click through.
 */
export function Principal(): React.ReactElement {
  const signOut = useSession((s) => s.signOut);
  const { data, isLoading, error } = useQuery({
    queryKey: ['principal'],
    queryFn: () => api.principal(),
    refetchInterval: 30_000,
  });

  if (isLoading) return <Centered>Loading…</Centered>;
  if (error || !data) return <Centered>Could not load today&apos;s summary.</Centered>;

  const { rightNow, thisWeek, safety } = data;

  return (
    <div className="min-h-full bg-paper">
      <div className="chequer" />
      <div className="mx-auto max-w-[900px] px-5 py-6">
        <header className="mb-5 flex flex-wrap items-baseline gap-3">
          <div>
            <h1 className="font-head text-[26px] font-bold">
              {greeting()}, {data.viewer.name || 'Principal'}
            </h1>
            <div className="text-[12.5px] text-slate">
              {data.school.name} · {data.school.date}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <span className="font-mono text-[13px] text-ink2">{data.school.localTime}</span>
            <button
              onClick={signOut}
              className="rounded-[9px] border border-line bg-white px-2.5 py-1.5 text-[12px] font-semibold"
            >
              Sign out
            </button>
          </div>
        </header>

        <section className="rounded-[12px] bg-ink px-6 py-7 text-white">
          <div className="font-head text-[10px] font-bold tracking-[0.18em] text-[#8FA0B6] uppercase">
            Right now
          </div>
          <p className="mt-2 max-w-[32ch] font-head text-[34px] leading-[1.15] font-bold">
            {rightNow.busesRunning} of {rightNow.busesTotal} bus
            {rightNow.busesTotal === 1 ? '' : 'es'} running.{' '}
            <span className="text-bus">{thisWeek.childrenTravelling} children</span> travel by
            bus.
            {rightNow.noSignal > 0
              ? ` ${rightNow.noSignal} not reporting a position.`
              : ' Every running bus is reporting.'}
          </p>
          {rightNow.routes.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {rightNow.routes.map((r) => (
                <span
                  key={r.tripId}
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
                    r.moving ? 'bg-[#E1F4EC] text-[#0F7A50]' : 'bg-[#FBE4E1] text-[#A62A1B]'
                  }`}
                >
                  <span className="block h-1.5 w-1.5 rounded-full bg-current" />
                  {r.routeName} · {r.moving ? 'moving' : 'no signal'}
                </span>
              ))}
            </div>
          ) : null}
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Panel title="This week">
            <Row
              label="On-time arrival"
              value={thisWeek.onTimePercent === null ? '—' : `${thisWeek.onTimePercent}%`}
            />
            <Row label="Trips measured" value={`${thisWeek.measuredTrips}`} />
            <Row label="Children travelling" value={`${thisWeek.childrenTravelling}`} />
            <Row
              label="No parent number"
              value={`${thisWeek.childrenWithoutParentNumber}`}
              alert={thisWeek.childrenWithoutParentNumber > 0}
            />
            {thisWeek.onTimePercent === null ? (
              <p className="pt-2 text-[11.5px] leading-snug text-slate">
                On-time needs an arrival time at the last stop. Nothing has recorded one yet.
              </p>
            ) : null}
          </Panel>

          <Panel title="Needs your decision">
            {data.decisions.length === 0 ? (
              <p className="py-3 text-[12.5px] text-slate">Nothing needs a decision today.</p>
            ) : (
              data.decisions.map((d, i) => (
                <div key={i} className="flex gap-2.5 border-b border-line py-2.5 last:border-0">
                  <span
                    className={`mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-[8px] text-[12px] font-bold ${
                      d.severity === 'critical'
                        ? 'bg-[#FBE4E1] text-alert'
                        : 'bg-[#FFF2D6] text-[#8A5B00]'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span className="block text-[13px] leading-snug font-semibold">{d.text}</span>
                    <span className="block text-[11.5px] text-slate">{d.detail}</span>
                  </span>
                </div>
              ))
            )}
          </Panel>

          <Panel title="Safety record" hint="Last 30 days">
            <Row
              label="Child left on bus"
              value={`${safety.childStillAboard}`}
              good={safety.childStillAboard === 0}
              alert={safety.childStillAboard > 0}
            />
            <Row label="SOS raised" value={`${safety.sos}`} good={safety.sos === 0} />
            <Row
              label="Speed warnings"
              value={`${safety.overspeed}`}
              alert={safety.overspeed > 10}
            />
            <Row label="Long halts" value={`${safety.longHalt}`} />
            <Link
              to="/reports"
              className="mt-3 block rounded-[9px] border border-line bg-white py-2 text-center text-[12.5px] font-semibold hover:bg-paper"
            >
              Report for the management meeting
            </Link>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function greeting(): string {
  const hour = Number(
    new Date().toLocaleString('en-IN', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="rounded-[12px] border border-line bg-white">
      <header className="flex items-baseline gap-2 border-b border-line px-4 py-3">
        <h4 className="font-head text-[15px] font-bold">{title}</h4>
        {hint ? <span className="text-[11px] text-slate">{hint}</span> : null}
      </header>
      <div className="px-4 py-2">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  alert,
  good,
}: {
  label: string;
  value: string;
  alert?: boolean;
  good?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between border-b border-dashed border-line py-2 last:border-0">
      <span className="text-[12.5px] text-slate">{label}</span>
      <b className={`font-mono text-[14px] ${alert ? 'text-alert' : good ? 'text-live' : 'text-ink'}`}>
        {value}
      </b>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="grid h-full place-items-center text-[13px] text-slate">{children}</div>;
}
