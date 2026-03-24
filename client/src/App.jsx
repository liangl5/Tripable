import { Suspense, lazy, useCallback, useEffect, useState, createContext, useContext } from "react";
import { Routes, Route } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { AuthStatus } from "./components/AuthStatus";
import { ensureUserProfile } from "./lib/userProfile.js";

const HomePage = lazy(() => import("./pages/HomePage.jsx"));
const TripListPage = lazy(() => import("./pages/TripListPage.jsx"));
const CreateTripPage = lazy(() => import("./pages/CreateTripPage.jsx"));
const TripDashboardPage = lazy(() => import("./pages/TripDashboardPage.jsx"));
const TripInvitePage = lazy(() => import("./pages/TripInvitePage.jsx"));
const ItineraryPage = lazy(() => import("./pages/ItineraryPage.jsx"));

export const SessionContext = createContext(null);
export function useSession() {
  return useContext(SessionContext);
}

export const UserProfileContext = createContext({
  profile: null,
  profileLoading: false,
  profileError: null,
  refreshProfile: async () => null
});
export function useUserProfile() {
  return useContext(UserProfileContext);
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = useCallback(async (nextSession = session) => {
    if (!nextSession) {
      setProfile(null);
      setProfileError(null);
      return null;
    }

    setProfileLoading(true);
    setProfileError(null);
    try {
      const ensured = await ensureUserProfile(nextSession);
      setProfile(ensured);
      return ensured;
    } catch (error) {
      setProfileError(error?.message || "Failed to load profile.");
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setProfileError(null);
      return;
    }

    refreshProfile(session);
  }, [refreshProfile, session]);

  if (loading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12 text-sm text-slate-500">
        Loading...
      </div>
    );
  }

  return (
    <SessionContext.Provider value={session}>
      <UserProfileContext.Provider value={{ profile, profileLoading, profileError, refreshProfile }}>
        <div className="app-shell min-h-screen">
          <Suspense
            fallback={
              <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12 text-sm text-slate-500">
                Loading...
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/auth" element={<AuthStatus />} />
              <Route path="/trips" element={<TripListPage />} />
              <Route path="/trips/new" element={<CreateTripPage />} />
              <Route path="/trips/:tripId/invite" element={<TripInvitePage />} />
              <Route path="/trips/:tripId/itinerary" element={<ItineraryPage />} />
              <Route path="/trips/:tripId" element={<TripDashboardPage />} />
            </Routes>
          </Suspense>
        </div>
      </UserProfileContext.Provider>
    </SessionContext.Provider>
  );
}
