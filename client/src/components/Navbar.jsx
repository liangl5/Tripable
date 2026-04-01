import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSession, useUserProfile } from "../App";
import { supabase } from "../lib/supabase";
import { getDisplayName } from "../lib/userProfile.js";
import UserIdentity from "./UserIdentity.jsx";
import TripableLogoLink from "./TripableLogoLink.jsx";

export default function Navbar() {
  const session = useSession();
  const { profile } = useUserProfile();
  const displayName = getDisplayName(profile, session);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const menuRef = useRef(null);

  const handleLogOut = async () => {
    await supabase.auth.signOut();
  };

  useEffect(() => {
    if (!menuOpen) return;

    const handleOutsideClick = (event) => {
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target)) return;
      setMenuOpen(false);
      setEditorOpen(false);
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-mist/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-6 lg:px-8">
        <TripableLogoLink className="shrink-0" />

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
              <Link to="/" className="rounded-full px-4 py-2 transition hover:bg-white hover:shadow-soft">
                My Trips
              </Link>
              <div ref={menuRef} className="relative flex items-center gap-2 border-l border-slate-200 pl-3">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen((open) => !open);
                    setEditorOpen(false);
                  }}
                  className="text-xs text-ink/60 transition hover:text-ink"
                >
                  {displayName}
                </button>
                <button
                  type="button"
                  aria-label="Edit display name"
                  onClick={() => {
                    setMenuOpen(true);
                    setEditorOpen(true);
                  }}
                  className="rounded-full p-2 text-ink/60 transition hover:bg-white hover:text-ink hover:shadow-soft"
                >
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path d="M13.586 3.586a2 2 0 0 1 2.828 2.828l-9.5 9.5a1 1 0 0 1-.39.242l-4 1.333a1 1 0 0 1-1.265-1.265l1.333-4a1 1 0 0 1 .242-.39l9.5-9.5Z" />
                    <path d="M12.172 5l2.828 2.828" />
                  </svg>
                </button>

                {menuOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-3 w-[min(22rem,90vw)] rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
                    {editorOpen ? (
                      <div className="mb-4">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-ink">Your display name</p>
                            <p className="text-xs text-slate-500">
                              This name shows up across the app and is not unique.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditorOpen(false)}
                            className="rounded-full px-3 py-1 text-xs font-semibold text-ink/70 transition hover:bg-slate-100"
                          >
                            Back
                          </button>
                        </div>
                        <UserIdentity editable />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditorOpen(true)}
                        className="w-full rounded-xl bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-ink transition hover:bg-slate-100"
                      >
                        Edit display name
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              <button
                onClick={handleLogOut}
                className="rounded-full px-4 py-2 text-red-600 transition hover:bg-red-50"
              >
                Sign Out
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
