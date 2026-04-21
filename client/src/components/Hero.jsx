import { useNavigate } from "react-router-dom";
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(30,72,64,0.08),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(186,245,156,0.4),transparent_24%)]" />
      <div className="relative rounded-[1.5rem] border border-slate-200/80 bg-[#FCFDFB] p-3 shadow-soft sm:p-4">
        <div className="flex items-center gap-2 border-b border-slate-200/80 pb-3">
          <span className="h-3 w-3 rounded-full bg-[#FF8A8A]" />
          <span className="h-3 w-3 rounded-full bg-[#FFD36B]" />
          <span className="h-3 w-3 rounded-full bg-[#6BCB77]" />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#1e4840]/60">Trip board</p>
                <h3 className="mt-1 text-xl font-bold text-[#1e4840]">Barcelona with friends</h3>
              </div>
              <div className="flex -space-x-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1e4840] text-xs font-bold text-white ring-4 ring-white">
                  A
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5aa167] text-xs font-bold text-white ring-4 ring-white">
                  J
                </span>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c98b4a] text-xs font-bold text-white ring-4 ring-white">
                  P
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                ["Fri 12", "Flight lands 10:10 AM", "bg-[#ecf5e9] text-[#1e4840]"],
                ["Afternoon", "Vote winner: Gothic Quarter food walk", "bg-[#e3f3e6] text-[#2f7c3f]"],
                ["Evening", "Sunset at Bunkers del Carmel", "bg-[#f8ead8] text-[#b56a1d]"]
              ].map(([time, title, style]) => (
                <div key={title} className="rounded-2xl border border-slate-100 bg-[#f7faf5] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{time}</span>
                    <span className="text-xs font-medium text-[#1e4840]/45">3 votes</span>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#1e4840]">{title}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-[320px] overflow-hidden rounded-[1.25rem] border border-slate-200/80 bg-[linear-gradient(180deg,#E5F2E2_0%,#D3E7DD_48%,#F9F6EE_100%)] p-4">
            <div className="absolute inset-x-5 top-5 rounded-2xl bg-white/90 px-4 py-3 shadow-soft backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1e4840]/45">Map view</p>
                  <p className="text-sm font-semibold text-[#1e4840]">Saved places and route pins</p>
                </div>
                <span className="rounded-full bg-[#ecf5e9] px-3 py-1 text-xs font-bold text-[#1e4840]">Live</span>
              </div>
            </div>

            <svg className="absolute inset-0 h-full w-full opacity-55" viewBox="0 0 500 400" fill="none" aria-hidden="true">
              <path d="M-20 270C83 192 121 181 195 207C278 237 327 174 403 130C438 110 484 106 536 94" stroke="#1E4840" strokeWidth="10" strokeLinecap="round" />
              <path d="M65 120C125 95 210 90 279 110C353 132 414 126 533 59" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="18" strokeLinecap="round" />
              <path d="M15 345C96 301 152 289 224 301C308 315 383 285 479 237" stroke="#D49A58" strokeOpacity="0.7" strokeWidth="12" strokeLinecap="round" />
            </svg>

            <MockPin className="left-[16%] top-[44%]" label="1" color="bg-[#1e4840]" />
            <MockPin className="left-[58%] top-[36%]" label="2" color="bg-[#5aa167]" />
            <MockPin className="left-[68%] top-[62%]" label="3" color="bg-[#c98b4a]" />
            <MockPin className="left-[34%] top-[70%]" label="4" color="bg-[#1e4840]" />

            <div className="absolute bottom-5 left-5 right-5 rounded-[1.25rem] bg-white/92 p-4 shadow-soft backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#1e4840]/45">Activity</p>
                  <p className="text-sm font-semibold text-[#1e4840]">4 saved pins, 2 voted favorites</p>
                </div>
                <button className="rounded-full bg-[#1e4840] px-4 py-2 text-xs font-bold text-white">Open trip</button>
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
    navigate("/trips/new");
  };

  const handleSignUp = () => {
    navigate("/auth?mode=signup");
  };

  const handleSignIn = () => {
    navigate("/auth?mode=signin");
  };

  return (
    <section className="overflow-hidden px-5 pb-12 pt-10 sm:px-6 lg:px-8 lg:pb-16 lg:pt-12">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.88fr,1.12fr]">
          <div className="flex flex-col justify-between rounded-[2rem] bg-[#f4f7f2] p-8 shadow-card lg:p-10">
            <div>
              <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#1e4840] sm:text-5xl lg:text-6xl">
                Plan trips together without the endless group chat.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#1e4840]/70">
                Tripable brings destination ideas, voting, availability, and itineraries into one place so your group can
                actually decide where to go.
              </p>
              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                {session ? (
                  <button
                    onClick={handlePlanTrip}
                    className="rounded-2xl bg-[#1e4840] px-7 py-4 text-base font-semibold text-white shadow-card transition hover:bg-[#152f2a]"
                  >
                    Plan trip
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSignUp}
                      className="rounded-2xl bg-[#1e4840] px-7 py-4 text-base font-semibold text-white shadow-card transition hover:bg-[#152f2a]"
                    >
                      Sign up
                    </button>
                    <button
                      onClick={handleSignIn}
                      className="rounded-2xl border border-slate-200 bg-white px-7 py-4 text-base font-semibold text-[#1e4840] transition hover:bg-[#f8fbf6]"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="lg:pt-3">
            <ProductMock />
          </div>
        </div>
      </div>
    </section>
  );
}
