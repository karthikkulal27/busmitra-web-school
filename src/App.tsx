import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { useSession } from './lib/session';
import { Alerts } from './screens/Alerts';
import { Boarding } from './screens/Boarding';
import { Children } from './screens/Children';
import { Home } from './screens/Home';
import { Live } from './screens/Live';
import { Messages } from './screens/Messages';
import { Principal } from './screens/Principal';
import { Reports } from './screens/Reports';
import { RoutesScreen } from './screens/Routes';
import { Settings } from './screens/Settings';
import { SignIn } from './screens/SignIn';
import { Staff } from './screens/Staff';
import { TripDetail } from './screens/TripDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // The morning is two hours long and the clerk never leaves the tab.
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App(): React.ReactElement {
  const session = useSession((s) => s.session);
  // A principal signs in to their own screen, not the clerk's control room.
  const landing = session?.staff.role === 'principal' ? '/principal' : '/';

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {session ? (
          <Routes>
            <Route element={<Shell />}>
              <Route
                path="/"
                element={landing === '/' ? <Home /> : <Navigate to={landing} replace />}
              />
              <Route path="/live" element={<Live />} />
              <Route path="/boarding" element={<Boarding />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/children" element={<Children />} />
              <Route path="/routes" element={<RoutesScreen />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/staff" element={<Staff />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/trips/:tripId" element={<TripDetail />} />
            </Route>
            {/* SA-13 sits outside the shell: it is one screen with no nav,
                built to open on a principal's phone. */}
            <Route path="/principal" element={<Principal />} />
            <Route path="*" element={<Navigate to={landing} replace />} />
          </Routes>
        ) : (
          <SignIn />
        )}
      </BrowserRouter>
    </QueryClientProvider>
  );
}
