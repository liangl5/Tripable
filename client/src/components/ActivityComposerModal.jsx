import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { buildFreeformIdeaPayload, buildResolvedIdeaPayload } from "../lib/ideaComposer.js";
export default function ActivityComposerModal({
  open,
  tabId,
  destination,
  defaultListId = "",
  defaultTitle = "",
  onClose,
  onSave
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [costEstimate, setCostEstimate] = useState("");
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
    setTitle(defaultTitle || "");
    setCostEstimate("");
    setSelectedSuggestion(null);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setSearchLocked(true);
    setSearchError("");
    setSaving(false);
  }, [defaultListId, defaultTitle, open]);

  useEffect(() => {
    if (!open) return;

    const trimmedTitle = title.trim();
    setSearchError("");

    if (searchLocked || !canSearchPlaces || trimmedTitle.length < 2) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    if (selectedSuggestion && trimmedTitle === selectedSuggestion.title.trim()) {
      setSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const results = await api.searchPlaces(trimmedTitle, destination);
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
  }, [canSearchPlaces, destination, open, searchLocked, selectedSuggestion, title]);

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
    setTitle(suggestion.title);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setSearchError("");
    setSearchLocked(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !defaultListId || saving) return;
    const costValue = String(costEstimate || "").trim();
    const normalizedCost = costValue ? Number(costValue) : null;
    const activityMode = "activity";
    const payloadBase = selectedSuggestion
      ? buildResolvedIdeaPayload(selectedSuggestion, {
          mode: activityMode,
          listId: defaultListId,
          listName: "",
          placeGroup: null
        })
      : buildFreeformIdeaPayload(title.trim(), {
          mode: activityMode,
          listId: defaultListId,
          listName: "",
          destination,
          placeGroup: null
        });

    const payload = {
      ...payloadBase,
      title: selectedSuggestion?.title || title.trim(),
      tabId,
      costEstimate: Number.isFinite(normalizedCost) ? normalizedCost : null,
      listId: defaultListId,
      description: ""
    };

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 px-4 py-6"
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute -right-3 -top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-mist text-lg font-semibold text-slate-500 transition hover:bg-slate-200 hover:text-ink"
        >
          ×
        </button>
        <div className="grid gap-4">
          <div className="relative min-w-0">
            <label className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Activity name or place</label>
            <input
              value={title}
              onChange={(event) => {
                setSearchLocked(false);
                setTitle(event.target.value);
                setSelectedSuggestion(null);
              }}
              placeholder="Search Google Maps or type a custom activity"
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
            />

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
                    {searchError || (canSearchPlaces ? "No Google Maps match found yet." : "Set VITE_GOOGLE_MAPS_API_KEY to enable Google Maps autocomplete.")}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {selectedSuggestion ? (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
              <div className="grid gap-0 md:grid-cols-[170px_1fr]">
                {selectedSuggestion.photoUrl ? (
                  <img
                    src={selectedSuggestion.photoUrl}
                    alt={selectedSuggestion.title}
                    className="h-full min-h-40 w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="flex min-h-40 items-center justify-center bg-mist text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    No photo
                  </div>
                )}
                <div className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Place preview</p>
                  <h4 className="mt-2 text-lg font-semibold text-ink">{selectedSuggestion.title}</h4>
                  <p className="mt-2 text-sm text-slate-600">{selectedSuggestion.address}</p>
                  {selectedSuggestion.primaryTypeLabel ? (
                    <p className="mt-2 text-xs font-semibold text-ocean">{selectedSuggestion.primaryTypeLabel}</p>
                  ) : null}
                </div>
              </div>
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
            disabled={saving || !title.trim() || !defaultListId}
            className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-70"
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}