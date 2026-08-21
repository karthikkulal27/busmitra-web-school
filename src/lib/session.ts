import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from './types';

interface SessionState {
  session: Session | null;
  signIn: (session: Session) => void;
  signOut: () => void;
}

/**
 * The office shares one PC and leaves this open all morning, so the session
 * lives in localStorage rather than memory — a browser restart at 7:05 AM must
 * not cost the clerk an OTP round trip.
 */
export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      signIn: (session) => set({ session }),
      signOut: () => set({ session: null }),
    }),
    { name: 'busmitra.console.session' },
  ),
);

export const tokenOf = (): string | null => useSession.getState().session?.token ?? null;
