import type { TripStatus } from '../lib/types';

/** Wording the clerk can act on, not jargon. */
const STATUS_LABEL: Record<TripStatus, string> = {
  running: 'Running',
  no_signal: 'No signal',
  lost: 'Lost',
  finished: 'Finished',
  not_started: 'Not started',
};

const STATUS_TONE: Record<TripStatus, string> = {
  running: 'bg-[#E1F4EC] text-[#0F7A50]',
  no_signal: 'bg-[#FFF2D6] text-[#8A5B00]',
  lost: 'bg-[#FBE4E1] text-[#A62A1B]',
  finished: 'bg-paper text-ink2',
  not_started: 'bg-paper text-slate',
};

export function StatusPill({ status }: { status: TripStatus }): React.ReactElement {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_TONE[status]}`}
    >
      <span className="block h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Plate({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <span className="inline-block rounded-[5px] bg-ink px-2 py-1 font-mono text-[12px] font-semibold text-white">
      {children}
    </span>
  );
}

export function Card({
  title,
  hint,
  action,
  children,
  bodyClass = '',
}: {
  title?: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClass?: string;
}): React.ReactElement {
  return (
    <section className="overflow-hidden rounded-[12px] border border-line bg-white">
      {title ? (
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h4 className="font-head text-[15px] font-bold">{title}</h4>
          {hint ? <span className="text-[11.5px] text-slate">{hint}</span> : null}
          {action ? <div className="ml-auto">{action}</div> : null}
        </header>
      ) : null}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Kpi({
  label,
  value,
  unit,
  detail,
  tone,
}: {
  label: string;
  value: string | number;
  unit?: string;
  detail?: string;
  tone?: 'alert' | 'live';
}): React.ReactElement {
  const colour = tone === 'alert' ? 'text-alert' : tone === 'live' ? 'text-live' : 'text-ink';
  return (
    <div className="rounded-[12px] border border-line bg-white p-4">
      <div className="font-head text-[10px] font-bold tracking-[0.14em] text-slate uppercase">
        {label}
      </div>
      <div className={`font-head text-[34px] leading-none font-bold ${colour} pt-2`}>
        {value}
        {unit ? <small className="pl-1 text-[15px] font-semibold text-slate">{unit}</small> : null}
      </div>
      <div className="pt-1.5 text-[12px] text-slate">{detail ?? ' '}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="px-4 py-10 text-center text-[13px] text-slate">{children}</div>;
}
