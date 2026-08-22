import { useState } from 'react';
import { api } from '../lib/api';

/**
 * Nominatim returns the full postal hierarchy — "Hennur Cross, Kalyan Nagar,
 * Bengaluru East, Bengaluru Urban, Karnataka, 560043, India" — which is useful
 * for telling two results apart and useless as a stop name. The first two parts
 * are what a driver would actually call the place.
 */
export function shortPlace(displayName: string): string {
  return displayName.split(',').slice(0, 2).join(',').trim();
}

/**
 * Find a place by name instead of hunting for it on the map.
 *
 * Placing twenty stops by panning is the slowest part of setting up a school,
 * and a clerk who cannot find a junction drops the pin approximately — after
 * which every arrival notification on that route is approximately right.
 *
 * The map still takes a click. This narrows down where to click; it does not
 * replace the click, because the exact side of the road a bus pulls in on is
 * something the school knows and a geocoder does not.
 */
export function PlaceSearch({
  onPick,
}: {
  onPick: (place: { name: string; lat: number; lng: number }) => void;
}): React.ReactElement {
  const [q, setQ] = useState('');
  const [places, setPlaces] = useState<{ name: string; lat: number; lng: number }[]>([]);
  const [state, setState] = useState<'idle' | 'searching' | 'empty' | 'down'>('idle');

  const search = async (): Promise<void> => {
    if (q.trim().length < 3) return;
    setState('searching');
    try {
      const res = await api.geocode(q.trim());
      setPlaces(res.places);
      setState(res.unavailable ? 'down' : res.places.length === 0 ? 'empty' : 'idle');
    } catch {
      setState('down');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Search a place — Hennur Cross, Surathkal, Kadri Temple"
          className="w-full rounded-[9px] border border-line px-3 py-2 text-[14px]"
        />
        <button
          type="button"
          onClick={() => void search()}
          disabled={q.trim().length < 3 || state === 'searching'}
          className="rounded-[9px] bg-ink px-4 py-2 text-[13.5px] font-bold text-white disabled:opacity-60"
        >
          {state === 'searching' ? 'Searching…' : 'Search'}
        </button>
      </div>

      {state === 'empty' ? (
        <p className="text-[12px] text-slate">
          Nothing found. Try the nearest landmark or junction, then fine-tune by clicking the map.
        </p>
      ) : null}
      {state === 'down' ? (
        <p className="text-[12px] text-slate">
          Search is unavailable right now. Clicking the map still works.
        </p>
      ) : null}

      {places.length > 0 ? (
        <ul className="max-h-40 overflow-auto rounded-[9px] border border-line bg-white">
          {places.map((p, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                  setPlaces([]);
                  setQ('');
                }}
                className="block w-full border-b border-line px-3 py-2 text-left text-[12.5px] last:border-0 hover:bg-paper"
              >
                <b className="font-semibold">{shortPlace(p.name)}</b>
                <span className="block truncate text-[11.5px] text-slate">{p.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
