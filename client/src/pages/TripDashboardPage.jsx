import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AvailabilityCalendar from "../components/AvailabilityCalendar.jsx";
import BudgetPanel from "../components/BudgetPanel.jsx";
import IdeaCard from "../components/IdeaCard.jsx";
import InlineIdeaComposer from "../components/InlineIdeaComposer.jsx";
import TripableLogoLink from "../components/TripableLogoLink.jsx";
import TripMapPanel from "../components/TripMapPanel.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { api } from "../lib/api.js";
import {
  addCustomList,
  getRecommendations as getFallbackRecommendations,
  getTripLists,
  isPlaceLikeList,
  normalizeListName,
  renameCustomList,
  removeCustomList,
  saveIdeaMeta,
  slugify
} from "../lib/tripPlanning.js";
import { formatDateRange } from "../lib/timeFormat.js";

const DEFAULT_RECOMMENDATION_SEARCH = "Places to Visit";
const RECOMMENDATION_PAGE_SIZE = 8;
const INITIAL_RECOMMENDATION_FETCH_COUNT = RECOMMENDATION_PAGE_SIZE * 2;
const TRIP_LIST_SELECTION_STORAGE_PREFIX = "tripable.trip-dashboard.selected-lists";

function looksFoodRelated(value) {
  return /food|restaurant|cafe|coffee|bakery|brunch|breakfast|lunch|dinner|bar|drink|ramen|sushi|pizza|eat/.test(
    slugify(value)
  );
}

function looksActivityRelated(value) {
  return /activit|tour|class|workshop|nightlife|show|event|experience|lesson|crawl/.test(slugify(value));
}

function looksPlaceRelated(value) {
  return /place|visit|landmark|museum|neighborhood|district|park|garden|temple|shrine|view|market/.test(
    slugify(value)
  );
}

function getRecommendationKey(recommendation) {
  return String(recommendation?.id || recommendation?.title || "").trim();
}

function getTripListSelectionStorageKey(tripId) {
  return tripId ? `${TRIP_LIST_SELECTION_STORAGE_PREFIX}.${tripId}` : "";
}

