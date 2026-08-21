import { useQuery } from '@tanstack/react-query';
import { Card, Empty, Kpi, Plate } from '../components/ui';
import { api } from '../lib/api';

/**
 * SA-07 — drivers and attendants.
 *
 * The prototype's framing: licence and fitness-certificate expiry is a genuine
 * compliance headache for schools, so own it. A bus whose certificate has
 * lapsed may not legally carry children, and nobody in the office is tracking
 * that in a diary.
 */
export function Staff(): React.ReactElement {
  const { data, isLoading, error } = useQuery({
    queryKey: ['staff'],
    queryFn: () => api.staff(),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Empty>Loading…</Empty>;
  if (error || !data) return <Empty>Could not load staff.</Empty>;

  const expiring = [
    ...data.staff
      .filter((s) => s.daysToLicence !== null && s.daysToLicence <= data.warnDays)
      .map((s) => ({
        what: `${s.name} · driving licence`,
        on: s.licenceExpiry,
        days: s.daysToLicence!,
      })),
    ...data.buses
      .filter((b) => b.daysToFitness !== null && b.daysToFitness <= data.warnDays)
      .map((b) => ({
        what: `${b.plate} · fitness certificate`,
        on: b.fitnessExpiry,
        days: b.daysToFitness!,
      })),
  ].sort((a, b) => a.days - b.days);

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="font-head text-[22px] font-bold">Drivers &amp; attendants</h3>
        <div className="text-[12.5px] text-slate">
          {data.counts.drivers} driver{data.counts.drivers === 1 ? '' : 's'} ·{' '}
          {data.counts.attendants} attendant{data.counts.attendants === 1 ? '' : 's'} ·{' '}
          {data.buses.length} bus{data.buses.length === 1 ? '' : 'es'}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="On a trip now"
          value={data.counts.onTrip}
          detail="Driving right now"
          tone={data.counts.onTrip > 0 ? 'live' : undefined}
        />
        <Kpi
          label="Licence expiring"
          value={data.counts.expiringLicences}
          detail={`Within ${data.warnDays} days`}
          tone={data.counts.expiringLicences > 0 ? 'alert' : undefined}
        />
        <Kpi
          label="Fitness certificate due"
          value={data.counts.expiringFitness}
          detail={`Within ${data.warnDays} days`}
          tone={data.counts.expiringFitness > 0 ? 'alert' : undefined}
        />
        <Kpi
          label="Speed warnings"
          value={data.counts.speedWarningsThisWeek}
          detail="Last 7 days"
          tone={data.counts.speedWarningsThisWeek > 5 ? 'alert' : undefined}
        />
      </div>

      {expiring.length > 0 ? (
        <Card title="Documents needing renewal" hint="A lapsed certificate grounds the bus">
          {expiring.map((e) => (
            <div
              key={e.what}
              className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0"
            >
              <span className="text-[13px] font-semibold">{e.what}</span>
              <span className="ml-auto font-mono text-[12px] text-slate">{e.on}</span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  e.days < 0
                    ? 'bg-[#FBE4E1] text-[#A62A1B]'
                    : 'bg-[#FFF2D6] text-[#8A5B00]'
                }`}
              >
                {e.days < 0 ? `expired ${-e.days} days ago` : `${e.days} days left`}
              </span>
            </div>
          ))}
        </Card>
      ) : null}

      <Card title="Staff">
        {data.staff.length === 0 ? (
          <Empty>No staff yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Assigned to</Th>
                  <Th>Licence</Th>
                  <Th>Police verification</Th>
                  <Th>Score</Th>
                  <Th>Now</Th>
                </tr>
              </thead>
              <tbody>
                {data.staff.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-2.5 font-semibold">
                      {s.name}
                      <div className="font-mono text-[11px] font-normal text-slate">{s.phone}</div>
                    </td>
                    <td className="px-4 py-2.5 capitalize">{s.role}</td>
                    <td className="px-4 py-2.5">
                      {s.plate ? <Plate>{s.plate}</Plate> : <span className="text-slate">—</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[12px]">
                      {s.licenceExpiry ? (
                        <span
                          className={
                            s.daysToLicence !== null && s.daysToLicence <= data.warnDays
                              ? 'text-alert'
                              : ''
                          }
                        >
                          {s.licenceExpiry}
                        </span>
                      ) : s.role === 'driver' ? (
                        <span className="text-alert">not on file</span>
                      ) : (
                        <span className="text-slate">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.policeVerifiedOn ? (
                        <span className="rounded-full bg-[#E1F4EC] px-2 py-0.5 text-[11px] font-bold text-[#0F7A50]">
                          {s.policeVerifiedOn}
                        </span>
                      ) : s.role === 'driver' || s.role === 'attendant' ? (
                        <span className="rounded-full bg-[#FFF2D6] px-2 py-0.5 text-[11px] font-bold text-[#8A5B00]">
                          not verified
                        </span>
                      ) : (
                        <span className="text-slate">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono">
                      {s.score === null ? <span className="text-slate">—</span> : s.score}
                    </td>
                    <td className="px-4 py-2.5">
                      {s.onTrip ? (
                        <span className="rounded-full bg-[#E1F4EC] px-2 py-0.5 text-[11px] font-bold text-[#0F7A50]">
                          On a trip
                        </span>
                      ) : (
                        <span className="text-slate">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line bg-paper px-4 py-2.5 text-[11.5px] leading-snug text-slate">
          Driving score is entered by hand for now. The prototype computes it from speed
          violations, harsh braking and halt time — braking needs the phone&apos;s accelerometer,
          which the driver app does not read yet.
        </p>
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
