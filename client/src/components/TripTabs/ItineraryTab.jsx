import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { clearGeneratedItinerary, slugify } from "../../lib/tripPlanning";
import ThreadedComments from "../ThreadedComments.jsx";

function ThumbUpIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M8.5 10.5V20a2 2 0 0 0 2 2h5.4a2 2 0 0 0 1.9-1.4l1.6-4.8a2 2 0 0 0-1.9-2.6H14V7.8c0-2-1.6-3.6-3.6-3.6-.6 0-1 .4-1 1v2.3c0 1.1-.4 2.1-1.1 3l-.2.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 10.5h3.5V22H5a2 2 0 0 1-2-2v-7.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThumbDownIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden="true">
      <path
        d="M8.5 13.5V4a2 2 0 0 1 2-2h5.4a2 2 0 0 1 1.9 1.4l1.6 4.8a2 2 0 0 1-1.9 2.6H14v5.4c0 2-1.6 3.6-3.6 3.6-.6 0-1-.4-1-1v-2.3c0-1.1-.4-2.1-1.1-3l-.2-.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M5 13.5h3.5V2H5a2 2 0 0 0-2 2v7.5a2 2 0 0 0 2 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ItineraryTab({ tab, tripId, userId, userRole, tripMembers, ideas, trip }) {
  const [days, setDays] = useState([]);
  const [itineraryItems, setItineraryItems] = useState([]);
  const [allowedListIds, setAllowedListIds] = useState(null);
  const [allowedListIdsConfigId, setAllowedListIdsConfigId] = useState(null);
  const [showActivityBank, setShowActivityBank] = useState(true);
  const [activityBankFilterOpen, setActivityBankFilterOpen] = useState(false);
  const [activityBankDraftListIds, setActivityBankDraftListIds] = useState([]);
  const [activityBankFilterError, setActivityBankFilterError] = useState("");
  const [activityBankFilterSaving, setActivityBankFilterSaving] = useState(false);
  const [draggedActivity, setDraggedActivity] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");
  const [dateRangeError, setDateRangeError] = useState("");
  const [listOptions, setListOptions] = useState([]);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const canManageItinerary = userRole === "owner" || userRole === "editor";

  const DisclosureChevron = ({ open }) => (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${open ? "rotate-90" : "rotate-0"}`}
    >
      <path
        d="M7.5 4.5L12.5 10L7.5 15.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

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
          .select("id, allowedListIds")
          .eq("tabId", tab.id)
          .maybeSingle();

        setAllowedListIdsConfigId(configData?.id || null);
        setAllowedListIds(configData?.allowedListIds);

        const { data: listData } = await supabase
          .from("List")
          .select("id, name, order")
          .eq("tripId", tripId)
          .order("order", { ascending: true });

        setListOptions(listData || []);

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
        const hasDays = (daysData || []).length > 0;
        setIsEditMode(canManageItinerary && (!hasDays || nextItems.length === 0));
      } catch (error) {
        console.error("Failed to load itinerary:", error);
      } finally {
        setLoading(false);
      }
    };

    loadItinerary();
  }, [tab.id, tripId, canManageItinerary, trip?.startDate, trip?.endDate]);

  useEffect(() => {
    const loadLists = async () => {
      try {
        const { data: listData } = await supabase
          .from("List")
          .select("id, name, order")
          .eq("tripId", tripId)
          .order("order", { ascending: true });
        setListOptions(listData || []);
      } catch (error) {
        console.error("Failed to load lists:", error);
      }
    };

    loadLists();
  }, [tripId, tab.id, ideas]);

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

  const toggleDescription = (itemId) => {
    setExpandedDescriptions((current) => ({
      ...current,
      [itemId]: !current[itemId]
    }));
  };

  const getIdeaDescription = (ideaId) => ideas.find((idea) => idea.id === ideaId)?.description || "";

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

    // Hide activities whose list was deleted (prevents orphan "Activity Bank" items after deleting a list).
    const validListIds = new Set((listOptions || []).map((list) => list.id).filter(Boolean));
    if (validListIds.size > 0) {
      filtered = filtered.filter((idea) => idea?.listId && validListIds.has(idea.listId));
    }

    return filtered.filter(
      (idea) =>
        !itineraryItems.some((item) => item.ideaId === idea.id) &&
        Boolean(idea.listId)
    );
  };

  const groupedActivityBank = () => {
    const bank = getActivityBank();
    const listIndex = new Map(listOptions.map((list, index) => [list.id, index]));
    const listNameById = new Map(listOptions.map((list) => [list.id, list.name]));
    const listNameBySlug = new Map(listOptions.map((list) => [slugify(list.name), list.name]));
    const listNameByLower = new Map(listOptions.map((list) => [String(list.name).toLowerCase(), list.name]));

    const groups = bank.reduce((acc, idea) => {
      const listId = idea.listId || "";
      const listNameHint = String(idea.listName || idea.category || "").trim();
      const slugMatch = listId ? listNameBySlug.get(listId) : null;
      const nameMatch = listNameHint ? listNameByLower.get(listNameHint.toLowerCase()) : null;
      const slugNameMatch = listNameHint ? listNameBySlug.get(slugify(listNameHint)) : null;
      const label =
        (listId && listNameById.get(listId)) ||
        slugMatch ||
        nameMatch ||
        slugNameMatch ||
        listNameHint ||
        "Uncategorized";
      const key = listId || label;
      if (!acc[key]) acc[key] = { label, listId, items: [] };
      acc[key].items.push(idea);
      return acc;
    }, {});

    return Object.values(groups).sort((a, b) => {
      const aIndex = a.listId ? listIndex.get(a.listId) : Number.POSITIVE_INFINITY;
      const bIndex = b.listId ? listIndex.get(b.listId) : Number.POSITIVE_INFINITY;
      if (aIndex !== bIndex) return (aIndex ?? Number.POSITIVE_INFINITY) - (bIndex ?? Number.POSITIVE_INFINITY);
      return a.label.localeCompare(b.label);
    });
  };

  const remainingActivityCount = getActivityBank().length;

  const openActivityBankFilter = () => {
    setActivityBankDraftListIds(Array.isArray(allowedListIds) ? allowedListIds : listOptions.map((list) => list.id));
    setActivityBankFilterError("");
    setActivityBankFilterOpen(true);
  };

  const toggleActivityBankDraftListId = (listId) => {
    setActivityBankDraftListIds((current) => {
      if (current.includes(listId)) {
        return current.filter((id) => id !== listId);
      }
      return [...current, listId];
    });
  };

  const saveActivityBankFilter = async () => {
    const selectedIds = listOptions.filter((list) => activityBankDraftListIds.includes(list.id)).map((list) => list.id);

    if (!selectedIds.length) {
      setActivityBankFilterError("Choose at least one list.");
      return;
    }

    const allListIds = listOptions.map((list) => list.id);
    const nextAllowedListIds = selectedIds.length === allListIds.length ? null : selectedIds;

    try {
      setActivityBankFilterSaving(true);
      setActivityBankFilterError("");

      if (allowedListIdsConfigId) {
        const { error } = await supabase
          .from("ItineraryTabConfiguration")
          .update({ allowedListIds: nextAllowedListIds })
          .eq("id", allowedListIdsConfigId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("ItineraryTabConfiguration")
          .insert([
            {
              id: crypto.randomUUID(),
              tabId: tab.id,
              allowedListIds: nextAllowedListIds
            }
          ])
          .select("id")
          .single();
        if (error) throw error;
        setAllowedListIdsConfigId(data?.id || null);
      }

      setAllowedListIds(nextAllowedListIds);
      setActivityBankFilterOpen(false);
    } catch (error) {
      console.error("Failed to update activity bank filter:", error);
      setActivityBankFilterError(error?.message || "Failed to update activity bank filter");
    } finally {
      setActivityBankFilterSaving(false);
    }
  };

  const getVoteSummary = (votesInput) => {
    const votes = Array.isArray(votesInput) ? votesInput : [];
    const upvotes = votes.filter((vote) => vote.value === 1);
    const downvotes = votes.filter((vote) => vote.value === -1);

    return {
      up: upvotes.length,
      down: downvotes.length
    };
  };

  const getVoteSummaryForIdea = (ideaId) => {
    const idea = ideas.find((candidate) => candidate.id === ideaId);
    return getVoteSummary(idea?.votes);
  };
  const memberNamesById = (tripMembers || []).reduce((acc, member) => {
    acc[member.id] = member.name || member.email || "Traveler";
    return acc;
  }, {});

  if (loading) {
    return <div className="p-6" />;
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
        {days.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-lg font-semibold text-ink">No itinerary yet</h3>
            <p className="mt-2 text-sm text-slate-600">
              Set a date range to create days, then drag items from the Activity Bank onto each day.
            </p>
            {canManageItinerary ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white hover:bg-[#152f2a]"
                >
                  Set itinerary dates
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Ask the trip owner to set itinerary dates.</p>
            )}
          </div>
        ) : null}
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
                        {String(item.mapQuery || item.location || "").trim() ? (
                          <p className="text-slate-600">{String(item.mapQuery || item.location || "").trim()}</p>
                        ) : null}
                        {getIdeaDescription(item.ideaId) ? (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => toggleDescription(item.id)}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500 shadow-sm transition hover:border-ocean hover:text-ocean"
                            >
                              <span>Description</span>
                              <DisclosureChevron open={Boolean(expandedDescriptions[item.id])} />
                            </button>
                            {expandedDescriptions[item.id] ? (
                              <p className="mt-1 max-w-prose whitespace-pre-wrap text-xs leading-5 text-slate-600">
                                {getIdeaDescription(item.ideaId)}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {(() => {
                          const voteSummary = getVoteSummaryForIdea(item.ideaId);
                          return (
                            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <ThumbUpIcon className="h-3.5 w-3.5" />
                                {voteSummary.up}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <ThumbDownIcon className="h-3.5 w-3.5" />
                                {voteSummary.down}
                              </span>
                            </span>
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
                <ThreadedComments
                  tableName="ItineraryDayComment"
                  resourceColumn="itineraryDayId"
                  resourceId={day.id}
                  userId={userId}
                  userNamesById={memberNamesById}
                  canDeleteAnyComment={userRole === "owner"}
                  title="Day Comments"
                />
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
        <div className="bg-white border-b border-slate-200 px-4 py-3 font-semibold text-ink flex items-center justify-between gap-2 hover:bg-slate-50">
          <button
            type="button"
            onClick={() => setShowActivityBank(!showActivityBank)}
            className="flex min-w-0 flex-1 items-center justify-between text-left"
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
          <button
            type="button"
            onClick={openActivityBankFilter}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-ocean hover:text-ocean"
            aria-label="Choose lists for activity bank"
            title="Choose lists"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
              <path d="M2 4a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Zm0 6a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1Z" />
            </svg>
          </button>
        </div>

        {showActivityBank && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {!canManageItinerary && listOptions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-sm text-slate-600">
                Wait for an editor to add a list.
              </div>
            ) : null}
            {groupedActivityBank().map((group) => (
              <div key={group.listId || group.label} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {group.label}
                </p>
                {group.items.map((activity) => (
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
                        {String(activity.mapQuery || activity.location || "").trim() ? (
                          <p className="text-slate-600">{String(activity.mapQuery || activity.location || "").trim()}</p>
                        ) : null}
                        {(() => {
                          const voteSummary = getVoteSummary(activity.votes);
                          return (
                            <span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-600">
                              <span className="inline-flex items-center gap-1">
                                <ThumbUpIcon className="h-3.5 w-3.5" />
                                {voteSummary.up}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <ThumbDownIcon className="h-3.5 w-3.5" />
                                {voteSummary.down}
                              </span>
                            </span>
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
              </div>
            ))}

            {getActivityBank().length === 0 && (
              <p className="text-center text-slate-600 py-4">All activities scheduled!</p>
            )}
          </div>
        )}
        </div>
      )}

      {activityBankFilterOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setActivityBankFilterOpen(false);
              setActivityBankFilterError("");
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Choose activity bank lists</h3>
            <p className="mt-2 text-sm text-slate-600">Select which lists appear in the Activity Bank.</p>

            <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
              {listOptions.length === 0 ? (
                <p className="text-sm text-slate-500">No lists available yet.</p>
              ) : (
                listOptions.map((list) => (
                  <label
                    key={list.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-ink hover:bg-white"
                  >
                    <input
                      type="checkbox"
                      checked={activityBankDraftListIds.includes(list.id)}
                      onChange={() => toggleActivityBankDraftListId(list.id)}
                      className="h-4 w-4 rounded border-slate-300 text-ocean focus:ring-ocean"
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{list.name}</span>
                  </label>
                ))
              )}
            </div>

            {activityBankFilterError ? <p className="mt-3 text-sm font-semibold text-coral">{activityBankFilterError}</p> : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setActivityBankFilterOpen(false);
                  setActivityBankFilterError("");
                }}
                disabled={activityBankFilterSaving}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveActivityBankFilter()}
                disabled={activityBankFilterSaving}
                className="rounded-xl bg-ocean px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#152f2a] disabled:opacity-60"
              >
                {activityBankFilterSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Save Button */}
      {unsavedChanges && isEditMode && (
        <div className="fixed bottom-6 right-6 flex gap-3">
          <button
            onClick={handleSaveItinerary}
            disabled={loading}
            className="rounded-lg bg-ocean px-4 py-2 text-sm font-semibold text-white hover:bg-[#152f2a] disabled:opacity-50"
          >
            Save Changes
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
