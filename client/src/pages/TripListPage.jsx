import { useEffect } from "react";
import { Link } from "react-router-dom";
import TripList from "../components/TripList.jsx";
import { useTripStore } from "../hooks/useTripStore.js";

export default function TripListPage() {
  const { trips, loadTrips, loading, error } = useTripStore();

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Tripute</p>
          <h1 className="text-3xl font-semibold text-ink">Your trips</h1>
        </div>
        <Link
          to="/trips/new"
          className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-card"
        >
          Create new trip
        </Link>
      </header>

      {loading ? <p className="text-sm">Loading trips...</p> : null}
      {error ? <p className="text-sm text-coral">{error}</p> : null}
      <TripList trips={trips} />
    </div>
  );
}
