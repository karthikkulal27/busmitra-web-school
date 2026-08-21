import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Empty, Kpi } from '../components/ui';
import { api } from '../lib/api';

/**
 * SA-11 — reports. What the principal takes to the management meeting.
 *
 * Every figure is computed from what was recorded. Where a figure cannot be
 * produced it shows "—" and says why, rather than showing a plausible number:
 * on-time arrival needs an arrival time at the last stop, and a school whose
 * drivers have not been tapping "Reached stop" should not be shown 100%.
 */
export function Reports(): React.ReactElement {
  const [days, setDays] = useState(30);
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10);

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => api.reports(from, to),
  });

  if (isLoading) return <Empty>Loading…</Empty>;
  if (error || !data) return <Empty>Could not build the report.</Empty>;

  const t = data.totals;
  const worstDay = Math.max(1, ...data.byDay.map((d) => d.averageDelayMinutes));

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-head text-[22px] font-bold">Reports</h3>
          <div className="text-[12.5px] text-slate">
            {data.range.from} – {data.range.to}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold ${
                d === days ? 'bg-ink text-white' : 'bg-white text-ink2 hover:bg-paper'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="On-time arrival"
          value={t.onTimePercent === null ? '—' : t.onTimePercent}
          unit={t.onTimePercent === null ? undefined : '%'}
          detail={
            t.measuredTrips === 0
              ? 'No arrival times recorded yet'
              : `${t.measuredTrips} trips measured`
          }
          tone={t.onTimePercent !== null && t.onTimePercent >= 90 ? 'live' : undefined}
        />
        <Kpi
          label="Average delay"
          value={t.averageDelayMinutes === null ? '—' : t.averageDelayMinutes}
          unit={t.averageDelayMinutes === null ? undefined : 'min'}
          detail="On trips that arrived late"
        />
        <Kpi
          label="Distance covered"
          value={t.distanceKm.toLocaleString('en-IN')}
          unit="km"
          detail="From recorded positions"
        />
        <Kpi
          label="Speed violations"
          value={t.speedViolations}
          detail="Over the school's limit"
          tone={t.speedViolations > 0 ? 'alert' : 'live'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Arrival at school, by day" hint="Average minutes late">
          {data.byDay.length === 0 ? (
            <Empty>
              No arrival times in this period. The bar chart fills in once drivers reach the last
              stop on a route — by tapping &ldquo;Reached stop&rdquo; or by the geofence.
            </Empty>
          ) : (
            <div className="flex h-[210px] items-end gap-1.5 px-4 py-4">
              {data.byDay.map((d) => (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    title={`${d.day}: ${d.averageDelayMinutes} min late, ${d.trips} trips`}
                    style={{ height: `${Math.max(4, (d.averageDelayMinutes / worstDay) * 100)}%` }}
                    className={`w-full rounded-t-[4px] ${
                      d.averageDelayMinutes > 10 ? 'bg-alert' : 'bg-ink'
                    }`}
                  />
                  <span className="font-mono text-[10px] text-slate">{d.day.slice(8)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Route by route">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Route</Th>
                  <Th>Trips</Th>
                  <Th>On time</Th>
                  <Th>Avg delay</Th>
                  <Th>Km</Th>
                  <Th>Violations</Th>
                </tr>
              </thead>
              <tbody>
                {data.routes.map((r) => (
                  <tr key={r.routeId} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-semibold">{r.routeName}</td>
                    <td className="px-4 py-2.5 font-mono">{r.trips}</td>
                    <td className="px-4 py-2.5">
                      {r.onTimePercent === null ? (
                        <span className="text-slate">—</span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            r.onTimePercent >= 95
                              ? 'bg-[#E1F4EC] text-[#0F7A50]'
                              : r.onTimePercent >= 90
                                ? 'bg-[#FFF2D6] text-[#8A5B00]'
                                : 'bg-[#FBE4E1] text-[#A62A1B]'
                          }`}
                        >
                          {r.onTimePercent}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {r.averageDelayMinutes === null ? '—' : `${r.averageDelayMinutes} min`}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {r.distanceKm.toLocaleString('en-IN')}
                    </td>
                    <td className="px-4 py-2.5 font-mono">{r.violations}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="How these are counted">
        <div className="p-4 text-[12.5px] leading-relaxed text-slate">
          <p>
            <b className="text-ink">On-time</b> compares the arrival time recorded at a route&apos;s
            last stop against that stop&apos;s scheduled time, with {5} minutes&apos; grace. Trips
            that never recorded an arrival are left out of the percentage rather than counted as
            punctual — a missing tick is not a punctual bus.
          </p>
          <p className="mt-2">
            <b className="text-ink">Distance</b> is the sum of the gaps between recorded positions.
            Segments under 5 m are treated as GPS jitter on a parked bus, and segments over 2 km as
            a jump after a dead zone rather than distance driven.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <th className="px-4 py-2.5 font-head text-[10px] font-bold tracking-[0.12em] text-slate uppercase">
      {children}
    </th>
  );
}
