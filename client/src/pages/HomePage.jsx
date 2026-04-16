import { useEffect, useMemo, useRef, useState } from "react";
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
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";

export default function HomePage() {
  const session = useSession();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const hasLoadedTripsRef = useRef(false);
  const trips = useTripStore((state) => state.trips);
  const loadTrips = useTripStore((state) => state.loadTrips);
  const loadIdeas = useTripStore((state) => state.loadIdeas);
  const tripsLoading = useTripStore((state) => state.tripsLoading);
  const error = useTripStore((state) => state.error);
  const flashNotice = useTripStore((state) => state.flashNotice);
  const clearFlashNotice = useTripStore((state) => state.clearFlashNotice);
  const [tripCards, setTripCards] = useState([]);
  const [tripCardsLoading, setTripCardsLoading] = useState(false);
  const [activeTripTab, setActiveTripTab] = useState("all");
  const [starredTripIds, setStarredTripIds] = useState(() => new Set());
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
    if (!currentUserId) {
      setStarredTripIds(new Set());
      return;
    }

    try {
      const storedIds = window.localStorage.getItem(`tripable_starred_trips_${currentUserId}`);
      const parsedIds = storedIds ? JSON.parse(storedIds) : [];
      setStarredTripIds(new Set(Array.isArray(parsedIds) ? parsedIds.filter(Boolean) : []));
    } catch (error) {
      console.error("Failed to load starred trips", error);
      setStarredTripIds(new Set());
    }
  }, [currentUserId]);

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

  const filteredTrips = useMemo(() => {
    if (activeTripTab === "mine") {
      return tripCards.filter((trip) => trip.userRole === "owner");
    }

    if (activeTripTab === "starred") {
      return tripCards.filter((trip) => starredTripIds.has(trip.id));
    }

    if (activeTripTab === "shared") {
      return tripCards.filter((trip) => trip.userRole !== "owner");
    }

    return tripCards;
  }, [activeTripTab, starredTripIds, tripCards]);

  const starredStorageKey = currentUserId ? `tripable_starred_trips_${currentUserId}` : null;

  const toggleTripStar = (tripId) => {
    if (!tripId || !starredStorageKey) return;
    setStarredTripIds((current) => {
      const next = new Set(current);
      if (next.has(tripId)) {
        next.delete(tripId);
      } else {
        next.add(tripId);
      }
      window.localStorage.setItem(starredStorageKey, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const emptyStateTitle =
    activeTripTab === "mine"
      ? "No trips created by you yet"
      : activeTripTab === "starred"
      ? "No starred trips yet"
      : activeTripTab === "shared"
        ? "No shared trips yet"
        : "No trips yet";

  const emptyStateDescription =
    activeTripTab === "mine"
      ? "Create a new trip to start planning."
      : activeTripTab === "starred"
      ? "Star trips from the cards to save them here."
      : activeTripTab === "shared"
        ? "Trips shared with you will show up here."
        : "Create a trip to start collaborating.";

  const handleTripCardClick = async (tripId) => {
    if (!tripId || !currentUserId) return;
    setTripNavigationLoading(true);
    setNavigationProgress(15);

    try {
      const { data: tripData, error: tripError } = await supabase
        .from("Trip")
        .select("*")
        .eq("id", tripId)
        .single();

      if (tripError || !tripData) throw tripError || new Error("Trip not found");
      setNavigationProgress(35);

      const [
        { data: memberRelations, error: memberRelationsError },
        { data: roleRows, error: roleRowsError },
        pendingInviteResult
      ] = await Promise.all([
        supabase
          .from("TripMember")
          .select("userId")
          .eq("tripId", tripId),
        supabase
          .from("UserTripRole")
          .select("userId, role")
          .eq("tripId", tripId),
        supabase
          .from("PendingTripInvite")
          .select("id, email, role, status, createdAt")
          .eq("tripId", tripId)
          .eq("status", "pending")
          .order("createdAt", { ascending: false })
      ]);

      if (memberRelationsError) throw memberRelationsError;
      if (roleRowsError) throw roleRowsError;

      const memberIds = Array.from(
        new Set([tripData.createdById, ...(memberRelations || []).map((member) => member.userId)].filter(Boolean))
      );

      let membersData = [];
      if (memberIds.length) {
        const { data, error: membersError } = await supabase
          .from("User")
          .select("id, name, email")
          .in("id", memberIds);
        if (membersError) throw membersError;
        membersData = data || [];
      }

      const roleMap = {};
      (roleRows || []).forEach((row) => {
        roleMap[row.userId] = row.userId === tripData.createdById
          ? "owner"
          : row.role === "editor"
            ? "editor"
            : "suggestor";
      });
      roleMap[tripData.createdById] = "owner";
      const derivedRole = tripData.createdById === currentUserId
        ? "owner"
        : roleMap[currentUserId] || "suggestor";

      let pendingInvites = [];
      if (pendingInviteResult.error) {
        if (!String(pendingInviteResult.error.message || "").includes("PendingTripInvite")) {
          throw pendingInviteResult.error;
        }
      } else {
        pendingInvites = pendingInviteResult.data || [];
      }

      setNavigationProgress(70);
      await loadIdeas(tripId);
      setNavigationProgress(100);
      await new Promise((resolve) => requestAnimationFrame(() => resolve()));
      await new Promise((resolve) => setTimeout(resolve, 140));

      navigate(`/trips/${tripId}`, {
        state: {
          prefetchedTripData: {
            trip: tripData,
            tripMembers: membersData,
            memberRoles: roleMap,
            userRole: derivedRole,
            existingPendingInvites: pendingInvites
          }
        }
      });
    } catch (error) {
      console.error("Failed to navigate to trip", error);
    } finally {
      setTripNavigationLoading(false);
      setNavigationProgress(0);
    }
  };

  // If user is NOT logged in, show marketing home page
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-[#ecf5e9]">
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
    <div className="flex h-screen flex-col overflow-hidden bg-[#ecf5e9]">
      <Header />
      {tripNavigationLoading ? (
        <div className="h-1.5 w-full overflow-hidden bg-slate-200">
          <div
            className="h-full bg-gradient-to-r from-[#fcae4e] to-[#f7942e] transition-all"
            style={{ width: `${navigationProgress}%` }}
          />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="w-full bg-[#f4f7f2] lg:h-full lg:w-72">
          <div className="px-6 pb-6 pt-10">
          <Link
            to="/trips/new"
            className="inline-flex w-fit -ml-1 items-center justify-start gap-2 rounded-2xl bg-[#1e4840] px-5 py-4 text-base font-bold text-white shadow-card hover:bg-[#152f2a]"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            Create new trip
          </Link>

          <div className="ml-[-24px] mt-5 w-[calc(100%+24px)]">
            {[
              { id: "all", label: "All trips" },
              { id: "mine", label: "My trips" },
              { id: "shared", label: "Shared with me" },
              { id: "starred", label: "Starred" }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTripTab(tab.id)}
                className={`flex w-full items-center justify-between rounded-r-full rounded-l-none pl-0 pr-6 py-2 text-left text-base font-semibold transition ${
                  activeTripTab === tab.id
                    ? "bg-[#baf59c] text-[#1e4840] shadow-card"
                    : "text-[#1e4840] hover:bg-gray-200"
                }`}
              >
                <span className="flex items-center gap-2 pl-[34px]">
                  {tab.id === "all" ? (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 6h16" />
                      <path d="M4 12h16" />
                      <path d="M4 18h16" />
                    </svg>
                  ) : null}
                  {tab.id === "mine" ? (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M5 20c1.5-3 4-5 7-5s5.5 2 7 5" />
                    </svg>
                  ) : null}
                  {tab.id === "shared" ? (
                    <PeopleAltIcon sx={{ fontSize: 24 }} />
                  ) : null}
                  {tab.id === "starred" ? (
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z" />
                    </svg>
                  ) : null}
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto px-6 py-10">
          <div className="mx-auto w-full max-w-6xl">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-3xl font-semibold text-[#1e4840]">
              {activeTripTab === "mine"
                ? "My trips"
                : activeTripTab === "starred"
                  ? "Starred trips"
                  : activeTripTab === "shared"
                    ? "Shared with me"
                    : "All trips"}
            </h2>
            <button
              type="button"
              onClick={() => setSelectionMode((current) => !current)}
              className="rounded-full border border-transparent bg-white px-5 py-3 text-sm font-semibold text-[#1e4840] hover:border-[#1e4840] hover:text-[#1e4840] disabled:opacity-60"
              disabled={!filteredTrips.length}
            >
              {selectionMode ? "Done" : "Select"}
            </button>
          </header>

          {tripsLoading || tripCardsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={`trip-skeleton-${index}`}
                  className="overflow-hidden rounded-3xl bg-white/90"
                >
                  <div className="h-40 animate-pulse bg-slate-200" />
                  <div className="flex flex-col gap-4 px-6 pt-8 pb-3">
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
              trips={filteredTrips}
              selectionMode={selectionMode}
              onCardClick={handleTripCardClick}
              starredTripIds={starredTripIds}
              onToggleStar={toggleTripStar}
              emptyStateTitle={emptyStateTitle}
              emptyStateDescription={emptyStateDescription}
            />
          ) : null}
          </div>
        </main>
      </div>
      {flashNotice ? (
        <div className="fixed bottom-4 right-6 z-[80] inline-flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
          <span>
            {flashNotice.kind === "trip_deleted"
              ? flashNotice.message || `“${flashNotice.name || "Trip"}” deleted`
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
