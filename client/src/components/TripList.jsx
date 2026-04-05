import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { createDefaultTripsTab } from "../lib/tabManagement.js";
import { formatDateRange } from "../lib/timeFormat.js";
import { parseInvitees } from "../lib/tripPlanning.js";
import { supabase } from "../lib/supabase.js";

const ROLE_LABELS = {
  owner: "Owner",
  editor: "Editor",
  suggestor: "Suggestor"
};

const getInitials = (name) => {
  const value = String(name || "").trim();
  if (!value) return "?";
  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const AVATAR_COLORS = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-cyan-100 text-cyan-700",
  "bg-blue-100 text-blue-700",
  "bg-indigo-100 text-indigo-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700"
];

const getAvatarColor = (id) => {
  const value = String(id || "");
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 2147483647;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function TripList({ trips }) {
  const navigate = useNavigate();
  const session = useSession();
  const createTrip = useTripStore((state) => state.createTrip);
  const updateTripMeta = useTripStore((state) => state.updateTripMeta);
  const deleteTrip = useTripStore((state) => state.deleteTrip);
  const sendTripInvites = useTripStore((state) => state.sendTripInvites);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [renameTrip, setRenameTrip] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [shareTrip, setShareTrip] = useState(null);
  const [inviteDraft, setInviteDraft] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [duplicateLoading, setDuplicateLoading] = useState(false);
  const [shareMenuOpenId, setShareMenuOpenId] = useState(null);
  const [shareMenuPinnedId, setShareMenuPinnedId] = useState(null);
  const [lastShareTrip, setLastShareTrip] = useState(null);
  const [accessMembers, setAccessMembers] = useState([]);
  const [roleUpdateLoadingId, setRoleUpdateLoadingId] = useState(null);
  const [roleMenuOpenId, setRoleMenuOpenId] = useState(null);
  const [pendingRoleChanges, setPendingRoleChanges] = useState({});
  const [savingRoleChanges, setSavingRoleChanges] = useState(false);
  const [originalRoles, setOriginalRoles] = useState({});
  const roleMenuRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpenId(null);
        setShareMenuOpenId(null);
        setShareMenuPinnedId(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMenuOpenId(null);
        setShareMenuOpenId(null);
        setShareMenuPinnedId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpenId]);

  useEffect(() => {
    if (!roleMenuOpenId) return undefined;
    const handleClickOutside = (event) => {
      if (roleMenuRef.current && !roleMenuRef.current.contains(event.target)) {
        setRoleMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [roleMenuOpenId]);

  useEffect(() => {
    if (!inviteStatus) return undefined;
    const timer = setTimeout(() => setInviteStatus(""), 10000);
    return () => clearTimeout(timer);
  }, [inviteStatus]);

  const loadAccessMembers = async () => {
    if (!shareTrip?.id) {
      setAccessMembers([]);
      return;
    }

    try {
      const { data: memberRows, error: memberError } = await supabase
        .from("TripMember")
        .select("tripId, userId")
        .eq("tripId", shareTrip.id);
      if (memberError) throw memberError;

      const userIds = Array.from(new Set((memberRows || []).map((row) => row.userId).filter(Boolean)));
      if (!userIds.length) {
        setAccessMembers([]);
        return;
      }

      const { data: users, error: userError } = await supabase
        .from("User")
        .select("id, name, email")
        .in("id", userIds);
      if (userError) throw userError;

      const { data: roleRows, error: roleError } = await supabase
        .from("UserTripRole")
        .select("userId, role")
        .eq("tripId", shareTrip.id)
        .in("userId", userIds);
      if (roleError) throw roleError;

      const roleMap = new Map((roleRows || []).map((row) => [row.userId, row.role]));
      const members = (users || []).map((user) => ({
        id: user.id,
        name: user.name || "Traveler",
        email: user.email || "",
        role: roleMap.get(user.id) || "suggestor",
        photoUrl: user.photoUrl || ""
      }));

      members.sort((a, b) => {
        if (a.role === "owner") return -1;
        if (b.role === "owner") return 1;
        return a.name.localeCompare(b.name);
      });

      setAccessMembers(members);
      setPendingRoleChanges({});
      setOriginalRoles(
        members.reduce((acc, member) => {
          acc[member.id] = member.role;
          return acc;
        }, {})
      );
    } catch (error) {
      console.error("Failed to load trip members", error);
      setAccessMembers([]);
    }
  };

  useEffect(() => {
    void loadAccessMembers();
  }, [shareTrip]);

  const currentUserRole = accessMembers.find((member) => member.id === session?.user?.id)?.role || "suggestor";
  const canManageRoles = currentUserRole === "owner" || currentUserRole === "editor";

  const handleRoleChange = (memberId, nextRole) => {
    if (!shareTrip?.id) return;
    if (!memberId || !nextRole) return;
    setPendingRoleChanges((current) => {
      const next = { ...current };
      const originalRole = originalRoles[memberId];
      if (nextRole === originalRole) {
        delete next[memberId];
      } else {
        next[memberId] = nextRole;
      }
      return next;
    });
    setAccessMembers((current) =>
      current.map((member) => (member.id === memberId ? { ...member, role: nextRole } : member))
    );
  };

  const pendingChangeCount = Object.keys(pendingRoleChanges).length;

  const handleSaveRoleChanges = async () => {
    if (!shareTrip?.id || pendingChangeCount === 0) return;
    setSavingRoleChanges(true);
    try {
      const entries = Object.entries(pendingRoleChanges);
      for (const [memberId, nextRole] of entries) {
        if (nextRole === "remove") {
          const { error: roleError } = await supabase
            .from("UserTripRole")
            .delete()
            .eq("tripId", shareTrip.id)
            .eq("userId", memberId);
          if (roleError) throw roleError;
          const { error: memberError } = await supabase
            .from("TripMember")
            .delete()
            .eq("tripId", shareTrip.id)
            .eq("userId", memberId);
          if (memberError) throw memberError;
        } else {
          const { error } = await supabase
            .from("UserTripRole")
            .update({ role: nextRole })
            .eq("tripId", shareTrip.id)
            .eq("userId", memberId);
          if (error) throw error;
        }
      }
      await loadAccessMembers();
      setInviteStatus("Permissions updated");
      setShareTrip(null);
    } catch (error) {
      console.error("Failed to update member role", error);
      setInviteStatus(error?.message || "Unable to update permissions.");
    } finally {
      setSavingRoleChanges(false);
      setRoleUpdateLoadingId(null);
    }
  };

  if (!trips.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/60 p-8 text-center">
        <p className="text-lg font-semibold">No trips yet</p>
        <p className="mt-2 text-sm text-slate-500">Create a trip to start collaborating.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {trips.map((trip) => (
          <div key={trip.id} className="relative overflow-visible rounded-3xl bg-white/90 shadow-card">
            <div className="h-40 rounded-t-3xl bg-gradient-to-br from-sky-100 via-indigo-100 to-rose-100" />
            <div
              className="absolute right-4 top-4"
              ref={menuRef}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setMenuOpenId(menuOpenId === trip.id ? null : trip.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-sm hover:text-ink"
                aria-label="Trip actions"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="12" cy="19" r="1.6" />
                </svg>
              </button>
              {menuOpenId === trip.id && (
                <div
                  className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg"
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                    onClick={() => {
                      setMenuOpenId(null);
                      setRenameTrip(trip);
                      setRenameValue(trip.name || "");
                    }}
                  >
                    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                    </svg>
                    Rename
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                    onClick={async () => {
                      setMenuOpenId(null);
                      setDuplicateLoading(true);
                      try {
                        const copyName = `Copy of ${trip.name || "Trip"}`;
                        const newTrip = await createTrip({ name: copyName });
                        if (session?.user?.id) {
                          await createDefaultTripsTab(newTrip.id, session.user.id);
                        }
                        navigate(`/trips/${newTrip.id}`);
                      } catch (error) {
                        console.error("Unable to duplicate trip", error);
                      } finally {
                        setDuplicateLoading(false);
                      }
                    }}
                  >
                    <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <rect x="2" y="2" width="13" height="13" rx="2" />
                    </svg>
                    {duplicateLoading ? "Duplicating..." : "Duplicate"}
                  </button>
                  <div
                    className="group relative"
                    onMouseEnter={() => setShareMenuOpenId(trip.id)}
                    onMouseLeave={() => {
                      if (shareMenuPinnedId !== trip.id) {
                        setShareMenuOpenId(null);
                      }
                    }}
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                      onClick={() => {
                        setShareMenuOpenId(trip.id);
                        setShareMenuPinnedId(trip.id);
                      }}
                    >
                      <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
                        <path d="M16 6l-4-4-4 4" />
                        <path d="M12 2v13" />
                      </svg>
                      Share
                      <svg className="ml-auto h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M7 5l5 5-5 5" />
                      </svg>
                    </button>
                    {shareMenuOpenId === trip.id && (
                      <div
                        className="absolute left-full top-1/2 z-10 -ml-1 w-44 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg"
                        onMouseDown={(event) => event.stopPropagation()}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                          onClick={() => {
                            setMenuOpenId(null);
                            setShareMenuOpenId(null);
                            setShareMenuPinnedId(null);
                            setShareTrip(trip);
                            setInviteDraft("");
                            setInviteStatus("");
                          }}
                        >
                        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                        Share
                      </button>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                          onClick={async () => {
                            const link = `${window.location.origin}/trips/${trip.id}/invite`;
                            await navigator.clipboard.writeText(link);
                            setMenuOpenId(null);
                            setShareMenuOpenId(null);
                            setShareMenuPinnedId(null);
                            setInviteStatus("Link copied");
                            setLastShareTrip(trip);
                          }}
                        >
                        <svg className="h-4 w-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="9" y="9" width="13" height="13" rx="2" />
                          <rect x="2" y="2" width="13" height="13" rx="2" />
                        </svg>
                        Copy link
                      </button>
                    </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-coral hover:bg-rose-50"
                    onClick={() => {
                      setMenuOpenId(null);
                      setDeleteConfirm(trip);
                    }}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M6 6l1 14h10l1-14" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                    Delete trip
                  </button>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div>
                <h3 className="text-2xl font-semibold tracking-tight text-ink">
                  {trip.destination?.name || trip.destination?.label
                    ? `${trip.name} at ${trip.destination.name || trip.destination.label}`
                    : trip.name}
                </h3>
                {trip.startDate && trip.endDate ? (
                  <p className="mt-2 text-sm text-slate-500">{formatDateRange(trip.startDate, trip.endDate)}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">People</p>
                <div className="flex items-center">
                  {(() => {
                    const allMembers = trip.members && trip.members.length
                      ? trip.members
                      : [{ id: trip.createdById || "owner", name: trip.ownerDisplayName || "Trip owner" }];
                    const maxVisible = 5;
                    const visibleMembers = allMembers.slice(0, maxVisible);
                    const overflowCount = Math.max(allMembers.length - maxVisible, 0);

                    return (
                      <>
                        {visibleMembers.map((member, index) => (
                    <div
                      key={member.id}
                      className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white text-xs font-semibold ${
                        index === 0 ? "z-10" : "-ml-2"
                      } ${member.photoUrl ? "bg-slate-100 text-slate-600" : getAvatarColor(member.id)}`}
                      style={{ zIndex: 10 - index }}
                      title={member.name || "Traveler"}
                    >
                      {member.photoUrl ? (
                        <img src={member.photoUrl} alt={member.name || "Traveler"} className="h-full w-full object-cover" />
                      ) : (
                        <span>{getInitials(member.name)}</span>
                      )}
                    </div>
                        ))}
                        {overflowCount > 0 && (
                          <div
                            className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white bg-slate-200 text-xs font-semibold text-slate-700 -ml-2`}
                            style={{ zIndex: 10 - visibleMembers.length }}
                            title={`${overflowCount} more`}
                          >
                            +{overflowCount}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold text-[#4C6FFF]">
                  {ROLE_LABELS[trip.userRole] || "Suggestor"}
                </span>
                <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-slateblue">
                  {trip.memberCount} members
                </span>
              </div>

              <Link
                to={`/trips/${trip.id}`}
                className="w-full rounded-full border border-slate-200 px-4 py-2 text-center text-xs font-semibold text-ink hover:border-ocean hover:text-ocean"
              >
                View Trip
              </Link>
            </div>
          </div>
        ))}
      </div>

      {renameTrip ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => setRenameTrip(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Rename trip</h3>
            <input
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder="Trip name"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setRenameTrip(null)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!renameTrip?.id) return;
                  const nextName = String(renameValue || "").trim();
                  if (!nextName) return;
                  try {
                    await updateTripMeta(renameTrip.id, { name: nextName });
                    setRenameTrip(null);
                  } catch (error) {
                    console.error("Failed to rename trip", error);
                  }
                }}
                className="rounded-xl bg-ocean px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shareTrip ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => setShareTrip(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Share trip</h3>
            <p className="mt-1 text-sm text-slate-600">Invite people by email or copy the link.</p>
            <div className="mt-4 space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Invite by email</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-ink"
                value={inviteDraft}
                onChange={(event) => setInviteDraft(event.target.value)}
                placeholder="Add emails separated by commas"
              />
              {!inviteDraft.trim() ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">People with access</p>
                <div className="mt-2 space-y-2">
                  {accessMembers.length ? (
                    accessMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white text-xs font-semibold ${
                              member.photoUrl ? "bg-slate-100 text-slate-600" : getAvatarColor(member.id)
                            }`}
                          >
                            {member.photoUrl ? (
                              <img src={member.photoUrl} alt={member.name || "Traveler"} className="h-full w-full object-cover" />
                            ) : (
                              <span>{getInitials(member.name)}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-ink">{member.name || "Traveler"}</p>
                            <p className="text-xs text-slate-500 truncate">{member.email || "No email"}</p>
                          </div>
                        </div>
                        {canManageRoles && member.role !== "owner" ? (
                          <div className="relative" ref={roleMenuOpenId === member.id ? roleMenuRef : null}>
                            <button
                              type="button"
                              onClick={() => setRoleMenuOpenId(roleMenuOpenId === member.id ? null : member.id)}
                              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm hover:border-ocean hover:text-ocean"
                              disabled={roleUpdateLoadingId === member.id}
                            >
                              {member.role === "remove" ? "Remove access" : ROLE_LABELS[member.role] || "Suggestor"}
                              <svg className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5 7l5 5 5-5" />
                              </svg>
                            </button>
                            {roleMenuOpenId === member.id && (
                              <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg">
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                                  onClick={() => {
                                    setRoleMenuOpenId(null);
                                    handleRoleChange(member.id, "editor");
                                  }}
                                >
                                  {member.role === "editor" ? (
                                    <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M7.667 13.2L4.4 9.933l-1.4 1.4 4.667 4.667 9-9-1.4-1.4-7.6 7.6z" />
                                    </svg>
                                  ) : (
                                    <span className="h-4 w-4" />
                                  )}
                                  Editor
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                                  onClick={() => {
                                    setRoleMenuOpenId(null);
                                    handleRoleChange(member.id, "suggestor");
                                  }}
                                >
                                  {member.role === "suggestor" ? (
                                    <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M7.667 13.2L4.4 9.933l-1.4 1.4 4.667 4.667 9-9-1.4-1.4-7.6 7.6z" />
                                    </svg>
                                  ) : (
                                    <span className="h-4 w-4" />
                                  )}
                                  Suggestor
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-coral hover:bg-rose-50"
                                  onClick={() => {
                                    setRoleMenuOpenId(null);
                                    handleRoleChange(member.id, "remove");
                                  }}
                                >
                                  {member.role === "remove" ? (
                                    <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M7.667 13.2L4.4 9.933l-1.4 1.4 4.667 4.667 9-9-1.4-1.4-7.6 7.6z" />
                                    </svg>
                                  ) : (
                                    <span className="h-4 w-4" />
                                  )}
                                  Remove access
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {ROLE_LABELS[member.role] || "Suggestor"}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No members yet.</p>
                  )}
                </div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={async () => {
                    const link = `${window.location.origin}/trips/${shareTrip.id}/invite`;
                    await navigator.clipboard.writeText(link);
                    setInviteStatus("Link copied");
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-ink hover:border-ocean hover:text-ocean"
                >
                  Copy link
                </button>
                <div className="ml-auto flex items-center gap-2">
                  {pendingChangeCount > 0 ? (
                    <>
                      <span className="text-sm font-semibold text-amber-700">Pending changes</span>
                      <button
                        type="button"
                        onClick={handleSaveRoleChanges}
                        disabled={savingRoleChanges}
                        className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
                      >
                        {savingRoleChanges ? "Saving..." : "Save"}
                      </button>
                    </>
                  ) : inviteDraft.trim() ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setInviteDraft("")}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-ink"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          if (!shareTrip?.id) return;
                          const emails = parseInvitees(inviteDraft);
                          if (!emails.length) {
                            setInviteStatus("Add at least one email.");
                            return;
                          }
                          setInviteLoading(true);
                          setInviteStatus("");
                          try {
                            await sendTripInvites({
                              tripId: shareTrip.id,
                              tripName: shareTrip.name || "Trip",
                              invitees: emails,
                              inviteUrl: `${window.location.origin}/trips/${shareTrip.id}/invite`
                            });
                            setInviteStatus("Invites sent.");
                            setInviteDraft("");
                          } catch (error) {
                            setInviteStatus(error?.message || "Unable to send invites.");
                          } finally {
                            setInviteLoading(false);
                          }
                        }}
                        className="rounded-lg bg-ocean px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
                        disabled={inviteLoading}
                      >
                        {inviteLoading ? "Sending..." : "Send"}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShareTrip(null)}
                      className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      Done
                    </button>
                  )}
                </div>
              </div>
              {inviteStatus ? <p className="text-sm text-slate-600">{inviteStatus}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirm ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Delete trip?</h3>
            <p className="mt-2 text-sm text-slate-600">
              Delete &quot;{deleteConfirm.name || "this trip"}&quot;? This cannot be undone.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await deleteTrip(deleteConfirm.id);
                    setDeleteConfirm(null);
                  } catch (error) {
                    console.error("Failed to delete trip", error);
                  }
                }}
                className="rounded-xl bg-coral px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {inviteStatus ? (
        <div className="fixed bottom-6 right-6 z-[70] flex items-center gap-4 rounded-xl bg-ink px-5 py-3 text-base font-semibold text-white shadow-lg">
          <span>{inviteStatus}</span>
          {lastShareTrip ? (
            <button
              type="button"
              className="text-base font-semibold text-sky-200 underline hover:text-white"
              onClick={() => {
                setShareTrip(lastShareTrip);
                setInviteDraft("");
                setInviteStatus("");
              }}
            >
              Manage access
            </button>
          ) : null}
          <button
            type="button"
            className="ml-1 text-white/70 hover:text-white"
            onClick={() => setInviteStatus("")}
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      ) : null}
    </>
  );
}
