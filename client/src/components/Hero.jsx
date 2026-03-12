import { Link, useNavigate } from "react-router-dom";
import { useSession } from "../App";

function MockPin({ className, label, color }) {
  return (
    <div className={`absolute ${className}`}>
      <div className={`mock-map-pin rounded-full px-2 py-1 text-[10px] font-bold text-white ${color}`}>{label}</div>
    </div>
  );
}

function ProductMock() {
  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white p-3 shadow-card sm:p-5">
      <div className="tripable-grid absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative rounded-[1.5rem] border border-slate-200/80 bg-[#FCFDFE] p-3 shadow-soft sm:p-4">
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
          <span className="h-3 w-3 rounded-full bg-[#FF8A8A]" />
          <span className="h-3 w-3 rounded-full bg-[#FFD36B]" />
          <span className="h-3 w-3 rounded-full bg-[#6BCB77]" />
          <div className="ml-3 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-ink/50">tripable.app</div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary/70">Itinerary</p>
                <h3 className="mt-1 text-xl font-bold text-ink">Barcelona with friends</h3>
              </div>
              <div className="flex -space-x-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-xs font-bold text-white ring-4 ring-white">
                  A
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-secondary text-xs font-bold text-white ring-4 ring-white">
                  J
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-accent text-xs font-bold text-white ring-4 ring-white">
                  P
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                ["Fri 12", "Flight lands 10:10 AM", "bg-brand-primary/10 text-brand-primary"],
                ["Afternoon", "Vote winner: Gothic Quarter food walk", "bg-brand-secondary/15 text-[#2C8B44]"],
                ["Evening", "Sunset at Bunkers del Carmel", "bg-brand-accent/20 text-[#D78528]"]
              ].map(([time, title, style]) => (
                <div key={title} className="rounded-2xl border border-slate-100 bg-mist p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{time}</span>
                    <span className="text-xs font-medium text-ink/45">3 votes</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-ink">{title}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl bg-brand-primary px-4 py-3 text-sm font-medium text-white">
              Auto-built route with realistic timing and shared notes.
            </div>
          </div>

          <div className="relative min-h-[320px] overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-[linear-gradient(180deg,#DCE8FF_0%,#CFE5D6_48%,#F9F6EE_100%)] p-4">
            <div className="absolute inset-x-5 top-5 rounded-2xl bg-white/90 px-4 py-3 shadow-soft backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Map View</p>
                  <p className="text-sm font-semibold text-ink">Saved places and route pins</p>
                </div>
                <span className="rounded-full bg-brand-secondary/20 px-3 py-1 text-xs font-bold text-[#2C8B44]">Live</span>
              </div>
            </div>

            <svg className="absolute inset-0 h-full w-full opacity-55" viewBox="0 0 500 400" fill="none" aria-hidden="true">
              <path d="M-20 270C83 192 121 181 195 207C278 237 327 174 403 130C438 110 484 106 536 94" stroke="#4C6FFF" strokeWidth="10" strokeLinecap="round" />
              <path d="M65 120C125 95 210 90 279 110C353 132 414 126 533 59" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="18" strokeLinecap="round" />
              <path d="M15 345C96 301 152 289 224 301C308 315 383 285 479 237" stroke="#FFB86B" strokeOpacity="0.7" strokeWidth="12" strokeLinecap="round" />
            </svg>

            <MockPin className="left-[16%] top-[44%]" label="1" color="bg-brand-primary" />
            <MockPin className="left-[58%] top-[36%]" label="2" color="bg-brand-secondary" />
            <MockPin className="left-[68%] top-[62%]" label="3" color="bg-brand-accent" />
            <MockPin className="left-[34%] top-[70%]" label="4" color="bg-brand-primary" />

            <div className="absolute bottom-5 left-5 right-5 rounded-[1.25rem] bg-white/92 p-4 shadow-soft backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/45">Activity</p>
                  <p className="text-sm font-semibold text-ink">4 saved pins, 2 voted favorites</p>
                </div>
                <button className="rounded-full bg-brand-primary px-4 py-2 text-xs font-bold text-white">Open trip</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const navigate = useNavigate();
  const session = useSession();

  const handlePlanTrip = () => {
    if (session) {
      navigate("/trips/new");
    } else {
      navigate("/auth");
    }
  };

  return (
    <section className="section-shell overflow-hidden px-5 pb-16 pt-10 sm:px-6 lg:px-8 lg:pb-24 lg:pt-16">
      <div className="mx-auto max-w-7xl">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex rounded-full border border-brand-primary/15 bg-white px-4 py-2 text-sm font-semibold text-brand-primary shadow-soft">
            Group trip planning without the chaos
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Plan trips together without the endless group chat.
          </h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-ink/70 sm:text-xl">
            Tripable brings destination ideas, voting, availability, and itineraries into one place so your group can actually decide where to go.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              onClick={handlePlanTrip}
              className="rounded-full bg-[#4C6FFF] px-7 py-4 text-base font-semibold text-white shadow-card transition hover:bg-[#3F5CE0]"
            >
              Plan trip
            </button>
            <a href="#features" className="text-base font-semibold text-ink transition hover:text-brand-primary">
              See how it works →
            </a>
          </div>
        </div>

        <div className="mt-14 lg:mt-16">
          <ProductMock />
        </div>
      </div>
    </section>
  );
}

