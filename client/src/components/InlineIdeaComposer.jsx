import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import { isPlaceLikeList, normalizeListName, slugify } from "../lib/tripPlanning.js";

function buildFreeformPayload(query, listName, destination) {
  const normalizedListName = normalizeListName(listName);
  const isPlaceLike = isPlaceLikeList(normalizedListName);

  return {
    title: query,
    description: "",
    location: isPlaceLike ? query : "",
    category: normalizedListName,
    entryType: isPlaceLike ? "place" : "activity",
    mapQuery: isPlaceLike
      ? [query, destination?.name || destination?.label].filter(Boolean).join(", ")
      : "",
    recommendationSource: null
  };
}

function buildResolvedPayload(placeMatch, listName) {
  const normalizedListName = normalizeListName(listName);
  const isPlaceLike = isPlaceLikeList(normalizedListName);

  return {
    title: placeMatch.title,
    description: "",
    location: placeMatch.address || placeMatch.title,
    category: normalizedListName,
    entryType: isPlaceLike ? "place" : "activity",
    mapQuery: placeMatch.mapQuery || placeMatch.address || placeMatch.title,
    coordinates: placeMatch.coordinates || null,
    photoUrl: placeMatch.photoUrl || "",
    photoAttributions: placeMatch.photoAttributions || [],
    recommendationSource: "Google Maps"
  };
}

export default function InlineIdeaComposer({
  destination,
  listNames,
  defaultListName,
  onAddIdea,
  onAddList,
  disabled
}) {
  const [query, setQuery] = useState("");
  const [selectedListName, setSelectedListName] = useState(defaultListName || listNames[0] || "Activities");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchError, setSearchError] = useState("");
  const dropdownRef = useRef(null);

  const canSearchPlaces = api.canSearchPlaces();
  const normalizedListNames = useMemo(() => listNames.map((listName) => normalizeListName(listName)), [listNames]);

  useEffect(() => {
    if (!defaultListName) return;
    setSelectedListName(defaultListName);
  }, [defaultListName]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    setSearchError("");
    if (!canSearchPlaces || trimmedQuery.length < 2) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.searchPlaces(trimmedQuery, destination);
        if (cancelled) return;
        setSuggestions(results);
        setHighlightedIndex(results.length ? 0 : -1);
      } catch (error) {
        if (cancelled) return;
        setSuggestions([]);
        setHighlightedIndex(-1);
        setSearchError("Google Maps did not return a match, so you can add your text directly.");
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
  }, [canSearchPlaces, destination, query]);

  const handleCommit = async (placeMatch) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery || submitting || disabled) return;

    setSubmitting(true);
    try {
      const payload = placeMatch
        ? buildResolvedPayload(placeMatch, selectedListName)
        : buildFreeformPayload(trimmedQuery, selectedListName, destination);
      await onAddIdea(payload);
      setQuery("");
      setSuggestions([]);
      setHighlightedIndex(-1);
      setSearchError("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const selectedSuggestion =
      highlightedIndex >= 0 && highlightedIndex < suggestions.length ? suggestions[highlightedIndex] : suggestions[0];
    await handleCommit(selectedSuggestion || null);
  };

  const handleKeyDown = async (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!suggestions.length) return;
      setHighlightedIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!suggestions.length) return;
      setHighlightedIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
      return;
    }

    if (event.key === "Enter") {
      await handleSubmit(event);
      return;
    }

    if (event.key === "Escape") {
      setSuggestions([]);
      setHighlightedIndex(-1);
    }
  };

  const handleCreateList = () => {
    const normalized = normalizeListName(newListName);
    if (!normalized) return;
    const createdList = onAddList(normalized) || normalized;
    setSelectedListName(createdList);
    setDropdownOpen(false);
    setNewListName("");
  };

  return (
    <div className="min-w-0 rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-card">
      <p className="text-sm font-semibold text-slate-500">Quick add</p>
      <form onSubmit={handleSubmit} className="mt-4 min-w-0">
        <div className="flex min-w-0 flex-col gap-3 xl:flex-row">
          <div className="relative min-w-0 flex-1">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add new activity or place"
              disabled={disabled || submitting}
              className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-sm text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10 disabled:opacity-60"
            />

            {(searching || suggestions.length > 0 || searchError || query.trim()) && (
              <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                {searching ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Searching Google Maps...</div>
                ) : suggestions.length ? (
                  <div className="max-h-72 overflow-y-auto">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={suggestion.id}
                        type="button"
                        onClick={() => handleCommit(suggestion)}
                        className={`flex w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 ${
                          highlightedIndex === index ? "bg-[#F8FAFF]" : "bg-white"
                        }`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-ink">{suggestion.title}</p>
                          <p className="mt-1 text-xs text-slate-500">{suggestion.address}</p>
                        </div>
                        <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold text-ocean">
                          Google match
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    {searchError ||
                      (canSearchPlaces
                        ? "No Google Maps match found. Press Enter to add exactly what you typed."
                        : "Add your text directly, or set VITE_GOOGLE_MAPS_API_KEY to enable Google Maps matching.")}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap xl:shrink-0">
            <div ref={dropdownRef} className="relative min-w-0 flex-1 sm:flex-none">
              <button
                type="button"
                onClick={() => setDropdownOpen((current) => !current)}
                className="inline-flex w-full min-w-0 items-center justify-between rounded-2xl border border-slate-200 px-4 py-4 text-sm font-semibold text-ink sm:min-w-[220px]"
              >
                <span>{selectedListName}</span>
                <span className="text-slate-400">v</span>
              </button>

              {dropdownOpen ? (
                <div className="absolute right-0 top-[calc(100%+10px)] z-30 w-[280px] rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
                  <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Save to list
                  </p>
                  <div className="grid gap-1">
                    {normalizedListNames.map((listName) => (
                      <button
                        key={slugify(listName)}
                        type="button"
                        onClick={() => {
                          setSelectedListName(listName);
                          setDropdownOpen(false);
                        }}
                        className={`rounded-xl px-3 py-2 text-left text-sm font-semibold ${
                          selectedListName === listName ? "bg-[#EEF2FF] text-ocean" : "text-ink hover:bg-mist"
                        }`}
                      >
                        {listName}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Add new list
                    </p>
                    <div className="flex gap-2">
                      <input
                        value={newListName}
                        onChange={(event) => setNewListName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            handleCreateList();
                          }
                        }}
                        placeholder="Ex: Nightlife"
                        className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-ocean"
                      />
                      <button
                        type="button"
                        onClick={handleCreateList}
                        className="rounded-xl bg-ocean px-3 py-2 text-xs font-semibold text-white"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={disabled || submitting || !query.trim()}
              className="w-full rounded-2xl bg-ocean px-5 py-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
            >
              {submitting ? "Adding..." : "Add"}
            </button>
          </div>
        </div>
      </form>

      <p className="mt-3 text-xs text-slate-500">
        Press Enter to use the best Google Maps match, or save your raw text if nothing matches.
      </p>
    </div>
  );
}