function readStoredListSelection(tripId) {
  if (typeof window === "undefined" || !tripId) {
    return undefined;
  }

  try {
    const raw = window.sessionStorage.getItem(getTripListSelectionStorageKey(tripId));
    if (raw === null) {
      return undefined;
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((value) => String(value || "").trim()).filter(Boolean) : [];
  } catch (error) {
    console.error("Unable to read saved trip list selection", error);
    return undefined;
  }
}

function writeStoredListSelection(tripId, selectedListIds) {
  if (typeof window === "undefined" || !tripId) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getTripListSelectionStorageKey(tripId),
      JSON.stringify(Array.isArray(selectedListIds) ? selectedListIds : [])
    );
  } catch (error) {
    console.error("Unable to save trip list selection", error);
  }
}

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
  const [availabilitySaved, setAvailabilitySaved] = useState(false);
  const [surveyDatesSaved, setSurveyDatesSaved] = useState(false);
  const [ideaToDelete, setIdeaToDelete] = useState(null);
  const [listActionLoadingId, setListActionLoadingId] = useState("");
  const [listContextMenu, setListContextMenu] = useState(null);
  const [listToDelete, setListToDelete] = useState(null);
  const [listToRename, setListToRename] = useState(null);
  const [renameListName, setRenameListName] = useState("");
  const [renameListError, setRenameListError] = useState("");
  const [selectedListIds, setSelectedListIds] = useState([]);
  const [recommendationSearchInput, setRecommendationSearchInput] = useState(DEFAULT_RECOMMENDATION_SEARCH);
  const [activeRecommendationSearch, setActiveRecommendationSearch] = useState(DEFAULT_RECOMMENDATION_SEARCH);
  const [recommendationVisibleCount, setRecommendationVisibleCount] = useState(RECOMMENDATION_PAGE_SIZE);
  const [recommendationFetchCount, setRecommendationFetchCount] = useState(INITIAL_RECOMMENDATION_FETCH_COUNT);
  const [activeMapQuery, setActiveMapQuery] = useState("");
  const [recommendationItems, setRecommendationItems] = useState([]);
  const [recommendationTargetByKey, setRecommendationTargetByKey] = useState({});
  const [recommendationToAdd, setRecommendationToAdd] = useState(null);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsLoadingMore, setRecommendationsLoadingMore] = useState(false);
  const [recommendationsNotice, setRecommendationsNotice] = useState("");
  const recommendationScrollerRef = useRef(null);
  const previousRecommendationQueryRef = useRef("");
  const hasInitializedListSelectionRef = useRef(false);

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

  useEffect(() => {
    hasInitializedListSelectionRef.current = false;
    setSelectedListIds([]);
  }, [tripId]);

  const inviteLink = useMemo(() => {
    if (!tripId) return "";
    return `${window.location.origin}/trips/${tripId}/invite`;
  }, [tripId]);

  const activeTrip = tripView || currentTrip;
  const lists = useMemo(() => getTripLists(activeTrip || tripId), [activeTrip, tripId]);
  const selectedListIdSet = useMemo(() => new Set(selectedListIds), [selectedListIds]);
  const allListsSelected = useMemo(
    () => lists.length > 0 && lists.every((list) => selectedListIdSet.has(list.id)),
    [lists, selectedListIdSet]
  );

  useEffect(() => {
    if (!lists.length) return;
    setSelectedListIds((current) => {
      const validSelections = current.filter((listId) => lists.some((list) => list.id === listId));
      if (!hasInitializedListSelectionRef.current) {
        const storedSelection = readStoredListSelection(tripId);
        const validStoredSelection =
          storedSelection?.filter((listId) => lists.some((list) => list.id === listId)) || [];

        hasInitializedListSelectionRef.current = true;

        if (storedSelection !== undefined) {
          return validStoredSelection;
        }

        return lists.map((list) => list.id);
      }
      if (
        validSelections.length === current.length &&
        validSelections.every((listId, index) => listId === current[index])
      ) {
        return current;
      }
      if (!validSelections.length) {
        return [];
      }
      return validSelections;
    });
  }, [lists, tripId]);

  useEffect(() => {
    if (!tripId || !hasInitializedListSelectionRef.current) return;
    writeStoredListSelection(tripId, selectedListIds);
  }, [selectedListIds, tripId]);

  useEffect(() => {
    if (!selectedListIds.length) {
      setActiveMapQuery("");
    }
  }, [selectedListIds]);

  useEffect(() => {
    const validListNames = new Set(lists.map((list) => list.name));
    setRecommendationTargetByKey((current) => {
      const next = Object.fromEntries(
        Object.entries(current).filter(([, listName]) => validListNames.has(listName))
      );

      return Object.keys(next).length === Object.keys(current).length ? current : next;
    });
  }, [lists]);

  const normalizedRecommendationSearch =
    normalizeListName(activeRecommendationSearch) || DEFAULT_RECOMMENDATION_SEARCH;

  useEffect(() => {
    if (!activeTrip?.destination || !normalizedRecommendationSearch) {
      setRecommendationItems([]);
      setRecommendationsLoading(false);
      setRecommendationsLoadingMore(false);
      setRecommendationsNotice("");
      return;
    }

    const recommendationQueryKey = [
      activeTrip?.destination?.id,
      activeTrip?.destination?.label,
      activeTrip?.destination?.mapQuery,
      activeTrip?.destination?.name,
      normalizedRecommendationSearch
    ].join("::");
    const isNewRecommendationQuery = previousRecommendationQueryRef.current !== recommendationQueryKey;
    previousRecommendationQueryRef.current = recommendationQueryKey;

    let cancelled = false;

    const loadRecommendationFeed = async () => {
      if (!api.canSearchPlaces()) {
        if (cancelled) return;
        setRecommendationItems(getFallbackRecommendations(activeTrip.destination, normalizedRecommendationSearch));
        setRecommendationsLoading(false);
        setRecommendationsLoadingMore(false);
        setRecommendationsNotice("Showing local suggestions until Google Maps recommendations are available.");
        return;
      }

      if (isNewRecommendationQuery) {
        setRecommendationsLoading(true);
        setRecommendationsLoadingMore(false);
        setRecommendationsNotice("");
        setRecommendationItems([]);
      } else {
        setRecommendationsLoadingMore(true);
      }

      try {
        const liveRecommendations = await api.getRecommendations(activeTrip.destination, normalizedRecommendationSearch, {
          limit: recommendationFetchCount
        });
        if (cancelled) return;

        if (liveRecommendations.length) {
          setRecommendationItems(liveRecommendations);
          setRecommendationsNotice("");
        } else {
          setRecommendationItems(getFallbackRecommendations(activeTrip.destination, normalizedRecommendationSearch));
          setRecommendationsNotice("Google Maps did not return results for this list yet, so local suggestions are shown.");
        }
      } catch (loadError) {
        console.error("Unable to load recommendations", loadError);
        if (cancelled) return;
        setRecommendationItems(getFallbackRecommendations(activeTrip.destination, normalizedRecommendationSearch));
        setRecommendationsNotice("Google Maps recommendations are unavailable right now, so local suggestions are shown.");
      } finally {
        if (!cancelled) {
          setRecommendationsLoading(false);
          setRecommendationsLoadingMore(false);
        }
      }
    };

    loadRecommendationFeed();

    return () => {
      cancelled = true;
    };
  }, [
    activeTrip?.destination?.id,
    activeTrip?.destination?.label,
    activeTrip?.destination?.mapQuery,
    activeTrip?.destination?.name,
    normalizedRecommendationSearch,
    recommendationFetchCount
  ]);

  const visibleIdeas = useMemo(() => {
    return [...ideas]
      .filter((idea) => selectedListIdSet.has(idea.listId))
      .sort((a, b) => {
      if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      });
  }, [ideas, selectedListIdSet]);

  const mappedIdeas = useMemo(
    () =>
      [...ideas]
        .filter((idea) => idea.hasMapLocation && selectedListIdSet.has(idea.listId))
        .sort((a, b) => {
          if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        }),
    [ideas, selectedListIdSet]
  );

  const recommendations = useMemo(() => {
    const existingTitles = new Set(ideas.map((idea) => idea.title.trim().toLowerCase()));
    return recommendationItems.filter(
      (item) => !existingTitles.has(item.title.trim().toLowerCase())
    );
  }, [ideas, recommendationItems]);

  const visibleRecommendations = useMemo(
    () => recommendations.slice(0, recommendationVisibleCount),
    [recommendationVisibleCount, recommendations]
  );
  const canLoadMoreRecommendations = recommendations.length > recommendationVisibleCount;
  const showViewMoreCard = canLoadMoreRecommendations || recommendationsLoadingMore;
  const selectedLists = useMemo(
    () => lists.filter((list) => selectedListIdSet.has(list.id)),
    [lists, selectedListIdSet]
  );
  const effectiveMapQuery = selectedListIds.length ? activeMapQuery : "";
  const emptyIdeasTitle = useMemo(() => {
    if (!selectedLists.length) {
      return "No lists selected";
    }
    if (selectedLists.length === 1) {
      return `Nothing in ${selectedLists[0].name} yet`;
    }
    return "Nothing in the selected lists yet";
  }, [selectedLists]);
  const emptyIdeasDescription = useMemo(() => {
    if (!selectedLists.length) {
      return "Choose at least one list above to see its ideas on the board.";
    }
    return "Add a plan item or start from the recommended suggestions below.";
  }, [selectedLists]);

  const tripTitle = useMemo(() => {
    if (!activeTrip?.name) return "Loading...";
    const locationLabel = activeTrip?.destination?.name || activeTrip?.destination?.label;
    return locationLabel ? `${activeTrip.name} at ${locationLabel}` : activeTrip.name;
  }, [activeTrip?.destination?.label, activeTrip?.destination?.name, activeTrip?.name]);

  const collaborators = useMemo(() => {
    const members = Array.isArray(activeTrip?.members) ? [...activeTrip.members] : [];
    return members.sort((left, right) => {
      if (left.isLeader !== right.isLeader) {
        return Number(right.isLeader) - Number(left.isLeader);
      }
      if (left.isViewer !== right.isViewer) {
        return Number(right.isViewer) - Number(left.isViewer);
      }
      return String(left.name || "").localeCompare(String(right.name || ""));
    });
  }, [activeTrip?.members]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddIdea = async (formData) => {
    if (!tripId) return;
    const createdIdea = await addIdea(tripId, formData);
    const nextListId = slugify(formData.category);
    if (nextListId) {
      setSelectedListIds((current) => (current.includes(nextListId) ? current : [...current, nextListId]));
    }
    return createdIdea;
  };

  const handleAddRecommendation = async (recommendation, explicitTargetListName) => {
    if (!tripId) return;
    const targetListName =
      normalizeListName(explicitTargetListName) || normalizeListName(getRecommendationTargetListName(recommendation));
    if (!targetListName) return false;

    try {
      await addIdea(tripId, {
        title: recommendation.title,
        description: recommendation.description,
        location: recommendation.location,
        category: targetListName,
        entryType: recommendation.entryType,
        mapQuery: recommendation.mapQuery,
        coordinates: recommendation.coordinates || null,
        photoUrl: recommendation.photoUrl || "",
        photoAttributions: recommendation.photoAttributions || [],
        recommendationSource: recommendation.recommendationSource
      });
      const targetListId = slugify(targetListName);
      setSelectedListIds((current) => (current.includes(targetListId) ? current : [...current, targetListId]));
      return true;
    } catch (submitError) {
      console.error("Unable to add recommendation", submitError);
      return false;
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
    const nextListId = slugify(normalized);
    setSelectedListIds((current) => (current.includes(nextListId) ? current : [...current, nextListId]));
    return normalized;
  };

  const handleListContextMenu = (event, list) => {
    if (!list || list.isDefault) return;
    event.preventDefault();
    setListContextMenu({
      list,
      x: Math.min(event.clientX, window.innerWidth - 180),
      y: Math.min(event.clientY, window.innerHeight - 120)
    });
  };

  const handleDeleteList = async (list) => {
    if (!tripId || !list || list.isDefault || listActionLoadingId) return;

    const ideasInList = ideas.filter((idea) => idea.listId === list.id);
    setListActionLoadingId(list.id);

    try {
      for (const idea of ideasInList) {
        await deleteIdea(idea.id, tripId);
      }

      const nextMeta = removeCustomList(tripId, list.name);
      setTripView((prev) => (prev ? { ...prev, ...nextMeta } : prev));
      setSelectedListIds((current) => current.filter((listId) => listId !== list.id));
      setRecommendationTargetByKey((current) =>
        Object.fromEntries(Object.entries(current).filter(([, listName]) => slugify(listName) !== list.id))
      );
      if (recommendationToAdd && slugify(getRecommendationTargetListName(recommendationToAdd)) === list.id) {
        setRecommendationToAdd(null);
      }
      setListToDelete(null);
    } catch (deleteListError) {
      console.error("Unable to delete list", deleteListError);
    } finally {
      setListActionLoadingId("");
    }
  };

  const handleOpenRenameListModal = (list) => {
    setListContextMenu(null);
    setRenameListError("");
    setRenameListName(list.name);
    setListToRename(list);
  };

  const handleRenameList = async () => {
    if (!tripId || !listToRename || listActionLoadingId) return;

    const normalizedNextName = normalizeListName(renameListName);
    if (!normalizedNextName) {
      setRenameListError("Enter a list name.");
      return;
    }

    const nextListSlug = slugify(normalizedNextName);
    const currentListSlug = listToRename.id;
    if (nextListSlug !== currentListSlug && lists.some((list) => list.id === nextListSlug)) {
      setRenameListError("That list name already exists.");
      return;
    }

    if (nextListSlug === currentListSlug) {
      setListToRename(null);
      setRenameListName("");
      setRenameListError("");
      return;
    }

    setListActionLoadingId(listToRename.id);

    try {
      const nextMeta = renameCustomList(tripId, listToRename.name, normalizedNextName);
      const ideasInList = ideas.filter((idea) => idea.listId === listToRename.id);

      ideasInList.forEach((idea) => {
        saveIdeaMeta(tripId, idea.id, { listName: normalizedNextName });
      });

      setTripView((prev) => (prev ? { ...prev, ...nextMeta } : prev));
      setSelectedListIds((current) => {
        const nextSelections = current.map((listId) => (listId === listToRename.id ? nextListSlug : listId));
        return Array.from(new Set(nextSelections));
      });
      setRecommendationTargetByKey((current) =>
        Object.fromEntries(
          Object.entries(current).map(([recommendationKey, listName]) => [
            recommendationKey,
            slugify(listName) === listToRename.id ? normalizedNextName : listName
          ])
        )
      );
      await loadIdeas(tripId);
      setListToRename(null);
      setRenameListName("");
      setRenameListError("");
    } catch (renameListFailure) {
      console.error("Unable to rename list", renameListFailure);
      setRenameListError("Unable to rename this list right now.");
    } finally {
      setListActionLoadingId("");
    }
  };

  const handleBudgetChange = (meta) => {
    setTripView((prev) => (prev ? { ...prev, ...meta } : prev));
  };

  const handleToggleListSelection = (listId) => {
    setSelectedListIds((current) => {
      if (current.includes(listId)) {
        return current.filter((candidate) => candidate !== listId);
      }
      return [...current, listId];
    });
  };

  const handleToggleAllLists = () => {
    setSelectedListIds((current) => {
      if (current.length === lists.length) {
        return [];
      }
      return lists.map((list) => list.id);
    });
  };

  const handleRecommendationSearch = (event) => {
    event.preventDefault();
    const nextSearch = normalizeListName(recommendationSearchInput) || DEFAULT_RECOMMENDATION_SEARCH;
    previousRecommendationQueryRef.current = "";
    setRecommendationTargetByKey({});
    setRecommendationToAdd(null);
    setRecommendationSearchInput(nextSearch);
    setActiveRecommendationSearch(nextSearch);
    setRecommendationVisibleCount(RECOMMENDATION_PAGE_SIZE);
    setRecommendationFetchCount(INITIAL_RECOMMENDATION_FETCH_COUNT);
    recommendationScrollerRef.current?.scrollTo({ left: 0, behavior: "smooth" });
  };

  const handleLoadMoreRecommendations = () => {
    const nextVisibleCount = recommendationVisibleCount + RECOMMENDATION_PAGE_SIZE;
    setRecommendationVisibleCount(nextVisibleCount);
    if (recommendationItems.length <= nextVisibleCount) {
      setRecommendationFetchCount((current) => current + RECOMMENDATION_PAGE_SIZE);
    }
  };

  const handleRecommendationTargetChange = (recommendation, nextListName) => {
    const recommendationKey = getRecommendationKey(recommendation);
    setRecommendationTargetByKey((current) => ({
      ...current,
      [recommendationKey]: nextListName
    }));
  };

  const handleOpenRecommendationAddModal = (recommendation) => {
    const recommendationKey = getRecommendationKey(recommendation);
    setRecommendationTargetByKey((current) => {
      if (current[recommendationKey]) {
        return current;
      }

      return {
        ...current,
        [recommendationKey]: getRecommendedListName(recommendation)
      };
    });
    setRecommendationToAdd(recommendation);
  };

  const activeRecommendationTargetListName = recommendationToAdd
    ? getRecommendationTargetListName(recommendationToAdd)
    : "";
  const activeRecommendationSuggestedListName = recommendationToAdd
    ? getRecommendedListName(recommendationToAdd)
    : "";

  return (
    <>
      <div className="min-h-screen overflow-x-hidden xl:pr-[clamp(420px,38vw,640px)]">
        <main className="min-w-0 xl:w-full xl:overflow-hidden">
          <div className="mx-auto w-full max-w-[980px] px-6 py-12 xl:max-w-[900px] 2xl:max-w-[960px]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <TripableLogoLink compact />
              <Link
                to="/trips"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mist text-base text-ocean">
                  ←
                </span>
                Back to trips
              </Link>
            </div>

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
                    <div className="group relative">
                      <button
                        type="button"
                        className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-[#E9EEF8] focus:bg-[#E9EEF8]"
                      >
                        {activeTrip?.memberCount || collaborators.length || 0} collaborators
                      </button>
                      {collaborators.length ? (
                        <div className="pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-20 hidden w-64 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-card group-hover:block group-focus-within:block">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            People in this trip
                          </p>
                          <div className="mt-3 grid gap-2">
                            {collaborators.map((member) => (
                              <div
                                key={member.id}
                                className="flex items-center justify-between gap-3 rounded-2xl bg-mist px-3 py-2"
                              >
                                <span className="text-sm font-semibold text-ink">
                                  {member.isViewer ? "You" : member.name}
                                </span>
                                <span className="text-xs font-semibold text-slate-500">
                                  {member.isLeader ? "(Owner)" : ""}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
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
            <section className="min-w-0 overflow-visible rounded-[32px] bg-white/95 p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-ink">Things to Do</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Everyone can add options, vote, and keep location-based items ready for the map.
                  </p>
                </div>
              </div>

            <div className="relative z-20 mt-6 min-w-0">
              <InlineIdeaComposer
                destination={activeTrip?.destination}
                listNames={lists.map((list) => list.name)}
                defaultListName={lists[0]?.name}
                onAddIdea={handleAddIdea}
                onAddList={handleAddList}
                disabled={!activeTrip}
              />
            </div>

            <div className="mt-6 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {lists.map((list) => {
                  const isSelected = selectedListIdSet.has(list.id);
                  return (
                    <div
                      key={list.id}
                      onContextMenu={(event) => handleListContextMenu(event, list)}
                      className={`flex items-center gap-1 rounded-full transition ${
                        isSelected
                          ? "bg-ocean text-white shadow-soft"
                          : "bg-mist text-slate-600 hover:bg-[#E9EEF8]"
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleToggleListSelection(list.id)}
                        className="rounded-full px-4 py-2 text-sm font-semibold"
                      >
                        {list.name}
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={handleToggleAllLists}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft"
                >
                  {allListsSelected ? "Deselect all" : "Select all"}
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
                    <p className="text-base font-semibold text-ink">{emptyIdeasTitle}</p>
                    <p className="mt-2 text-sm text-slate-500">{emptyIdeasDescription}</p>
                  </div>
                )}
              </div>
            </div>
            </section>

            <section className="min-w-0 overflow-hidden rounded-[32px] bg-white/95 p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="mt-1 text-2xl font-semibold text-ink">
                    Recommendations for {activeTrip?.destination?.name || "your trip"}
                  </h2>
                  {recommendationsNotice ? (
                    <p className="mt-3 rounded-2xl bg-mist px-4 py-3 text-sm text-slate-500">{recommendationsNotice}</p>
                  ) : null}
                </div>
                <div className="min-w-[220px]">
                  <form onSubmit={handleRecommendationSearch}>
                    <div className="mt-2 flex gap-2">
                      <input
                        id="recommendation-search"
                        value={recommendationSearchInput}
                        onChange={(event) => setRecommendationSearchInput(event.target.value)}
                        placeholder={DEFAULT_RECOMMENDATION_SEARCH}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
                      />
                      <button
                        type="submit"
                        className="rounded-2xl bg-ocean px-4 py-3 text-sm font-semibold text-white"
                      >
                        Search
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              <div className="mt-6 min-w-0">
                {recommendationsLoading ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-mist px-4 py-8 text-sm text-slate-500">
                    Loading the top Google Maps picks for {normalizedRecommendationSearch || "this list"} in{" "}
                    {activeTrip?.destination?.name || "this destination"}...
                  </div>
                ) : visibleRecommendations.length ? (
                  <div
                    ref={recommendationScrollerRef}
                    className="flex w-full max-w-full snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden pb-2 scroll-smooth"
                  >
                    {visibleRecommendations.map((recommendation) => {
                      return (
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
                              onClick={() => handleOpenRecommendationAddModal(recommendation)}
                              className="mt-4 rounded-full bg-ocean px-4 py-2 text-xs font-semibold text-white"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {showViewMoreCard ? (
                      <button
                        type="button"
                        onClick={handleLoadMoreRecommendations}
                        disabled={recommendationsLoadingMore}
                        className="flex w-[220px] shrink-0 snap-start items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-mist px-6 py-6 text-center text-base font-semibold text-ink transition hover:border-ocean hover:bg-[#F8FAFF] disabled:cursor-wait disabled:opacity-70 sm:w-[240px] lg:w-[250px] xl:w-[255px]"
                      >
                        {recommendationsLoadingMore ? "Loading more..." : "View more"}
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-mist px-4 py-8 text-sm text-slate-500">
                    {recommendationItems.length
                      ? `You already added the current top picks for ${normalizedRecommendationSearch}.`
                      : "Once the destination is set, this area can pull live recommendations for each list title."}
                  </div>
                )}
              </div>
            </section>

            <div className="xl:hidden">
              <TripMapPanel
                destination={activeTrip?.destination}
                activeQuery={effectiveMapQuery}
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
              activeQuery={effectiveMapQuery}
              mappedIdeas={mappedIdeas}
              onFocusLocation={setActiveMapQuery}
              immersive
            />
          </div>
        </aside>

        {listContextMenu ? (
          <div
            className="fixed inset-0 z-50"
            onClick={() => setListContextMenu(null)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              className="absolute w-40 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 shadow-card"
              style={{ left: `${listContextMenu.x}px`, top: `${listContextMenu.y}px` }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => handleOpenRenameListModal(listContextMenu.list)}
                className="flex w-full items-center px-4 py-3 text-left text-sm font-semibold text-ink transition hover:bg-mist"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  setListToDelete(listContextMenu.list);
                  setListContextMenu(null);
                }}
                className="flex w-full items-center px-4 py-3 text-left text-sm font-semibold text-coral transition hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          </div>
        ) : null}

        {listToDelete ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4 py-6"
            onClick={() => setListToDelete(null)}
          >
            <div
              className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-card"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Delete list</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">{listToDelete.name}</h3>
              <p className="mt-3 text-sm text-slate-500">
                {(() => {
                  const itemCount = ideas.filter((idea) => idea.listId === listToDelete.id).length;
                  return itemCount
                    ? `This will also delete ${itemCount} item${itemCount === 1 ? "" : "s"} in that list.`
                    : "This will remove the list from this trip.";
                })()}
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setListToDelete(null)}
                  className="rounded-full bg-mist px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteList(listToDelete)}
                  disabled={listActionLoadingId === listToDelete.id}
                  className="rounded-full bg-[#F56565] px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
                >
                  {listActionLoadingId === listToDelete.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {listToRename ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4 py-6"
            onClick={() => {
              setListToRename(null);
              setRenameListName("");
              setRenameListError("");
            }}
          >
            <div
              className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-card"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Rename list</p>
              <h3 className="mt-2 text-xl font-semibold text-ink">{listToRename.name}</h3>
              <div className="mt-5">
                <label htmlFor="rename-list-name" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  New name
                </label>
                <input
                  id="rename-list-name"
                  value={renameListName}
                  onChange={(event) => {
                    setRenameListName(event.target.value);
                    if (renameListError) {
                      setRenameListError("");
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleRenameList();
                    }
                  }}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
                />
                {renameListError ? <p className="mt-2 text-sm text-coral">{renameListError}</p> : null}
              </div>
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setListToRename(null);
                    setRenameListName("");
                    setRenameListError("");
                  }}
                  className="rounded-full bg-mist px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRenameList}
                  disabled={listActionLoadingId === listToRename.id}
                  className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
                >
                  {listActionLoadingId === listToRename.id ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {recommendationToAdd ? (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/35 px-4 py-6"
            onClick={() => setRecommendationToAdd(null)}
          >
            <div
              className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-card"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Add recommendation
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-ink">{recommendationToAdd.title}</h3>
                  <p className="mt-3 text-sm text-slate-500">
                    Recommended list: {activeRecommendationSuggestedListName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRecommendationToAdd(null)}
                  className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-slate-500"
                >
                  Close
                </button>
              </div>

              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Choose a list</p>
                <div className="mt-3 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2">
                  <div className="grid gap-1">
                    {lists.map((list) => {
                      const isSelected = activeRecommendationTargetListName === list.name;
                      const isRecommended = activeRecommendationSuggestedListName === list.name;

                      return (
                        <button
                          key={`recommendation-target-${list.id}`}
                          type="button"
                          onClick={() => handleRecommendationTargetChange(recommendationToAdd, list.name)}
                          className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${
                            isSelected
                              ? "bg-[#EEF2FF] text-ocean"
                              : "text-ink hover:bg-mist"
                          }`}
                        >
                          <span>{list.name}</span>
                          {isRecommended ? (
                            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                              Suggested
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRecommendationToAdd(null)}
                  className="rounded-full bg-mist px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const didAdd = await handleAddRecommendation(recommendationToAdd, activeRecommendationTargetListName);
                    if (didAdd) {
                      setRecommendationToAdd(null);
                    }
                  }}
                  className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
