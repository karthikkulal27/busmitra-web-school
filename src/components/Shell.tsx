import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useFleet, useFleetSocket } from '../lib/fleet';
import { useSession } from '../lib/session';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/live', label: 'Live map', end: false },
  { to: '/alerts', label: 'Alerts', end: false },
  { to: '/boarding', label: 'Boarding log', end: false },
  { to: '/messages', label: 'Messages', end: false },
  { to: '/children', label: 'Children', end: false },
  { to: '/routes', label: 'Routes & stops', end: false },
  { to: '/reports', label: 'Reports', end: false },
  { to: '/staff', label: 'Drivers & staff', end: false },
  { to: '/settings', label: 'Settings', end: false },
];

export function Shell(): React.ReactElement {
  useFleetSocket();
  const session = useSession((s) => s.session);
  const signOut = useSession((s) => s.signOut);
  const connection = useFleet((s) => s.connection);

  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const initials = (session?.staff.name ?? '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="grid h-full grid-cols-[212px_1fr]">
      <aside className="flex flex-col border-r border-line bg-ink text-white">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="grid h-9 w-9 place-items-center rounded-[10px] bg-bus font-head text-[20px] font-bold text-ink">
            B
          </div>
          <div>
            <div className="font-head text-[15px] font-bold">BusMitra</div>
            <div className="text-[11px] text-[#93A3B8]">School console</div>
          </div>
        </div>
        <div className="chequer" />

        <nav className="flex flex-col gap-1 p-3">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `rounded-[9px] px-3 py-2 text-[13.5px] font-semibold transition-colors ${
                  isActive ? 'bg-ink2 text-white' : 'text-[#93A3B8] hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto p-3 text-[11px] text-[#63748C]">
          <div className="truncate">{session?.school.name}</div>
          <div className="font-mono">{session?.school.code}</div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-white px-5 py-3">
          <div className="min-w-0">
            <div className="truncate font-head text-[17px] font-bold">
              {session?.school.name}
            </div>
            <div className="font-mono text-[11.5px] text-slate">{session?.school.code}</div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <ConnectionChip connection={connection} />
            <div className="font-mono text-[12.5px] text-ink2">
              {clock.toLocaleTimeString('en-IN', { hour12: false, timeZone: 'Asia/Kolkata' })}
            </div>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-paper text-[11px] font-bold text-slate">
                {initials || '··'}
              </div>
              <div className="text-[12.5px]">
                <div className="font-semibold">{session?.staff.name}</div>
                <div className="text-[11px] text-slate capitalize">{session?.staff.role}</div>
              </div>
            </div>
            <button
              onClick={signOut}
              className="rounded-[9px] border border-line px-2.5 py-1.5 text-[12px] font-semibold text-ink2 hover:bg-paper"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ConnectionChip({
  connection,
}: {
  connection: 'connecting' | 'live' | 'offline';
}): React.ReactElement {
  const [label, tone] =
    connection === 'live'
      ? (['Live', 'bg-[#E1F4EC] text-[#0F7A50]'] as const)
      : connection === 'connecting'
        ? (['Connecting', 'bg-paper text-slate'] as const)
        : (['Reconnecting', 'bg-[#FBE4E1] text-[#A62A1B]'] as const);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}
    >
      <span className="block h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
