import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import TripList from "../components/TripList.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";

export default function TripListPage() {
  const navigate = useNavigate();
  const session = useSession();
  const trips = useTripStore((state) => state.trips);
  const loadTrips = useTripStore((state) => state.loadTrips);
  const tripsLoading = useTripStore((state) => state.tripsLoading);
  const error = useTripStore((state) => state.error);
  const currentUserId = session?.user?.id;
  const [selectionMode, setSelectionMode] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate("/auth");
      return;
    }

    loadTrips();
  }, [loadTrips, session, navigate]);

  const tripsWithOwnership = useMemo(
    () =>
      trips.map((trip) => ({
        ...trip,
        createdById: trip.createdById === currentUserId ? trip.createdById : null
      })),
    [currentUserId, trips]
  );


  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="mx-auto flex max-w-6xl flex-col px-6 py-12">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-ink">My Trips</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/" className="rounded-full bg-white/80 px-5 py-3 text-sm font-semibold text-ink shadow-card">
              Home
            </Link>
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
              className="inline-flex items-center gap-2 rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-card"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              Create new trip
            </Link>
          </div>
        </header>

        {tripsLoading ? <p className="text-sm">Loading trips...</p> : null}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <TripList trips={tripsWithOwnership} selectionMode={selectionMode} />
      </div>
    </div>
  );
}
