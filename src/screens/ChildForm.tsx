import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card } from '../components/ui';
import { api } from '../lib/api';

/**
 * SA-06 — one child, by hand.
 *
 * The importer is right for four hundred children in an afternoon and wrong for
 * the admission that arrives in October. A school that has to edit its master
 * spreadsheet and re-import to add a single child will keep that spreadsheet as
 * the real record, and this console becomes a viewer rather than the system.
 *
 * Only the name is required. The office often has a child before it has their
 * stop or a working number for the parent, and refusing the record until
 * everything is known means it gets written on paper instead — where the bus
 * cannot see it.
 */
export interface ChildDraft {
  id?: string;
  name: string;
  admissionNo: string | null;
  className: string | null;
  stopId: string | null;
  parentName: string | null;
  parentPhone: string | null;
}

export function ChildForm({
  child,
  stops,
  onDone,
  onCancel,
}: {
  child: ChildDraft | null;
  stops: { id: string; name: string; routeName: string }[];
  onDone: (message: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  const queryClient = useQueryClient();
  const [name, setName] = useState(child?.name ?? '');
  const [admissionNo, setAdmissionNo] = useState(child?.admissionNo ?? '');
  const [className, setClassName] = useState(child?.className ?? '');
  const [stopId, setStopId] = useState(child?.stopId ?? '');
  const [parentName, setParentName] = useState(child?.parentName ?? '');
  const [parentPhone, setParentPhone] = useState(child?.parentPhone ?? '');
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(child?.id);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['children'] });
  };

  const body = () => ({
    name: name.trim(),
    admissionNo: admissionNo.trim() || null,
    className: className.trim() || null,
    stopId: stopId || null,
    parentName: parentName.trim() || null,
    parentPhone: parentPhone.trim() || null,
  });

  const save = useMutation({
    // Void, because create returns an id and update returns ok — the caller
    // needs neither, and typing the union buys nothing.
    mutationFn: async (): Promise<void> => {
      if (editing) await api.updateChild(child!.id!, body());
      else await api.createChild(body());
    },
    onSuccess: () => {
      refresh();
      onDone(editing ? 'Saved.' : `${name.trim()} added.`);
    },
    onError: (e: Error) =>
      setError(
        e.message.includes('admission_no_already_here')
          ? 'That admission number is already on the roll.'
          : e.message.includes('stop_not_in_this_school')
            ? 'That stop belongs to a different school.'
            : 'Could not save.',
      ),
  });

  const remove = useMutation({
    mutationFn: () => api.updateChild(child!.id!, { active: false }),
    onSuccess: () => {
      refresh();
      onDone(`${child?.name} marked as left the school.`);
    },
  });

  return (
    <Card title={editing ? `Edit ${child?.name}` : 'Add a child'}>
      <form
        className="grid gap-3 p-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          save.mutate();
        }}
      >
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
          />
        </Field>
        <Field label="Admission number">
          <input
            value={admissionNo}
            onChange={(e) => setAdmissionNo(e.target.value)}
            placeholder="ADM-2211"
            className="w-full rounded-[9px] border border-line px-3 py-2 font-mono text-[14px]"
          />
        </Field>
        <Field label="Class">
          <input
            value={className}
            onChange={(e) => setClassName(e.target.value)}
            placeholder="6B"
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
          />
        </Field>
        <Field label="Stop">
          <select
            value={stopId}
            onChange={(e) => setStopId(e.target.value)}
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
          >
            <option value="">No stop yet</option>
            {stops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.routeName} · {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Parent name">
          <input
            value={parentName}
            onChange={(e) => setParentName(e.target.value)}
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
          />
        </Field>
        <Field label="Parent mobile">
          <input
            value={parentPhone}
            onChange={(e) => setParentPhone(e.target.value)}
            placeholder="98450 20001"
            className="w-full rounded-[9px] border border-line px-3 py-2 font-mono text-[14px]"
          />
        </Field>

        {error ? <p className="text-[12.5px] text-alert sm:col-span-2">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={name.trim().length < 2 || save.isPending}
            className="rounded-[9px] bg-ink px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          >
            {save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Add child'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-[12.5px] font-semibold text-slate hover:text-ink"
          >
            Cancel
          </button>

          {editing ? (
            <button
              type="button"
              onClick={() => remove.mutate()}
              className="ml-auto text-[12.5px] font-semibold text-slate hover:text-alert"
            >
              This child has left the school
            </button>
          ) : (
            <span className="text-[12px] text-slate">
              Only the name is needed. A stop and a mobile number can be added later.
            </span>
          )}
        </div>

        {editing ? (
          <p className="text-[11.5px] leading-relaxed text-slate sm:col-span-2">
            Marking a child as left keeps their boarding record. It is the account of
            where they were on every trip they took, and it is not ours to delete.
          </p>
        ) : null}
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
