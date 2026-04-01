import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDateRange } from "../lib/timeFormat.js";

const ROLE_LABELS = {
  owner: "Owner",
  editor: "Editor",
  suggestor: "Suggestor"
};

export default function TripList({ trips, onDeleteTrip, deletingTripId }) {
  const [confirmTrip, setConfirmTrip] = useState(null);

  if (!trips.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <p className="text-lg font-semibold">No trips yet</p>
        <p className="mt-2 text-sm text-slate-500">Create a trip to start collaborating.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        {trips.map((trip) => (
          <div key={trip.id} className="rounded-3xl bg-white/90 p-6 shadow-card">
            <div className="flex items-start justify-between gap-4">
              <Link to={`/trips/${trip.id}`} className="block min-w-0 flex-1 transition hover:-translate-y-1">
                <h3 className="text-3xl font-semibold tracking-tight text-ink">
                  {trip.destination?.name || trip.destination?.label
                    ? `${trip.name} at ${trip.destination.name || trip.destination.label}`
                    : trip.name}
                </h3>
                {trip.startDate && trip.endDate ? (
                  <p className="mt-3 text-sm text-slate-500">{formatDateRange(trip.startDate, trip.endDate)}</p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-slate-600">
                    Owner: {trip.ownerDisplayName || "Trip owner"}
                  </span>
                  <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4C6FFF]">
                    {ROLE_LABELS[trip.userRole] || "Suggestor"}
                  </span>
                </div>
              </Link>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-slateblue">
                  {trip.memberCount} members
                </span>
                {trip.canDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmTrip({ id: trip.id, name: trip.name || "this trip" })}
                    disabled={deletingTripId === trip.id}
                    className="rounded-full bg-[#F56565] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {deletingTripId === trip.id ? "Deleting..." : "Delete trip"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {confirmTrip ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => {
            if (!deletingTripId) setConfirmTrip(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Delete trip?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete &quot;{confirmTrip.name}&quot;? This cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmTrip(null)}
                disabled={Boolean(deletingTripId)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDeleteTrip?.(confirmTrip.id);
                  setConfirmTrip(null);
                }}
                disabled={Boolean(deletingTripId)}
                className="rounded-xl bg-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
              >
                {deletingTripId === confirmTrip.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
