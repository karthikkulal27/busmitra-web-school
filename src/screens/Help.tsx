import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Empty } from '../components/ui';
import { api } from '../lib/api';

/**
 * Getting help from BusMitra.
 *
 * The operator console's support inbox is built around one idea — "every ticket
 * carries the school's live state, so you don't start by asking questions" —
 * and until now there was no way for a school to raise one. The inbox could
 * only be filled by hand, which made that screen a demo.
 *
 * Linking a child is the field that earns its place. With it, the operator
 * opens the ticket and already sees that child's stop, their parent's app
 * version, whether push is denied on that phone, and whether they boarded today.
 * Without it, the first reply is a question the school has to answer before
 * anything can happen.
 */
export function Help(): React.ReactElement {
  const queryClient = useQueryClient();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [childId, setChildId] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ['my-tickets'], queryFn: () => api.myTickets() });
  const { data: kids } = useQuery({ queryKey: ['children'], queryFn: () => api.children() });

  const raise = useMutation({
    mutationFn: () =>
      api.raiseTicket({
        subject: subject.trim(),
        body: body.trim(),
        priority: urgent ? 'urgent' : 'normal',
        childId: childId || null,
      }),
    onSuccess: (res) => {
      setNote(`Sent. Your reference is #${res.number}.`);
      setSubject('');
      setBody('');
      setUrgent(false);
      setChildId('');
      void queryClient.invalidateQueries({ queryKey: ['my-tickets'] });
    },
    onError: () => setNote('Could not send that. Try again in a moment.'),
  });

  const tickets = data?.tickets ?? [];
  const open = tickets.filter((t) => t.status !== 'closed');
  const ok = subject.trim().length >= 4 && body.trim().length >= 4;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="font-head text-[22px] font-bold">Get help</h3>
        <div className="text-[12.5px] text-slate">
          {open.length === 0 ? 'Nothing open' : `${open.length} open`}
        </div>
      </div>

      {note ? (
        <p className="rounded-[9px] border border-line bg-white px-3 py-2 text-[12.5px]">{note}</p>
      ) : null}

      <Card title="Tell us what is wrong">
        <form
          className="grid gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setNote(null);
            raise.mutate();
          }}
        >
          <label className="block">
            <Label>What is happening</Label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Parent cannot see the bus"
              className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
            />
          </label>

          <label className="block">
            <Label>Anything that would help us</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Her mother says the app shows &ldquo;waiting for bus to start&rdquo; but the bus already crossed her stop. Class 6B."
              className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <Label>Is it about one child?</Label>
              <select
                value={childId}
                onChange={(e) => setChildId(e.target.value)}
                className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
              >
                <option value="">Not about a particular child</option>
                {(kids?.children ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.className ? ` · ${c.className}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-2 pb-2.5 text-[13.5px]">
              <input
                type="checkbox"
                checked={urgent}
                onChange={(e) => setUrgent(e.target.checked)}
              />
              A bus or a child is affected right now
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!ok || raise.isPending}
              className="rounded-[9px] bg-ink px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
            >
              {raise.isPending ? 'Sending…' : 'Send to BusMitra'}
            </button>
            <span className="text-[12px] leading-relaxed text-slate">
              Naming the child saves a round of questions — we can see their stop, whether
              they boarded, and whether notifications are blocked on the parent&rsquo;s phone.
            </span>
          </div>
        </form>
      </Card>

      <Card title="Your tickets">
        {tickets.length === 0 ? (
          <Empty>Nothing raised yet.</Empty>
        ) : (
          tickets.map((t) => (
            <div key={t.id} className="border-b border-line p-4 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12px] text-slate">#{t.number}</span>
                <b className="text-[14px]">{t.subject}</b>
                {t.priority === 'urgent' ? (
                  <span className="rounded-full bg-[#FBE4E1] px-2 py-0.5 text-[11px] font-bold text-[#A62A1B]">
                    Urgent
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    t.status === 'closed'
                      ? 'bg-paper text-slate'
                      : t.status === 'known_issue'
                        ? 'bg-[#FFF2D6] text-[#8A5B00]'
                        : 'bg-[#E7EDF6] text-[#2C4B78]'
                  }`}
                >
                  {t.status === 'known_issue' ? 'Known issue' : t.status}
                </span>
                <span className="ml-auto text-[11.5px] text-slate">
                  {new Date(t.created_at).toLocaleString('en-IN')}
                </span>
              </div>

              <p className="mt-1.5 text-[13px] leading-relaxed">{t.body}</p>
              {t.child_name ? (
                <p className="mt-1 text-[12px] text-slate">About {t.child_name}</p>
              ) : null}

              {t.replies.length === 0 ? (
                <p className="mt-2 text-[12px] text-slate">No reply yet.</p>
              ) : (
                t.replies.map((r, i) => (
                  <div key={i} className="mt-2 rounded-[9px] bg-paper px-3 py-2">
                    <div className="text-[11.5px] text-slate">
                      {r.author} · {new Date(r.at).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[13px]">{r.body}</div>
                  </div>
                ))
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="mb-1.5 block font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
      {children}
    </span>
  );
}
