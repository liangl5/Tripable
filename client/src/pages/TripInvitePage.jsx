import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import TripableLogoLink from "../components/TripableLogoLink.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { formatDateRange } from "../lib/timeFormat.js";

export default function TripInvitePage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const [searchParams] = useSearchParams();
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  const loadTrip = useTripStore((state) => state.loadTrip);
  const joinTrip = useTripStore((state) => state.joinTrip);

  // If user is not logged in, redirect to auth with return URL
  useEffect(() => {
    if (!session) {
      const returnUrl = `/trips/${tripId}/invite`;
      navigate(`/auth?return=${encodeURIComponent(returnUrl)}`);
    }
  }, [session, tripId, navigate]);

  // Load trip details
  useEffect(() => {
    if (!session || !tripId) return;

    const loadTripData = async () => {
      setLoading(true);
      try {
        const trip = await loadTrip(tripId);
        setTripData(trip);
      } catch (err) {
        setError(err.message || "Failed to load trip");
      } finally {
        setLoading(false);
      }
    };

    loadTripData();
  }, [tripId, session, loadTrip]);

  const handleAccept = async () => {
    if (!tripId) return;
    try {
      setLoading(true);
      await joinTrip(tripId);
      setAccepted(true);
      // Redirect to trip dashboard after 1 second
      setTimeout(() => {
        navigate(`/trips/${tripId}`);
      }, 1000);
    } catch (err) {
      setError(err.message || "Failed to join trip");
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = () => {
    navigate("/trips");
  };

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <TripableLogoLink className="absolute left-4 top-4 sm:left-6 sm:top-6" compact surface />
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
          <p className="text-center text-slate-600">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <TripableLogoLink className="absolute left-4 top-4 sm:left-6 sm:top-6" compact surface />
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            onClick={() => navigate("/trips")}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            Back to Trips
          </button>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
        <TripableLogoLink className="absolute left-4 top-4 sm:left-6 sm:top-6" compact surface />
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
          <div className="text-center">
            <div className="text-4xl mb-4">✓</div>
            <h2 className="text-2xl font-bold text-green-600 mb-2">Welcome!</h2>
            <p className="text-slate-600">You've joined the trip "{tripData?.name}"</p>
            <p className="text-sm text-slate-500 mt-4">Redirecting to trip details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4">
      <TripableLogoLink className="absolute left-4 top-4 sm:left-6 sm:top-6" compact surface />
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Trip Invitation</h2>
          <p className="text-slate-500">You're invited to collaborate on a trip</p>
        </div>

        {tripData && (
          <div className="bg-slate-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-slate-900">{tripData.name}</h3>
            {tripData.startDate && tripData.endDate ? (
              <p className="text-sm text-slate-600 mt-2">
                {formatDateRange(tripData.startDate, tripData.endDate)}
              </p>
            ) : (
              <p className="text-sm text-slate-600 mt-2">Dates TBD</p>
            )}
            {tripData.memberCount && (
              <p className="text-sm text-slate-600 mt-2">
                {tripData.memberCount} member{tripData.memberCount !== 1 ? 's' : ''} already joined
              </p>
            )}
          </div>
        )}

        <p className="text-slate-600 text-sm mb-6">
          Would you like to join this trip and start collaborating?
        </p>

        <div className="flex gap-3">
          <button
            onClick={handleDecline}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-slate-100 text-slate-900 rounded-lg hover:bg-slate-200 transition font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Decline
          </button>
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {loading ? "Joining..." : "Accept & Join"}
          </button>
        </div>
      </div>
    </div>
  );
}
