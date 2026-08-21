import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, Empty } from '../components/ui';
import { api } from '../lib/api';

/**
 * SA-10 — send a message to parents.
 *
 * The prototype shows a cost estimate and an app/WhatsApp/SMS channel split.
 * There is one channel today, so the estimate is a real count against the real
 * per-message price rather than a mocked-up figure, and the channel breakdown
 * is absent until there is more than one.
 */
export function Messages(): React.ReactElement {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [wholeSchool, setWholeSchool] = useState(false);
  const [body, setBody] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const { data: routeData } = useQuery({ queryKey: ['routes'], queryFn: () => api.routes() });
  const { data: sent } = useQuery({
    queryKey: ['messages'],
    queryFn: () => api.messages(),
    refetchInterval: 30_000,
  });

  const routes = routeData?.routes ?? [];

  const audience = wholeSchool
    ? routes.reduce((n, r) => n + r.parents, 0)
    : routes.filter((r) => selected.includes(r.id)).reduce((n, r) => n + r.parents, 0);

  const send = useMutation({
    mutationFn: () => api.sendMessage({ routeIds: selected, wholeSchool, body }),
    onSuccess: (res) => {
      setResult(`Sent to ${res.sent} of ${res.recipients} parents.`);
      setBody('');
      setSelected([]);
      setWholeSchool(false);
      void queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
    onError: () => setResult('Could not send. Nothing was delivered.'),
  });

  const canSend = body.trim().length >= 5 && audience > 0 && !send.isPending;

  return (
    <div className="flex flex-col gap-4 p-5">
      <div>
        <h3 className="font-head text-[22px] font-bold">New message</h3>
        <div className="text-[12.5px] text-slate">Sent messages are logged permanently</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card title="Compose">
          <div className="p-4">
            <Label>Who gets this</Label>
            <div className="mb-4 flex flex-wrap gap-2">
              {routes.map((r) => {
                const on = !wholeSchool && selected.includes(r.id);
                return (
                  <button
                    key={r.id}
                    onClick={() =>
                      setSelected((prev) =>
                        prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id],
                      )
                    }
                    disabled={wholeSchool}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                      on ? 'bg-live text-white' : 'bg-paper text-ink2'
                    } disabled:opacity-50`}
                  >
                    {r.name} · {r.parents}
                  </button>
                );
              })}
              <button
                onClick={() => setWholeSchool((v) => !v)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                  wholeSchool ? 'bg-ink text-white' : 'bg-paper text-ink2'
                }`}
              >
                Whole school
              </button>
            </div>

            <Label>Message</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              maxLength={700}
              placeholder="Heavy rain in Surathkal. Route 3 will reach school about 20 minutes late today. Children are safe with the attendant."
              className="mb-1 w-full rounded-[9px] border border-line px-3 py-2.5 text-[13.5px] leading-relaxed outline-none focus:border-ink"
            />
            <div className="mb-4 text-right font-mono text-[11px] text-slate">
              {body.length} / 700
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => send.mutate()}
                disabled={!canSend}
                className="rounded-[9px] bg-ink px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {send.isPending ? 'Sending…' : `Send to ${audience} parent${audience === 1 ? '' : 's'}`}
              </button>
              <span className="text-[12px] text-slate">
                Estimated cost ₹{((audience * 115) / 1000).toFixed(2)} · WhatsApp utility
                templates are ₹0.115 each
              </span>
            </div>

            {result ? (
              <p className="mt-3 rounded-[9px] bg-paper px-3 py-2 text-[12.5px]">{result}</p>
            ) : null}
          </div>
        </Card>

        <Card title="How it will arrive" hint="Kannada first, English under it">
          <div className="p-4">
            <div className="rounded-[12px] bg-[#DCF8C6] px-3.5 py-3 text-[13px] leading-relaxed">
              <b className="mb-1 block text-[11.5px] text-[#0F7A50]">
                WhatsApp · Sharada Vidyalaya
              </b>
              {body.trim() || 'Your message appears here as the parent will see it.'}
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-slate">
              Transactional messages (boarded, not boarded, bus approaching, reached school) go
              out automatically from the roll call and the geofence. This screen is only for the
              things the office decides: rain, a strike, an early closing.
            </p>
          </div>
        </Card>
      </div>

      <Card title="Sent messages" hint="Newest first">
        {!sent || sent.messages.length === 0 ? (
          <Empty>Nothing sent yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  <Th>When</Th>
                  <Th>Message</Th>
                  <Th>By</Th>
                  <Th>Delivered</Th>
                </tr>
              </thead>
              <tbody>
                {sent.messages.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2.5 font-mono text-[12px] whitespace-nowrap">
                      {m.sentAt
                        ? new Date(m.sentAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                            timeZone: 'Asia/Kolkata',
                          })
                        : '—'}
                    </td>
                    <td className="max-w-[420px] px-4 py-2.5">{m.body}</td>
                    <td className="px-4 py-2.5 text-[12px]">{m.createdBy}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px]">
                      {m.sent} / {m.recipients}
                      {m.failed > 0 ? (
                        <span className="text-alert"> · {m.failed} failed</span>
                      ) : null}
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

function Label({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <label className="mb-1.5 block font-head text-[10px] font-bold tracking-[0.13em] text-slate uppercase">
      {children}
    </label>
  );
}

function Th({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <th className="px-4 py-2.5 font-head text-[10px] font-bold tracking-[0.12em] text-slate uppercase">
      {children}
    </th>
  );
}
