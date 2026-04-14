import { useEffect, useRef, useState } from "react";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { getAvatarColor } from "../lib/avatarColors.js";
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
  return parts[0][0].toUpperCase();
};

export default function ShareTripModal({ open, trip, onClose, onLinkCopied }) {
  const session = useSession();
  const sendTripInvites = useTripStore((state) => state.sendTripInvites);
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [accessMembers, setAccessMembers] = useState([]);
  const [roleUpdateLoadingId, setRoleUpdateLoadingId] = useState(null);
  const [roleMenuOpenId, setRoleMenuOpenId] = useState(null);
  const [pendingRoleChanges, setPendingRoleChanges] = useState({});
  const [savingRoleChanges, setSavingRoleChanges] = useState(false);
  const [originalRoles, setOriginalRoles] = useState({});
  const roleMenuRef = useRef(null);
  const [inviteRoleMenuOpenIndex, setInviteRoleMenuOpenIndex] = useState(null);
  const inviteRoleMenuRef = useRef(null);
  const [inviteRows, setInviteRows] = useState([{ email: "", role: "editor" }]);
  const [inviteErrors, setInviteErrors] = useState({});
  const [notifyInvites, setNotifyInvites] = useState(true);
  const [latchedOpen, setLatchedOpen] = useState(false);

  const resetInviteState = () => {
    setInviteStatus("");
    setInviteLoading(false);
    setRoleMenuOpenId(null);
    setRoleUpdateLoadingId(null);
    setPendingRoleChanges({});
    setSavingRoleChanges(false);
    setInviteRoleMenuOpenIndex(null);
    setInviteRows([{ email: "", role: "editor" }]);
    setInviteErrors({});
    setNotifyInvites(true);
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
        .select("id, name, email, avatarColor")
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
        avatarColor: user.avatarColor || ""
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
    if (open) {
      setLatchedOpen(true);
    }
  }, [open]);

  useEffect(() => {
    if (!open && !latchedOpen) {
      resetInviteState();
      return;
    }
    if (open) {
      resetInviteState();
      void loadAccessMembers();
    }
  }, [open, trip?.id, latchedOpen]);

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
    if (inviteRoleMenuOpenIndex === null) return undefined;
    const handleClickOutside = (event) => {
      if (inviteRoleMenuRef.current && !inviteRoleMenuRef.current.contains(event.target)) {
        setInviteRoleMenuOpenIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [inviteRoleMenuOpenIndex]);

  const currentUserRole = accessMembers.find((member) => member.id === session?.user?.id)?.role || "suggestor";
  const canManageRoles = currentUserRole === "owner" || currentUserRole === "editor";

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

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
  const hasInviteDrafts = inviteRows.some((row) => String(row.email || "").trim());

  const removeInviteRow = (index) => {
    setInviteRoleMenuOpenIndex((current) => {
      if (current === null) return current;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
    setInviteRows((current) => {
      if (current.length <= 1) {
        return [{ email: "", role: "editor" }];
      }
      const next = current.filter((_, i) => i !== index);
      return next.length ? next : [{ email: "", role: "editor" }];
    });
    setInviteErrors((current) => {
      const next = {};
      Object.entries(current).forEach(([key, value]) => {
        const idx = Number(key);
        if (Number.isNaN(idx) || idx === index) return;
        next[idx > index ? idx - 1 : idx] = value;
      });
      return next;
    });
  };

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

  const isVisible = (open || latchedOpen) && trip;
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
      onClick={() => {
        setLatchedOpen(false);
        onClose?.();
      }}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-card"
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-ink">Share trip</h3>
        <p className="mt-1 text-sm text-slate-600">Invite people by email or copy the link.</p>
        <div className="mt-4 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Invite by email</label>
          <div className="space-y-3">
            {inviteRows.map((row, index) => (
              <div key={`invite-row-${index}`} className="flex items-center gap-2">
                <button
                  type="button"
                  className={`${
                    inviteRows.length === 1 && !String(row.email || "").trim()
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-400 hover:text-ink"
                  }`}
                  onClick={() => removeInviteRow(index)}
                  aria-label="Remove invitee"
                  disabled={inviteRows.length === 1 && !String(row.email || "").trim()}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 14h10l1-14" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
                <div className="relative flex-1">
                  {inviteErrors[index] ? (
                    <span className="absolute -top-2 left-2 z-10 bg-white px-1 text-[11px] font-semibold leading-none text-rose-600">
                      Invalid email
                    </span>
                  ) : null}
                  <div
                    className={`relative h-10 overflow-hidden rounded-lg border transition-colors ${
                      inviteErrors[index] ? "border-rose-500" : "border-slate-300 focus-within:border-ocean"
                    }`}
                  >
                    <input
                      type="email"
                      className="invite-email-input h-full w-full bg-transparent px-3 text-sm text-ink outline-none"
                      aria-invalid={Boolean(inviteErrors[index])}
                      value={row.email}
                      onChange={(event) => {
                        const value = event.target.value;
                        setInviteRows((current) =>
                          current.map((item, i) => (i === index ? { ...item, email: value } : item))
                        );
                      }}
                      onBlur={() => {
                        const value = String(inviteRows[index]?.email || "").trim();
                        if (value && !isValidEmail(value)) {
                          setInviteErrors((current) => ({ ...current, [index]: true }));
                        } else {
                          setInviteErrors((current) => {
                            if (!current[index]) return current;
                            const next = { ...current };
                            delete next[index];
                            return next;
                          });
                        }
                      }}
                      placeholder="Enter email"
                    />
                  </div>
                </div>
                <div
                  className="relative"
                  ref={inviteRoleMenuOpenIndex === index ? inviteRoleMenuRef : null}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setInviteRoleMenuOpenIndex(inviteRoleMenuOpenIndex === index ? null : index)
                    }
                    className="flex h-10 min-w-[128px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 shadow-sm hover:border-ocean hover:text-ocean"
                  >
                    {ROLE_LABELS[row.role] || "Editor"}
                    <svg className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M5 7l5 5 5-5" />
                    </svg>
                  </button>
                  {inviteRoleMenuOpenIndex === index ? (
                    <div className="absolute right-0 mt-2 min-w-[128px] rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                        onClick={() => {
                          setInviteRoleMenuOpenIndex(null);
                          setInviteRows((current) =>
                            current.map((item, i) => (i === index ? { ...item, role: "editor" } : item))
                          );
                        }}
                      >
                        {row.role === "editor" ? (
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
                          setInviteRoleMenuOpenIndex(null);
                          setInviteRows((current) =>
                            current.map((item, i) => (i === index ? { ...item, role: "suggestor" } : item))
                          );
                        }}
                      >
                        {row.role === "suggestor" ? (
                          <svg className="h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7.667 13.2L4.4 9.933l-1.4 1.4 4.667 4.667 9-9-1.4-1.4-7.6 7.6z" />
                          </svg>
                        ) : (
                          <span className="h-4 w-4" />
                        )}
                        Suggestor
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="text-xs font-semibold text-ocean hover:text-blue-700"
              onClick={() =>
                setInviteRows((current) => [...current, { email: "", role: "editor" }])
              }
            >
              + Add another person
            </button>
            <div className="flex justify-end">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={notifyInvites}
                  onChange={(event) => setNotifyInvites(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-ocean focus:ring-ocean"
                />
                Notify people
              </label>
            </div>
          </div>
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
                          member.avatarColor || getAvatarColor(member.id)
                        }`}
                      >
                        <span>{getInitials(member.name)}</span>
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
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-ocean hover:text-ocean"
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
                      <span className="mr-3 text-xs font-semibold tracking-wide text-slate-500">
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
              ) : hasInviteDrafts ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setInviteRows([{ email: "", role: "editor" }]);
                      setInviteErrors({});
                      onClose?.();
                    }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!trip?.id) return;
                      const errors = {};
                      const normalizedRows = inviteRows
                        .map((row, idx) => ({
                          email: String(row.email || "").trim().toLowerCase(),
                          role: row.role || "editor",
                          index: idx
                        }))
                        .filter((row) => row.email);
                      if (!normalizedRows.length) {
                        setInviteStatus("Add at least one email.");
                        return;
                      }
                      normalizedRows.forEach((row) => {
                        if (!isValidEmail(row.email)) {
                          errors[row.index] = true;
                        }
                      });
                      if (Object.keys(errors).length) {
                        setInviteErrors(errors);
                        setInviteStatus("Enter a valid email for each invitee.");
                        return;
                      }
                      setInviteLoading(true);
                      setInviteStatus("");
                      try {
                        await sendTripInvites({
                          tripId: trip.id,
                          tripName: trip.name || "Trip",
                          invitees: normalizedRows.map(({ email, role }) => ({ email, role })),
                          inviteUrl: `${window.location.origin}/trips/${trip.id}/invite`,
                          notify: notifyInvites
                        });
                        setInviteStatus("Invites sent.");
                        setInviteRows([{ email: "", role: "editor" }]);
                        setInviteErrors({});
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
          {inviteStatus ? (
            <p
              className={`text-sm ${
                inviteStatus === "Enter a valid email for each invitee." ? "text-rose-600" : "text-slate-600"
              }`}
            >
              {inviteStatus}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
