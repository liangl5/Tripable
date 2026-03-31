import { useEffect, useMemo, useState } from "react";
import AvailabilityDetails from "./AvailabilityDetails.jsx";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, count) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateFromMonthKey(value) {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function parseISODate(value) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatISO(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateInputLabel(value) {
  const date = parseISODate(value);
  if (!date) return "mm/dd/yyyy";
  return date.toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function buildDateRange(startValue, endValue) {
  const start = parseISODate(startValue);
  const end = parseISODate(endValue);
  if (!start || !end || start.getTime() > end.getTime()) return [];

  const dates = [];
  const cursor = new Date(start);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(formatISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function normalizeRange(startValue, endValue) {
  if (!startValue || !endValue) return { start: "", end: "" };
  if (startValue <= endValue) return { start: startValue, end: endValue };
  return { start: endValue, end: startValue };
}

function buildRangeFromDates(dates, allowedDateSet) {
  const filtered = (dates || []).filter((date) => !allowedDateSet || allowedDateSet.has(date)).sort();
  if (!filtered.length) return { start: "", end: "" };
  return { start: filtered[0], end: filtered[filtered.length - 1] };
}

function distanceInDays(firstISO, secondISO) {
  const first = parseISODate(firstISO);
  const second = parseISODate(secondISO);
  if (!first || !second) return Number.MAX_SAFE_INTEGER;
  return Math.abs(first.getTime() - second.getTime());
}

function buildMonthCells(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(year, month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

export default function AvailabilityCalendar({
  trip,
  loading,
  onSaveAvailability,
  onSaveSurveyDates,
  statusMessage
}) {
  const members = trip?.members || [];
  const availability = trip?.availability || {};
  const surveyDatesFromTrip = trip?.surveyDates || [];
  const isViewerOwner = Boolean(trip?.isViewerCreator);
  const viewer = members.find((member) => member.isViewer) || null;
  const viewerAvailability = viewer ? availability[viewer.id] || [] : [];
  const surveyDatesKey = surveyDatesFromTrip.join("|");
  const originalSurveyRange = useMemo(
    () => ({
      start: surveyDatesFromTrip[0] || "",
      end: surveyDatesFromTrip[surveyDatesFromTrip.length - 1] || ""
    }),
    [surveyDatesKey]
  );

  const viewerAvailabilityKey = viewerAvailability.join("|");
  const initialMonth = useMemo(() => {
    if (surveyDatesFromTrip[0]) {
      return monthKey(new Date(`${surveyDatesFromTrip[0]}T00:00:00`));
    }
    return monthKey(startOfMonth(new Date()));
  }, [surveyDatesKey]);

  const [displayedMonthKey, setDisplayedMonthKey] = useState(initialMonth);
  const [mode, setMode] = useState("edit");
  const [editSurveyDates, setEditSurveyDates] = useState(false);
  const [surveyRange, setSurveyRange] = useState(() => originalSurveyRange);
  const [availabilityRange, setAvailabilityRange] = useState(() => buildRangeFromDates(viewerAvailability));
  const [isSavingSurveyDates, setIsSavingSurveyDates] = useState(false);
  const [isSavingAvailability, setIsSavingAvailability] = useState(false);
  const [dirtyAvailability, setDirtyAvailability] = useState(false);
  const [pendingRangeStart, setPendingRangeStart] = useState("");
  const [activeRangeHandle, setActiveRangeHandle] = useState(null);
  const [localMessage, setLocalMessage] = useState("");
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [memberViewMode, setMemberViewMode] = useState("table"); // "table" or "list"

  const displayedMonth = useMemo(() => dateFromMonthKey(displayedMonthKey), [displayedMonthKey]);
  const draftSurveyDates = useMemo(
    () => buildDateRange(surveyRange.start, surveyRange.end),
    [surveyRange.end, surveyRange.start]
  );
  const surveyDateSet = useMemo(
    () => new Set(editSurveyDates ? draftSurveyDates : surveyDatesFromTrip),
    [draftSurveyDates, editSurveyDates, surveyDatesKey]
  );
  const selectedDates = useMemo(() => {
    if (!availabilityRange.start || !availabilityRange.end) return new Set();
    return new Set(
      buildDateRange(availabilityRange.start, availabilityRange.end).filter((date) => surveyDateSet.has(date))
    );
  }, [availabilityRange.end, availabilityRange.start, surveyDateSet]);
  const selectedDateList = useMemo(() => [...selectedDates].sort(), [selectedDates]);
  const surveyRangeDirty = surveyRange.start !== originalSurveyRange.start || surveyRange.end !== originalSurveyRange.end;
  const surveyRangeError = useMemo(() => {
    if (!editSurveyDates) return "";
    if (!surveyRange.start && !surveyRange.end) return "";
    if (!surveyRange.start || !surveyRange.end) return "Choose both a start date and an end date.";
    if (surveyRange.start > surveyRange.end) return "End date must be on or after the start date.";
    return "";
  }, [editSurveyDates, surveyRange.end, surveyRange.start]);

  useEffect(() => {
    setDisplayedMonthKey(initialMonth);
  }, [initialMonth, trip?.id]);

  useEffect(() => {
    setSurveyRange(originalSurveyRange);
  }, [originalSurveyRange, trip?.id]);

  useEffect(() => {
    if (dirtyAvailability || pendingRangeStart || activeRangeHandle) return;
    setAvailabilityRange(buildRangeFromDates(viewerAvailability, surveyDateSet));
  }, [activeRangeHandle, dirtyAvailability, pendingRangeStart, surveyDateSet, viewer?.id, viewerAvailabilityKey]);

  const monthCells = useMemo(() => buildMonthCells(displayedMonth), [displayedMonth]);
  const overlapByDate = useMemo(() => {
    const entries = new Map();
    for (const member of members) {
      for (const date of availability[member.id] || []) {
        entries.set(date, (entries.get(date) || 0) + 1);
      }
    }
    return entries;
  }, [availability, members]);

  const maxOverlap = useMemo(() => {
    let highest = 0;
    for (const count of overlapByDate.values()) highest = Math.max(highest, count);
    return highest;
  }, [overlapByDate]);

  const toggleDate = (isoDate) => {
    if (isSavingAvailability || editSurveyDates || !surveyDateSet.has(isoDate)) return;

    if (!availabilityRange.start || !availabilityRange.end) {
      setAvailabilityRange({ start: isoDate, end: isoDate });
      setPendingRangeStart(isoDate);
      setActiveRangeHandle("end");
      setLocalMessage("Start date selected. Choose an end date.");
      return;
    }

    if (pendingRangeStart) {
      const nextRange = normalizeRange(pendingRangeStart, isoDate);
      const rangeDates = buildDateRange(nextRange.start, nextRange.end).filter((date) => surveyDateSet.has(date));

      setAvailabilityRange(nextRange);
      setPendingRangeStart("");
      setActiveRangeHandle(null);
      setDirtyAvailability(true);
      setLocalMessage(`${rangeDates.length} day${rangeDates.length === 1 ? "" : "s"} selected.`);
      return;
    }

    if (activeRangeHandle) {
      const nextRange = normalizeRange(
        activeRangeHandle === "start" ? isoDate : availabilityRange.start,
        activeRangeHandle === "end" ? isoDate : availabilityRange.end
      );
      setAvailabilityRange(nextRange);
      setActiveRangeHandle(null);
      setDirtyAvailability(true);
      setLocalMessage("Range updated.");
      return;
    }

    if (availabilityRange.start === isoDate && availabilityRange.end === isoDate) {
      setAvailabilityRange({ start: "", end: "" });
      setDirtyAvailability(true);
      setLocalMessage("Availability cleared.");
      return;
    }

    if (isoDate === availabilityRange.start) {
      setActiveRangeHandle("start");
      setLocalMessage("Choose a new start date.");
      return;
    }

    if (isoDate === availabilityRange.end) {
      setActiveRangeHandle("end");
      setLocalMessage("Choose a new end date.");
      return;
    }

    if (selectedDates.has(isoDate)) {
      const distanceToStart = distanceInDays(isoDate, availabilityRange.start);
      const distanceToEnd = distanceInDays(isoDate, availabilityRange.end);
      const nextRange = normalizeRange(
        distanceToStart <= distanceToEnd ? isoDate : availabilityRange.start,
        distanceToStart <= distanceToEnd ? availabilityRange.end : isoDate
      );
      setAvailabilityRange(nextRange);
      setDirtyAvailability(true);
      setLocalMessage("Range updated.");
      return;
    }

    const distanceToStart = distanceInDays(isoDate, availabilityRange.start);
    const distanceToEnd = distanceInDays(isoDate, availabilityRange.end);
    const nextRange = normalizeRange(
      distanceToStart <= distanceToEnd ? isoDate : availabilityRange.start,
      distanceToStart <= distanceToEnd ? availabilityRange.end : isoDate
    );
    setAvailabilityRange(nextRange);
    setDirtyAvailability(true);
    setLocalMessage("Range updated.");
  };

  const clearAvailability = () => {
    if (isSavingAvailability) return;
    if (!availabilityRange.start && !availabilityRange.end) return;
    setAvailabilityRange({ start: "", end: "" });
    setPendingRangeStart("");
    setActiveRangeHandle(null);
    setDirtyAvailability(true);
    setLocalMessage("Availability cleared.");
  };

  const handleSaveAvailability = async () => {
    if (!trip?.id || !dirtyAvailability || isSavingAvailability) return;
    setIsSavingAvailability(true);
    try {
      await onSaveAvailability(selectedDateList);
      setDirtyAvailability(false);
      setPendingRangeStart("");
      setActiveRangeHandle(null);
      setLocalMessage("Availability updated.");
    } catch (error) {
      setLocalMessage("Failed to save availability. Please try again.");
      console.error("Availability save error:", error);
    } finally {
      setIsSavingAvailability(false);
    }
  };

  const handleDiscardAvailability = () => {
    if (isSavingAvailability) return;
    setAvailabilityRange(buildRangeFromDates(viewerAvailability, surveyDateSet));
    setDirtyAvailability(false);
    setPendingRangeStart("");
    setActiveRangeHandle(null);
    setLocalMessage("Unsaved availability changes discarded.");
  };

  const handlePickRangeHandle = (handle) => {
    if (isSavingAvailability) return;
    if (!availabilityRange.start || !availabilityRange.end) {
      setLocalMessage("Select a start date first.");
      return;
    }
    const isClearingSelection = activeRangeHandle === handle;
    setPendingRangeStart("");
    setActiveRangeHandle((current) => (current === handle ? null : handle));
    if (isClearingSelection) {
      setLocalMessage("Handle selection cleared.");
      return;
    }
    if (handle === "start") {
      setLocalMessage("Start handle selected. Click a tile to move start.");
    } else {
      setLocalMessage("End handle selected. Click a tile to move end.");
    }
  };

  const handleResetSurveyDates = () => {
    setSurveyRange({ start: "", end: "" });
    setDisplayedMonthKey(monthKey(startOfMonth(new Date())));
    setLocalMessage("Selectable date range cleared. Save changes to apply.");
  };

  const handleCancelSurveyDates = () => {
    setSurveyRange(originalSurveyRange);
    setEditSurveyDates(false);
    setLocalMessage("Selectable date range edits discarded.");
  };

  const handleSaveSurveyDates = async () => {
    if (surveyRangeError) return;

    setIsSavingSurveyDates(true);
    try {
      await onSaveSurveyDates(draftSurveyDates);
      setEditSurveyDates(false);
      setLocalMessage("Selectable date range updated.");
    } catch (error) {
      setLocalMessage("Failed to save date range. Please try again.");
      console.error("Survey dates save error:", error);
    } finally {
      setIsSavingSurveyDates(false);
    }
  };

  const handleSurveyRangeChange = (field, value) => {
    setSurveyRange((current) => ({ ...current, [field]: value }));
    if (value) {
      const nextDate = parseISODate(value);
      if (nextDate) {
        setDisplayedMonthKey(monthKey(startOfMonth(nextDate)));
      }
    }
  };

  const canEditAvailability = surveyDatesFromTrip.length > 0;
  const monthStatusText = surveyRangeError || statusMessage || localMessage;

  return (
    <div className="relative rounded-3xl bg-white/95 p-6 shadow-card">
      {isSavingAvailability ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-white/60 backdrop-blur-[1px]">
          <div className="rounded-full bg-[#4C6FFF] px-4 py-2 text-xs font-semibold text-white shadow-card">
            Autosaving availability...
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Availability</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode("edit");
              setEditSurveyDates(false);
            }}
            className={classNames(
              "rounded-full px-4 py-2 text-xs font-semibold transition",
              mode === "edit" && !editSurveyDates ? "bg-[#4C6FFF] text-white" : "bg-mist text-ink"
            )}
          >
            Select/Edit your availability
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("group");
              setEditSurveyDates(false);
              setShowDetailedView(false);
            }}
            className={classNames(
              "rounded-full px-4 py-2 text-xs font-semibold transition",
              mode === "group" && !showDetailedView ? "bg-[#4C6FFF] text-white" : "bg-mist text-ink"
            )}
          >
            See group availability
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("group");
              setEditSurveyDates(false);
              setShowDetailedView(true);
            }}
            className={classNames(
              "rounded-full px-4 py-2 text-xs font-semibold transition",
              showDetailedView ? "bg-[#4C6FFF] text-white" : "bg-mist text-ink"
            )}
          >
            View member breakdown
          </button>
          {isViewerOwner ? (
            <button
              type="button"
              onClick={() => {
                setMode("edit");
                setEditSurveyDates(true);
                setSurveyRange(originalSurveyRange);
              }}
              className={classNames(
                "rounded-full px-4 py-2 text-xs font-semibold transition",
                editSurveyDates ? "bg-[#6BCB77] text-white" : "bg-[#E8F7EB] text-[#2C8B44]"
              )}
            >
              {editSurveyDates ? "Editing date range" : "Set date range"}
            </button>
          ) : null}
        </div>
      </div>

      {editSurveyDates ? (
        <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-slate-200/80 bg-[#FBFCFF] p-4 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Start date
            <input
              type="date"
              value={surveyRange.start}
              onChange={(event) => handleSurveyRangeChange("start", event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-normal text-ink appearance-none"
            />
            <span className="text-xs font-normal text-slate-500">{formatDateInputLabel(surveyRange.start)}</span>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            End date
            <input
              type="date"
              value={surveyRange.end}
              min={surveyRange.start || undefined}
              onChange={(event) => handleSurveyRangeChange("end", event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-normal text-ink appearance-none"
            />
            <span className="text-xs font-normal text-slate-500">{formatDateInputLabel(surveyRange.end)}</span>
          </label>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDisplayedMonthKey((current) => monthKey(addMonths(dateFromMonthKey(current), -1)))}
            className="rounded-full bg-mist px-3 py-2 text-sm font-semibold text-ink"
          >
            ←
          </button>
          <div className="rounded-full bg-[#EEF2FF] px-4 py-2 text-sm font-semibold text-[#4C6FFF]">
            {formatMonthLabel(displayedMonth)}
          </div>
          <button
            type="button"
            onClick={() => setDisplayedMonthKey((current) => monthKey(addMonths(dateFromMonthKey(current), 1)))}
            className="rounded-full bg-mist px-3 py-2 text-sm font-semibold text-ink"
          >
            →
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          {editSurveyDates ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#6BCB77]" />
              Selectable trip range
            </span>
          ) : mode === "group" ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#6BCB77]" />
              More overlap = darker green
            </span>
          ) : (
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#6BCB77]" />
              Your selected availability
            </span>
          )}

          {!editSurveyDates && mode === "edit" ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handlePickRangeHandle("start")}
                disabled={isSavingAvailability}
                className={classNames(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  activeRangeHandle === "start" ? "bg-[#4C6FFF] text-white" : "bg-white text-ink shadow-soft",
                  isSavingAvailability ? "opacity-60 cursor-not-allowed" : ""
                )}
              >
                Adjust start
              </button>
              <button
                type="button"
                onClick={() => handlePickRangeHandle("end")}
                disabled={isSavingAvailability}
                className={classNames(
                  "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  activeRangeHandle === "end" ? "bg-[#4C6FFF] text-white" : "bg-white text-ink shadow-soft",
                  isSavingAvailability ? "opacity-60 cursor-not-allowed" : ""
                )}
              >
                Adjust end
              </button>
              <button
                type="button"
                onClick={clearAvailability}
                disabled={isSavingAvailability}
                className={classNames(
                  "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-soft transition hover:bg-slate-50",
                  isSavingAvailability ? "opacity-60 cursor-not-allowed" : ""
                )}
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {!canEditAvailability && !editSurveyDates ? (
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-300 bg-mist px-4 py-6 text-sm text-slate-500">
          {isViewerOwner
            ? "Start by clicking 'Set date range' and choosing the trip's start and end dates."
            : "Waiting for the trip owner to choose the date window."}
        </div>
      ) : (
        <div className="mt-6 rounded-[1.75rem] border border-slate-200/80 bg-[#FBFCFF] p-4">
          <div className="grid grid-cols-7 gap-2">
            {DAY_NAMES.map((day) => (
              <div key={day} className="px-1 pb-2 text-center text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {day}
              </div>
            ))}

            {monthCells.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="aspect-square rounded-2xl bg-transparent" />;
              }

              const isoDate = formatISO(date);
              const inSurvey = surveyDateSet.has(isoDate);
              const isSelected = selectedDates.has(isoDate);
              const overlap = overlapByDate.get(isoDate) || 0;
              const overlapStrength = maxOverlap > 0 ? overlap / maxOverlap : 0;
              const isToday = isoDate === formatISO(new Date());
              const disabled = !editSurveyDates && !inSurvey;
              const isRangeStart = mode === "edit" && availabilityRange.start === isoDate;
              const isRangeEnd = mode === "edit" && availabilityRange.end === isoDate;
              const isPendingStart = mode === "edit" && pendingRangeStart === isoDate;

              let cellStyle = "border-slate-200/70 bg-white text-ink";
              let inlineStyle;

              if (editSurveyDates && inSurvey) {
                cellStyle = "border-[#6BCB77] bg-[#E8F7EB] text-ink";
              } else if (mode === "edit" && isSelected) {
                cellStyle = "border-[#4C6FFF] bg-[#4C6FFF] text-white shadow-soft";
              } else if (mode === "group" && inSurvey && overlap > 0) {
                cellStyle = "border-[#6BCB77]/40 text-ink";
                inlineStyle = {
                  backgroundColor: `rgba(107, 203, 119, ${0.15 + overlapStrength * 0.45})`
                };
              } else if (inSurvey) {
                cellStyle = "border-[#4C6FFF]/25 bg-[#EEF2FF] text-ink";
              }

              return (
                <button
                  key={isoDate}
                  type="button"
                  disabled={isSavingAvailability || mode === "group" || editSurveyDates || disabled}
                  onClick={() => toggleDate(isoDate)}
                  className={classNames(
                    "relative aspect-square rounded-2xl border p-2 text-left transition",
                    cellStyle,
                    disabled || mode === "group" ? "cursor-default" : "cursor-pointer",
                    disabled ? "opacity-35" : "",
                    isPendingStart ? "ring-2 ring-[#4C6FFF]/70 ring-offset-2 ring-offset-[#FBFCFF]" : "",
                    isRangeStart ? "rounded-l-[1.2rem]" : "",
                    isRangeEnd ? "rounded-r-[1.2rem]" : ""
                  )}
                  style={inlineStyle}
                >
                  <span className="text-sm font-semibold">{date.getDate()}</span>
                  {editSurveyDates ? (
                    inSurvey ? (
                      <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#6BCB77]" aria-label="Open" />
                    ) : null
                  ) : mode === "group" ? (
                    inSurvey ? (
                      <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#6BCB77]" aria-label="Members available" />
                    ) : null
                  ) : isSelected ? (
                    <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#6BCB77]" aria-label="Selected" />
                  ) : inSurvey ? (
                    <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-[#F56565]" aria-label="Available to select" />
                  ) : null}

                  {!editSurveyDates && mode === "edit" && isRangeStart ? (
                    <span
                      className="absolute left-1 top-1 rounded-full bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-[#4C6FFF]"
                      aria-label="Start"
                    >
                      S
                    </span>
                  ) : null}
                  {!editSurveyDates && mode === "edit" && isRangeEnd ? (
                    <span
                      className="absolute right-1 top-1 rounded-full bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold text-[#4C6FFF]"
                      aria-label="End"
                    >
                      E
                    </span>
                  ) : null}

                  {isToday ? (
                    <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#FFB86B]" aria-hidden="true" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {members.map((member) => (
          <div key={member.id} className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-ink">
            {member.isViewer ? "You" : member.name}
            <span className="ml-2 text-slate-400">{(availability[member.id] || []).length} days</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-[1.5rem] bg-mist px-4 py-4">
        <p className="text-sm font-semibold text-ink">
          {editSurveyDates
            ? draftSurveyDates.length === 0 && !surveyRange.start && !surveyRange.end
              ? "No selectable date range set"
              : `${draftSurveyDates.length} selectable day${draftSurveyDates.length === 1 ? "" : "s"}`
            : `${selectedDates.size} day${selectedDates.size === 1 ? "" : "s"} marked free`}
        </p>

        {editSurveyDates ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleResetSurveyDates}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSaveSurveyDates}
              disabled={!surveyRangeDirty || Boolean(surveyRangeError) || isSavingSurveyDates || loading}
              className="rounded-full bg-[#4C6FFF] px-5 py-2.5 text-sm font-semibold text-white shadow-card disabled:opacity-60"
            >
              {isSavingSurveyDates ? "Saving..." : "Save changes"}
            </button>
            <button
              type="button"
              onClick={handleCancelSurveyDates}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft"
            >
              Cancel
            </button>
          </div>
        ) : mode === "edit" ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleSaveAvailability}
              disabled={!dirtyAvailability || isSavingAvailability || loading}
              className="rounded-full bg-[#4C6FFF] px-5 py-2.5 text-sm font-semibold text-white shadow-card disabled:opacity-60"
            >
              {isSavingAvailability ? "Saving..." : "Save availability"}
            </button>
            <button
              type="button"
              onClick={handleDiscardAvailability}
              disabled={!dirtyAvailability || isSavingAvailability}
              className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink shadow-soft disabled:opacity-60"
            >
              Discard changes
            </button>
          </div>
        ) : null}
      </div>

      {showDetailedView ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-card">
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-ink">Member Availability</h3>
                <button
                  type="button"
                  onClick={() => setShowDetailedView(false)}
                  className="text-sm font-semibold text-slate-500 hover:text-ink"
                >
                  Close
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMemberViewMode("table")}
                  className={classNames(
                    "rounded-full px-3 py-2 text-xs font-semibold transition",
                    memberViewMode === "table" ? "bg-[#4C6FFF] text-white" : "bg-mist text-ink"
                  )}
                >
                  Date columns
                </button>
                <button
                  type="button"
                  onClick={() => setMemberViewMode("list")}
                  className={classNames(
                    "rounded-full px-3 py-2 text-xs font-semibold transition",
                    memberViewMode === "list" ? "bg-[#4C6FFF] text-white" : "bg-mist text-ink"
                  )}
                >
                  Member list
                </button>
              </div>
            </div>

            {memberViewMode === "table" ? (
              <AvailabilityDetails 
                members={members} 
                availability={availability} 
                surveyDates={surveyDatesFromTrip}
              />
            ) : (
              <div className="space-y-4">
                {members.map((member) => {
                  const memberAvailability = availability[member.id] || [];
                  return (
                    <div key={member.id} className="rounded-2xl bg-mist p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-ink">{member.isViewer ? "You" : member.name}</span>
                        {member.isLeader && (
                          <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-xs font-semibold text-[#4C6FFF]">
                            Leader
                          </span>
                        )}
                        <span className="ml-auto text-xs text-slate-500">
                          {memberAvailability.length}/{surveyDatesFromTrip.length} days
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {surveyDatesFromTrip.map((date) => {
                          const isAvailable = memberAvailability.includes(date);
                          const dateObj = new Date(date);
                          const dateLabel = dateObj.toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric',
                            weekday: 'short'
                          });
                          return (
                            <div
                              key={`${member.id}-${date}`}
                              className={classNames(
                                "rounded-lg px-2 py-1 text-xs font-medium",
                                isAvailable 
                                  ? "bg-[#6BCB77] text-white" 
                                  : "bg-[#F56565] text-white"
                              )}
                            >
                              {dateLabel}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
