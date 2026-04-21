import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../lib/api.js";
import { buildFreeformIdeaPayload, buildResolvedIdeaPayload } from "../lib/ideaComposer.js";
import { isPlaceLikeList, normalizeListName } from "../lib/tripPlanning.js";
export default function ActivityComposerModal({
  open,
  tabId,
  destination,
  defaultListId = "",
  defaultListName = "",
  availableLists = [],
  defaultTitle = "",
  defaultLocation = "",
  defaultDescription = "",
  defaultCostEstimate = "",
  initialIdea = null,
  submitLabel = "Add",
  onClose,
  onSave
}) {
  const normalizedListName = normalizeListName(defaultListName);
  const defaultMode = initialIdea?.entryType === "place" ? "place" : isPlaceLikeList(normalizedListName) ? "place" : "activity";
  const [mode, setMode] = useState(defaultMode); // "activity" | "place"
  const [selectedListId, setSelectedListId] = useState(defaultListId);
  const [title, setTitle] = useState(defaultTitle);
  const [location, setLocation] = useState(defaultLocation);
  const [description, setDescription] = useState(defaultDescription);
  const [costEstimate, setCostEstimate] = useState(defaultCostEstimate);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [searching, setSearching] = useState(false);
  const [searchLocked, setSearchLocked] = useState(true);
  const [searchError, setSearchError] = useState("");
  const [saving, setSaving] = useState(false);

  const canSearchPlaces = api.canSearchPlaces();

  useEffect(() => {
    if (!open) return;
    setMode(defaultMode);
    setSelectedListId(initialIdea?.listId || defaultListId || "");
    setTitle(initialIdea?.title || defaultTitle || "");
    setLocation(initialIdea?.location || defaultLocation || "");
    setDescription(initialIdea?.description || defaultDescription || "");
    setCostEstimate(initialIdea?.costEstimate ?? defaultCostEstimate ?? "");
    setSelectedSuggestion(null);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setSearchLocked(true);
    setSearchError("");
    setSaving(false);
  }, [defaultCostEstimate, defaultDescription, defaultListId, defaultLocation, defaultTitle, defaultMode, initialIdea?.description, initialIdea?.id, open]);

  useEffect(() => {
    if (!open) return;

    const query = mode === "place" ? title.trim() : location.trim();
    setSearchError("");

    if (searchLocked || !canSearchPlaces || query.length < 2) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    if (
      selectedSuggestion &&
      query === String(
        mode === "place"
          ? selectedSuggestion.title
          : (selectedSuggestion.address || selectedSuggestion.title || "")
      ).trim()
    ) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.searchPlaces(query, destination);
        if (!cancelled) {
          setSuggestions(results);
          setHighlightedIndex(results.length ? 0 : -1);
        }
      } catch (error) {
        if (!cancelled) {
          setSuggestions([]);
          setHighlightedIndex(-1);
          setSearchError("Google Maps did not return a match. You can still save this activity.");
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
  }, [canSearchPlaces, destination, location, mode, open, searchLocked, selectedSuggestion, title]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const handleSelectSuggestion = (suggestion) => {
    setSelectedSuggestion(suggestion);
    if (mode === "place") {
      setTitle(suggestion.title);
    } else {
      setLocation(String(suggestion.mapQuery || suggestion.address || suggestion.title || "").trim());
    }
    setSuggestions([]);
    setHighlightedIndex(-1);
    setSearchError("");
    setSearchLocked(true);
  };

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    const trimmedLocation = location.trim();
    const targetListId = String(selectedListId || defaultListId || "").trim();
    if (!trimmedTitle || !targetListId || saving) return;
    const costValue = String(costEstimate || "").trim();
    const normalizedCost = costValue ? Number(costValue) : null;
    const isEditing = Boolean(initialIdea?.id);
    const isTitleUnchanged = isEditing && trimmedTitle === String(initialIdea.title || "").trim();
    const isLocationUnchanged = isEditing && trimmedLocation === String(initialIdea.location || "").trim();
    const payloadBase =
      mode === "place"
        ? selectedSuggestion
          ? buildResolvedIdeaPayload(selectedSuggestion, {
              mode: "activity",
              listId: defaultListId,
              listName: normalizedListName,
              placeGroup: null
            })
          : buildFreeformIdeaPayload(trimmedTitle, {
              mode: "activity",
              listId: defaultListId,
              listName: normalizedListName,
              destination,
              placeGroup: null
            })
        : buildFreeformIdeaPayload(trimmedTitle, {
            mode: "activity",
            listId: defaultListId,
            listName: normalizedListName,
            destination,
            placeGroup: null
          });
    const mapQuery =
      mode === "place"
        ? (selectedSuggestion?.mapQuery || payloadBase.mapQuery || "")
        : selectedSuggestion?.mapQuery
          ? selectedSuggestion.mapQuery
          : trimmedLocation
            ? [trimmedTitle, trimmedLocation].filter(Boolean).join(", ")
            : "";

    const payload = {
      ...payloadBase,
      title: trimmedTitle,
      tabId,
      costEstimate: Number.isFinite(normalizedCost) ? normalizedCost : null,
      listId: targetListId,
      description: String(description || "").trim() || null,
      entryType: mode === "place" ? (selectedSuggestion ? payloadBase.entryType : "place") : "activity",
      location:
        isEditing && !selectedSuggestion && isTitleUnchanged && isLocationUnchanged
          ? initialIdea.location || ""
          : mode === "place"
            ? selectedSuggestion
              ? payloadBase.location
              : trimmedTitle || ""
            : selectedSuggestion
              ? selectedSuggestion.mapQuery || selectedSuggestion.address || selectedSuggestion.title || trimmedLocation
              : trimmedLocation || "",
      mapQuery:
        isEditing && !selectedSuggestion && isTitleUnchanged && isLocationUnchanged
          ? initialIdea.mapQuery || ""
          : mapQuery,
      coordinates:
        isEditing && !selectedSuggestion && isTitleUnchanged && isLocationUnchanged
          ? initialIdea.coordinates || null
          : selectedSuggestion?.coordinates || payloadBase.coordinates || null,
      photoUrl:
        isEditing && !selectedSuggestion && isTitleUnchanged && isLocationUnchanged
          ? initialIdea.photoUrl || ""
          : selectedSuggestion?.photoUrl || payloadBase.photoUrl || "",
      photoAttributions: Array.isArray(selectedSuggestion?.photoAttributions)
        ? selectedSuggestion.photoAttributions
        : isEditing && !selectedSuggestion && isTitleUnchanged && isLocationUnchanged
          ? initialIdea.photoAttributions || []
        : payloadBase.photoAttributions || [],
      recommendationSource:
        isEditing && !selectedSuggestion && isTitleUnchanged && isLocationUnchanged
          ? initialIdea.recommendationSource || null
          : selectedSuggestion
            ? "Google Maps"
            : payloadBase.recommendationSource || null
    };

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-card"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Type</p>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-full bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode("activity");
                    setSelectedSuggestion(null);
                    setSuggestions([]);
                    setSearchLocked(true);
                    setSearchError("");
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    mode === "activity" ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"
                  }`}
                >
                  Activity
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("place");
                    setSelectedSuggestion(null);
                    setSuggestions([]);
                    setSearchLocked(true);
                    setSearchError("");
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    mode === "place" ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"
                  }`}
                >
                  Place
                </button>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-ink"
              >
                ×
              </button>
            </div>
          </div>
          {Array.isArray(availableLists) && availableLists.length > 1 ? (
            <div className="relative min-w-0">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">List</label>
              <select
                value={selectedListId}
                onChange={(event) => setSelectedListId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
              >
                {availableLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="relative min-w-0">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              {mode === "place" ? "Place name" : "Activity name"}
            </label>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (mode === "place") {
                  setSearchLocked(false);
                  setSelectedSuggestion(null);
                }
              }}
              placeholder={mode === "place" ? "Search Google Maps or type a place" : "Running, museum, dinner reservation..."}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
            />
          </div>

          <div className="relative min-w-0">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Description (optional)</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Add a short note or detail"
              rows={3}
              className="mt-2 w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
            />
          </div>

          {mode === "activity" ? (
            <div className="relative min-w-0">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Location (optional)</label>
            <input
              value={location}
              onChange={(event) => {
                setSearchLocked(false);
                setLocation(event.target.value);
                setSelectedSuggestion(null);
              }}
              placeholder="Optional — e.g. Central Park"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
            />
            </div>
          ) : null}

          {(searching || suggestions.length || searchError) ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
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
                        {suggestion.photoUrl ? (
                          <img
                            src={suggestion.photoUrl}
                            alt={suggestion.title}
                            className="h-14 w-14 rounded-xl object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-xl bg-mist" />
                        )}
                        <div className="min-w-0 flex-1">
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
                        ? "No Google Maps match found yet."
                        : "Set VITE_GOOGLE_MAPS_API_KEY to enable Google Maps autocomplete.")}
                  </div>
                ) : null}
              </div>
            ) : null}

          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Estimated cost (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={costEstimate}
              onChange={(event) => setCostEstimate(event.target.value)}
              placeholder="0.00"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
            />
          </div>
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
            disabled={saving || !title.trim() || !(String(selectedListId || defaultListId || "").trim())}
            className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modal;
  }

  return createPortal(modal, document.body);
}
