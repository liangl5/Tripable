import { Link } from "react-router-dom";

export default function TripList({ trips }) {
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
        <Link
          key={trip.id}
          to={`/trips/${trip.id}`}
          className="rounded-3xl bg-white/90 p-6 shadow-card transition hover:-translate-y-1"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-ink">{trip.name}</h3>
            <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-slateblue">
              {trip.memberCount} members
            </span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            {trip.startDate} → {trip.endDate}
          </p>
        </Link>
      ))}
    </div>
  );
}
