import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';
import { config } from '../config';
import { useSession } from './session';
import type { LiveFix } from './types';

export type Connection = 'connecting' | 'live' | 'offline';

interface FleetState {
  connection: Connection;
  /** busId -> newest fix. The console's whole live picture. */
  fixes: Record<string, LiveFix>;
  /** Bumped on every fix so map components can react without deep compares. */
  seq: number;
  /** Bumped when the worker raises an alert, so screens can refetch. */
  alertSeq: number;
  setConnection: (c: Connection) => void;
  apply: (fix: LiveFix) => void;
  reset: () => void;
}

export const useFleet = create<FleetState>((set) => ({
  connection: 'connecting',
  fixes: {},
  seq: 0,
  alertSeq: 0,
  setConnection: (connection) => set({ connection }),
  apply: (fix) =>
    set((s) => ({ fixes: { ...s.fixes, [fix.busId]: fix }, seq: s.seq + 1 })),
  reset: () => set({ fixes: {}, seq: 0, alertSeq: 0, connection: 'connecting' }),
}));

/**
 * One socket for the whole console, opened once and shared by every screen.
 *
 * The server fans a position out to `school:{id}`, so SA-02, SA-03 and SA-04 all
 * feed off this single subscription rather than each opening their own.
 */
export function useFleetSocket(): void {
  const token = useSession((s) => s.session?.token ?? null);

  useEffect(() => {
    if (!token) return;

    const { setConnection, apply, reset } = useFleet.getState();
    reset();

    const s: Socket = io(config.apiUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    });

    s.on('connect', () => {
      setConnection('live');
      // Rooms do not survive a reconnect, so re-subscribe every time. The
      // server replays each bus's last known position on subscribe.
      s.emit('school:subscribe', {});
    });
    s.on('disconnect', () => setConnection('offline'));
    s.on('connect_error', () => setConnection('offline'));
    s.on('location:update', (fix: LiveFix) => apply(fix));
    // The alert worker pushes into the school room as it raises things. The
    // console does not poll for these; it is told.
    s.on('alert:new', () => {
      useFleet.setState((prev) => ({ alertSeq: prev.alertSeq + 1 }));
    });

    return () => {
      s.close();
    };
  }, [token]);
}

/** Age of a fix in seconds, or null when there has never been one. */
export function ageSeconds(fix: LiveFix | null | undefined, now: number): number | null {
  if (!fix) return null;
  return Math.max(0, Math.round((now - Date.parse(fix.at)) / 1000));
}
