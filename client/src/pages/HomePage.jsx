import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
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
  const navigate = useNavigate();
  const hasLoadedTripsRef = useRef(false);
  const trips = useTripStore((state) => state.trips);
  const loadTrips = useTripStore((state) => state.loadTrips);
  const tripsLoading = useTripStore((state) => state.tripsLoading);
  const error = useTripStore((state) => state.error);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [pendingInvitesLoading, setPendingInvitesLoading] = useState(false);
  const [tripCards, setTripCards] = useState([]);

  const currentUserId = session?.user?.id;

  useEffect(() => {
    if (!session) {
      hasLoadedTripsRef.current = false;
      return;
    }

    if (!hasLoadedTripsRef.current) {
      hasLoadedTripsRef.current = true;
      loadTrips();
    }
  }, [session, loadTrips]);

  useEffect(() => {
    if (!session?.user?.email) {
      setPendingInvites([]);
      return;
    }

    const loadPendingInvites = async () => {
      setPendingInvitesLoading(true);
      try {
        const normalizedEmail = String(session.user.email || "").trim().toLowerCase();
        const { data: inviteRows, error: inviteError } = await supabase
          .from("PendingTripInvite")
          .select("id, tripId, role, createdAt")
          .ilike("email", normalizedEmail)
          .eq("status", "pending")
          .order("createdAt", { ascending: false });

        if (inviteError) {
          // Backwards compatibility if pending invite table is not deployed yet.
          if (String(inviteError.message || "").includes("PendingTripInvite")) {
            setPendingInvites([]);
            return;
          }
          throw inviteError;
        }

        const rows = inviteRows || [];
        if (!rows.length) {
          setPendingInvites([]);
          return;
        }

        const tripIds = rows.map((invite) => invite.tripId);
        const { data: tripRows, error: tripError } = await supabase
          .from("Trip")
          .select("id, name, createdById")
          .in("id", tripIds);
        if (tripError) throw tripError;

        const ownerIds = Array.from(
          new Set((tripRows || []).map((trip) => trip.createdById).filter(Boolean))
        );
        let ownerMap = new Map();
        if (ownerIds.length > 0) {
          const { data: ownerRows, error: ownerError } = await supabase
            .from("User")
            .select("id, name")
            .in("id", ownerIds);
          if (ownerError) throw ownerError;
          ownerMap = new Map((ownerRows || []).map((owner) => [owner.id, owner.name || "Trip owner"]));
        }

        const tripMap = new Map((tripRows || []).map((trip) => [trip.id, trip]));
        const invitesWithTripName = rows.map((invite) => ({
          ...invite,
          tripName: tripMap.get(invite.tripId)?.name || "Trip invitation",
          ownerName: ownerMap.get(tripMap.get(invite.tripId)?.createdById) || "Trip owner"
        }));
        setPendingInvites(invitesWithTripName);
      } catch (inviteLoadError) {
        console.error("Failed to load pending invites:", inviteLoadError);
        setPendingInvites([]);
      } finally {
        setPendingInvitesLoading(false);
      }
    };

    void loadPendingInvites();
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id || !trips.length) {
      setTripCards([]);
      return;
    }

    const loadTripCardMeta = async () => {
      try {
        const tripIds = trips.map((trip) => trip.id);
        const ownerIds = Array.from(new Set(trips.map((trip) => trip.createdById).filter(Boolean)));

        let ownerMap = new Map();
        let userMap = new Map();
        if (ownerIds.length > 0) {
          const { data: ownerRows, error: ownerError } = await supabase
            .from("User")
            .select("id, name")
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
            .select("id, name")
            .in("id", memberIds);
          if (memberUsersError) throw memberUsersError;
          userMap = new Map((memberUsers || []).map((user) => [user.id, user]));
        }

        let inviteRows = [];
        const { data: inviteData, error: inviteError } = await supabase
          .from("PendingTripInvite")
          .select("tripId, email")
          .in("tripId", tripIds)
          .eq("status", "pending");
        if (inviteError) {
          if (!String(inviteError.message || "").includes("PendingTripInvite")) {
            throw inviteError;
          }
        } else {
          inviteRows = inviteData || [];
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
            pushMember(row.tripId, { id: user.id, name: user.name || "Traveler", photoUrl: user.photoUrl });
          }
        });

        (inviteRows || []).forEach((invite) => {
          const email = String(invite.email || "").trim();
          if (!email) return;
          pushMember(invite.tripId, { id: `invite:${email}`, name: email, photoUrl: "" });
        });

        const { data: roleRows, error: roleError } = await supabase
          .from("UserTripRole")
          .select("tripId, role")
          .in("tripId", tripIds)
          .eq("userId", session.user.id);
        if (roleError) throw roleError;

        const roleMap = new Map((roleRows || []).map((row) => [row.tripId, row.role]));
        setTripCards(
          trips.map((trip) => {
            const isOwner = trip.createdById === session.user.id;
            const rawRole = isOwner ? "owner" : roleMap.get(trip.id) || "suggestor";
            const normalizedRole = rawRole === "owner" || rawRole === "editor" ? rawRole : "suggestor";
            const members = membersByTrip.get(trip.id) || [];
            const ownerUser = userMap.get(trip.createdById);
            const ownerMember = ownerUser
              ? { id: ownerUser.id, name: ownerMap.get(trip.createdById) || "Trip owner", photoUrl: ownerUser.photoUrl }
              : { id: trip.createdById, name: ownerMap.get(trip.createdById) || "Trip owner", photoUrl: "" };
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
            userRole: trip.createdById === session.user.id ? "owner" : "suggestor",
            canDelete: trip.createdById === session.user.id
          }))
        );
      }
    };

    void loadTripCardMeta();
  }, [session, trips]);


  // If user is NOT logged in, show marketing home page
  if (!session) {
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
      <div className="mx-auto flex max-w-6xl flex-col px-6 py-12">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-ink">My Trips</h1>
          </div>
          <Link
            to="/trips/new"
            className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-card hover:bg-blue-600"
          >
            Create new trip
          </Link>
        </header>

        {pendingInvitesLoading ? <p className="mb-4 text-sm text-slate-600">Checking pending invites...</p> : null}
        {pendingInvites.length > 0 ? (
          <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-ink">Pending invitations</h2>
            <p className="mt-1 text-sm text-slate-600">You have invites waiting for your response.</p>
            <div className="mt-4 grid gap-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{invite.tripName}</p>
                    <p className="text-xs text-slate-500">Owner: {invite.ownerName}</p>
                    <p className="text-xs text-slate-500">Role: {invite.role === "editor" ? "Editor" : "Suggestor"}</p>
                  </div>
                  <Link
                    to={`/trips/${invite.tripId}/invite`}
                    className="rounded-lg bg-ocean px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
                  >
                    Review invite
                  </Link>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tripsLoading && <p className="text-sm text-slate-600">Loading trips...</p>}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <TripList trips={tripCards.length ? tripCards : trips} />
      </div>
    </div>
  );
}
