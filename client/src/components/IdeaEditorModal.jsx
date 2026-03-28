import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import {
  buildFreeformIdeaPayload,
  buildResolvedIdeaPayload,
  DESTINATION_LIST_NAME
} from "../lib/ideaComposer.js";
import { normalizeListName, slugify } from "../lib/tripPlanning.js";

function buildListOptions(listOptions) {
  return (Array.isArray(listOptions) ? listOptions : [])
    .map((list) => ({
      ...list,
      id: String(list?.id || slugify(list?.name)).trim(),
      name: normalizeListName(list?.name)
    }))
    .filter((list) => list.id && list.name);
}

function EditIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M4.167 13.75V15.833H6.25L13.854 8.229L11.771 6.146L4.167 13.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M10.729 7.188L12.813 9.271"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12.396 3.958C12.791 3.562 13.328 3.34 13.888 3.34C14.448 3.34 14.985 3.562 15.38 3.958C15.776 4.353 15.998 4.89 15.998 5.45C15.998 6.01 15.776 6.547 15.38 6.942L13.854 8.469L11.771 6.385L13.297 4.859L12.396 3.958Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function IdeaEditorModal({
  idea,
  destination,
  listOptions = [],
  placeGroups = [],
  onClose,
  onSave
}) {
  const [query, setQuery] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [selectedListName, setSelectedListName] = useState("");
  const [selectedPlaceGroupId, setSelectedPlaceGroupId] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchLocked, setSearchLocked] = useState(true);

  const canSearchPlaces = api.canSearchPlaces();
  const normalizedListOptions = useMemo(() => buildListOptions(listOptions), [listOptions]);
  const activityListOptions = useMemo(
    () => normalizedListOptions.filter((list) => slugify(list.name) !== slugify(DESTINATION_LIST_NAME)),
    [normalizedListOptions]
  );
  const normalizedPlaceGroups = useMemo(
    () =>
      (placeGroups || [])
        .map((placeGroup) => ({
          ...placeGroup,
          title: String(placeGroup?.title || "").trim(),
          locationLabel: String(placeGroup?.locationLabel || placeGroup?.location || "").trim()
        }))
        .filter((placeGroup) => placeGroup.id && placeGroup.title && placeGroup.id !== idea?.id),
    [idea?.id, placeGroups]
  );
  const selectedPlaceGroup = useMemo(
    () => normalizedPlaceGroups.find((placeGroup) => placeGroup.id === selectedPlaceGroupId) || null,
    [normalizedPlaceGroups, selectedPlaceGroupId]
  );
  const isDestinationGroup = Boolean(
    idea &&
      slugify(idea.listName) === slugify(DESTINATION_LIST_NAME) &&
      idea.entryType === "place" &&
      !idea.parentIdeaId
  );
  const searchContextDestination = useMemo(() => {
    if (isDestinationGroup) return null;
    if (selectedPlaceGroup) {
      return {
        name: selectedPlaceGroup.title,
        label: selectedPlaceGroup.locationLabel || selectedPlaceGroup.title
      };
    }
    return destination;
  }, [destination, isDestinationGroup, selectedPlaceGroup]);

  useEffect(() => {
    if (!idea) return;
    setQuery(idea.title || "");
    setSelectedSuggestion(null);
    setSelectedListName(idea.listName || "");
    setSelectedPlaceGroupId(idea.parentIdeaId || "");
    setSuggestions([]);
    setHighlightedIndex(-1);
    setSearchError("");
    setSearchLocked(true);
  }, [activityListOptions, idea]);

  useEffect(() => {
    if (!selectedSuggestion) return;
    if (query.trim() !== selectedSuggestion.title.trim()) {
      setSelectedSuggestion(null);
    }
  }, [query, selectedSuggestion]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    setSearchError("");

    if (searchLocked || !canSearchPlaces || trimmedQuery.length < 2) {
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
          setSearchError("Google Maps did not return a match. You can still save what you typed.");
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
  }, [canSearchPlaces, query, searchContextDestination, searchLocked, selectedSuggestion]);

  if (!idea) {
    return null;
  }

  const handleSelectSuggestion = (suggestion) => {
    setSelectedSuggestion(suggestion);
    setQuery(suggestion.title);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setSearchError("");
  };

  const handleSave = async () => {
    if (!query.trim() || saving) return;

    const selectedListId =
      activityListOptions.find((list) => list.name === selectedListName)?.id || slugify(selectedListName);
    const nextMode = isDestinationGroup ? "destination" : "activity";
    const trimmedQuery = query.trim();
    const isTitleUnchanged = trimmedQuery === String(idea.title || "").trim();
    const freeformPayload = buildFreeformIdeaPayload(trimmedQuery, {
      mode: nextMode,
      listId: selectedListId,
      listName: selectedListName,
      destination,
      placeGroup: selectedPlaceGroup
    });

    const payload = selectedSuggestion
      ? buildResolvedIdeaPayload(selectedSuggestion, {
          mode: nextMode,
          listId: selectedListId,
          listName: selectedListName,
          placeGroup: selectedPlaceGroup
        })
      : {
          ...freeformPayload,
          description: idea.description || "",
          location: isTitleUnchanged ? idea.location : freeformPayload.location,
          mapQuery: isTitleUnchanged ? idea.mapQuery : freeformPayload.mapQuery,
          coordinates: isTitleUnchanged ? idea.coordinates || null : null,
          photoUrl: isTitleUnchanged ? idea.photoUrl || "" : "",
          photoAttributions: isTitleUnchanged ? idea.photoAttributions || [] : [],
          recommendationSource: isTitleUnchanged ? idea.recommendationSource || null : null
        };

    setSaving(true);
    try {
      await onSave(idea.id, payload);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-xl rounded-[28px] bg-white p-6 shadow-card"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              {isDestinationGroup ? "Edit destination group" : "Edit item"}
            </p>
            <h3 className="mt-2 text-xl font-semibold text-ink">{idea.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-slate-500"
          >
            Close
          </button>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="relative min-w-0">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {isDestinationGroup ? "Destination group" : "Name or place"}
            </label>
            <div className="mt-2 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-soft">
              <span className="text-slate-400">
                <EditIcon />
              </span>
              <input
                value={query}
                onChange={(event) => {
                  setSearchLocked(false);
                  setQuery(event.target.value);
                }}
                onKeyDown={(event) => {
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
                placeholder={isDestinationGroup ? "Search a country, city, or region" : "Search a place or type a name"}
                className="w-full min-w-0 text-sm text-ink outline-none"
              />
            </div>

            {(searching || suggestions.length || searchError) ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
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
                        ? "No Google Maps match found. You can still save what you typed."
                        : "Add your text directly, or set VITE_GOOGLE_MAPS_API_KEY to enable Google Maps matching.")}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {!isDestinationGroup ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">List (optional)</label>
                <select
                  value={selectedListName}
                  onChange={(event) => setSelectedListName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
                >
                  <option value="">No list</option>
                  {activityListOptions.map((list) => (
                    <option key={list.id} value={list.name}>
                      {list.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Destination group</label>
                <select
                  value={selectedPlaceGroupId}
                  onChange={(event) => setSelectedPlaceGroupId(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
                >
                  <option value="">Uncategorized</option>
                  {normalizedPlaceGroups.map((placeGroup) => (
                    <option key={placeGroup.id} value={placeGroup.id}>
                      {placeGroup.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-mist px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !query.trim()}
            className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
