export default function DayCard({ day, onMove }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-ink">Day {day.dayNumber}</h3>
          <p className="mt-1 text-sm text-slate-500">{day.date || "Date TBD"}</p>
        </div>
        <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-slate-500">
          {day.locationLabel || "Mixed locations"}
        </span>
      </div>
      <div className="mt-5 grid gap-3">
        {day.items.map((item, index) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[11px] font-semibold text-ocean">
                    {item.timeLabel || `Stop ${index + 1}`}
                  </span>
                  <span className="rounded-full bg-mist px-3 py-1 text-[11px] font-semibold text-slate-500">
                    {item.listName}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold text-ink">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.location}</p>
                {item.note ? <p className="mt-2 text-xs text-slate-500">{item.note}</p> : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onMove(day.dayNumber, index, -1)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                  disabled={index === 0}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => onMove(day.dayNumber, index, 1)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs"
                  disabled={index === day.items.length - 1}
                >
                  Down
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
