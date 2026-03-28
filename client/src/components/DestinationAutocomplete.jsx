import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";

export default function DestinationAutocomplete({
  value,
  selectedDestination,
  onChange,
  onSelect,
  label = "Destination",
  placeholder = "Search city, region, or country"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [error, setError] = useState("");
  const sessionTokenRef = useRef("");
  const canSearchDestinations = api.canSearchPlaces();

  useEffect(() => {
    const trimmedValue = value.trim();

    if (!isOpen || trimmedValue.length < 2) {
      setOptions([]);
      setLoading(false);
      setError("");
      if (!trimmedValue) {
        sessionTokenRef.current = "";
      }
      return;
    }

    if (!canSearchDestinations) {
      setOptions([]);
      setLoading(false);
      setError("Add VITE_GOOGLE_MAPS_API_KEY to search Google Maps destinations.");
      return;
    }

    if (!sessionTokenRef.current) {
      sessionTokenRef.current = crypto.randomUUID();
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const results = await api.searchDestinations(trimmedValue, { sessionToken: sessionTokenRef.current });
        if (cancelled) return;
        setOptions(results);
        if (!results.length) {
          setError("No Google Maps destinations matched that search yet.");
        }
      } catch (searchError) {
        if (cancelled) return;
        setOptions([]);
        setError(searchError?.message || "Google Maps destination search failed.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canSearchDestinations, isOpen, value]);

  const handleSelect = async (destinationPrediction) => {
    if (!destinationPrediction || selectionLoading) return;

    const selectedDisplayValue = String(
      destinationPrediction.label || destinationPrediction.mapQuery || destinationPrediction.name || ""
    ).trim();

    setSelectionLoading(true);
    setError("");
    try {
      const resolvedDestination = await api.resolveDestination(destinationPrediction, {
        sessionToken: sessionTokenRef.current
      });
      onSelect(resolvedDestination || destinationPrediction, selectedDisplayValue);
      setIsOpen(false);
      setOptions([]);
      sessionTokenRef.current = "";
    } catch (selectionError) {
      setError(selectionError?.message || "Could not load that destination from Google Maps.");
    } finally {
      setSelectionLoading(false);
    }
  };

  return (
    <div className="relative">
      <label className="text-sm font-semibold text-ink">{label}</label>
      <input
        value={value}
        disabled={selectionLoading}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink shadow-soft outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10 disabled:opacity-70"
      />

      {isOpen && value.trim().length >= 2 ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          {loading ? (
            <div className="px-4 py-3 text-sm text-slate-500">Searching Google Maps...</div>
          ) : options.length ? (
            options.map((destination) => (
              <button
                key={destination.placeId || destination.id}
                type="button"
                disabled={selectionLoading}
                onMouseDown={(event) => {
                  event.preventDefault();
                  void handleSelect(destination);
                }}
                className="flex w-full items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-mist last:border-b-0 disabled:opacity-70"
              >
                <p className="text-sm font-semibold text-ink">{destination.label}</p>
                <span className="rounded-full bg-mist px-3 py-1 text-[11px] font-semibold text-slate-500">
                  {destination.type}
                </span>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500">
              {error || "No Google Maps destinations matched that search yet."}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
