import { useEffect, useRef, useState } from "react";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
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

export default function ShareTripModal({ open, trip, onClose, onLinkCopied }) {
  const session = useSession();
  const sendTripInvites = useTripStore((state) => state.sendTripInvites);
  const [inviteDraft, setInviteDraft] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [accessMembers, setAccessMembers] = useState([]);
  const [roleUpdateLoadingId, setRoleUpdateLoadingId] = useState(null);
  const [roleMenuOpenId, setRoleMenuOpenId] = useState(null);
  const [pendingRoleChanges, setPendingRoleChanges] = useState({});
  const [savingRoleChanges, setSavingRoleChanges] = useState(false);
  const [originalRoles, setOriginalRoles] = useState({});
  const roleMenuRef = useRef(null);

  const resetInviteState = () => {
    setInviteDraft("");
    setInviteStatus("");
    setInviteLoading(false);
    setRoleMenuOpenId(null);
    setRoleUpdateLoadingId(null);
    setPendingRoleChanges({});
    setSavingRoleChanges(false);
  };

  useEffect(() => {
    if (!inviteStatus) return undefined;
    const timer = setTimeout(() => setInviteStatus(""), 10000);
    return () => clearTimeout(timer);
  }, [inviteStatus]);

  const loadAccessMembers = async () => {
    if (!trip?.id) {
      setAccessMembers([]);
      return;
    }

    try {
      const { data: memberRows, error: memberError } = await supabase
        .from("TripMember")
        .select("tripId, userId")
        .eq("tripId", trip.id);
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
        .eq("tripId", trip.id)
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
    if (!open) {
      resetInviteState();
      return;
    }
    resetInviteState();
    void loadAccessMembers();
  }, [open, trip?.id]);

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

  const currentUserRole = accessMembers.find((member) => member.id === session?.user?.id)?.role || "suggestor";
  const canManageRoles = currentUserRole === "owner" || currentUserRole === "editor";

  const handleRoleChange = (memberId, nextRole) => {
    if (!trip?.id) return;
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
    if (!trip?.id || pendingChangeCount === 0) return;
    setSavingRoleChanges(true);
    try {
      const entries = Object.entries(pendingRoleChanges);
      for (const [memberId, nextRole] of entries) {
        if (nextRole === "remove") {
          const { error: roleError } = await supabase
            .from("UserTripRole")
            .delete()
            .eq("tripId", trip.id)
            .eq("userId", memberId);
          if (roleError) throw roleError;
          const { error: memberError } = await supabase
            .from("TripMember")
            .delete()
            .eq("tripId", trip.id)
            .eq("userId", memberId);
          if (memberError) throw memberError;
        } else {
          const { error } = await supabase
            .from("UserTripRole")
            .update({ role: nextRole })
            .eq("tripId", trip.id)
            .eq("userId", memberId);
          if (error) throw error;
        }
      }
      await loadAccessMembers();
      setInviteStatus("Permissions updated");
      onClose?.();
    } catch (error) {
      console.error("Failed to update member role", error);
      setInviteStatus(error?.message || "Unable to update permissions.");
    } finally {
      setSavingRoleChanges(false);
      setRoleUpdateLoadingId(null);
    }
  };

  if (!open || !trip) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
      onClick={() => onClose?.()}
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
                const link = `${window.location.origin}/trips/${trip.id}/invite`;
                await navigator.clipboard.writeText(link);
                setInviteStatus("Link copied");
                onLinkCopied?.(trip);
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
                    onClick={() => {
                      setInviteDraft("");
                      onClose?.();
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!trip?.id) return;
                      const emails = parseInvitees(inviteDraft);
                      if (!emails.length) {
                        setInviteStatus("Add at least one email.");
                        return;
                      }
                      setInviteLoading(true);
                      setInviteStatus("");
                      try {
                        await sendTripInvites({
                          tripId: trip.id,
                          tripName: trip.name || "Trip",
                          invitees: emails,
                          inviteUrl: `${window.location.origin}/trips/${trip.id}/invite`
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
                  onClick={() => onClose?.()}
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
  );
}
