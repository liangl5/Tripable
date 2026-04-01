import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function ItineraryTab({ tab, tripId, userId, userRole, ideas, trip }) {
  const [days, setDays] = useState([]);
  const [itineraryItems, setItineraryItems] = useState([]);
  const [allowedListIds, setAllowedListIds] = useState(null);
  const [showActivityBank, setShowActivityBank] = useState(true);
  const [draggedActivity, setDraggedActivity] = useState(null);
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
          .eq("tripId", tripId)
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

        setItineraryItems(itemsData || []);

        // Load allowed lists for this tab
        const { data: configData } = await supabase
          .from("ItineraryTabConfiguration")
          .select("allowedListIds")
          .eq("tabId", tab.id)
          .maybeSingle();

        setAllowedListIds(configData?.allowedListIds);
      } catch (error) {
        console.error("Failed to load itinerary:", error);
      } finally {
        setLoading(false);
      }
    };

    loadItinerary();
  }, [tab.id, tripId]);

  const handleAddDay = async () => {
    if (!canManageItinerary) return;

    try {
      const nextDayNumber = (days.length || 0) + 1;
      const { data, error } = await supabase
        .from("ItineraryDay")
        .insert([
          {
            id: crypto.randomUUID(),
            tripId,
            dayNumber: nextDayNumber,
            createdAt: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      setDays([...days, data]);
    } catch (error) {
      console.error("Failed to add day:", error);
    }
  };

  const handleDeleteDay = async (dayId) => {
    if (!canManageItinerary || !window.confirm("Delete this day?")) return;

    try {
      await supabase.from("ItineraryDay").delete().eq("id", dayId);
      setDays(days.filter((d) => d.id !== dayId));
    } catch (error) {
      console.error("Failed to delete day:", error);
    }
  };

  const handleDragStart = (activity) => {
    setDraggedActivity(activity);
  };

  const handleDropOnDay = async (dayId) => {
    if (!draggedActivity || !canManageItinerary) {
      setDraggedActivity(null);
      return;
    }

    try {
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
    } catch (error) {
      console.error("Failed to add activity to day:", error);
    } finally {
      setDraggedActivity(null);
    }
  };

  const handleRemoveActivityFromDay = (itemId) => {
    if (!canManageItinerary) return;

    setItineraryItems(itineraryItems.filter((i) => i.id !== itemId));
    setUnsavedChanges(true);
  };

  const handleSaveItinerary = async () => {
    if (!unsavedChanges) return;

    try {
      setLoading(true);

      // Delete all old items
      if (itineraryItems.length > 0) {
        const dayIds = days.map((d) => d.id);
        await supabase.from("ItineraryItem").delete().in("itineraryDayId", dayIds);
      }

      // Insert new items
      if (itineraryItems.length > 0) {
        await supabase.from("ItineraryItem").insert(itineraryItems);
      }

      setUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to save itinerary:", error);
      alert("Failed to save itinerary changes");
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

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Loading itinerary...</div>;
  }

  return (
    <div className="flex gap-6 p-6 h-[calc(100vh-200px)]">
      {/* Days Columns */}
      <div className="flex-1 overflow-x-auto space-y-4">
        <div className="flex gap-4">
          {days.map((day) => (
            <div key={day.id} className="flex-1 min-w-64 bg-slate-50 rounded-lg border border-slate-200">
              <div className="sticky top-0 bg-white border-b border-slate-200 p-3 flex items-center justify-between">
                <h3 className="font-semibold text-ink">Day {day.dayNumber}</h3>
                {canManageItinerary && (
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
                      className="bg-white rounded-lg border border-slate-200 p-2 text-xs space-y-1"
                    >
                      <p className="font-semibold text-ink">{index + 1}. {item.title}</p>
                      {item.location && <p className="text-slate-600">{item.location}</p>}
                      {canManageItinerary && (
                        <button
                          onClick={() => handleRemoveActivityFromDay(item.id)}
                          className="text-coral hover:font-semibold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ))}

          {canManageItinerary && (
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
      <div className="w-80 bg-slate-50 rounded-lg border border-slate-200 flex flex-col">
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
                className={`rounded-lg border border-slate-200 p-2 text-xs space-y-1 ${
                  canManageItinerary ? "cursor-move hover:bg-white" : ""
                }`}
              >
                <p className="font-semibold text-ink">{activity.title}</p>
                {activity.location && <p className="text-slate-600">{activity.location}</p>}
                <div className="flex gap-1 text-slate-500">
                  {activity.voteCount && <span>👍 {activity.voteCount}</span>}
                </div>
              </div>
            ))}

            {getActivityBank().length === 0 && (
              <p className="text-center text-slate-600 py-4">All activities scheduled!</p>
            )}
          </div>
        )}
      </div>

      {/* Save Button */}
      {unsavedChanges && (
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
  );
}
