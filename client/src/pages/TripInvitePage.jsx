import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { supabase } from "../lib/supabase.js";

export default function TripInvitePage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const [searchParams] = useSearchParams();
  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  const loadTripInvitePreview = useTripStore((state) => state.loadTripInvitePreview);
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
        const trip = await loadTripInvitePreview(tripId);
        setTripData(trip);
      } catch (err) {
        setError(err.message || "Failed to load trip");
      } finally {
        setLoading(false);
      }
    };

    loadTripData();
  }, [tripId, session, loadTripInvitePreview]);

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

  const handleDecline = async () => {
    try {
      const normalizedEmail = String(session?.user?.email || "").trim().toLowerCase();
      if (normalizedEmail && tripId) {
        const { error: cancelError } = await supabase
          .from("PendingTripInvite")
          .update({
            status: "canceled",
            canceledAt: new Date().toISOString()
          })
          .eq("tripId", tripId)
          .ilike("email", normalizedEmail)
          .eq("status", "pending");

        if (cancelError && !String(cancelError.message || "").includes("PendingTripInvite")) {
          throw cancelError;
        }
      }
      navigate("/");
    } catch (declineError) {
      setError(declineError?.message || "Unable to decline invite right now.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
            <p className="text-center text-slate-600">Loading trip details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-xl font-bold text-red-600 mb-4">Error</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={() => navigate("/")}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
            >
              Back to Trips
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Header />
        <div className="flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
            <div className="text-center">
              <div className="text-4xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">Welcome!</h2>
              <p className="text-slate-600">You've joined the trip "{tripData?.name}"</p>
              <p className="text-sm text-slate-500 mt-4">Redirecting to trip details...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Trip Invitation</h2>
            <p className="text-slate-500">You're invited to collaborate on a trip</p>
          </div>

          {tripData && (
            <div className="bg-slate-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-slate-900">{tripData.name}</h3>
              <p className="text-sm text-slate-600 mt-2">
                Owner: {tripData.ownerDisplayName || "Trip owner"}
              </p>
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
    </div>
  );
}
