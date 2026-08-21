import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, Empty } from './ui';
import { api } from '../lib/api';
import { useSession } from '../lib/session';

const LEAVE_LABEL: Record<string, string> = {
  full_day: 'Not travelling today',
  morning_only: 'No pickup this morning',
  evening_only: 'No drop this evening',
};

/**
 * SA-06's second panel — what parents asked for today.
 *
 * Leave needs no decision: the child is ill, and the value is that the driver
 * stops waiting at the stop. A stop change does need one — SA-06 calls
 * evening-drop changes the #1 real-world safety incident, so nothing moves
 * until somebody here presses Approve.
 */
export function RequestsPanel(): React.ReactElement {
  const queryClient = useQueryClient();
  const readOnly = useSession((s) => s.session?.staff.role) === 'principal';

  const { data } = useQuery({
    queryKey: ['requests'],
    queryFn: () => api.requests(),
    refetchInterval: 30_000,
  });

  const decide = useMutation({
    mutationFn: (input: { id: string; status: 'approved' | 'rejected' }) =>
      api.decideStopChange(input.id, input.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });

  const nothing = !data || (data.leave.length === 0 && data.stopChanges.length === 0);

  return (
    <Card
      title="Leave &amp; stop changes today"
      hint="From the parent app"
      action={
        data && data.pending > 0 ? (
          <span className="rounded-full bg-[#FFF2D6] px-2.5 py-1 text-[11px] font-bold text-[#8A5B00]">
            {data.pending} need{data.pending === 1 ? 's' : ''} approval
          </span>
        ) : null
      }
    >
      {nothing ? (
        <Empty>No leave or stop changes today.</Empty>
      ) : (
        <>
          {data!.leave.map((l) => (
            <div key={l.id} className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
              <span className="mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-[9px] bg-[#E3ECFD] text-[12px] font-bold text-[#2D6BE4]">
                L
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">
                  {l.childName} — {LEAVE_LABEL[l.type] ?? l.type}
                </span>
                <span className="block text-[11.5px] text-slate">
                  {l.reason ? `${l.reason} · ` : ''}
                  applied by {l.parentName ?? 'parent'} · {l.routeName ?? ''}
                </span>
              </span>
              <span className="ml-auto flex-none text-[11.5px] text-slate">
                Driver told
              </span>
            </div>
          ))}

          {data!.stopChanges.map((s) => (
            <div key={s.id} className="flex gap-3 border-b border-line px-4 py-3 last:border-0">
              <span
                className={`mt-0.5 grid h-7 w-7 flex-none place-items-center rounded-[9px] text-[12px] font-bold ${
                  s.status === 'pending'
                    ? 'bg-[#FFF2D6] text-[#8A5B00]'
                    : s.status === 'approved'
                      ? 'bg-[#E1F4EC] text-[#0F7A50]'
                      : 'bg-[#FBE4E1] text-[#A62A1B]'
                }`}
              >
                S
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold">
                  {s.childName} — {s.shift} drop at {s.toStop}
                </span>
                <span className="block text-[11.5px] text-slate">
                  instead of {s.fromStop ?? 'their usual stop'}
                  {s.note ? ` · ${s.note}` : ''}
                  {s.decidedBy ? ` · ${s.status} by ${s.decidedBy}` : ''}
                </span>
              </span>
              <span className="ml-auto flex flex-none items-center gap-2">
                {s.status === 'pending' && !readOnly ? (
                  <>
                    <button
                      onClick={() => decide.mutate({ id: s.id, status: 'approved' })}
                      disabled={decide.isPending}
                      className="rounded-[9px] bg-ink px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => decide.mutate({ id: s.id, status: 'rejected' })}
                      disabled={decide.isPending}
                      className="rounded-[9px] border border-line px-2.5 py-1.5 text-[12px] font-semibold"
                    >
                      Reject
                    </button>
                  </>
                ) : (
                  <span className="text-[11.5px] text-slate capitalize">{s.status}</span>
                )}
              </span>
            </div>
          ))}

          <p className="border-t border-line bg-paper px-4 py-2.5 text-[11.5px] leading-snug text-slate">
            A stop change does not reach the driver until it is approved here. Until then the
            child is picked up where they always are.
          </p>
        </>
      )}
    </Card>
  );
}
