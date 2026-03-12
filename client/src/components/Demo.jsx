import { Link } from "react-router-dom";

function DemoMock() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white p-4 shadow-card sm:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(76,111,255,0.12),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(107,203,119,0.12),transparent_24%)]" />
      <div className="relative grid gap-4 lg:grid-cols-[0.95fr,1.05fr]">
        <div className="rounded-[1.5rem] border border-slate-200/70 bg-mist p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary/70">Itinerary</p>
          <div className="mt-4 space-y-3">
            {[
              ["08:30", "Brunch shortlist", "4 votes"],
              ["11:00", "Museum district", "Auto-grouped"],
              ["15:30", "Beach break", "2 shared notes"],
              ["19:30", "Dinner reservation", "Confirmed"]
            ].map(([time, title, meta]) => (
              <div key={title} className="rounded-2xl bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-brand-primary">{time}</span>
                  <span className="rounded-full bg-brand-secondary/15 px-2.5 py-1 text-[11px] font-bold text-[#2C8B44]">
                    {meta}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative min-h-[220px] overflow-hidden rounded-[1.5rem] border border-slate-200/70 bg-[linear-gradient(180deg,#E3ECFF_0%,#E9F5E7_100%)]">
            <svg className="absolute inset-0 h-full w-full opacity-70" viewBox="0 0 500 300" fill="none" aria-hidden="true">
              <path d="M34 234C133 126 187 188 282 131C351 89 400 91 472 52" stroke="#4C6FFF" strokeWidth="12" strokeLinecap="round" />
              <path d="M29 118C131 99 174 88 274 113C350 133 434 130 503 108" stroke="#FFB86B" strokeOpacity="0.8" strokeWidth="10" strokeLinecap="round" />
            </svg>
            {[
              ["left-[12%] top-[62%]", "1", "bg-brand-primary"],
              ["left-[41%] top-[44%]", "2", "bg-brand-secondary"],
              ["left-[72%] top-[28%]", "3", "bg-brand-accent"]
            ].map(([placement, label, tone]) => (
              <div key={label} className={`absolute ${placement}`}>
                <span className={`mock-map-pin flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white ${tone}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>

          <div className="rounded-[1.5rem] border border-slate-200/70 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink/45">Group members</p>
                <p className="mt-1 text-sm font-semibold text-ink">Everyone sees the same plan</p>
              </div>
              <div className="flex -space-x-2">
                {[
                  ["A", "bg-brand-primary"],
                  ["M", "bg-brand-secondary"],
                  ["L", "bg-brand-accent"],
                  ["+2", "bg-ink"]
                ].map(([label, tone]) => (
                  <span
                    key={label}
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ring-4 ring-white ${tone}`}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Demo() {
  return (
    <section className="px-5 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr,0.95fr]">
        <DemoMock />
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-primary">Product demo</p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
            From scattered ideas to a clear plan.
          </h2>
          <p className="mt-5 text-lg leading-8 text-ink/70">
            Tripable turns suggestions from group chats, links, and messages into a shared trip plan everyone can see
            and contribute to.
          </p>
          <Link
            to="/trips/new"
            className="mt-8 inline-flex rounded-full bg-[#4C6FFF] px-7 py-4 text-base font-semibold text-white shadow-card transition hover:bg-[#3F5CE0]"
          >
            Start planning
          </Link>
        </div>
      </div>
    </section>
  );
}
