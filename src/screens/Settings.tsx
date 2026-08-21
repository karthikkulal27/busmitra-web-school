import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Card, Empty } from '../components/ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

/**
 * SA-12 — settings.
 *
 * Two things are deliberately not on this screen as switches: the
 * child-still-aboard alert and the not-boarded message to parents. The
 * prototype's note is blunt about why — never let a school disable the one
 * alert that prevents the headline nobody wants — so there is no toggle, no
 * field in the request schema, and no column in the database behind it.
 */
export function Settings(): React.ReactElement {
  const queryClient = useQueryClient();
  const role = useSession((s) => s.session?.staff.role);
  const readOnly = role === 'principal';

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.settings(),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm({
      name: data.school.name,
      assemblyTime: data.timings.assemblyTime ?? '',
      closingTime: data.timings.closingTime ?? '',
      busesLeaveBy: data.timings.busesLeaveBy ?? '',
      speedLimitKmh: String(data.alerts.speedLimitKmh),
      longHaltMinutes: String(data.alerts.longHaltMinutes),
      routeDeviationM: String(data.alerts.routeDeviationM),
      tripLateAfterMinutes: String(data.alerts.tripLateAfterMinutes),
      officePhone: data.contacts.officePhone ?? '',
      transportPhone: data.contacts.transportPhone ?? '',
    });
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      api.saveSettings({
        name: form['name'],
        assemblyTime: form['assemblyTime'] || undefined,
        closingTime: form['closingTime'] || undefined,
        busesLeaveBy: form['busesLeaveBy'] || undefined,
        speedLimitKmh: Number(form['speedLimitKmh']),
        longHaltMinutes: Number(form['longHaltMinutes']),
        routeDeviationM: Number(form['routeDeviationM']),
        tripLateAfterMinutes: Number(form['tripLateAfterMinutes']),
        officePhone: form['officePhone'] || undefined,
        transportPhone: form['transportPhone'] || undefined,
      }),
    onSuccess: () => {
      setNote('Saved. Alert thresholds apply to the next position that arrives.');
      void queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: () => setNote('Could not save.'),
  });

  if (isLoading) return <Empty>Loading…</Empty>;
  if (error || !data) return <Empty>Could not load settings.</Empty>;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-head text-[22px] font-bold">Settings</h3>
          <div className="text-[12.5px] text-slate">
            {data.school.code} · {data.school.timezone}
          </div>
        </div>
        {note ? (
          <span className="rounded-[9px] bg-paper px-3 py-1.5 text-[12px] text-ink2">{note}</span>
        ) : null}
        {!readOnly ? (
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="ml-auto rounded-[9px] bg-ink px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-60"
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        ) : (
          <span className="ml-auto rounded-full bg-paper px-3 py-1.5 text-[12px] font-semibold text-slate">
            Read-only · principal account
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="School &amp; timings">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Name shown to parents" wide>
              <Input value={form['name'] ?? ''} onChange={set('name')} disabled={readOnly} />
            </Field>
            <Field label="Morning assembly">
              <Input
                value={form['assemblyTime'] ?? ''}
                onChange={set('assemblyTime')}
                placeholder="08:15"
                mono
                disabled={readOnly}
              />
            </Field>
            <Field label="Closing bell">
              <Input
                value={form['closingTime'] ?? ''}
                onChange={set('closingTime')}
                placeholder="15:30"
                mono
                disabled={readOnly}
              />
            </Field>
            <Field label="Buses leave school by">
              <Input
                value={form['busesLeaveBy'] ?? ''}
                onChange={set('busesLeaveBy')}
                placeholder="15:45"
                mono
                disabled={readOnly}
              />
            </Field>
          </div>
        </Card>

        <Holidays />

        <Card title="Numbers a driver can call">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="School office">
              <Input
                value={form['officePhone'] ?? ''}
                onChange={set('officePhone')}
                placeholder="0824 2345678"
                mono
                disabled={readOnly}
              />
            </Field>
            <Field label="Transport in-charge">
              <Input
                value={form['transportPhone'] ?? ''}
                onChange={set('transportPhone')}
                placeholder="+91 98450 12345"
                mono
                disabled={readOnly}
              />
            </Field>
            <p className="text-[11.5px] leading-relaxed text-slate sm:col-span-2">
              The office number becomes the &ldquo;Call school office&rdquo; button on the
              driver&rsquo;s SOS screen. Leave it blank and the SOS still reaches you here — the
              driver just has no one-tap way to reach a person. 112 is always offered.
            </p>
          </div>
        </Card>

        <Card title="When to alert us">
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label="Speed goes above (km/h)">
              <Input
                value={form['speedLimitKmh'] ?? ''}
                onChange={set('speedLimitKmh')}
                mono
                disabled={readOnly}
              />
            </Field>
            <Field label="Stops moving for longer than (min)">
              <Input
                value={form['longHaltMinutes'] ?? ''}
                onChange={set('longHaltMinutes')}
                mono
                disabled={readOnly}
              />
            </Field>
            <Field label="Goes off route by (m)">
              <Input
                value={form['routeDeviationM'] ?? ''}
                onChange={set('routeDeviationM')}
                mono
                disabled={readOnly}
              />
            </Field>
            <Field label="Trip has not started by (+min)">
              <Input
                value={form['tripLateAfterMinutes'] ?? ''}
                onChange={set('tripLateAfterMinutes')}
                mono
                disabled={readOnly}
              />
            </Field>

            <div className="sm:col-span-2">
              <Locked label="Child not boarded — inform parent" value="Immediately" />
              <Locked label="Child still aboard after last stop" value="Always · cannot be turned off" />
              <p className="pt-2 text-[11.5px] leading-relaxed text-slate">
                These two have no switch anywhere in the product — not disabled, absent. There is
                no field in the API and no column in the database, so no administrator can turn
                off the alert that prevents a child being left on a bus.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Not configurable yet">
        <div className="p-4 text-[12.5px] leading-relaxed text-slate">
          The prototype also has tabs for <b className="text-ink">parent app visibility</b>,{' '}
          <b className="text-ink">billing</b> and <b className="text-ink">holidays</b>. The parent
          app is phase 8 and your plan says not to build it before the pilot; billing is phase 9.
          Showing switches for either would imply a setting that does nothing.
          <span className="mt-2 block">
            Route deviation is stored and editable here, but no alert reads it yet — that check
            needs the route corridor geometry, which is the PostGIS work still outstanding.
          </span>
        </div>
      </Card>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  mono,
  disabled,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  mono?: boolean;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <input
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full rounded-[9px] border border-line px-3 py-2 text-[13.5px] outline-none focus:border-ink disabled:bg-paper disabled:text-slate ${
        mono ? 'font-mono' : ''
      }`}
    />
  );
}

function Locked({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-between border-b border-dashed border-line py-2 last:border-0">
      <span className="text-[12.5px]">{label}</span>
      <span className="rounded-full bg-[#E1F4EC] px-2.5 py-1 text-[11px] font-bold text-[#0F7A50]">
        {value}
      </span>
    </div>
  );
}


/**
 * SA-12 — days no bus is expected.
 *
 * Not housekeeping. The late-start sweep runs every five minutes and, without
 * this list, files one alert per route on Dasara. An alert engine that is
 * predictably wrong on days everybody knew about teaches the office to dismiss
 * the whole category — and then the Tuesday a bus genuinely never leaves goes
 * unread.
 */
function Holidays(): React.ReactElement {
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [running, setRunning] = useState(false);

  const { data } = useQuery({ queryKey: ['holidays'], queryFn: () => api.holidays() });
  const holidays = data?.holidays ?? [];

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['holidays'] });
  const add = useMutation({
    mutationFn: () => api.addHoliday({ onDate: date, name: name.trim(), busesRunning: running }),
    onSuccess: () => {
      setDate('');
      setName('');
      setRunning(false);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.removeHoliday(id),
    onSuccess: refresh,
  });

  const upcoming = holidays.filter((h) => !h.past);

  return (
    <Card title="Holidays" hint={`${upcoming.length} still to come`}>
      <div className="p-4">
        <form
          className="mb-4 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (date && name.trim().length >= 2) add.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1.5 block font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-[9px] border border-line px-3 py-2 font-mono text-[14px]"
            />
          </label>
          <label className="block min-w-[12rem] flex-1">
            <span className="mb-1.5 block font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
              What is it
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dasara"
              className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
            />
          </label>
          <label className="flex items-center gap-2 pb-2.5 text-[13px]">
            <input
              type="checkbox"
              checked={running}
              onChange={(e) => setRunning(e.target.checked)}
            />
            Buses still run
          </label>
          <button
            type="submit"
            disabled={!date || name.trim().length < 2 || add.isPending}
            className="rounded-[9px] bg-ink px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {add.isPending ? 'Adding…' : 'Add'}
          </button>
        </form>

        {holidays.length === 0 ? (
          <p className="text-[12.5px] text-slate">
            None yet. Add the school calendar before term starts — every route will be
            reported late on a holiday that is not listed here.
          </p>
        ) : (
          holidays.slice(0, 20).map((h) => (
            <div
              key={h.id}
              className={`flex items-center gap-3 border-b border-line py-2 text-[13px] last:border-0 ${
                h.past ? 'opacity-55' : ''
              }`}
            >
              <span className="w-28 font-mono text-[12.5px]">{h.label}</span>
              <span className="font-semibold">{h.name}</span>
              {h.buses_running ? (
                <span className="rounded-full bg-[#FFF2D6] px-2 py-0.5 text-[11px] font-bold text-[#8A5B00]">
                  Buses run
                </span>
              ) : (
                <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-bold text-slate">
                  Closed
                </span>
              )}
              <button
                onClick={() => remove.mutate(h.id)}
                className="ml-auto text-[12.5px] font-semibold text-slate hover:text-alert"
              >
                Remove
              </button>
            </div>
          ))
        )}

        <p className="pt-3 text-[11.5px] leading-relaxed text-slate">
          Tick &ldquo;buses still run&rdquo; for an exam or half day. The late-start alert
          is suppressed either way; the difference is that reports can still tell a closed
          day from one that ran off timetable.
        </p>
      </div>
    </Card>
  );
}
