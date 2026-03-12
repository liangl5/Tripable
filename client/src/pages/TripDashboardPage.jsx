import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AddIdeaModal from "../components/AddIdeaModal.jsx";
import AvailabilityCalendar from "../components/AvailabilityCalendar.jsx";
import IdeaCard from "../components/IdeaCard.jsx";
import { useTripStore } from "../hooks/useTripStore.js";

export default function TripDashboardPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const ideas = useTripStore((state) => state.ideas);
  const loadTrip = useTripStore((state) => state.loadTrip);
  const loadIdeas = useTripStore((state) => state.loadIdeas);
  const joinTrip = useTripStore((state) => state.joinTrip);
  const addIdea = useTripStore((state) => state.addIdea);
  const voteIdea = useTripStore((state) => state.voteIdea);
  const deleteTrip = useTripStore((state) => state.deleteTrip);
  const updateTripLeaders = useTripStore((state) => state.updateTripLeaders);
  const updateTripSurveyDates = useTripStore((state) => state.updateTripSurveyDates);
  const updateTripAvailability = useTripStore((state) => state.updateTripAvailability);
  const generateItinerary = useTripStore((state) => state.generateItinerary);
  const loading = useTripStore((state) => state.loading);
  const error = useTripStore((state) => state.error);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sortMode, setSortMode] = useState("top");
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [surveyDatesSaved, setSurveyDatesSaved] = useState(false);
  const [leadersSaved, setLeadersSaved] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    const loadDashboard = async () => {
      await joinTrip(tripId);
      if (cancelled) return;
      await loadTrip(tripId);
      if (cancelled) return;
      await loadIdeas(tripId);
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [tripId, loadTrip, joinTrip, loadIdeas]);

  const inviteLink = useMemo(() => {
    if (!tripId) return "";
    return `${window.location.origin}/trips/${tripId}`;
  }, [tripId]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [inviteLink]);

  const handleDeleteTrip = useCallback(async () => {
    if (!tripId) return;
    const confirmed = window.confirm("Delete this trip? This cannot be undone.");
    if (!confirmed) return;
    await deleteTrip(tripId);
    navigate("/trips");
  }, [deleteTrip, navigate, tripId]);

  const handleAddIdea = useCallback(async (payload) => {
    if (!tripId) return;
    await addIdea(tripId, payload);
  }, [addIdea, tripId]);

  const handleGenerate = useCallback(async () => {
    if (!tripId) return;
    await generateItinerary(tripId);
  }, [generateItinerary, tripId]);

  const handleSaveAvailability = useCallback(async (dates) => {
    if (!tripId) return;
    try {
      await updateTripAvailability(tripId, { dates });
      setAvailabilitySaved(true);
      setTimeout(() => setAvailabilitySaved(false), 2000);
    } catch (error) {
      console.error("Failed to save availability:", error);
      // Error will be displayed by the AvailabilityCalendar component
    }
  }, [tripId, updateTripAvailability]);

  const handleSaveSurveyDates = useCallback(async (dates) => {
    if (!tripId) return;
    try {
      await updateTripSurveyDates(tripId, { dates });
      setSurveyDatesSaved(true);
      setTimeout(() => setSurveyDatesSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save survey dates:", error);
      // Error will be displayed by the AvailabilityCalendar component
    }
  }, [tripId, updateTripSurveyDates]);

  const handleToggleLeader = useCallback(async (memberId) => {
    if (!tripId || !currentTrip?.members) return;
    const currentLeaders = new Set(currentTrip.leaders || []);
    if (currentLeaders.has(memberId)) {
      currentLeaders.delete(memberId);
    } else {
      currentLeaders.add(memberId);
    }
    if (currentLeaders.size === 0) return;
    try {
      await updateTripLeaders(tripId, { leaderIds: [...currentLeaders] });
      setLeadersSaved(true);
      setTimeout(() => setLeadersSaved(false), 2000);
    } catch (error) {
      console.error("Failed to update leaders:", error);
    }
  }, [currentTrip?.leaders, currentTrip?.members, tripId, updateTripLeaders]);

  const visibleIdeas = useMemo(() => {
    const list = [...ideas];
    if (sortMode === "new") {
      return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    return list.sort((a, b) => {
      if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [ideas, sortMode]);

  const members = currentTrip?.members || [];
  const leaderIds = new Set(currentTrip?.leaders || []);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6 py-12">
      <Link to="/trips" className="text-sm text-slate-500">
        ← Back to trips
      </Link>

      <section className="mt-6 rounded-3xl bg-white/95 p-8 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-semibold text-slate-500">Trip dashboard</p>
            <h1 className="text-3xl font-semibold text-ink">{currentTrip?.name || "Loading..."}</h1>
            <p className="mt-2 text-sm text-slate-500">
              {currentTrip?.startDate && currentTrip?.endDate
                ? `${currentTrip.startDate} → ${currentTrip.endDate}`
                : "Dates TBD"}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="rounded-2xl border border-slate-200 bg-mist px-4 py-3 text-sm">
              <p className="font-semibold text-slate-500">Invite link</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">{inviteLink}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-full bg-ocean px-3 py-1 text-xs font-semibold text-white"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            {currentTrip?.isViewerCreator ? (
              <button
                type="button"
                onClick={handleDeleteTrip}
                className="rounded-full bg-[#F56565] px-4 py-2 text-xs font-semibold text-white"
              >
                Delete trip
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-[1.2fr,1fr]">
        <div className="rounded-3xl bg-white/95 p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-ink">Activities</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-mist p-1 text-xs font-semibold text-slate-500">
                <button
                  type="button"
                  onClick={() => setSortMode("top")}
                  className={`rounded-full px-3 py-1 ${sortMode === "top" ? "bg-white text-ink shadow" : ""}`}
                >
                  Top
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode("new")}
                  className={`rounded-full px-3 py-1 ${sortMode === "new" ? "bg-white text-ink shadow" : ""}`}
                >
                  New
                </button>
              </div>
              <button
                type="button"
                onClick={() => loadIdeas(tripId)}
                className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-ink shadow-card"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="rounded-full bg-moss px-4 py-2 text-xs font-semibold text-white"
              >
                Add idea
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-4">
            {visibleIdeas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} onVote={(value) => voteIdea(idea.id, value)} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <AvailabilityCalendar
            trip={currentTrip}
            loading={loading}
            onSaveAvailability={handleSaveAvailability}
            onSaveSurveyDates={handleSaveSurveyDates}
            statusMessage={
              availabilitySaved
                ? "Availability saved for the group."
                : surveyDatesSaved
                  ? "Selectable dates updated."
                  : leadersSaved
                    ? "Trip leaders updated."
                    : undefined
            }
          />
          <div className="rounded-3xl bg-white/95 p-6 shadow-card">
            <h2 className="text-xl font-semibold text-ink">Trip status</h2>
            <p className="mt-3 text-sm text-slate-500">
              {currentTrip?.memberCount || 0} collaborators · {ideas.length} ideas so far
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {members.filter((member) => member.isLeader).map((member) => (
                <span key={member.id} className="rounded-full bg-[#EEF2FF] px-3 py-2 text-xs font-semibold text-[#4C6FFF]">
                  {member.isViewer ? "You" : member.name} · Leader
                </span>
              ))}
            </div>
            {currentTrip?.ownerId ? (
              <div className="mt-4 rounded-2xl bg-mist px-4 py-3 text-xs font-semibold text-slate-500">
                Owner: {members.find((member) => member.id === currentTrip.ownerId)?.isViewer
                  ? "You"
                  : members.find((member) => member.id === currentTrip.ownerId)?.name || "Trip owner"}
              </div>
            ) : null}
          </div>
          <div className="rounded-3xl bg-white/95 p-6 shadow-card">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">Leadership</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Leaders can help manage the trip, but only the owner can change the date window or delete the trip.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {members.map((member) => {
                const isOnlyLeader = leaderIds.size === 1 && leaderIds.has(member.id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-mist px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink">{member.isViewer ? "You" : member.name}</p>
                      <p className="text-xs text-slate-500">
                        {member.id === currentTrip?.ownerId ? "Owner" : member.isLeader ? "Leader" : "Member"}
                      </p>
                    </div>
                    {currentTrip?.isViewerLeader ? (
                      <button
                        type="button"
                        disabled={isOnlyLeader}
                        onClick={() => handleToggleLeader(member.id)}
                        className={`rounded-full px-4 py-2 text-xs font-semibold text-white ${
                          member.isLeader ? "bg-[#F56565]" : "bg-[#4C6FFF]"
                        } disabled:opacity-50`}
                      >
                        {member.isLeader ? "Remove leader" : "Make leader"}
                      </button>
                    ) : (
                      <span className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-soft">
                        {member.isLeader ? "Leader" : "Member"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="rounded-3xl bg-white/95 p-6 shadow-card">
            <h2 className="text-xl font-semibold text-ink">Itinerary</h2>
            <p className="mt-3 text-sm text-slate-500">
              Generate a schedule based on top-voted ideas.
            </p>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="mt-5 w-full rounded-2xl bg-ocean px-4 py-3 text-sm font-semibold text-white"
            >
              {loading ? "Generating..." : "Generate itinerary"}
            </button>
            <Link to={`/trips/${tripId}/itinerary`} className="mt-4 inline-flex text-sm font-semibold text-ocean">
              View itinerary →
            </Link>
          </div>
        </div>
      </section>

      {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
      <AddIdeaModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAddIdea} />
    </div>
  );
}
