import { useEffect, useRef, useState } from "react";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { getAvatarColor } from "../lib/avatarColors.js";
import { supabase } from "../lib/supabase.js";
import ToastNotification from "./ToastNotification.jsx";

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

const formatPendingInviteName = (email) => {
  const localPart = String(email || "").split("@")[0] || "";
  const normalized = localPart.replace(/[._-]+/g, " ").trim();
  if (!normalized) return "Pending invite";
  return normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export default function ShareTripModal({ open, trip, onClose, onLinkCopied }) {
  const session = useSession();
  const sendTripInvites = useTripStore((state) => state.sendTripInvites);
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [accessMembers, setAccessMembers] = useState([]);
  const [pendingInviteEntries, setPendingInviteEntries] = useState([]);
  const [roleUpdateLoadingId, setRoleUpdateLoadingId] = useState(null);
  const [roleMenuOpenId, setRoleMenuOpenId] = useState(null);
  const [pendingInviteActionLoadingId, setPendingInviteActionLoadingId] = useState(null);
  const [pendingInviteMenuOpenId, setPendingInviteMenuOpenId] = useState(null);
  const [pendingRoleChanges, setPendingRoleChanges] = useState({});
  const [savingRoleChanges, setSavingRoleChanges] = useState(false);
  const [originalRoles, setOriginalRoles] = useState({});
  const roleMenuRef = useRef(null);
  const pendingInviteMenuRef = useRef(null);
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
    setPendingInviteActionLoadingId(null);
    setPendingInviteMenuOpenId(null);
    setPendingRoleChanges({});
    setSavingRoleChanges(false);
    setInviteRoleMenuOpenIndex(null);
    setInviteRows([{ email: "", role: "editor" }]);
    setInviteErrors({});
    setNotifyInvites(true);
  };

  const handleRequestClose = () => {
    setLatchedOpen(false);
    onClose?.();
  };

  useEffect(() => {
    if (!inviteStatus) return undefined;
    const timer = setTimeout(() => setInviteStatus(""), 5000);
    return () => clearTimeout(timer);
  }, [inviteStatus]);

  const loadAccessMembers = async () => {
    if (!trip?.id) {
      setAccessMembers([]);
      setPendingInviteEntries([]);
      return;
    }

    try {
      const { data: memberRows, error: memberError } = await supabase
        .from("TripMember")
        .select("tripId, userId")
        .eq("tripId", trip.id);
      if (memberError) throw memberError;

      const userIds = Array.from(new Set((memberRows || []).map((row) => row.userId).filter(Boolean)));
      let users = [];
      if (userIds.length) {
        const { data: userRows, error: userError } = await supabase
          .from("User")
          .select("id, name, email, avatarColor")
          .in("id", userIds);
        if (userError) throw userError;
        users = userRows || [];
      }

      let roleRows = [];
      if (userIds.length) {
        const { data: roleData, error: roleError } = await supabase
          .from("UserTripRole")
          .select("userId, role")
          .eq("tripId", trip.id)
          .in("userId", userIds);
        if (roleError) throw roleError;
        roleRows = roleData || [];
      }

      const roleMap = new Map(roleRows.map((row) => [row.userId, row.role]));
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

      const { data: pendingRows, error: pendingError } = await supabase
        .from("PendingTripInvite")
        .select("id, email, role, status, createdAt")
        .eq("tripId", trip.id)
        .eq("status", "pending")
        .order("createdAt", { ascending: true });

      if (pendingError && !String(pendingError.message || "").includes("PendingTripInvite")) {
        throw pendingError;
      }

      const memberEmailSet = new Set(
        members
          .map((member) => String(member.email || "").trim().toLowerCase())
          .filter(Boolean)
      );
      const pendingEmails = Array.from(
        new Set(
          (pendingRows || [])
            .map((row) => String(row.email || "").trim().toLowerCase())
            .filter((email) => email && !memberEmailSet.has(email))
        )
      );

      let pendingUsersByEmail = new Map();
      if (pendingEmails.length) {
        const { data: pendingUsers, error: pendingUsersError } = await supabase
          .from("User")
          .select("id, name, email, avatarColor")
          .in("email", pendingEmails);
        if (pendingUsersError) throw pendingUsersError;
        pendingUsersByEmail = new Map(
          (pendingUsers || []).map((user) => [String(user.email || "").trim().toLowerCase(), user])
        );
      }

      const pendingEntries = (pendingRows || [])
        .map((row) => {
          const email = String(row.email || "").trim().toLowerCase();
          if (!email || memberEmailSet.has(email)) return null;
          const matchedUser = pendingUsersByEmail.get(email);
          return {
            id: row.id,
            name: matchedUser?.name || formatPendingInviteName(email),
            email,
            role: row.role === "editor" ? "editor" : "suggestor",
            avatarColor: matchedUser?.avatarColor || "",
            avatarKey: matchedUser?.id || `pending:${row.id}`
          };
        })
        .filter(Boolean);

      setAccessMembers(members);
      setPendingInviteEntries(pendingEntries);
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
      setPendingInviteEntries([]);
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
    if (!pendingInviteMenuOpenId) return undefined;
    const handleClickOutside = (event) => {
      if (pendingInviteMenuRef.current && !pendingInviteMenuRef.current.contains(event.target)) {
        setPendingInviteMenuOpenId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pendingInviteMenuOpenId]);

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
  const canManagePendingInvites = currentUserRole === "owner";

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
  const hasPeopleWithAccess = accessMembers.length > 0 || pendingInviteEntries.length > 0;

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
      handleRequestClose();
    } catch (error) {
      console.error("Failed to update member role", error);
      setInviteStatus(error?.message || "Unable to update permissions.");
    } finally {
      setSavingRoleChanges(false);
      setRoleUpdateLoadingId(null);
    }
  };

  const handlePendingInviteRoleUpdate = async (inviteId, nextRole) => {
    if (!trip?.id || !inviteId || !canManagePendingInvites) return;
    setPendingInviteActionLoadingId(inviteId);
    try {
      const normalizedRole = nextRole === "editor" ? "editor" : "suggestor";
      const { error } = await supabase
        .from("PendingTripInvite")
        .update({ role: normalizedRole })
        .eq("id", inviteId)
        .eq("tripId", trip.id)
        .eq("status", "pending");
      if (error) throw error;
      setInviteStatus("Pending invite updated.");
      await loadAccessMembers();
    } catch (error) {
      console.error("Failed to update pending invite role", error);
      setInviteStatus(error?.message || "Unable to update pending invite.");
    } finally {
      setPendingInviteActionLoadingId(null);
      setPendingInviteMenuOpenId(null);
    }
  };

  const handlePendingInviteRemove = async (inviteId) => {
    if (!trip?.id || !inviteId || !canManagePendingInvites) return;
    setPendingInviteActionLoadingId(inviteId);
    try {
      const { error } = await supabase
        .from("PendingTripInvite")
        .update({
          status: "canceled",
          canceledAt: new Date().toISOString()
        })
        .eq("id", inviteId)
        .eq("tripId", trip.id)
        .eq("status", "pending");
      if (error) throw error;
      setInviteStatus("Pending invite removed.");
      await loadAccessMembers();
    } catch (error) {
      console.error("Failed to remove pending invite", error);
      setInviteStatus(error?.message || "Unable to remove pending invite.");
    } finally {
      setPendingInviteActionLoadingId(null);
      setPendingInviteMenuOpenId(null);
    }
  };

  const isVisible = (open || latchedOpen) && trip;
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
      onClick={handleRequestClose}
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
              className="text-xs font-semibold text-ocean hover:text-[#152f2a]"
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
              {hasPeopleWithAccess ? (
                <>
                {accessMembers.map((member) => (
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
                ))}
                {pendingInviteEntries.map((invite) => (
                  <div
                    key={`pending-${invite.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white text-xs font-semibold ${
                          invite.avatarColor || getAvatarColor(invite.avatarKey)
                        }`}
                      >
                        <span>{getInitials(invite.name)}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                          <span className="truncate">{invite.name || "Pending invite"}</span>
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                            Pending
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 truncate">{invite.email || "No email"}</p>
                      </div>
                    </div>
                    {canManagePendingInvites ? (
                      <div
                        className="relative"
                        ref={pendingInviteMenuOpenId === invite.id ? pendingInviteMenuRef : null}
                      >
                        <button
                          type="button"
                          onClick={() => setPendingInviteMenuOpenId(pendingInviteMenuOpenId === invite.id ? null : invite.id)}
                          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:border-ocean hover:text-ocean"
                          disabled={pendingInviteActionLoadingId === invite.id}
                        >
                          {ROLE_LABELS[invite.role] || "Suggestor"}
                          <svg className="h-3 w-3 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M5 7l5 5 5-5" />
                          </svg>
                        </button>
                        {pendingInviteMenuOpenId === invite.id ? (
                          <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1 text-sm shadow-lg">
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100"
                              onClick={() => handlePendingInviteRoleUpdate(invite.id, "editor")}
                            >
                              {invite.role === "editor" ? (
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
                              onClick={() => handlePendingInviteRoleUpdate(invite.id, "suggestor")}
                            >
                              {invite.role === "suggestor" ? (
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
                              onClick={() => handlePendingInviteRemove(invite.id)}
                            >
                              <span className="h-4 w-4" />
                              Remove invite
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <span className="mr-3 text-xs font-semibold tracking-wide text-slate-500">
                        {ROLE_LABELS[invite.role] || "Suggestor"}
                      </span>
                    )}
                  </div>
                ))}
                </>
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
                      handleRequestClose();
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
                        const memberEmailSet = new Set(
                          accessMembers
                            .map((member) => String(member.email || "").trim().toLowerCase())
                            .filter(Boolean)
                        );

                        const candidateRows = normalizedRows.filter((row) => !memberEmailSet.has(row.email));
                        if (!candidateRows.length) {
                          setInviteStatus("All invitees are already members.");
                          return;
                        }

                        const candidateEmails = candidateRows.map((row) => row.email);
                        let existingPendingSet = new Set();
                        const { data: existingPendingRows, error: existingPendingError } = await supabase
                          .from("PendingTripInvite")
                          .select("email")
                          .eq("tripId", trip.id)
                          .in("email", candidateEmails)
                          .eq("status", "pending");

                        if (existingPendingError && !String(existingPendingError.message || "").includes("PendingTripInvite")) {
                          throw existingPendingError;
                        }

                        if (!existingPendingError) {
                          existingPendingSet = new Set(
                            (existingPendingRows || [])
                              .map((row) => String(row.email || "").trim().toLowerCase())
                              .filter(Boolean)
                          );
                        }

                        const rowsToCreate = candidateRows.filter((row) => !existingPendingSet.has(row.email));
                        if (!rowsToCreate.length) {
                          setInviteStatus("All invitees already have pending invites.");
                          return;
                        }

                        const pendingRows = rowsToCreate.map((invitee) => ({
                          id: crypto.randomUUID(),
                          tripId: trip.id,
                          email: invitee.email,
                          role: invitee.role === "editor" ? "editor" : "suggestor",
                          status: "pending",
                          createdById: session?.user?.id || null
                        }));

                        const { error: pendingInsertError } = await supabase
                          .from("PendingTripInvite")
                          .insert(pendingRows);

                        const missingPendingInviteTable =
                          pendingInsertError && String(pendingInsertError.message || "").includes("PendingTripInvite");
                        if (pendingInsertError && !missingPendingInviteTable) {
                          throw pendingInsertError;
                        }

                        let inviteSendResult = null;
                        let inviteSendError = null;
                        try {
                          inviteSendResult = await sendTripInvites({
                            tripId: trip.id,
                            tripName: trip.name || "Trip",
                            invitees: rowsToCreate.map(({ email, role }) => ({ email, role })),
                            inviteUrl: `${window.location.origin}/trips/${trip.id}/invite`,
                            notify: notifyInvites
                          });
                        } catch (error) {
                          inviteSendError = error;
                          console.error("Invite email send failed", error);
                        }

                        if (missingPendingInviteTable) {
                          setInviteStatus("Invites sent, but pending invite tracking is unavailable in this environment.");
                        } else if (!notifyInvites) {
                          setInviteStatus(rowsToCreate.length === 1 ? "Invite created." : "Invites created.");
                        } else if (inviteSendResult?.sent > 0 && (inviteSendResult?.failed || 0) === 0) {
                          setInviteStatus(rowsToCreate.length === 1 ? "Invite sent." : "Invites sent.");
                        } else if (inviteSendResult?.sent > 0) {
                          setInviteStatus(
                            `${inviteSendResult.sent} invite${inviteSendResult.sent === 1 ? "" : "s"} sent.`
                          );
                        } else if (inviteSendError) {
                          setInviteStatus("Invite created. Email notification couldn't be delivered right now.");
                        } else {
                          setInviteStatus(rowsToCreate.length === 1 ? "Invite created." : "Invites created.");
                        }
                        setInviteRows([{ email: "", role: "editor" }]);
                        setInviteErrors({});
                        await loadAccessMembers();
                      } catch (error) {
                        setInviteStatus(error?.message || "Unable to send invites.");
                      } finally {
                        setInviteLoading(false);
                      }
                    }}
                    className="rounded-lg bg-ocean px-3 py-2 text-sm font-semibold text-white hover:bg-[#152f2a] disabled:opacity-60"
                    disabled={inviteLoading}
                  >
                    {inviteLoading ? "Sending..." : "Send"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestClose}
                  className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Done
                </button>
              )}
            </div>
          </div>
          {inviteStatus ? (
            <ToastNotification message={inviteStatus} onDismiss={() => setInviteStatus("")} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
