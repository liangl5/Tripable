import { useMemo, useState } from "react";
import { searchDestinations } from "../lib/tripPlanning.js";

export default function DestinationAutocomplete({
  value,
  selectedDestination,
  onChange,
  onSelect,
  label = "Destination",
  placeholder = "Search city, region, or country"
}) {
  const [isOpen, setIsOpen] = useState(false);

  const options = useMemo(() => searchDestinations(value), [value]);

  return (
    <div className="relative">
      <label className="text-sm font-semibold text-ink">{label}</label>
      <input
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => {
          window.setTimeout(() => setIsOpen(false), 120);
        }}
        placeholder={placeholder}
        className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-ink shadow-soft outline-none transition focus:border-ocean focus:ring-2 focus:ring-ocean/10"
      />

      {selectedDestination ? (
        <p className="mt-2 text-xs text-slate-500">
          {selectedDestination.type} | {selectedDestination.summary}
        </p>
      ) : null}

      {isOpen && options.length ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          {options.map((destination) => (
            <button
              key={destination.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                onSelect(destination);
                setIsOpen(false);
              }}
              className="flex w-full items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-mist last:border-b-0"
            >
              <div>
                <p className="text-sm font-semibold text-ink">{destination.label}</p>
                <p className="mt-1 text-xs text-slate-500">{destination.summary}</p>
              </div>
              <span className="rounded-full bg-mist px-3 py-1 text-[11px] font-semibold text-slate-500">
                {destination.type}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
