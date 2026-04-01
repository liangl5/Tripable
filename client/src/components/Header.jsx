import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession, useUserProfile } from "../App";
import { getDisplayName } from "../lib/userProfile.js";
import { trackEvent } from "../lib/analytics.js";
import TripableLogoLink from "./TripableLogoLink.jsx";

export default function Header() {
  const session = useSession();
  const { profile } = useUserProfile();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const displayName = getDisplayName(profile, session);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    void trackEvent("auth_sign_out", {
      source: "header_menu"
    });
    navigate("/");
    setIsProfileMenuOpen(false);
  };

  const handleProfileClick = () => {
    void trackEvent("profile_opened", {
      source: "header_menu"
    });
    navigate("/profile");
    setIsProfileMenuOpen(false);
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <TripableLogoLink className="w-fit" compact />

        {session ? (
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-ink hover:bg-slate-200"
            >
              <span className="h-6 w-6 rounded-full bg-ocean text-white flex items-center justify-center text-xs font-bold">
                {displayName?.charAt(0).toUpperCase()}
              </span>
              <span>{displayName}</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg bg-white shadow-lg border border-slate-200 z-50">
                <button
                  onClick={handleProfileClick}
                  className="w-full px-4 py-2 text-left text-sm text-ink hover:bg-slate-50 rounded-t-lg"
                >
                  Profile Settings
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-sm text-coral hover:bg-slate-50 rounded-b-lg border-t border-slate-200"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              to="/auth?mode=signup"
              className="rounded-full bg-ocean px-5 py-2 text-sm font-semibold text-white shadow-card hover:bg-blue-600"
            >
              Sign up
            </Link>
            <Link
              to="/auth?mode=signin"
              className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-ink hover:bg-slate-50"
            >
              Sign in
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
