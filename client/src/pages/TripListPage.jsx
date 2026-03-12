import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import TripList from "../components/TripList.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { getCurrentUserId } from "../lib/api.js";

export default function TripListPage() {
  const trips = useTripStore((state) => state.trips);
  const loadTrips = useTripStore((state) => state.loadTrips);
  const deleteTrip = useTripStore((state) => state.deleteTrip);
  const tripsLoading = useTripStore((state) => state.tripsLoading);
  const deleteTripLoading = useTripStore((state) => state.deleteTripLoading);
  const error = useTripStore((state) => state.error);
  const [deletingTripId, setDeletingTripId] = useState(null);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const currentUserId = getCurrentUserId();
  const tripsWithOwnership = useMemo(
    () =>
      trips.map((trip) => ({
        ...trip,
        createdById: trip.createdById === currentUserId ? trip.createdById : null
      })),
    [currentUserId, trips]
  );

  const handleDeleteTrip = async (tripId) => {
    const confirmed = window.confirm("Delete this trip? This cannot be undone.");
    if (!confirmed) return;
    setDeletingTripId(tripId);
    try {
      await deleteTrip(tripId);
    } finally {
      setDeletingTripId(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Tripute</p>
          <h1 className="text-3xl font-semibold text-ink">Your trips</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/" className="rounded-full bg-white/80 px-5 py-3 text-sm font-semibold text-ink shadow-card">
            Home
          </Link>
          <Link
            to="/trips/new"
            className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-card"
          >
            Create new trip
          </Link>
        </div>
      </header>

      {tripsLoading ? <p className="text-sm">Loading trips...</p> : null}
      {error ? <p className="text-sm text-coral">{error}</p> : null}
      <TripList
        trips={tripsWithOwnership}
        onDeleteTrip={handleDeleteTrip}
        deletingTripId={deleteTripLoading ? deletingTripId : null}
      />
    </div>
  );
}
