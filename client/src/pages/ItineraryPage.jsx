import { useEffect, useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import ItineraryView from "../components/ItineraryView.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { formatCurrency, getBudgetSummary } from "../lib/tripPlanning.js";
import { formatDateRange } from "../lib/timeFormat.js";

export default function ItineraryPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const itinerary = useTripStore((state) => state.itinerary);
  const currentTrip = useTripStore((state) => state.currentTrip);
  const loadItinerary = useTripStore((state) => state.loadItinerary);
  const loadTrip = useTripStore((state) => state.loadTrip);
  const tripLoading = useTripStore((state) => state.tripLoading);
  const itineraryLoading = useTripStore((state) => state.itineraryLoading);
  const error = useTripStore((state) => state.error);

  useEffect(() => {
    if (!session) {
      navigate("/auth");
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    const loadPage = async () => {
      try {
        const trip = await loadTrip(tripId);
        if (cancelled) return;

        if (!trip?.isViewerCreator && !trip?.isViewerMember) {
          navigate("/");
          return;
        }

        await loadItinerary(tripId);
      } catch (loadError) {
        console.error("Unable to load itinerary", loadError);
      }
    };

    loadPage();

    return () => {
      cancelled = true;
    };
  }, [tripId, loadTrip, loadItinerary, navigate]);

  const tripSummary = useMemo(() => getBudgetSummary(currentTrip), [currentTrip]);
  const totalStops = itinerary?.days?.reduce((sum, day) => sum + day.items.length, 0) || 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-center justify-end gap-4">
          <Link to={`/trips/${tripId}`} className="text-sm text-slate-500">
            {"<-"} Back to dashboard
          </Link>
        </div>

        <header className="mt-6 rounded-[32px] bg-white/95 p-8 shadow-card">
          <p className="text-sm font-semibold text-slate-500">Daily itinerary</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{currentTrip?.name}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {currentTrip?.destination ? (
              <span className="rounded-full bg-[#EEF2FF] px-3 py-2 text-xs font-semibold text-ocean">
                {currentTrip.destination.label}
              </span>
            ) : null}
            {currentTrip?.startDate && currentTrip?.endDate ? (
              <span className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-slate-500">
                {formatDateRange(currentTrip.startDate, currentTrip.endDate)}
              </span>
            ) : null}
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-white/95 p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Days planned</p>
            <p className="mt-3 text-2xl font-semibold text-ink">{itinerary?.days?.length || 0}</p>
          </div>
          <div className="rounded-3xl bg-white/95 p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Planned stops</p>
            <p className="mt-3 text-2xl font-semibold text-ink">{totalStops}</p>
          </div>
          <div className="rounded-3xl bg-white/95 p-5 shadow-card">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Budget remaining</p>
            <p className="mt-3 text-2xl font-semibold text-ink">{formatCurrency(tripSummary.remaining)}</p>
          </div>
        </section>

        <div className="mt-8">
          {tripLoading || itineraryLoading ? <p className="text-sm">Loading itinerary...</p> : null}
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <ItineraryView itinerary={itinerary} />
        </div>
      </div>
    </div>
  );
}
