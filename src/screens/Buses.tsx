import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Empty, Kpi, Plate } from '../components/ui';
import { api } from '../lib/api';
import type { FleetBus } from '../lib/types';

/**
 * SA-14 — buses.
 *
 * A new screen, outside the SA-01..SA-13 prototype set — there was no mock for
 * it, because the original plan had the operator adding vehicles. It first
 * carried SA-08, which is the boarding log's number.
 *
 * The school owns its fleet. Schools buy and retire vehicles on their own
 * timetable, and routing every plate change through BusMitra would make us a
 * bottleneck in something that has nothing to do with us. Until now this table
 * was only reachable by hand-written SQL.
 *
 * The fitness certificate is the reason this screen has a warning colour at all:
 * a bus whose certificate has lapsed may not legally carry children, and the
 * office needs to see that before the bus leaves, not after.
 */
export function Buses(): React.ReactElement {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FleetBus | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['fleet'], queryFn: () => api.fleet() });
  const buses = data?.buses ?? [];

  const done = (message: string) => {
    setNote(message);
    setAdding(false);
    setEditing(null);
    void queryClient.invalidateQueries({ queryKey: ['fleet'] });
  };

  const create = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.createBus(input),
    onSuccess: () => done('Bus added.'),
    onError: (e: Error) =>
      setNote(
        e.message.includes('plate_already_here')
          ? 'That plate is already on your list — it may just need reactivating.'
          : 'Could not add the bus.',
      ),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      api.updateBus(id, input),
    onSuccess: () => done('Saved.'),
    onError: (e: Error) =>
      setNote(
        e.message.includes('bus_is_on_a_trip')
          ? 'That bus is on a trip right now. Retire it after the trip ends.'
          : 'Could not save.',
      ),
  });

  const active = buses.filter((b) => b.active);
  const lapsed = buses.filter((b) => b.fitness_lapsed);
  const soon = buses.filter((b) => b.fitness_soon && !b.fitness_lapsed);
  const unassigned = active.filter((b) => b.routes === 0);

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="font-head text-[22px] font-bold">Buses</h3>
          <div className="text-[12.5px] text-slate">{active.length} in service</div>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setAdding(true);
            setNote(null);
          }}
          className="ml-auto rounded-[9px] bg-ink px-3.5 py-2 text-[13px] font-bold text-white"
        >
          Add a bus
        </button>
      </div>

      {note ? (
        <p className="rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px]">{note}</p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="In service" value={active.length} detail="Active buses" />
        <Kpi
          label="Fitness lapsed"
          value={lapsed.length}
          detail="May not legally carry children"
          tone={lapsed.length > 0 ? 'alert' : undefined}
        />
        <Kpi label="Expiring in 30 days" value={soon.length} detail="Renew now" />
        <Kpi
          label="No route yet"
          value={unassigned.length}
          detail="Cannot be driven until assigned"
        />
      </div>

      {adding || editing ? (
        <BusForm
          bus={editing}
          busy={create.isPending || update.isPending}
          onCancel={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSave={(input) =>
            editing ? update.mutate({ id: editing.id, input }) : create.mutate(input)
          }
        />
      ) : null}

      <Card title="Fleet">
        {isLoading ? (
          <Empty>Loading…</Empty>
        ) : buses.length === 0 ? (
          <Empty>
            No buses yet. Add them here, then assign each one to a route on
            &ldquo;Routes &amp; stops&rdquo;.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  <Th>Bus</Th>
                  <Th>Seats</Th>
                  <Th>Driver</Th>
                  <Th>Routes</Th>
                  <Th>Fitness certificate</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {buses.map((b) => (
                  <tr
                    key={b.id}
                    className={`border-b border-line last:border-0 hover:bg-paper ${
                      b.active ? '' : 'opacity-55'
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <Plate>{b.plate}</Plate>
                      <div className="mt-0.5 text-[11px] text-slate">
                        {b.model ?? '—'}
                        {b.on_trip ? ' · on a trip now' : ''}
                        {b.active ? '' : ' · retired'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 font-mono">{b.seats}</td>
                    <td className="px-4 py-2.5">
                      {b.driver_name ?? <span className="text-slate">not assigned</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {b.routes === 0 ? (
                        <span className="rounded-full bg-[#FFF2D6] px-2 py-0.5 text-[11px] font-bold text-[#8A5B00]">
                          No route
                        </span>
                      ) : (
                        <span className="font-mono">{b.routes}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <Fitness bus={b} />
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button
                        onClick={() => {
                          setAdding(false);
                          setEditing(b);
                          setNote(null);
                        }}
                        className="text-[12.5px] font-semibold text-slate hover:text-ink"
                      >
                        Edit
                      </button>
                      {b.active ? (
                        <button
                          onClick={() => update.mutate({ id: b.id, input: { active: false } })}
                          className="ml-3 text-[12.5px] font-semibold text-slate hover:text-alert"
                        >
                          Retire
                        </button>
                      ) : (
                        <button
                          onClick={() => update.mutate({ id: b.id, input: { active: true } })}
                          className="ml-3 text-[12.5px] font-semibold text-slate hover:text-live"
                        >
                          Bring back
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

      <p className="text-[11.5px] leading-relaxed text-slate">
        Retiring a bus never deletes it. Past trips name the vehicle a child was on, and
        that is a question which can be asked long after the bus has been sold.
      </p>
    </div>
  );
}

function Fitness({ bus }: { bus: FleetBus }): React.ReactElement {
  if (!bus.fitness_label) return <span className="text-slate">not recorded</span>;
  if (bus.fitness_lapsed) {
    return (
      <span className="rounded-full bg-[#FBE4E1] px-2 py-0.5 text-[11px] font-bold text-[#A62A1B]">
        Lapsed {bus.fitness_label}
      </span>
    );
  }
  if (bus.fitness_soon) {
    return (
      <span className="rounded-full bg-[#FFF2D6] px-2 py-0.5 text-[11px] font-bold text-[#8A5B00]">
        Due {bus.fitness_label}
      </span>
    );
  }
  return <span className="font-mono text-[12px]">{bus.fitness_label}</span>;
}

function BusForm({
  bus,
  busy,
  onSave,
  onCancel,
}: {
  bus: FleetBus | null;
  busy: boolean;
  onSave: (input: Record<string, unknown>) => void;
  onCancel: () => void;
}): React.ReactElement {
  const [plate, setPlate] = useState(bus?.plate ?? '');
  const [seats, setSeats] = useState(String(bus?.seats ?? 42));
  const [model, setModel] = useState(bus?.model ?? '');
  const [fitness, setFitness] = useState(bus?.fitness_expiry ?? '');

  const ok = plate.trim().length >= 4 && Number(seats) > 0;

  return (
    <Card title={bus ? `Edit ${bus.plate}` : 'Add a bus'}>
      <form
        className="grid gap-3 p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            plate: plate.trim(),
            seats: Number(seats),
            model: model.trim() || null,
            fitnessExpiry: fitness || null,
          });
        }}
      >
        <Field label="Registration number">
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="KA 19 AC 1188"
            className="w-full rounded-[9px] border border-line px-3 py-2 font-mono text-[14px] uppercase"
          />
        </Field>
        <Field label="Seats">
          <input
            value={seats}
            onChange={(e) => setSeats(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            className="w-full rounded-[9px] border border-line px-3 py-2 font-mono text-[14px]"
          />
        </Field>
        <Field label="Model (optional)">
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Tata Starbus"
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
          />
        </Field>
        <Field label="Fitness certificate expires">
          <input
            type="date"
            value={fitness}
            onChange={(e) => setFitness(e.target.value)}
            className="w-full rounded-[9px] border border-line px-3 py-2 font-mono text-[14px]"
          />
        </Field>

        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={!ok || busy}
            className="rounded-[9px] bg-ink px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {busy ? 'Saving…' : bus ? 'Save changes' : 'Add bus'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-[12.5px] font-semibold text-slate hover:text-ink"
          >
            Cancel
          </button>
          <span className="text-[12px] text-slate">
            A bus needs a route before anyone can drive it — set that on &ldquo;Routes &amp;
            stops&rdquo;.
          </span>
        </div>
      </form>
    </Card>
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
    <label className="block">
      <span className="mb-1.5 block font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <th className="px-4 py-2.5 text-left font-head text-[10px] font-bold tracking-[0.12em] text-slate uppercase">
      {children}
    </th>
  );
}
