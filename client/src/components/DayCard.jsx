export default function DayCard({ day, onMove }) {
  return (
    <div className="rounded-3xl bg-white/95 p-6 shadow-card">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-ink">Day {day.dayNumber}</h3>
          <p className="text-sm text-slate-500">{day.date}</p>
        </div>
        <span className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-slate-500">
          {day.locationLabel || "Mixed locations"}
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {day.items.map((item, index) => (
          <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-slate-500">{item.location}</p>
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
