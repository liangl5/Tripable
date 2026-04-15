import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession, useUserProfile } from "../App";
import { supabase } from "../lib/supabase.js";
import Header from "../components/Header.jsx";
import TripList from "../components/TripList.jsx";
import Hero from "../components/Hero.jsx";
import Testimonials from "../components/Testimonials.jsx";
import Features from "../components/Features.jsx";
import Demo from "../components/Demo.jsx";
import CTA from "../components/CTA.jsx";
import Footer from "../components/Footer.jsx";

export default function HomePage() {
  const session = useSession();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const hasLoadedTripsRef = useRef(false);
  const trips = useTripStore((state) => state.trips);
  const loadTrips = useTripStore((state) => state.loadTrips);
  const tripsLoading = useTripStore((state) => state.tripsLoading);
  const error = useTripStore((state) => state.error);
  const flashNotice = useTripStore((state) => state.flashNotice);
  const clearFlashNotice = useTripStore((state) => state.clearFlashNotice);
  const [tripCards, setTripCards] = useState([]);
  const [tripCardsLoading, setTripCardsLoading] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [localSession, setLocalSession] = useState(null);
  const [tripNavigationLoading, setTripNavigationLoading] = useState(false);
  const [navigationProgress, setNavigationProgress] = useState(0);

  const effectiveSession = session || localSession;
  const currentUserId = effectiveSession?.user?.id;

  useEffect(() => {
    if (!effectiveSession) {
      hasLoadedTripsRef.current = false;
      return;
    }

    if (!hasLoadedTripsRef.current) {
      hasLoadedTripsRef.current = true;
      loadTrips();
    }
  }, [effectiveSession, loadTrips]);

  useEffect(() => {
    let active = true;
    const resolveSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data?.session) {
          setLocalSession(data.session);
          setSessionLoading(false);
          return;
        }
      } catch (error) {
        console.error("Failed to check session", error);
      }
      if (active) {
        setSessionLoading(false);
      }
    };
    resolveSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (session) {
      setSessionLoading(false);
      setLocalSession(session);
      return;
    }
    setLocalSession(null);
  }, [session]);

  useEffect(() => {
    if (!effectiveSession?.user?.id || !trips.length) {
      setTripCards([]);
      return;
    }

    const loadTripCardMeta = async () => {
      setTripCardsLoading(true);
      try {
        const tripIds = trips.map((trip) => trip.id);
        const ownerIds = Array.from(new Set(trips.map((trip) => trip.createdById).filter(Boolean)));

        let ownerMap = new Map();
        let userMap = new Map();
        if (ownerIds.length > 0) {
          const { data: ownerRows, error: ownerError } = await supabase
          .from("User")
          .select("id, name, avatarColor")
            .in("id", ownerIds);
          if (ownerError) throw ownerError;
          ownerMap = new Map((ownerRows || []).map((owner) => [owner.id, owner.name || "Trip owner"]));
          userMap = new Map((ownerRows || []).map((owner) => [owner.id, owner]));
        }

        const { data: memberRows, error: memberError } = await supabase
          .from("TripMember")
          .select("tripId, userId")
          .in("tripId", tripIds);
        if (memberError) throw memberError;

        const memberIds = Array.from(
          new Set([...(memberRows || []).map((row) => row.userId), ...ownerIds].filter(Boolean))
        );

        if (memberIds.length > 0) {
          const { data: memberUsers, error: memberUsersError } = await supabase
            .from("User")
            .select("id, name, avatarColor")
            .in("id", memberIds);
          if (memberUsersError) throw memberUsersError;
          userMap = new Map((memberUsers || []).map((user) => [user.id, user]));
        }

        const membersByTrip = new Map();
        const pushMember = (tripId, member) => {
          if (!tripId || !member) return;
          const existing = membersByTrip.get(tripId) || [];
          if (!existing.some((item) => item.id === member.id)) {
            existing.push(member);
          }
          membersByTrip.set(tripId, existing);
        };

        (memberRows || []).forEach((row) => {
          const user = userMap.get(row.userId);
          if (user) {
            pushMember(row.tripId, {
              id: user.id,
              name: user.name || "Traveler",
              avatarColor: user.avatarColor
            });
          }
        });

        const { data: roleRows, error: roleError } = await supabase
          .from("UserTripRole")
          .select("tripId, role")
          .in("tripId", tripIds)
          .eq("userId", effectiveSession.user.id);
        if (roleError) throw roleError;

        const roleMap = new Map((roleRows || []).map((row) => [row.tripId, row.role]));
        setTripCards(
          trips.map((trip) => {
            const isOwner = trip.createdById === effectiveSession.user.id;
            const rawRole = isOwner ? "owner" : roleMap.get(trip.id) || "suggestor";
            const normalizedRole = rawRole === "owner" || rawRole === "editor" ? rawRole : "suggestor";
            const members = membersByTrip.get(trip.id) || [];
            const ownerUser = userMap.get(trip.createdById);
            const ownerMember = ownerUser
              ? {
                  id: ownerUser.id,
                  name: ownerMap.get(trip.createdById) || "Trip owner",
                  avatarColor: ownerUser.avatarColor
                }
              : {
                  id: trip.createdById,
                  name: ownerMap.get(trip.createdById) || "Trip owner",
                  avatarColor: ""
                };
            const uniqueMembers = [ownerMember, ...members].reduce((acc, member) => {
              if (!member?.id) return acc;
              if (!acc.some((item) => item.id === member.id)) acc.push(member);
              return acc;
            }, []);

            return {
              ...trip,
              ownerDisplayName: ownerMap.get(trip.createdById) || "Trip owner",
              userRole: normalizedRole,
              canDelete: isOwner,
              members: uniqueMembers
            };
          })
        );
      } catch (metaError) {
        console.error("Failed to load trip card metadata:", metaError);
        setTripCards(
          trips.map((trip) => ({
            ...trip,
            ownerDisplayName: "Trip owner",
            userRole: trip.createdById === effectiveSession.user.id ? "owner" : "suggestor",
            canDelete: trip.createdById === effectiveSession.user.id
          }))
        );
      } finally {
        setTripCardsLoading(false);
      }
    };

    void loadTripCardMeta();
  }, [effectiveSession, trips, profile?.avatarColor]);

  useEffect(() => {
    if (!flashNotice) return undefined;
    const timer = setTimeout(() => clearFlashNotice(), 10000);
    return () => clearTimeout(timer);
  }, [flashNotice, clearFlashNotice]);

  const handleTripCardClick = async (tripId) => {
    if (!tripId) return;
    setTripNavigationLoading(true);
    setNavigationProgress(30);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      setNavigationProgress(60);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      setNavigationProgress(90);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      setNavigationProgress(100);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      navigate(`/trips/${tripId}`);
    } catch (error) {
      console.error("Failed to navigate to trip", error);
      setTripNavigationLoading(false);
    }
  };

  // If user is NOT logged in, show marketing home page
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
      </div>
    );
  }

  if (!effectiveSession) {
    return (
      <div className="min-h-screen">
        <Header />
        <main>
          <Hero />
          <Testimonials />
          <Features />
          <Demo />
          <CTA />
        </main>
        <Footer />
      </div>
    );
  }

  // If user IS logged in, show trip dashboard
  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      {tripNavigationLoading ? (
        <div className="h-1 w-full overflow-hidden bg-slate-200">
          <div
            className="h-full bg-gradient-to-r from-ocean to-blue-500 transition-all"
            style={{ width: `${navigationProgress}%` }}
          />
        </div>
      ) : null}
      <div className="mx-auto flex max-w-6xl flex-col px-6 py-12">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-ink">My Trips</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectionMode((current) => !current)}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-ink shadow-card hover:border-ocean hover:text-ocean disabled:opacity-60"
              disabled={!trips.length}
            >
              {selectionMode ? "Done" : "Select"}
            </button>
            <Link
              to="/trips/new"
              className="inline-flex items-center gap-2 rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-card hover:bg-blue-600"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Create new trip
            </Link>
          </div>
        </header>

        {tripsLoading || tripCardsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={`trip-skeleton-${index}`}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white/90"
              >
                <div className="h-40 animate-pulse bg-slate-200" />
                <div className="space-y-4 p-6">
                  <div className="space-y-2">
                    <div className="h-6 w-3/4 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                    <div className="flex items-center -space-x-2">
                      <div className="h-9 w-9 animate-pulse rounded-full border border-white bg-slate-200" />
                      <div className="h-9 w-9 animate-pulse rounded-full border border-white bg-slate-200" />
                      <div className="h-9 w-9 animate-pulse rounded-full border border-white bg-slate-200" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        {!tripsLoading && !tripCardsLoading ? (
          <TripList
            trips={tripCards.length ? tripCards : trips}
            selectionMode={selectionMode}
            onCardClick={handleTripCardClick}
          />
        ) : null}
      </div>
      {flashNotice ? (
        <div className="fixed bottom-4 right-6 z-[80] inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
          <span>
            {flashNotice.kind === "trip_deleted"
              ? `“${flashNotice.name || "Trip"}” deleted`
              : flashNotice.kind === "trip_copied"
                ? `Copy of “${flashNotice.name || "Trip"}” created`
                : flashNotice.message || "Done"}
          </span>
          <button
            type="button"
            className="ml-auto text-white/70 hover:text-white"
            onClick={() => clearFlashNotice()}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ) : null}
    </div>
  );
}
