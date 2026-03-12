import { Link } from "react-router-dom";
import { useSession } from "../App";
import { supabase } from "../lib/supabase";
import tripableLogo from "../../imgs/icon.png";

function TripableLogo() {
  return (
    <img src={tripableLogo} alt="Tripable Logo" width="50px"/>
  );
}

export default function Navbar() {
  const session = useSession();

  const handleLogOut = async () => {
    await supabase.auth.signOut();
  };

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
          {!session ? (
            <>
              <Link to="/auth" className="rounded-full px-4 py-2 transition hover:bg-white hover:shadow-soft">
                Sign In
              </Link>
              <Link
                to="/auth"
                className="rounded-full bg-[#4C6FFF] px-5 py-2.5 text-white shadow-card transition hover:bg-[#3F5CE0]"
              >
                Sign Up
              </Link>
            </>
          ) : (
            <>
              <Link to="/trips" className="rounded-full px-4 py-2 transition hover:bg-white hover:shadow-soft">
                My Trips
              </Link>
              <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
                <span className="text-xs text-ink/60">{session.user.email}</span>
                <button
                  onClick={handleLogOut}
                  className="rounded-full px-4 py-2 text-red-600 transition hover:bg-red-50"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
