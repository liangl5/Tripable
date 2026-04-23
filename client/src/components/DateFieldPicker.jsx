import { useEffect, useRef, useState } from "react";
import {
  DAY_NAMES,
  addMonths,
  buildMonthCells,
  formatISO,
  monthKey,
  startOfMonth
} from "../lib/calendarHelpers.js";

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function dateFromMonthKey(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  return new Date(year, (month || 1) - 1, 1);
}

function parseISODate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatMonthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function formatDateInputLabel(value) {
  const parsed = parseISODate(value);
  if (!parsed) return "mm/dd/yyyy";
  return parsed.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-4 w-4">
      <path
        d="M7 2v3M17 2v3M3 9h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function DateFieldPicker({
  label,
  value,
  onChange,
  minDate,
  maxDate
}) {
  const containerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [displayedMonthKey, setDisplayedMonthKey] = useState(() => {
    const initialDate = parseISODate(value) || parseISODate(minDate) || new Date();
    return monthKey(startOfMonth(initialDate));
  });

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const activeDate = parseISODate(value) || parseISODate(minDate) || new Date();
    setDisplayedMonthKey(monthKey(startOfMonth(activeDate)));
  }, [isOpen, minDate, value]);

  const displayedMonth = dateFromMonthKey(displayedMonthKey);
  const monthCells = buildMonthCells(displayedMonth);

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex min-w-[13rem] flex-col">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className={classNames(
          "mt-1 flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition",
          value
            ? "border-slate-300 bg-white text-ink hover:border-slate-400"
            : "border-slate-300 bg-white text-slate-400 hover:border-slate-400"
        )}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span>{formatDateInputLabel(value)}</span>
        <span className="text-slate-500">
          <CalendarIcon />
        </span>
      </button>

      {isOpen ? (
        <div className="absolute left-0 top-full z-50 mt-2 w-[18rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-card">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setDisplayedMonthKey(monthKey(addMonths(displayedMonth, -1)))}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-ink"
              aria-label="Previous month"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M11.5 5.5 7 10l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <p className="text-sm font-semibold text-ink">{formatMonthLabel(displayedMonth)}</p>
            <button
              type="button"
              onClick={() => setDisplayedMonthKey(monthKey(addMonths(displayedMonth, 1)))}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-ink"
              aria-label="Next month"
            >
              <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                <path d="M8.5 5.5 13 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            {DAY_NAMES.map((dayName) => (
              <span key={dayName} className="py-1">
                {dayName}
              </span>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthCells.map((date, index) => {
              if (!date) {
                return <span key={`empty-${displayedMonthKey}-${index}`} className="h-9 w-9" aria-hidden="true" />;
              }

              const isoDate = formatISO(date);
              const isSelected = value === isoDate;
              const isDisabled = Boolean((minDate && isoDate < minDate) || (maxDate && isoDate > maxDate));

              return (
                <button
                  key={isoDate}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelect(isoDate)}
                  className={classNames(
                    "h-9 w-9 rounded-full text-sm font-medium transition",
                    isSelected && "bg-[#1e4840] text-white",
                    !isSelected && !isDisabled && "text-ink hover:bg-slate-100",
                    isDisabled && "cursor-not-allowed text-slate-300"
                  )}
                  aria-pressed={isSelected}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => handleSelect("")}
              disabled={!value}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full px-3 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-ink"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
