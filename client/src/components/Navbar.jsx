import { Link } from "react-router-dom";

function TripableLogo() {
  return (
    <div className="relative h-11 w-11 rounded-2xl bg-white shadow-soft ring-1 ring-brand-primary/10">
      <span className="absolute left-2 top-2 h-3.5 w-3.5 rounded-full bg-brand-primary" />
      <span className="absolute right-2 top-2 h-3.5 w-3.5 rounded-full bg-brand-secondary" />
      <span className="absolute bottom-2 left-2 h-3.5 w-3.5 rounded-full bg-brand-accent" />
      <span className="absolute bottom-2 right-2 h-3.5 w-3.5 rounded-full bg-brand-primary/20 ring-2 ring-brand-primary/35" />
    </div>
  );
}

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-mist/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <TripableLogo />
          <div>
            <p className="text-lg font-bold tracking-tight text-ink">Tripable</p>
            <p className="text-xs text-ink/60">Plan together</p>
          </div>
        </Link>

        <nav className="flex items-center gap-3 text-sm font-semibold text-ink">
          <Link to="/trips" className="rounded-full px-4 py-2 transition hover:bg-white hover:shadow-soft">
            Log in
          </Link>
          <Link
            to="/trips/new"
            className="rounded-full bg-[#4C6FFF] px-5 py-2.5 text-white shadow-card transition hover:bg-[#3F5CE0]"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
