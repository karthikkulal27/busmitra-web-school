import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FleetMap } from '../components/FleetMap';
import { Empty, Plate, StatusPill } from '../components/ui';
import { api } from '../lib/api';
import { ageSeconds, useFleet } from '../lib/fleet';

/** SA-03 — full-bleed map with the bus list. Click a bus to open SA-04. */
export function Live(): React.ReactElement {
  const navigate = useNavigate();
  const fixes = useFleet((s) => s.fixes);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['buses'],
    queryFn: () => api.buses(),
    refetchInterval: 30_000,
  });

  const all = data?.buses ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (b) =>
        b.plate.toLowerCase().includes(q) ||
        (b.routeName ?? '').toLowerCase().includes(q) ||
        (b.driverName ?? '').toLowerCase().includes(q),
    );
  }, [all, query]);

  const mapBuses = useMemo(
    () => filtered.map((b) => ({ busId: b.busId, plate: b.plate })),
    [filtered],
  );

  return (
    <div className="grid h-full grid-cols-[280px_1fr]">
      <div className="flex min-h-0 flex-col border-r border-line bg-white">
        <div className="border-b border-line p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bus, route or driver"
            className="w-full rounded-[9px] border border-line px-3 py-2 text-[12.5px] outline-none focus:border-ink"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <Empty>Loading…</Empty>
          ) : filtered.length === 0 ? (
            <Empty>No buses match.</Empty>
          ) : (
            filtered.map((b) => {
              const fix = fixes[b.busId] ?? b.live;
              const age = ageSeconds(fix, now);
              const isSelected = selected === b.busId;
              return (
                <button
                  key={b.busId}
                  onClick={() => {
                    setSelected(b.busId);
                    if (b.tripId) navigate(`/trips/${b.tripId}`);
                  }}
                  className={`block w-full border-b border-line px-3.5 py-2.5 text-left hover:bg-paper ${
                    isSelected ? 'bg-paper' : ''
                  } ${b.status === 'lost' ? 'shadow-[inset_3px_0_0_var(--color-alert)]' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <Plate>{b.plate}</Plate>
                    <span className="ml-auto">
                      <StatusPill status={b.status} />
                    </span>
                  </div>
                  <div className="mt-1.5 text-[11.5px] text-slate">
                    {b.routeName ?? 'No trip running'}
                    {fix?.speed != null ? ` · ${Math.round(fix.speed * 3.6)} km/h` : ''}
                    {age !== null ? ` · ${age}s ago` : ''}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="min-h-0">
        {mapBuses.length > 0 ? (
          <FleetMap
            buses={mapBuses}
            followBusId={selected}
            onBusClick={(busId) => {
              const bus = all.find((b) => b.busId === busId);
              if (bus?.tripId) navigate(`/trips/${bus.tripId}`);
            }}
          />
        ) : (
          <Empty>No buses to show.</Empty>
        )}
      </div>
    </div>
  );
}
