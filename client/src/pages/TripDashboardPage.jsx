import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AvailabilityCalendar from "../components/AvailabilityCalendar.jsx";
import BudgetPanel from "../components/BudgetPanel.jsx";
import IdeaCard from "../components/IdeaCard.jsx";
import InlineIdeaComposer from "../components/InlineIdeaComposer.jsx";
import TripMapPanel from "../components/TripMapPanel.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { api } from "../lib/api.js";
import {
  addCustomList,
  getRecommendations as getFallbackRecommendations,
  getTripLists,
  normalizeListName,
  slugify
} from "../lib/tripPlanning.js";
import { formatDateRange } from "../lib/timeFormat.js";

export default function TripDashboardPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const currentTrip = useTripStore((state) => state.currentTrip);
  const ideas = useTripStore((state) => state.ideas);
  const loadTrip = useTripStore((state) => state.loadTrip);
  const loadIdeas = useTripStore((state) => state.loadIdeas);
  const addIdea = useTripStore((state) => state.addIdea);
  const voteIdea = useTripStore((state) => state.voteIdea);
  const deleteIdea = useTripStore((state) => state.deleteIdea);
  const deleteTrip = useTripStore((state) => state.deleteTrip);
  const leaveTrip = useTripStore((state) => state.leaveTrip);
  const updateTripSurveyDates = useTripStore((state) => state.updateTripSurveyDates);
  const updateTripAvailability = useTripStore((state) => state.updateTripAvailability);
  const generateItinerary = useTripStore((state) => state.generateItinerary);
  const tripLoading = useTripStore((state) => state.tripLoading);
  const itineraryLoading = useTripStore((state) => state.itineraryLoading);
  const leaveTripLoading = useTripStore((state) => state.leaveTripLoading);
  const error = useTripStore((state) => state.error);
  const [tripView, setTripView] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sortMode, setSortMode] = useState("top");
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [surveyDatesSaved, setSurveyDatesSaved] = useState(false);
  const [ideaToDelete, setIdeaToDelete] = useState(null);
  const [activeListId, setActiveListId] = useState("places-to-visit");
  const [activeMapQuery, setActiveMapQuery] = useState("");
  const [recommendationItems, setRecommendationItems] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsNotice, setRecommendationsNotice] = useState("");
  const recommendationScrollerRef = useRef(null);

  useEffect(() => {
    if (!session) {
      navigate("/auth");
    }
  }, [session, navigate]);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;

    const loadDashboard = async () => {
      try {
        const trip = await loadTrip(tripId);
        if (cancelled) return;

        if (!trip?.isViewerCreator && !trip?.isViewerMember) {
          navigate("/trips");
          return;
        }

        setTripView(trip);
        if (cancelled) return;
        await loadIdeas(tripId);
      } catch (loadError) {
        console.error("Unable to load dashboard", loadError);
      }
    };

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [tripId, loadTrip, loadIdeas, navigate]);

  useEffect(() => {
    if (!currentTrip) return;
    setTripView(currentTrip);
  }, [currentTrip]);

  const inviteLink = useMemo(() => {
    if (!tripId) return "";
    return `${window.location.origin}/trips/${tripId}/invite`;
  }, [tripId]);

  const activeTrip = tripView || currentTrip;
  const lists = useMemo(() => getTripLists(activeTrip || tripId), [activeTrip, tripId]);

  useEffect(() => {
    if (!lists.length) return;
    const exists = lists.some((list) => list.id === activeListId);
    if (!exists) {
      setActiveListId(lists[0].id);
    }
  }, [lists, activeListId]);

  const activeList = lists.find((list) => list.id === activeListId) || lists[0];

  useEffect(() => {
    if (!activeTrip?.destination || !activeList?.name) {
      setRecommendationItems([]);
      setRecommendationsLoading(false);
      setRecommendationsNotice("");
      return;
    }

    let cancelled = false;

    const loadRecommendationFeed = async () => {
      if (!api.canSearchPlaces()) {
        if (cancelled) return;
        setRecommendationItems(getFallbackRecommendations(activeTrip.destination, activeList.name));
        setRecommendationsLoading(false);
        setRecommendationsNotice("Showing local suggestions until Google Maps recommendations are available.");
        return;
      }

      setRecommendationsLoading(true);
      setRecommendationsNotice("");
      setRecommendationItems([]);

      try {
        const liveRecommendations = await api.getRecommendations(activeTrip.destination, activeList.name, { limit: 10 });
        if (cancelled) return;

        if (liveRecommendations.length) {
          setRecommendationItems(liveRecommendations);
          setRecommendationsNotice("");
        } else {
          setRecommendationItems(getFallbackRecommendations(activeTrip.destination, activeList.name));
          setRecommendationsNotice("Google Maps did not return results for this list yet, so local suggestions are shown.");
        }
      } catch (loadError) {
        console.error("Unable to load recommendations", loadError);
        if (cancelled) return;
        setRecommendationItems(getFallbackRecommendations(activeTrip.destination, activeList.name));
        setRecommendationsNotice("Google Maps recommendations are unavailable right now, so local suggestions are shown.");
      } finally {
        if (!cancelled) {
          setRecommendationsLoading(false);
        }
      }
    };

    loadRecommendationFeed();

    return () => {
      cancelled = true;
    };
  }, [
    activeList?.name,
    activeTrip?.destination?.id,
    activeTrip?.destination?.label,
    activeTrip?.destination?.mapQuery,
    activeTrip?.destination?.name
  ]);

  const visibleIdeas = useMemo(() => {
    const list = [...ideas].filter((idea) => idea.listId === activeListId);
    if (sortMode === "new") {
      return list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    }
    return list.sort((a, b) => {
      if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [activeListId, ideas, sortMode]);

  const mappedIdeas = useMemo(
    () =>
      [...ideas]
        .filter((idea) => idea.hasMapLocation)
        .sort((a, b) => {
          if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }),
    [ideas]
  );

  const recommendations = useMemo(() => {
    if (!activeList?.id) return recommendationItems;
    const existingTitles = new Set(
      ideas
        .filter((idea) => idea.listId === activeList.id)
        .map((idea) => idea.title.trim().toLowerCase())
    );
    return recommendationItems.filter(
      (item) => !existingTitles.has(item.title.trim().toLowerCase())
    );
  }, [activeList?.id, ideas, recommendationItems]);

  const tripTitle = useMemo(() => {
    if (!activeTrip?.name) return "Loading...";
    const locationLabel = activeTrip?.destination?.name || activeTrip?.destination?.label;
    return locationLabel ? `${activeTrip.name} at ${locationLabel}` : activeTrip.name;
  }, [activeTrip?.destination?.label, activeTrip?.destination?.name, activeTrip?.name]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddIdea = async (formData) => {
    if (!tripId) return;
    await addIdea(tripId, formData);
  };

  const handleAddRecommendation = async (recommendation) => {
    if (!tripId || !activeList) return;
    try {
      await addIdea(tripId, {
        title: recommendation.title,
        description: recommendation.description,
        location: recommendation.location,
        category: activeList.name,
        entryType: recommendation.entryType,
        mapQuery: recommendation.mapQuery,
        coordinates: recommendation.coordinates || null,
        photoUrl: recommendation.photoUrl || "",
        photoAttributions: recommendation.photoAttributions || [],
        recommendationSource: recommendation.recommendationSource
      });
    } catch (submitError) {
      console.error("Unable to add recommendation", submitError);
    }
  };

  const handleDeleteTrip = async () => {
    if (!tripId) return;
    const confirmed = window.confirm("Delete this trip? This cannot be undone.");
    if (!confirmed) return;
    await deleteTrip(tripId);
    navigate("/trips");
  };

  const handleLeaveTrip = async () => {
    if (!tripId || activeTrip?.isViewerCreator) return;
    const confirmed = window.confirm("Leave this trip? You will need a new invite link if you want to rejoin later.");
    if (!confirmed) return;

    try {
      await leaveTrip(tripId);
      navigate("/trips");
    } catch (leaveError) {
      console.error("Unable to leave trip", leaveError);
    }
  };

  const handleDeleteIdea = async () => {
    if (!tripId || !ideaToDelete) return;
    try {
      await deleteIdea(ideaToDelete.id, tripId);
      setIdeaToDelete(null);
    } catch (deleteError) {
      console.error("Unable to delete plan item", deleteError);
    }
  };

  const handleGenerate = async () => {
    if (!tripId) return;
    try {
      await generateItinerary(tripId);
      navigate(`/trips/${tripId}/itinerary`);
    } catch (generateError) {
      console.error("Unable to generate itinerary", generateError);
    }
  };

  const handleSaveAvailability = async (dates) => {
    if (!tripId) return;
    await updateTripAvailability(tripId, { dates });
    setAvailabilitySaved(true);
    setTimeout(() => setAvailabilitySaved(false), 2000);
  };

  const handleSaveSurveyDates = async (dates) => {
    if (!tripId) return;
    await updateTripSurveyDates(tripId, { dates });
    const refreshedTrip = await loadTrip(tripId);
    setTripView(refreshedTrip);
    setSurveyDatesSaved(true);
    setTimeout(() => setSurveyDatesSaved(false), 2000);
  };

  const handleAddList = (listName) => {
    if (!tripId) return "";
    const normalized = normalizeListName(listName);
    if (!normalized) return "";
    const nextMeta = addCustomList(tripId, normalized);
    setTripView((prev) => (prev ? { ...prev, ...nextMeta } : prev));
    setActiveListId(slugify(normalized));
    return normalized;
  };

  const handleBudgetChange = (meta) => {
    setTripView((prev) => (prev ? { ...prev, ...meta } : prev));
  };

  const handleScrollRecommendations = (direction) => {
    const container = recommendationScrollerRef.current;
    if (!container) return;
    const scrollAmount = Math.max(container.clientWidth * 0.82, 320) * direction;
    container.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  return (
    <>
      <div className="min-h-screen overflow-x-hidden xl:pr-[clamp(420px,38vw,640px)]">
        <main className="min-w-0 xl:w-full xl:overflow-hidden">
          <div className="mx-auto w-full max-w-[980px] px-6 py-12 xl:max-w-[900px] 2xl:max-w-[960px]">
          <Link to="/trips" className="text-sm text-slate-500">
            {"<-"} Back to trips
          </Link>

          <section className="mt-6 rounded-[32px] bg-white/95 p-8 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold text-slate-500">Plan trip dashboard</p>
                <h1 className="mt-2 text-3xl font-semibold text-ink">{tripTitle}</h1>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {activeTrip?.destination ? (
                    <span className="rounded-full bg-[#EEF2FF] px-3 py-2 text-xs font-semibold text-ocean">
                      {activeTrip.destination.label}
                    </span>
                  ) : null}
                  <span className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-slate-500">
                    {activeTrip?.startDate && activeTrip?.endDate
                      ? formatDateRange(activeTrip.startDate, activeTrip.endDate)
                      : "Dates TBD"}
                  </span>
                  <span className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-slate-500">
                    {activeTrip?.memberCount || 0} collaborators
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-full bg-ocean px-5 py-3 text-sm font-semibold text-white"
                >
                  {copied ? "Copied invite link" : "Copy invite link"}
                </button>
                {activeTrip?.isViewerCreator ? (
                  <button
                    type="button"
                    onClick={handleDeleteTrip}
                    className="rounded-full bg-[#F56565] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Delete trip
                  </button>
                ) : activeTrip?.isViewerMember ? (
                  <button
                    type="button"
                    onClick={handleLeaveTrip}
                    disabled={leaveTripLoading}
                    className="rounded-full bg-[#F97316] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {leaveTripLoading ? "Leaving..." : "Leave trip"}
                  </button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="mt-10 grid min-w-0 gap-6">
            <section className="min-w-0 overflow-hidden rounded-[32px] bg-white/95 p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-ink">Things to Do</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Everyone can add options, vote, and keep location-based items ready for the map.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="rounded-full bg-mist p-1 text-xs font-semibold text-slate-500">
                    <button
                      type="button"
                      onClick={() => setSortMode("top")}
                      className={`rounded-full px-3 py-1 ${sortMode === "top" ? "bg-white text-ink shadow-soft" : ""}`}
                    >
                      Top
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortMode("new")}
                      className={`rounded-full px-3 py-1 ${sortMode === "new" ? "bg-white text-ink shadow-soft" : ""}`}
                    >
                      New
                    </button>
                  </div>
                <button
                  type="button"
                  onClick={() => loadIdeas(tripId)}
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-ink shadow-soft"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {lists.map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    onClick={() => setActiveListId(list.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      activeListId === list.id
                        ? "bg-ocean text-white shadow-soft"
                        : "bg-mist text-slate-600 hover:bg-[#E9EEF8]"
                    }`}
                >
                  {list.name}
                </button>
              ))}
            </div>

            <div className="mt-4 min-w-0">
              <InlineIdeaComposer
                destination={activeTrip?.destination}
                listNames={lists.map((list) => list.name)}
                defaultListName={activeList?.name}
                onAddIdea={handleAddIdea}
                onAddList={handleAddList}
                disabled={!activeTrip}
              />
            </div>

            <div className="mt-6 min-w-0 max-h-[640px] overflow-y-auto pr-2">
              <div className="grid gap-4">
                {ideaToDelete ? (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-red-900">Delete item?</p>
                        <p className="mt-1 text-sm text-red-700">
                          "{ideaToDelete.title}" will be permanently removed from the plan.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setIdeaToDelete(null)}
                          className="rounded-full bg-red-100 px-4 py-2 text-xs font-semibold text-red-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteIdea}
                          className="rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {visibleIdeas.length ? (
                  visibleIdeas.map((idea) => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      onVote={(value) => voteIdea(idea.id, value)}
                      onDeleteRequest={(ideaId, ideaTitle) => setIdeaToDelete({ id: ideaId, title: ideaTitle })}
                      isOwner={activeTrip?.isViewerCreator}
                      onFocusLocation={setActiveMapQuery}
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-mist px-4 py-8 text-center">
                    <p className="text-base font-semibold text-ink">Nothing in {activeList?.name} yet</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Add a plan item or start from the recommended suggestions below.
                    </p>
                  </div>
                )}
              </div>
            </div>
            </section>

            <section className="min-w-0 overflow-hidden rounded-[32px] bg-white/95 p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Recommendations</p>
                  <h2 className="mt-1 text-2xl font-semibold text-ink">
                    {activeList?.name} suggestions for {activeTrip?.destination?.name || "your trip"}
                  </h2>
                  {recommendationsNotice ? (
                    <p className="mt-3 rounded-2xl bg-mist px-4 py-3 text-sm text-slate-500">{recommendationsNotice}</p>
                  ) : null}
                </div>
                {recommendations.length > 3 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleScrollRecommendations(-1)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-ink shadow-soft"
                    >
                      {"<"} Prev
                    </button>
                    <button
                      type="button"
                      onClick={() => handleScrollRecommendations(1)}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-ink shadow-soft"
                    >
                      Next {">"}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mt-6 min-w-0">
                {recommendationsLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-mist px-4 py-8 text-sm text-slate-500">
                    Loading the top Google Maps picks for {activeList?.name || "this list"} in{" "}
                    {activeTrip?.destination?.name || "this destination"}...
                  </div>
                ) : recommendations.length ? (
                  <div
                    ref={recommendationScrollerRef}
                    className="flex w-full max-w-full snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-2 scroll-smooth"
                  >
                    {recommendations.map((recommendation) => (
                      <div
                        key={recommendation.id || recommendation.title}
                        className="w-[220px] shrink-0 snap-start rounded-2xl border border-slate-200 bg-white sm:w-[240px] lg:w-[250px] xl:w-[255px]"
                      >
                        {recommendation.photoUrl ? (
                          <div className="overflow-hidden rounded-t-2xl bg-mist">
                            <img
                              src={recommendation.photoUrl}
                              alt={recommendation.title}
                              className="h-32 w-full object-cover sm:h-36"
                              loading="lazy"
                              referrerPolicy="no-referrer-when-downgrade"
                            />
                          </div>
                        ) : null}

                        <div className="p-4">
                          <h3 className="text-[15px] font-semibold leading-snug text-ink">{recommendation.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-500">{recommendation.description}</p>
                          {recommendation.photoAttributions?.length ? (
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                              {recommendation.photoAttributions.map((attribution, index) => (
                                attribution?.uri ? (
                                  <a
                                    key={`${recommendation.id || recommendation.title}-photo-${index}`}
                                    href={attribution.uri}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="transition hover:text-slate-500"
                                  >
                                    Photo: {attribution.displayName || attribution.authorName || "Source"}
                                  </a>
                                ) : (
                                  <span key={`${recommendation.id || recommendation.title}-photo-${index}`}>
                                    Photo: {attribution?.displayName || attribution?.authorName || "Source"}
                                  </span>
                                )
                              ))}
                            </div>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => handleAddRecommendation(recommendation)}
                            className="mt-4 rounded-full bg-ocean px-4 py-2 text-xs font-semibold text-white"
                          >
                            Add to {activeList?.name}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-mist px-4 py-8 text-sm text-slate-500">
                    {recommendationItems.length
                      ? `You already added the current top picks for ${activeList?.name}.`
                      : "Once the destination is set, this area can pull live recommendations for each list title."}
                  </div>
                )}
              </div>
            </section>

            <div className="xl:hidden">
              <TripMapPanel
                destination={activeTrip?.destination}
                activeQuery={activeMapQuery}
                mappedIdeas={mappedIdeas}
                onFocusLocation={setActiveMapQuery}
              />
            </div>

            <AvailabilityCalendar
              trip={activeTrip}
              loading={tripLoading}
              onSaveAvailability={handleSaveAvailability}
              onSaveSurveyDates={handleSaveSurveyDates}
              statusMessage={
                availabilitySaved
                  ? "Availability saved for the group."
                  : surveyDatesSaved
                    ? "Selectable dates updated."
                    : undefined
              }
            />

            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-card">
              <p className="text-sm font-semibold text-slate-500">Group snapshot</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Who is planning</h2>
              <div className="mt-5 flex flex-wrap gap-2">
                {(activeTrip?.members || []).map((member) => (
                  <span
                    key={member.id}
                    className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-slate-600"
                  >
                    {member.isViewer ? "You" : member.name}
                  </span>
                ))}
              </div>
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Planned invitees</p>
                {activeTrip?.invitees?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeTrip.invitees.map((invitee) => (
                      <span
                        key={invitee}
                        className="rounded-full bg-[#EEF2FF] px-3 py-2 text-xs font-semibold text-ocean"
                      >
                        {invitee}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No invite list saved yet.</p>
                )}
              </div>
            </section>

            {activeTrip ? <BudgetPanel trip={activeTrip} onChange={handleBudgetChange} /> : null}

            <section className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-card">
              <p className="text-sm font-semibold text-slate-500">Itinerary</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">Build the daily schedule</h2>
              <p className="mt-3 text-sm text-slate-500">
                Once the travel window is decided, the highest-voted ideas are distributed across each day.
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={itineraryLoading}
                className="mt-5 w-full rounded-2xl bg-ocean px-4 py-3 text-sm font-semibold text-white"
              >
                {itineraryLoading ? "Generating..." : "Generate daily itinerary"}
              </button>
              <Link to={`/trips/${tripId}/itinerary`} className="mt-4 inline-flex text-sm font-semibold text-ocean">
                View itinerary {"->"}
              </Link>
            </section>
          </section>

            {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
          </div>
        </main>

        <aside className="fixed inset-y-0 right-0 z-10 hidden w-[clamp(420px,38vw,640px)] border-l border-slate-200 bg-white xl:block">
          <div className="h-full">
            <TripMapPanel
              destination={activeTrip?.destination}
              activeQuery={activeMapQuery}
              mappedIdeas={mappedIdeas}
              onFocusLocation={setActiveMapQuery}
              immersive
            />
          </div>
        </aside>
      </div>
    </>
  );
}
