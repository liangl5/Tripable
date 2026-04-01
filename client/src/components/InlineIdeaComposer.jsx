import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import {
  buildFreeformIdeaPayload,
  buildResolvedIdeaPayload,
  DESTINATION_LIST_NAME
} from "../lib/ideaComposer.js";
import { normalizeListName, slugify } from "../lib/tripPlanning.js";
import { trackEvent } from "../lib/analytics.js";

function ModeToggle({ active, title, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
        active
          ? "bg-ocean text-white shadow-soft"
          : "bg-white text-slate-600 hover:bg-mist"
      }`}
    >
      {title}
    </button>
  );
}

function buildListOptions(listOptions, defaultListName) {
  const normalizedOptions = (Array.isArray(listOptions) ? listOptions : [])
    .map((list) => ({
      ...list,
      id: String(list?.id || slugify(list?.name)).trim(),
      name: normalizeListName(list?.name)
    }))
    .filter((list) => list.id && list.name);

  if (normalizedOptions.length) {
    return normalizedOptions;
  }

  const fallbackListName = normalizeListName(defaultListName);
  if (!fallbackListName) {
    return [];
  }

  return [
    {
      id: slugify(fallbackListName),
      name: fallbackListName,
      isDefault: true
    }
  ];
}

export default function InlineIdeaComposer({
  destination,
  listOptions = [],
  defaultListName,
  placeGroups = [],
  preferredMode = "",
  preferredPlaceGroupId = "",
  onAddIdea,
  disabled
}) {
  const [mode, setMode] = useState(preferredMode || "destination");
  const [query, setQuery] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [selectedListName, setSelectedListName] = useState(defaultListName || "");
  const [selectedPlaceGroupId, setSelectedPlaceGroupId] = useState(preferredPlaceGroupId);
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchError, setSearchError] = useState("");

  const canSearchPlaces = api.canSearchPlaces();
  const normalizedListOptions = useMemo(
    () => buildListOptions(listOptions, defaultListName),
    [defaultListName, listOptions]
  );
  const activityListOptions = useMemo(() => {
    const filtered = normalizedListOptions.filter((list) => slugify(list.name) !== slugify(DESTINATION_LIST_NAME));
    return filtered;
  }, [normalizedListOptions]);
  const activityListNames = useMemo(
    () => activityListOptions.map((list) => list.name),
    [activityListOptions]
  );
  const selectedList = useMemo(
    () => (selectedListName ? activityListOptions.find((list) => list.name === selectedListName) || null : null),
    [activityListOptions, selectedListName]
  );
  const normalizedPlaceGroups = useMemo(
    () =>
      (placeGroups || [])
        .map((placeGroup) => ({
          ...placeGroup,
          title: String(placeGroup?.title || "").trim(),
          locationLabel: String(placeGroup?.locationLabel || placeGroup?.location || "").trim()
        }))
        .filter((placeGroup) => placeGroup.id && placeGroup.title),
    [placeGroups]
  );
  const selectedPlaceGroup = useMemo(
    () => normalizedPlaceGroups.find((placeGroup) => placeGroup.id === selectedPlaceGroupId) || null,
    [normalizedPlaceGroups, selectedPlaceGroupId]
  );
  const searchContextDestination = useMemo(() => {
    if (mode === "destination") return null;
    if (selectedPlaceGroup) {
      return {
        name: selectedPlaceGroup.title,
        label: selectedPlaceGroup.locationLabel || selectedPlaceGroup.title
      };
    }
    return destination;
  }, [destination, mode, selectedPlaceGroup]);
  const shouldShowSuggestions = Boolean(searching || suggestions.length || searchError);
  const formGridClassName =
    mode === "activity"
      ? "mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.7fr),minmax(180px,0.9fr),minmax(180px,0.95fr),auto]"
      : "mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr),auto]";

  useEffect(() => {
    if (preferredMode) {
      setMode(preferredMode);
    }
  }, [preferredMode]);

  useEffect(() => {
    const normalizedDefaultListName = normalizeListName(defaultListName);
    if (normalizedDefaultListName && slugify(normalizedDefaultListName) !== slugify(DESTINATION_LIST_NAME)) {
      setSelectedListName(normalizedDefaultListName);
    }
  }, [defaultListName]);

  useEffect(() => {
    if (selectedListName && !activityListNames.includes(selectedListName)) {
      setSelectedListName("");
    }
  }, [activityListNames, selectedListName]);

  useEffect(() => {
    if (preferredPlaceGroupId && normalizedPlaceGroups.some((placeGroup) => placeGroup.id === preferredPlaceGroupId)) {
      setMode("activity");
      setSelectedPlaceGroupId(preferredPlaceGroupId);
    }
  }, [normalizedPlaceGroups, preferredPlaceGroupId]);

  useEffect(() => {
    if (mode === "destination") {
      setSelectedPlaceGroupId("");
      return;
    }

    if (selectedPlaceGroupId && !normalizedPlaceGroups.some((placeGroup) => placeGroup.id === selectedPlaceGroupId)) {
      setSelectedPlaceGroupId("");
    }
  }, [mode, normalizedPlaceGroups, selectedPlaceGroupId]);

  useEffect(() => {
    if (!selectedSuggestion) return;
    if (query.trim() !== selectedSuggestion.title.trim()) {
      setSelectedSuggestion(null);
    }
  }, [query, selectedSuggestion]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    setSearchError("");

    if (!canSearchPlaces || trimmedQuery.length < 2) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    if (selectedSuggestion && trimmedQuery === selectedSuggestion.title.trim()) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.searchPlaces(trimmedQuery, searchContextDestination);
        if (!cancelled) {
          setSuggestions(results);
          setHighlightedIndex(results.length ? 0 : -1);
        }
      } catch (error) {
        if (!cancelled) {
          setSuggestions([]);
          setHighlightedIndex(-1);
          setSearchError("Google Maps did not return a match. You can still add what you typed.");
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canSearchPlaces, query, searchContextDestination, selectedSuggestion]);

  const handleSelectSuggestion = (suggestion) => {
    setSelectedSuggestion(suggestion);
    setQuery(suggestion.title);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setSearchError("");
    void trackEvent("composer_suggestion_selected", {
      mode,
      suggestion_id: suggestion.id
    });
  };

  const handleCommit = async (placeMatch) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || submitting || disabled) return;

    const submissionContext = {
      mode,
      listId: selectedList?.id,
      listName: selectedListName,
      destination,
      placeGroup: selectedPlaceGroup
    };

    setSubmitting(true);
    try {
      const payload = placeMatch
        ? buildResolvedIdeaPayload(placeMatch, submissionContext)
        : buildFreeformIdeaPayload(trimmedQuery, submissionContext);
      const createdIdea = await onAddIdea(payload);
      void trackEvent("composer_commit_succeeded", {
        mode,
        idea_id: createdIdea?.id || ""
      });
      setQuery("");
      setSelectedSuggestion(null);
      setSuggestions([]);
      setHighlightedIndex(-1);
      setSearchError("");

      if (mode === "destination" && createdIdea?.id) {
        setMode("activity");
        setSelectedPlaceGroupId(createdIdea.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await handleCommit(selectedSuggestion);
  };

  const modeLabel = mode === "destination" ? "Destination group" : "Plan item";
  const placeholder =
    mode === "destination"
      ? "Search a country, city, or region"
      : "Search a place or type a custom activity";

  return (
    <div className="relative min-w-0 rounded-[28px] border border-slate-200 bg-[#FBFCFF] p-4 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <ModeToggle
          active={mode === "destination"}
          title="Destination group"
          onClick={() => {
            setMode("destination");
            void trackEvent("composer_mode_switched", { mode: "destination" });
          }}
        />
        <ModeToggle
          active={mode === "activity"}
          title="Activity or place"
          onClick={() => {
            setMode("activity");
            void trackEvent("composer_mode_switched", { mode: "activity" });
          }}
        />
      </div>

      <form onSubmit={handleSubmit} className={formGridClassName}>
        <div className="relative min-w-0">
          <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{modeLabel}</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={async (event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                if (suggestions.length) {
                  setHighlightedIndex((current) => (current + 1) % suggestions.length);
                }
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                if (suggestions.length) {
                  setHighlightedIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
                }
                return;
              }
              if (event.key === "Enter" && suggestions.length && highlightedIndex >= 0 && !selectedSuggestion) {
                event.preventDefault();
                handleSelectSuggestion(suggestions[highlightedIndex]);
                return;
              }
              if (event.key === "Escape") {
                setSuggestions([]);
                setHighlightedIndex(-1);
              }
            }}
            placeholder={placeholder}
            disabled={disabled || submitting}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10 disabled:opacity-60"
          />

          {shouldShowSuggestions ? (
            <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              {searching ? <div className="px-4 py-3 text-sm text-slate-500">Searching Google Maps...</div> : null}
              {!searching && suggestions.length ? (
                <div className="max-h-72 overflow-y-auto">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${
                        highlightedIndex === index ? "bg-[#F8FAFF]" : "bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{suggestion.title}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{suggestion.address}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
              {!searching && !suggestions.length ? (
                <div className="px-4 py-3 text-sm text-slate-500">
                  {searchError ||
                    (canSearchPlaces
                      ? "No Google Maps match found. Add your text directly if it still works for the group."
                      : "Add your text directly, or set VITE_GOOGLE_MAPS_API_KEY to enable Google Maps matching.")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {mode === "activity" ? (
          <>
            <div className="min-w-0">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">List (optional)</label>
              <select
                value={selectedListName}
                onChange={(event) => setSelectedListName(event.target.value)}
                disabled={disabled || submitting}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10 disabled:opacity-60"
              >
                <option value="">No list</option>
                {activityListOptions.map((list) => (
                  <option key={list.id} value={list.name}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Destination</label>
              <select
                value={selectedPlaceGroupId}
                onChange={(event) => setSelectedPlaceGroupId(event.target.value)}
                disabled={disabled || submitting}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10 disabled:opacity-60"
              >
                <option value="">Uncategorized</option>
                {normalizedPlaceGroups.map((placeGroup) => (
                  <option key={placeGroup.id} value={placeGroup.id}>
                    {placeGroup.title}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        <div className="flex items-end">
          <button
            type="submit"
            disabled={disabled || submitting || !query.trim()}
            className="w-full rounded-2xl bg-ocean px-5 py-3 text-sm font-semibold text-white disabled:opacity-60 lg:w-auto"
          >
            {submitting ? "Saving..." : mode === "destination" ? "Add group" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}
