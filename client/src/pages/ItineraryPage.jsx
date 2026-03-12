import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import ItineraryView from "../components/ItineraryView.jsx";
import { useTripStore } from "../hooks/useTripStore.js";

export default function ItineraryPage() {
  const { tripId } = useParams();
  const itinerary = useTripStore((state) => state.itinerary);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const loadItinerary = useTripStore((state) => state.loadItinerary);
  const loadTrip = useTripStore((state) => state.loadTrip);
  const tripLoading = useTripStore((state) => state.tripLoading);
  const itineraryLoading = useTripStore((state) => state.itineraryLoading);
  const error = useTripStore((state) => state.error);

  useEffect(() => {
    if (!tripId) return;
    loadTrip(tripId);
    loadItinerary(tripId);
  }, [tripId, loadTrip, loadItinerary]);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link to={`/trips/${tripId}`} className="text-sm text-slate-500">
        ← Back to dashboard
      </Link>
      <header className="mt-6 rounded-3xl bg-white/95 p-8 shadow-card">
        <p className="text-sm font-semibold text-slate-500">Generated itinerary</p>
        <h1 className="text-3xl font-semibold text-ink">{currentTrip?.name}</h1>
      </header>

      <div className="mt-8">
        {tripLoading || itineraryLoading ? <p className="text-sm">Loading itinerary...</p> : null}
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <ItineraryView itinerary={itinerary} />
      </div>
    </div>
  );
}
