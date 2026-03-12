import { Link } from "react-router-dom";
import { formatDateRange } from "../lib/timeFormat.js";

export default function TripList({ trips, onDeleteTrip, deletingTripId }) {
  if (!trips.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <p className="text-lg font-semibold">No trips yet</p>
        <p className="mt-2 text-sm text-slate-500">Create a trip to start collaborating.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {trips.map((trip) => (
        <div key={trip.id} className="rounded-3xl bg-white/90 p-6 shadow-card">
          <Link to={`/trips/${trip.id}`} className="block transition hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-ink">{trip.name}</h3>
              <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-slateblue">
                {trip.memberCount} members
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500">
              {trip.startDate && trip.endDate ? formatDateRange(trip.startDate, trip.endDate) : "Dates TBD"}
            </p>
          </Link>

          {trip.createdById ? (
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4C6FFF]">Owner</span>
              <button
                type="button"
                onClick={() => onDeleteTrip?.(trip.id)}
                disabled={deletingTripId === trip.id}
                className="rounded-full bg-[#F56565] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              >
                {deletingTripId === trip.id ? "Deleting..." : "Delete trip"}
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
