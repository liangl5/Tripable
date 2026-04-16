import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api.js";
import { useSession, useUserProfile } from "../App";
import { getDisplayName } from "../lib/userProfile.js";
import { trackEvent } from "../lib/analytics.js";
import { AVATAR_COLOR_CHOICES, getAvatarColor } from "../lib/avatarColors.js";

export default function Header() {
  const session = useSession();
  const { profile, profileLoading, refreshProfile } = useUserProfile();
  const navigate = useNavigate();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAvatarEditorOpen, setIsAvatarEditorOpen] = useState(false);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [pendingInvitesLoading, setPendingInvitesLoading] = useState(false);
  const [joinStatus, setJoinStatus] = useState("");
  const [avatarColorOverride, setAvatarColorOverride] = useState("");
  const [draftColor, setDraftColor] = useState("");
  const [navigationLoading, setNavigationLoading] = useState(false);
  const [navigationProgress, setNavigationProgress] = useState(0);
  const menuRef = useRef(null);

  const displayName = getDisplayName(profile, session);
  const userId = profile?.id || session?.user?.id;
  const avatarColor =
    avatarColorOverride ||
    profile?.avatarColor ||
    (profileLoading ? "bg-slate-200 text-slate-700" : getAvatarColor(userId));
  const pendingInviteCount = pendingInvites.length;

  const resetAvatarDraft = () => {
    setDraftColor(avatarColorOverride || "");
  };

  const closeAvatarEditor = () => {
    setIsAvatarEditorOpen(false);
    resetAvatarDraft();
  };

  useEffect(() => {
    if (!userId || !profile) return;
    setAvatarColorOverride(profile.avatarColor || "");
  }, [userId, profile]);

  useEffect(() => {
    if (!userId || !profile) return;
    if (profile.avatarColor) return;
    const randomColor = AVATAR_COLOR_CHOICES[Math.floor(Math.random() * AVATAR_COLOR_CHOICES.length)];
    const persistDefault = async () => {
      try {
        await supabase.from("User").update({ avatarColor: randomColor }).eq("id", userId);
        await refreshProfile();
      } catch (error) {
        console.error("Failed to set default avatar color", error);
      }
    };
    void persistDefault();
  }, [userId, profile, refreshProfile]);

  useEffect(() => {
    if (!isAvatarEditorOpen) return;
    resetAvatarDraft();
  }, [isAvatarEditorOpen]);

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

  const handleDeclineInvite = async (inviteId) => {
    if (!inviteId) return;
    try {
      await supabase
        .from("PendingTripInvite")
        .update({ status: "canceled", canceledAt: new Date().toISOString() })
        .eq("id", inviteId);
      setPendingInvites((current) => current.filter((invite) => invite.id !== inviteId));
    } catch (error) {
      console.error("Failed to decline invite", error);
    }
  };

  const handleJoinInvite = async (tripId, inviteId) => {
    if (!tripId) return;
    try {
      setJoinStatus("Joining trip...");
      await api.joinTrip(tripId);
      setPendingInvites((current) => current.filter((invite) => invite.id !== inviteId));
      setIsNotificationOpen(false);
      setJoinStatus("");
      navigate(`/trips/${tripId}`);
    } catch (error) {
      console.error("Failed to join trip", error);
      setJoinStatus("");
    }
  };

  const handleNavigateHome = async () => {
    setNavigationLoading(true);
    setNavigationProgress(30);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      setNavigationProgress(60);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      setNavigationProgress(90);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      setNavigationProgress(100);
      
      await new Promise(resolve => setTimeout(resolve, 200));
      navigate("/");
    } catch (error) {
      console.error("Failed to navigate", error);
      setNavigationLoading(false);
    }
  };

  useEffect(() => {
    if (!isProfileMenuOpen && !isNotificationOpen) return undefined;
    const handleOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
        setIsNotificationOpen(false);
        setIsAvatarEditorOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        setIsNotificationOpen(false);
        setIsAvatarEditorOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isProfileMenuOpen, isNotificationOpen]);

  useEffect(() => {
    if (!session?.user?.email) {
      setPendingInvites([]);
      return;
    }

    const loadPendingInvites = async () => {
      setPendingInvitesLoading(true);
      try {
        const normalizedEmail = String(session.user.email || "").trim().toLowerCase();
        const { data: inviteRows, error: inviteError } = await supabase
          .from("PendingTripInvite")
          .select("id, tripId, role, createdAt, createdById")
          .ilike("email", normalizedEmail)
          .eq("status", "pending")
          .order("createdAt", { ascending: false });

        if (inviteError) {
          if (String(inviteError.message || "").includes("PendingTripInvite")) {
            setPendingInvites([]);
            return;
          }
          throw inviteError;
        }

        const rows = inviteRows || [];
        if (!rows.length) {
          setPendingInvites([]);
          return;
        }

        const tripIds = rows.map((invite) => invite.tripId);
        const { data: tripRows, error: tripError } = await supabase
          .from("Trip")
          .select("id, name, createdById")
          .in("id", tripIds);
        if (tripError) throw tripError;

        const ownerIds = Array.from(new Set((tripRows || []).map((trip) => trip.createdById).filter(Boolean)));
        const inviterIds = Array.from(new Set((rows || []).map((invite) => invite.createdById).filter(Boolean)));
        let ownerMap = new Map();
        let inviterMap = new Map();
        if (ownerIds.length > 0 || inviterIds.length > 0) {
          const allIds = Array.from(new Set([...ownerIds, ...inviterIds]));
          const { data: ownerRows, error: ownerError } = await supabase
            .from("User")
            .select("id, name, avatarColor")
            .in("id", allIds);
          if (ownerError) throw ownerError;
          ownerMap = new Map((ownerRows || []).map((owner) => [owner.id, owner.name || "Trip owner"]));
          inviterMap = new Map(
            (ownerRows || []).map((owner) => [
              owner.id,
              {
                id: owner.id,
                name: owner.name || "Traveler",
                avatarColor: owner.avatarColor || ""
              }
            ])
          );
        }

        const tripMap = new Map((tripRows || []).map((trip) => [trip.id, trip]));
        const invitesWithTripName = rows.map((invite) => ({
          ...invite,
          tripName: tripMap.get(invite.tripId)?.name || "Trip invitation",
          ownerName: ownerMap.get(tripMap.get(invite.tripId)?.createdById) || "Trip owner",
          inviter: inviterMap.get(invite.createdById) || {
            id: invite.createdById,
            name: ownerMap.get(invite.createdById) || "Traveler",
            avatarColor: ""
          }
        }));

        setPendingInvites(invitesWithTripName);
      } catch (error) {
        console.error("Failed to load pending invites:", error);
        setPendingInvites([]);
      } finally {
        setPendingInvitesLoading(false);
      }
    };

    void loadPendingInvites();
  }, [session]);

  return (
    <>
      <header className="relative z-[70] bg-[#1e4840]">
      <div className="flex items-center justify-between gap-4 px-10 py-4">
        <button
          type="button"
          onClick={handleNavigateHome}
          className="text-2xl font-extrabold tracking-tight text-[#ecf5e9] hover:underline"
          aria-label="Home"
        >
          Tripable
        </button>

        {session ? (
          <div className="relative flex items-center gap-2" ref={menuRef}>
            <button
              type="button"
              className="text-base font-semibold text-[#ecf5e9] hover:underline"
              aria-label="All Trips"
              onClick={() => {
                handleNavigateHome();
                setIsProfileMenuOpen(false);
                setIsNotificationOpen(false);
              }}
            >
              All Trips
            </button>

            <div className="relative">
              <button
                type="button"
                className="relative flex h-10 w-10 items-center justify-center rounded-full text-[#ecf5e9] hover:bg-[#ecf5e9]/20 hover:text-[#ecf5e9]"
                aria-label="Notifications"
                onClick={() => {
                  setIsNotificationOpen((current) => !current);
                  setIsProfileMenuOpen(false);
                }}
              >
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M19.29 17.29 18 16V11c0-3.07-1.63-5.64-4.5-6.32V4a1.5 1.5 0 1 0-3 0v.68C7.64 5.36 6 7.92 6 11v5l-1.29 1.29A.996.996 0 0 0 5.41 19h13.17c.89 0 1.34-1.08.71-1.71z" />
                  <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2z" />
                </svg>
                {pendingInviteCount > 0 ? (
                  <span className="pointer-events-none absolute right-[7px] top-[7px] inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                ) : null}
              </button>

              {isNotificationOpen ? (
                <div className="absolute right-0 mt-2 w-96 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-lg z-[80]">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notifications</p>
                  {joinStatus ? (
                    <p className="mt-2 text-sm font-semibold text-slate-600">{joinStatus}</p>
                  ) : null}
                  {pendingInvitesLoading ? (
                    <p className="mt-2 text-sm text-slate-500">Loading invites...</p>
                  ) : pendingInvites.length ? (
                    <div className="mt-3 space-y-2">
                      {pendingInvites.map((invite) => (
                        <div key={invite.id} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full text-xs font-semibold">
                              <span
                                className={`flex h-full w-full items-center justify-center ${
                                  invite.inviter?.avatarColor || getAvatarColor(invite.inviter?.id)
                                }`}
                              >
                                {(invite.inviter?.name || "T")[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-ink">
                                <span className="font-semibold">{invite.inviter?.name || "Someone"}</span> invited you to{" "}
                                <span className="font-semibold">{invite.tripName}</span>
                              </p>
                              <p className="text-xs text-slate-500">
                                {invite.createdAt ? new Date(invite.createdAt).toLocaleString() : ""}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              type="button"
                              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                              onClick={() => handleDeclineInvite(invite.id)}
                            >
                              Decline
                            </button>
                            <button
                              className="flex-1 rounded-lg bg-ocean px-3 py-2 text-center text-xs font-semibold text-white hover:bg-blue-600"
                              onClick={() => handleJoinInvite(invite.tripId, invite.id)}
                            >
                              Join trip
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No new notifications.</p>
                  )}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-ink hover:bg-slate-200"
                aria-label="Open profile menu"
                onClickCapture={() => setIsNotificationOpen(false)}
              >
              <span
                className={`flex h-full w-full items-center justify-center rounded-full text-base font-bold ${avatarColor}`}
              >
                {displayName?.charAt(0).toUpperCase()}
              </span>
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-lg bg-white shadow-lg border border-slate-200 z-50">
                  <div className="px-4 py-3 border-b border-slate-200 text-center">
                    <p className="text-xs font-semibold tracking-wide text-slate-400 break-all">
                      {profile?.email || session?.user?.email || "Account"}
                    </p>
                    <div className="mt-3 flex flex-col items-center gap-3">
                      <div className="relative">
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-full text-base font-bold ${avatarColor}`}
                      >
                        {displayName?.charAt(0).toUpperCase()}
                      </span>
                        <button
                          type="button"
                          onClick={() => setIsAvatarEditorOpen((current) => !current)}
                          className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200 text-slate-500 hover:text-ink"
                          aria-label="Edit profile"
                        >
                          ✎
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-ink">
                        Hi, {displayName || "Traveler"}!
                      </p>
                      {isAvatarEditorOpen ? (
                        <div
                          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 px-4"
                          onClick={closeAvatarEditor}
                        >
                          <div
                            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-ink">Edit profile</h3>
                              </div>
                              <button
                                type="button"
                                className="text-slate-400 hover:text-ink"
                                onClick={closeAvatarEditor}
                                aria-label="Close"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="mt-4 flex flex-col items-center gap-4">
                              <div className="w-full">
                                <div className="mb-3 flex justify-center">
                                  <div className="h-20 w-20 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                                    <span
                                      className={`flex h-full w-full items-center justify-center text-xl font-bold ${
                                        draftColor || avatarColor
                                      }`}
                                    >
                                      {displayName?.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <p className="text-center text-xs font-semibold text-slate-500">Avatar colors</p>
                                <div className="mt-2 grid w-full grid-cols-4 justify-items-center gap-x-4 gap-y-2">
                                  {AVATAR_COLOR_CHOICES.map((color) => (
                                    <button
                                      key={color}
                                      type="button"
                                      className={`h-8 w-8 rounded-full ${color} ${
                                        draftColor === color ? "ring-2 ring-ocean" : "ring-1 ring-slate-200"
                                      }`}
                                      onClick={() => setDraftColor(color)}
                                      aria-label="Select avatar color"
                                    />
                                  ))}
                                </div>
                              </div>

                              <div className="flex w-full items-center gap-2">
                                <button
                                  type="button"
                                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                  onClick={closeAvatarEditor}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  className="w-full rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                                  onClick={() => {
                                    if (!userId) return;
                                    const persistAvatar = async () => {
                                      await supabase
                                        .from("User")
                                        .update({
                                          avatarColor: draftColor || avatarColor
                                        })
                                        .eq("id", userId);
                                      setAvatarColorOverride(draftColor || avatarColor);
                                      await refreshProfile();
                                    };
                                    persistAvatar()
                                      .catch((error) => {
                                        console.error("Failed to update avatar", error);
                                      })
                                      .finally(() => {
                                        setIsAvatarEditorOpen(false);
                                      });
                                  }}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-3">
                    <button
                      onClick={handleProfileClick}
                      className="w-full rounded-lg bg-ocean px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600"
                    >
                      Manage Your Account
                    </button>
                    <button
                      onClick={handleLogout}
                      className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-coral hover:bg-slate-50"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
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
    {navigationLoading ? (
        <div className="h-1.5 w-full overflow-hidden bg-slate-200">
          <div
            className="h-full bg-gradient-to-r from-[#fcae4e] to-[#f7942e] transition-all"
            style={{ width: `${navigationProgress}%` }}
          />
        </div>
      ) : null}
    </>
  );
}
