import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { RequestsPanel } from '../components/RequestsPanel';
import { Card, Empty, Kpi } from '../components/ui';
import { api } from '../lib/api';
import type { ImportPreview, ImportPreviewChild } from '../lib/types';

/**
 * SA-06 — children, and the Excel importer.
 *
 * docs/00_plan.md §8 calls this "the screen that decides whether onboarding
 * takes 2 hours or 2 weeks". The whole design follows from that: read the file
 * the school already has, guess the columns, match the stop spellings, and only
 * ask the clerk about what is genuinely ambiguous.
 */
export function Children(): React.ReactElement {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ['children'], queryFn: () => api.children() });

  const upload = useMutation({
    mutationFn: (file: File) => api.importPreview(file),
    onSuccess: (res) => {
      setPreview(res);
      setOverrides({});
      setError(null);
      setDone(null);
    },
    onError: () => setError('Could not read that file. Is it .xlsx or .csv?'),
  });

  const commit = useMutation({
    mutationFn: () => {
      const rows = (preview?.children ?? [])
        .map((c) => ({
          name: c.name,
          admissionNo: c.admissionNo,
          className: c.className,
          stopId: overrides[c.rowNumber] ?? c.match?.stopId ?? null,
          parentName: c.parentName,
          parentPhone: c.parentPhone,
        }))
        .filter((c) => c.stopId !== null || c.name);
      return api.importCommit(rows);
    },
    onSuccess: (res) => {
      setDone(`${res.created} added, ${res.updated} updated, ${res.parentsLinked} parents linked.`);
      setPreview(null);
      void queryClient.invalidateQueries({ queryKey: ['children'] });
    },
    onError: () => setError('Import failed. Nothing was saved.'),
  });

  const needsReview = (preview?.children ?? []).filter(
    (c) => c.needsReview && !overrides[c.rowNumber],
  );

  return (
    <div className="flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <div>
          <h3 className="font-head text-[22px] font-bold">Children</h3>
          <div className="text-[12.5px] text-slate">
            {data?.counts.total ?? 0} using transport
          </div>
        </div>
        <div className="ml-auto">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload.mutate(f);
              e.target.value = '';
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="rounded-[9px] bg-ink px-3.5 py-2 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {upload.isPending ? 'Reading…' : 'Import from Excel'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-[9px] border border-alert bg-[#FBE4E1] px-3 py-2 text-[12.5px] text-[#A62A1B]">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="rounded-[9px] border border-live bg-[#E1F4EC] px-3 py-2 text-[12.5px] text-[#0F7A50]">
          {done}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Children" value={data?.counts.total ?? 0} detail="Using transport" />
        <Kpi
          label="No parent number"
          value={data?.counts.noParentPhone ?? 0}
          detail="Cannot be told anything"
          tone={(data?.counts.noParentPhone ?? 0) > 0 ? 'alert' : undefined}
        />
        <Kpi
          label="No stop"
          value={data?.counts.noStop ?? 0}
          detail="Will not appear in any roll call"
          tone={(data?.counts.noStop ?? 0) > 0 ? 'alert' : undefined}
        />
      </div>

      {preview ? (
        <Card
          title="Import from Excel"
          hint={`${preview.file} · sheet "${preview.sheetName}" · headers on row ${preview.headerRow}`}
        >
          <div className="p-4">
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
              <div>
                <Sub>Your columns</Sub>
                {preview.mapping
                  .filter((m) => m.header)
                  .map((m) => (
                    <div
                      key={m.index}
                      className="flex items-center gap-2 border-b border-line py-1.5 text-[12.5px] last:border-0"
                    >
                      <span className="font-mono">{m.header}</span>
                      <span
                        className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          m.field
                            ? m.confident
                              ? 'bg-[#E1F4EC] text-[#0F7A50]'
                              : 'bg-[#FFF2D6] text-[#8A5B00]'
                            : 'bg-paper text-slate'
                        }`}
                      >
                        {m.field ? `→ ${m.field}` : 'ignored'}
                      </span>
                    </div>
                  ))}
              </div>

              <div>
                <Sub>What we found</Sub>
                <Line label="Rows" value={`${preview.totals.rows}`} />
                <Line label="Stops matched" value={`${preview.totals.matched}`} good />
                <Line
                  label="Needs your decision"
                  value={`${needsReview.length}`}
                  bad={needsReview.length > 0}
                />
                <Line label="No parent number" value={`${preview.totals.noPhone}`} />
              </div>
            </div>

            {needsReview.length > 0 ? (
              <div className="mb-4">
                <Sub>Stops we could not place</Sub>
                <p className="mb-2 text-[12px] text-slate">
                  Everything else matched on spelling or Kannada transliteration. Pick a stop, or
                  leave it and the child is imported without one.
                </p>
                {needsReview.map((c) => (
                  <ReviewRow
                    key={c.rowNumber}
                    child={c}
                    stops={preview.stops}
                    onPick={(stopId) =>
                      setOverrides((prev) => ({ ...prev, [c.rowNumber]: stopId }))
                    }
                  />
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button
                onClick={() => commit.mutate()}
                disabled={commit.isPending}
                className="rounded-[9px] bg-ink px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
              >
                {commit.isPending ? 'Importing…' : `Import ${preview.totals.rows} rows`}
              </button>
              <button
                onClick={() => setPreview(null)}
                className="text-[12.5px] font-semibold text-slate hover:text-ink"
              >
                Cancel
              </button>
              <span className="text-[12px] text-slate">
                Re-importing a corrected file updates the same children — it does not duplicate
                them.
              </span>
            </div>
          </div>
        </Card>
      ) : null}

      <RequestsPanel />

      <Card title="All children">
        {!data || data.children.length === 0 ? (
          <Empty>No children yet. Import the school&apos;s existing list to start.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>Child</Th>
                  <Th>Class</Th>
                  <Th>Route &amp; stop</Th>
                  <Th>Parent</Th>
                </tr>
              </thead>
              <tbody>
                {data.children.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-2.5 font-semibold">
                      {c.name}
                      {c.admissionNo ? (
                        <div className="font-mono text-[11px] font-normal text-slate">
                          {c.admissionNo}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">{c.className ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      {c.stopName ? (
                        <>
                          <span className="text-slate">{c.routeName} · </span>
                          {c.stopName}
                        </>
                      ) : (
                        <span className="rounded-full bg-[#FBE4E1] px-2 py-0.5 text-[11px] font-bold text-[#A62A1B]">
                          No stop
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.parentPhone ? (
                        <>
                          {c.parentName ?? '—'}
                          <div className="font-mono text-[11px] text-slate">{c.parentPhone}</div>
                        </>
                      ) : (
                        <span className="rounded-full bg-[#FBE4E1] px-2 py-0.5 text-[11px] font-bold text-[#A62A1B]">
                          No number
                        </span>
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

function ReviewRow({
  child,
  stops,
  onPick,
}: {
  child: ImportPreviewChild;
  stops: { id: string; name: string; routeName: string }[];
  onPick: (stopId: string) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line py-2 text-[12.5px] last:border-0">
      <span className="font-mono text-[11px] text-slate">row {child.rowNumber}</span>
      <span className="font-semibold">{child.name}</span>
      <span className="rounded-full bg-[#FFF2D6] px-2 py-0.5 font-mono text-[11px] text-[#8A5B00]">
        {child.rawStop ?? 'no stop given'}
      </span>
      {child.match ? (
        <span className="text-[11.5px] text-slate">
          closest: {child.match.stopName} ({Math.round(child.match.score * 100)}%)
        </span>
      ) : null}
      <select
        onChange={(e) => e.target.value && onPick(e.target.value)}
        defaultValue=""
        className="ml-auto rounded-[9px] border border-line px-2 py-1.5 text-[12px]"
      >
        <option value="">Pick a stop…</option>
        {stops.map((s) => (
          <option key={s.id} value={s.id}>
            {s.routeName} · {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="mb-1.5 font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
      {children}
    </div>
  );
}

function Line({
  label,
  value,
  good,
  bad,
}: {
  label: string;
  value: string;
  good?: boolean;
  bad?: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between border-b border-line py-1.5 text-[12.5px] last:border-0">
      <span className="text-slate">{label}</span>
      <span
        className={`font-mono font-semibold ${good ? 'text-live' : bad ? 'text-alert' : ''}`}
      >
        {value}
      </span>
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
