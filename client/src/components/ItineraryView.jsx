import { useState, useEffect } from "react";
import DayCard from "./DayCard.jsx";

export default function ItineraryView({ itinerary }) {
  const [days, setDays] = useState(itinerary?.days || []);

  useEffect(() => {
    setDays(itinerary?.days || []);
  }, [itinerary]);

  const handleMove = (dayNumber, index, direction) => {
    setDays((prev) =>
      prev.map((day) => {
        if (day.dayNumber !== dayNumber) return day;
        const nextItems = [...day.items];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= nextItems.length) return day;
        const [moved] = nextItems.splice(index, 1);
        nextItems.splice(targetIndex, 0, moved);
        return { ...day, items: nextItems };
      })
    );
  };

  if (!days.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <p className="text-lg font-semibold">No itinerary yet</p>
        <p className="mt-2 text-sm text-slate-500">Generate one to see the schedule.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {days.map((day) => (
        <DayCard key={day.dayNumber} day={day} onMove={handleMove} />
      ))}
    </div>
  );
}
