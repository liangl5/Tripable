import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { clearGeneratedItinerary } from "../../lib/tripPlanning";

export default function ItineraryTab({ tab, tripId, userId, userRole, ideas, trip }) {
  const [days, setDays] = useState([]);
  const [itineraryItems, setItineraryItems] = useState([]);
  const [allowedListIds, setAllowedListIds] = useState(null);
  const [showActivityBank, setShowActivityBank] = useState(true);
  const [draggedActivity, setDraggedActivity] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [dateRangeError, setDateRangeError] = useState("");
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const canManageItinerary = userRole === "owner" || userRole === "editor";

  // Load itinerary configuration and days
  useEffect(() => {
    const loadItinerary = async () => {
      try {
        setLoading(true);

        // Load itinerary days
        const { data: daysData } = await supabase
          .from("ItineraryDay")
          .select("*")
          .eq("tabId", tab.id)
          .order("dayNumber", { ascending: true });

        setDays(daysData || []);

        // Load itinerary items for all days
        const dayIds = (daysData || []).map((d) => d.id);
        let itemsData = [];
        if (dayIds.length > 0) {
          const { data } = await supabase
            .from("ItineraryItem")
            .select("*")
            .in("itineraryDayId", dayIds);
          itemsData = data || [];
        }

        const nextItems = itemsData || [];
        setItineraryItems(nextItems);

        // Load allowed lists for this tab
        const { data: configData } = await supabase
          .from("ItineraryTabConfiguration")
          .select("allowedListIds")
          .eq("tabId", tab.id)
          .maybeSingle();

        setAllowedListIds(configData?.allowedListIds);

        const nextDates = (daysData || [])
          .map((day) => (day?.date ? String(day.date).slice(0, 10) : null))
          .filter(Boolean)
          .sort();
        if (nextDates.length > 0) {
          setDateRangeStart(nextDates[0]);
          setDateRangeEnd(nextDates[nextDates.length - 1]);
        } else if (trip?.startDate && trip?.endDate) {
          setDateRangeStart(String(trip.startDate).slice(0, 10));
          setDateRangeEnd(String(trip.endDate).slice(0, 10));
        }
        setIsEditMode(canManageItinerary && nextItems.length === 0);
      } catch (error) {
        console.error("Failed to load itinerary:", error);
      } finally {
        setLoading(false);
      }
    };

    loadItinerary();
  }, [tab.id, tripId, canManageItinerary, trip?.startDate, trip?.endDate]);

  useEffect(() => {
    if (!unsavedChanges) return undefined;
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [unsavedChanges]);

  const parseDateOnly = (value) => {
    if (!value) return null;
    const [year, month, day] = value.split("-").map((part) => Number(part));
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const toDateStorageValue = (dateStr) => {
    if (!dateStr) return null;
    return `${dateStr}T12:00:00Z`;
  };

  const buildDateRange = (start, end) => {
    if (!start || !end) return [];
    const startDate = parseDateOnly(start);
    const endDate = parseDateOnly(end);
    if (!startDate || !endDate) return [];
    const dates = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  };

  const formatDayLabel = (dateValue) => {
    if (!dateValue) return "Date TBD";
    const dateKey = String(dateValue).slice(0, 10);
    const parsed = parseDateOnly(dateKey);
    if (!parsed) return "Date TBD";
    return parsed.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric"
    });
  };

  const handleAddDay = async () => {
    if (!canManageItinerary) return;

    try {
      const maxDayNumber = days.reduce((max, day) => Math.max(max, day.dayNumber || 0), 0);
      const nextDayNumber = maxDayNumber + 1;
      const lastDay = [...days].sort((a, b) => a.dayNumber - b.dayNumber).at(-1);
      let nextDate = null;
      let nextDateKey = null;
      if (lastDay?.date) {
        const lastKey = String(lastDay.date).slice(0, 10);
        const date = parseDateOnly(lastKey);
        if (date) {
          date.setDate(date.getDate() + 1);
          nextDateKey = date.toISOString().slice(0, 10);
          nextDate = toDateStorageValue(nextDateKey);
        }
      }
      const { data, error } = await supabase
        .from("ItineraryDay")
        .insert([
          {
            id: crypto.randomUUID(),
            tripId,
            tabId: tab.id,
            dayNumber: nextDayNumber,
            date: nextDate
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setDays([...days, data].sort((a, b) => a.dayNumber - b.dayNumber));
      if (nextDateKey) {
        if (!dateRangeStart || nextDateKey < dateRangeStart) setDateRangeStart(nextDateKey);
        if (!dateRangeEnd || nextDateKey > dateRangeEnd) setDateRangeEnd(nextDateKey);
      }
      setUnsavedChanges(true);
    } catch (error) {
      console.error("Failed to add day:", error);
    }
  };

  const handleDeleteDay = async (dayId) => {
    if (!canManageItinerary) return;
    const shouldDelete = window.confirm("Delete this day and its activities? This cannot be undone.");
    if (!shouldDelete) return;

    try {
      await supabase.from("ItineraryDay").delete().eq("id", dayId);
      setDays(days.filter((d) => d.id !== dayId));
      setItineraryItems(itineraryItems.filter((item) => item.itineraryDayId !== dayId));
      setUnsavedChanges(true);
    } catch (error) {
      console.error("Failed to delete day:", error);
    }
  };

  const handleDragStart = (activity) => {
    setDraggedActivity(activity);
  };

  const handleItemDragStart = (item) => {
    if (!canManageItinerary) return;
    setDraggedItem(item);
  };

  const resequenceDayItems = (items, dayId) => {
    const dayItems = items
      .filter((item) => item.itineraryDayId === dayId)
      .sort((a, b) => a.order - b.order);
    const others = items.filter((item) => item.itineraryDayId !== dayId);
    const resequenced = dayItems.map((item, index) => ({ ...item, order: index }));
    return [...others, ...resequenced];
  };

  const resequenceAllDays = (items) => {
    const dayIds = Array.from(new Set(items.map((item) => item.itineraryDayId)));
    return dayIds.reduce((acc, dayId) => resequenceDayItems(acc, dayId), items);
  };

  const handleDropOnDay = async (dayId) => {
    if (!canManageItinerary || !isEditMode) {
      setDraggedActivity(null);
      setDraggedItem(null);
      return;
    }

    try {
      if (draggedActivity) {
        const newItem = {
          id: crypto.randomUUID(),
          itineraryDayId: dayId,
          ideaId: draggedActivity.id,
          title: draggedActivity.title,
          location: draggedActivity.location,
          order: itineraryItems.filter((i) => i.itineraryDayId === dayId).length
        };

        setItineraryItems([...itineraryItems, newItem]);
        setUnsavedChanges(true);
      } else if (draggedItem) {
        const moved = itineraryItems.map((item) =>
          item.id === draggedItem.id
            ? {
                ...item,
                itineraryDayId: dayId,
                order: itineraryItems.filter((i) => i.itineraryDayId === dayId).length
              }
            : item
        );
        setItineraryItems(resequenceAllDays(moved));
        setUnsavedChanges(true);
      }
    } catch (error) {
      console.error("Failed to add activity to day:", error);
    } finally {
      setDraggedActivity(null);
      setDraggedItem(null);
    }
  };

  const handleDropOnActivityBank = () => {
    if (!canManageItinerary || !isEditMode) {
      setDraggedItem(null);
      return;
    }

    if (!draggedItem) return;

    setItineraryItems(itineraryItems.filter((item) => item.id !== draggedItem.id));
    setUnsavedChanges(true);
    setDraggedItem(null);
  };

  const handleRemoveActivityFromDay = (itemId) => {
    if (!canManageItinerary || !isEditMode) return;

    setItineraryItems(itineraryItems.filter((i) => i.id !== itemId));
    setUnsavedChanges(true);
  };

  const handleSaveItinerary = async () => {
    if (!unsavedChanges) return;

    try {
      setLoading(true);

      // Delete all old items
      const dayIds = days.map((d) => d.id);
      if (dayIds.length > 0) {
        await supabase.from("ItineraryItem").delete().in("itineraryDayId", dayIds);
      }

      // Insert new items
      if (itineraryItems.length > 0) {
        await supabase.from("ItineraryItem").insert(itineraryItems);
      }

      clearGeneratedItinerary(tripId);
      setUnsavedChanges(false);
      setIsEditMode(itineraryItems.length === 0);
    } catch (error) {
      console.error("Failed to save itinerary:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyDateRange = async () => {
    if (!canManageItinerary || !isEditMode) return;
    setDateRangeError("");

    if (!dateRangeStart || !dateRangeEnd) {
      setDateRangeError("Choose both a start and end date.");
      return;
    }

    if (dateRangeEnd < dateRangeStart) {
      setDateRangeError("End date must be on or after the start date.");
      return;
    }

    const dates = buildDateRange(dateRangeStart, dateRangeEnd);
    const sortedDays = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
    const extraDays = sortedDays.slice(dates.length);
    const extraDayIds = new Set(extraDays.map((day) => day.id));
    const extraItemCount = itineraryItems.filter((item) => extraDayIds.has(item.itineraryDayId)).length;

    if (extraItemCount > 0) {
      const proceed = window.confirm(
        "Shortening the date range will remove days and any activities scheduled on them. Continue?"
      );
      if (!proceed) return;
    }

    try {
      setLoading(true);
      const updates = [];
      const nextDays = [];

      dates.forEach((dateStr, index) => {
        const existing = sortedDays[index];
        const nextDate = toDateStorageValue(dateStr);
        const existingDateKey = existing?.date ? String(existing.date).slice(0, 10) : null;
        if (existing) {
          if (existing.dayNumber !== index + 1 || existingDateKey !== dateStr) {
            updates.push({ id: existing.id, dayNumber: index + 1, date: nextDate });
          }
          nextDays.push({ ...existing, dayNumber: index + 1, date: nextDate });
        }
      });

      if (updates.length > 0) {
        await Promise.all(
          updates.map((update) =>
            supabase.from("ItineraryDay").update({ dayNumber: update.dayNumber, date: update.date }).eq("id", update.id)
          )
        );
      }

      if (extraDays.length > 0) {
        await supabase.from("ItineraryDay").delete().in("id", extraDays.map((day) => day.id));
      }

      let insertedDays = [];
      if (dates.length > sortedDays.length) {
        const inserts = dates.slice(sortedDays.length).map((dateStr, index) => ({
          id: crypto.randomUUID(),
          tripId,
          tabId: tab.id,
          dayNumber: sortedDays.length + index + 1,
          date: toDateStorageValue(dateStr)
        }));
        const { data, error } = await supabase.from("ItineraryDay").insert(inserts).select();
        if (error) throw error;
        insertedDays = data || [];
      }

      const nextItems = itineraryItems.filter((item) => !extraDayIds.has(item.itineraryDayId));
      setItineraryItems(nextItems);
      setDays([...nextDays, ...insertedDays].sort((a, b) => a.dayNumber - b.dayNumber));
      setUnsavedChanges(true);
    } catch (error) {
      console.error("Failed to apply date range:", error);
      setDateRangeError("Failed to update dates. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getActivityBank = () => {
    let filtered = ideas;

    if (allowedListIds) {
      filtered = filtered.filter((idea) => allowedListIds.includes(idea.listId));
    }

    return filtered.filter(
      (idea) =>
        !itineraryItems.some((item) => item.ideaId === idea.id) &&
        idea.entryType !== "activity"
    );
  };

  const remainingActivityCount = getActivityBank().length;

  const getVoteSummary = (votesInput) => {
    const votes = Array.isArray(votesInput) ? votesInput : [];
    const upvotes = votes.filter((vote) => vote.value === 1);
    const downvotes = votes.filter((vote) => vote.value === -1);
    const upNames = upvotes.map((vote) => vote.name || "Traveler");
    const downNames = downvotes.map((vote) => vote.name || "Traveler");
    const tooltip = [
      upNames.length > 0 ? `Upvotes: ${upNames.join(", ")}` : "Upvotes: none",
      downNames.length > 0 ? `Downvotes: ${downNames.join(", ")}` : "Downvotes: none"
    ].join("\n");

    return {
      up: upvotes.length,
      down: downvotes.length,
      tooltip
    };
  };

  const getVoteSummaryForIdea = (ideaId) => {
    const idea = ideas.find((candidate) => candidate.id === ideaId);
    return getVoteSummary(idea?.votes);
  };

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Loading itinerary...</div>;
  }

  return (
    <div className="flex flex-col gap-4 p-6 h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-600">
          {isEditMode ? "Edit mode" : "View mode"}
        </div>
        {unsavedChanges && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
            Unsaved changes
          </span>
        )}
        {canManageItinerary && (
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className="rounded-full border border-slate-300 px-4 py-1 text-sm font-semibold text-ink hover:border-ocean hover:text-ocean"
          >
            {isEditMode ? "Switch to view" : "Switch to edit"}
          </button>
        )}
      </div>

      {!isEditMode && remainingActivityCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
          {remainingActivityCount} {remainingActivityCount === 1 ? "activity" : "activities"} still in the Activity Bank.
          Switch to edit mode to add them to your itinerary.
        </div>
      )}

      <div className="flex gap-6 flex-1 overflow-hidden">
      {/* Days Columns */}
      <div className="flex-1 overflow-x-auto space-y-4">
        {isEditMode && canManageItinerary && (
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Start date</label>
              <input
                type="date"
                value={dateRangeStart}
                onChange={(event) => setDateRangeStart(event.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">End date</label>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={(event) => setDateRangeEnd(event.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink"
              />
            </div>
            <button
              onClick={handleApplyDateRange}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Set itinerary dates
            </button>
            {dateRangeError && <p className="text-sm font-semibold text-coral">{dateRangeError}</p>}
          </div>
        )}
        <div className="flex gap-4">
          {days.map((day) => (
            <div key={day.id} className="flex-1 min-w-64 bg-slate-50 rounded-lg border border-slate-200">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-3 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-ink">{formatDayLabel(day.date)}</h3>
                  <p className="text-xs text-slate-500">Day {day.dayNumber}</p>
                </div>
                {canManageItinerary && isEditMode && (
                  <button
                    onClick={() => handleDeleteDay(day.id)}
                    className="text-xs text-coral hover:font-semibold"
                  >
                    Delete
                  </button>
                )}
              </div>
              <div
                onDrop={() => handleDropOnDay(day.id)}
                onDragOver={(e) => e.preventDefault()}
                className="flex flex-col gap-2 p-3 min-h-80"
              >
                {itineraryItems
                  .filter((item) => item.itineraryDayId === day.id)
                  .sort((a, b) => a.order - b.order)
                  .map((item, index) => (
                    <div
                      key={item.id}
                      draggable={canManageItinerary && isEditMode}
                      onDragStart={() => handleItemDragStart(item)}
                      className={`${canManageItinerary && isEditMode ? "cursor-grab active:cursor-grabbing" : ""}`}
                    >
                      <div className="bg-white rounded-lg border border-slate-200 p-2 text-xs flex items-center justify-between gap-3">
                        <div className="space-y-1">
                        <p className="font-semibold text-ink">{index + 1}. {item.title}</p>
                        {item.location && <p className="text-slate-600">{item.location}</p>}
                        {(() => {
                          const voteSummary = getVoteSummaryForIdea(item.ideaId);
                          const tooltipLines = voteSummary.tooltip.split("\n");
                          return (
                            <div className="relative inline-flex items-center group">
                              <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition group-hover:border-ocean group-hover:text-ocean">
                                <span>👍 {voteSummary.up}</span>
                                <span>👎 {voteSummary.down}</span>
                              </span>
                              <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden min-w-[200px] rounded-lg border border-slate-200 bg-white p-2 text-[11px] font-semibold text-slate-700 shadow-lg group-hover:block">
                                {tooltipLines.map((line) => (
                                  <p key={line} className="leading-snug">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                        {canManageItinerary && isEditMode && (
                          <button
                            onClick={() => handleRemoveActivityFromDay(item.id)}
                            className="text-coral hover:text-red-600"
                            aria-label="Remove activity"
                            title="Remove activity"
                          >
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M6 6l1 14h10l1-14" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                          </button>
                        )}
                        </div>
                        {canManageItinerary && isEditMode && (
                          <div className="text-slate-400" title="Drag to reorder">
                            <svg
                              className="h-4 w-4"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <circle cx="6" cy="5" r="1.5" />
                              <circle cx="14" cy="5" r="1.5" />
                              <circle cx="6" cy="10" r="1.5" />
                              <circle cx="14" cy="10" r="1.5" />
                              <circle cx="6" cy="15" r="1.5" />
                              <circle cx="14" cy="15" r="1.5" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {canManageItinerary && isEditMode && (
            <button
              onClick={handleAddDay}
              className="flex-1 min-w-64 flex items-center justify-center rounded-lg border-2 border-dashed border-slate-300 hover:border-ocean hover:text-ocean font-semibold text-slate-600"
            >
              + Add Day
            </button>
          )}
        </div>
      </div>

      {/* Activity Bank */}
      {isEditMode && (
        <div
          className="w-80 bg-slate-50 rounded-lg border border-slate-200 flex flex-col"
          onDrop={handleDropOnActivityBank}
          onDragOver={(event) => event.preventDefault()}
        >
        <button
          onClick={() => setShowActivityBank(!showActivityBank)}
          className="bg-white border-b border-slate-200 px-4 py-3 font-semibold text-ink flex items-center justify-between hover:bg-slate-50"
        >
          <span>Activity Bank</span>
          <svg
            className={`h-4 w-4 transform transition-transform ${showActivityBank ? "" : "-rotate-90"}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>

        {showActivityBank && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {getActivityBank().map((activity) => (
              <div
                key={activity.id}
                draggable={canManageItinerary}
                onDragStart={() => handleDragStart(activity)}
                className={`rounded-lg border border-slate-200 p-2 text-xs ${
                  canManageItinerary ? "cursor-grab active:cursor-grabbing hover:bg-white" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold text-ink">{activity.title}</p>
                    {activity.location && <p className="text-slate-600">{activity.location}</p>}
                    {(() => {
                      const voteSummary = getVoteSummary(activity.votes);
                      const tooltipLines = voteSummary.tooltip.split("\n");
                      return (
                        <div className="relative inline-flex items-center group">
                          <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600 transition group-hover:border-ocean group-hover:text-ocean">
                            <span>👍 {voteSummary.up}</span>
                            <span>👎 {voteSummary.down}</span>
                          </span>
                          <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden min-w-[200px] rounded-lg border border-slate-200 bg-white p-2 text-[11px] font-semibold text-slate-700 shadow-lg group-hover:block">
                            {tooltipLines.map((line) => (
                              <p key={line} className="leading-snug">
                                {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {canManageItinerary && (
                    <div className="text-slate-400" title="Drag to reorder">
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <circle cx="6" cy="5" r="1.5" />
                        <circle cx="14" cy="5" r="1.5" />
                        <circle cx="6" cy="10" r="1.5" />
                        <circle cx="14" cy="10" r="1.5" />
                        <circle cx="6" cy="15" r="1.5" />
                        <circle cx="14" cy="15" r="1.5" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {getActivityBank().length === 0 && (
              <p className="text-center text-slate-600 py-4">All activities scheduled!</p>
            )}
          </div>
        )}
        </div>
      )}

      {/* Save Button */}
      {unsavedChanges && isEditMode && (
        <div className="fixed bottom-6 right-6 flex gap-3">
          <button
            onClick={handleSaveItinerary}
            disabled={loading}
            className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
