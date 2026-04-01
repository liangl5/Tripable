import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import TabManager from "../components/TabManager.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { supabase } from "../lib/supabase.js";
import { parseInvitees } from "../lib/tripPlanning.js";

const ROLE_LABELS = {
  owner: "Owner",
  editor: "Editor",
  suggestor: "Suggestor"
};

const ROLE_ORDER = {
  owner: 0,
  editor: 1,
  suggestor: 2
};

function normalizeRole(role) {
  if (role === "owner" || role === "editor") return role;
  return "suggestor";
}

export default function TripDashboardPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const session = useSession();
  const [trip, setTrip] = useState(null);
  const [ideas, setIdeas] = useState([]);
  const [tripMembers, setTripMembers] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [memberRoles, setMemberRoles] = useState({});
  const [inviteDraft, setInviteDraft] = useState("");
  const [pendingInvites, setPendingInvites] = useState([]);
  const [existingPendingInvites, setExistingPendingInvites] = useState([]);
  const [notifyInvitees, setNotifyInvitees] = useState(true);
  const [shareStatus, setShareStatus] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editTripNameOpen, setEditTripNameOpen] = useState(false);
  const [tripNameDraft, setTripNameDraft] = useState("");
  const [tripNameSaving, setTripNameSaving] = useState(false);
  const tripNameInputRef = useRef(null);
  const leaveTrip = useTripStore((state) => state.leaveTrip);
  const leaveTripLoading = useTripStore((state) => state.leaveTripLoading);
  const sendTripInvites = useTripStore((state) => state.sendTripInvites);

  const currentUserId = session?.user?.id;

  const loadPendingInvites = async () => {
    const { data, error } = await supabase
      .from("PendingTripInvite")
      .select("id, email, role, status, createdAt")
      .eq("tripId", tripId)
      .eq("status", "pending")
      .order("createdAt", { ascending: false });

    if (error) {
      // Backwards compatibility for environments where this table is not created yet.
      if (String(error.message || "").includes("PendingTripInvite")) {
        setExistingPendingInvites([]);
        return;
      }
      throw error;
    }

    setExistingPendingInvites(data || []);
  };

  // Load trip and roles
  useEffect(() => {
    if (!session) {
      navigate("/auth");
      return;
    }

    const loadTripData = async () => {
      try {
        setLoading(true);

        // Load trip
        const { data: tripData, error: tripError } = await supabase
          .from("Trip")
          .select("*")
          .eq("id", tripId)
          .single();

        if (tripError) throw tripError;
        setTrip(tripData);

        // Load trip members from TripMember table
        const { data: memberRelations } = await supabase
          .from("TripMember")
          .select("userId")
          .eq("tripId", tripId);

        const memberIds = [tripData.createdById, ...(memberRelations?.map((m) => m.userId) || [])];

        const { data: roleRows } = await supabase
          .from("UserTripRole")
          .select("userId, role")
          .eq("tripId", tripId);

        const roleMap = {};
        (roleRows || []).forEach((row) => {
          roleMap[row.userId] = row.userId === tripData.createdById ? "owner" : (row.role === "editor" ? "editor" : "suggestor");
        });
        roleMap[tripData.createdById] = "owner";
        setMemberRoles(roleMap);

        const derivedRole = tripData?.createdById === currentUserId
          ? "owner"
          : normalizeRole(roleMap[currentUserId]);
        setUserRole(derivedRole);

        const { data: membersData } = await supabase
          .from("User")
          .select("id, name, email")
          .in("id", memberIds);

        setTripMembers(membersData || []);

        // Load ideas
        const { data: ideasData } = await supabase
          .from("Idea")
          .select("*")
          .eq("tripId", tripId);

        setIdeas(ideasData || []);
        await loadPendingInvites();
      } catch (error) {
        console.error("Failed to load trip:", error);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    loadTripData();
  }, [tripId, session, navigate, currentUserId]);

  useEffect(() => {
    if (!shareOpen || userRole !== "owner") return;
    void loadPendingInvites();
  }, [shareOpen, userRole]);

  useEffect(() => {
    if (!editTripNameOpen) return;
    setTripNameDraft(String(trip?.name || ""));
  }, [editTripNameOpen, trip?.name]);

  useEffect(() => {
    if (!editTripNameOpen) return;
    const timer = setTimeout(() => {
      const input = tripNameInputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(0, input.value.length);
    }, 0);
    return () => clearTimeout(timer);
  }, [editTripNameOpen]);

  const handleCopyInviteLink = async () => {
    const inviteLink = `${window.location.origin}/trips/${tripId}/invite`;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const canEditTripName = userRole === "owner" || userRole === "editor";

  const handleSaveTripName = async () => {
    if (!canEditTripName || !trip?.id) return;
    const nextName = String(tripNameDraft || "").trim();
    if (!nextName || nextName === trip.name) {
      setEditTripNameOpen(false);
      return;
    }

    try {
      setTripNameSaving(true);
      const { error } = await supabase
        .from("Trip")
        .update({ name: nextName })
        .eq("id", trip.id);

      if (error) throw error;
      setTrip((current) => (current ? { ...current, name: nextName } : current));
      setEditTripNameOpen(false);
    } catch (error) {
      setActionStatus(error?.message || "Unable to update trip name right now.");
    } finally {
      setTripNameSaving(false);
    }
  };

  const addPendingInvitees = () => {
    const parsed = parseInvitees(inviteDraft);
    if (!parsed.length) return;
    const memberEmailSet = new Set(
      (tripMembers || [])
        .map((member) => String(member.email || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const persistedPendingSet = new Set(
      (existingPendingInvites || [])
        .map((invite) => String(invite.email || "").trim().toLowerCase())
        .filter(Boolean)
    );

    let skippedCount = 0;
    setPendingInvites((current) => {
      const map = new Map(current.map((entry) => [entry.email, entry]));
      parsed.forEach((email) => {
        const normalized = String(email || "").trim().toLowerCase();
        if (!normalized) return;
        if (memberEmailSet.has(normalized) || persistedPendingSet.has(normalized)) {
          skippedCount += 1;
          return;
        }
        if (!map.has(normalized)) {
          map.set(normalized, { email: normalized, role: "suggestor" });
        }
      });
      return Array.from(map.values());
    });
    if (skippedCount > 0) {
      setShareStatus(`${skippedCount} email(s) were skipped because they are already members or pending invites.`);
    }
    setInviteDraft("");
  };

  const handlePendingRoleChange = (email, role) => {
    setPendingInvites((current) =>
      current.map((entry) => (entry.email === email ? { ...entry, role: normalizeRole(role) } : entry))
    );
  };

  const handleRemovePendingInvite = (email) => {
    setPendingInvites((current) => current.filter((entry) => entry.email !== email));
  };

  const handleCancelExistingPendingInvite = async (inviteId) => {
    try {
      setShareLoading(true);
      const { error } = await supabase
        .from("PendingTripInvite")
        .update({
          status: "canceled",
          canceledAt: new Date().toISOString()
        })
        .eq("id", inviteId)
        .eq("tripId", tripId)
        .eq("status", "pending");
      if (error) throw error;
      await loadPendingInvites();
      setShareStatus("Pending invite canceled.");
    } catch (error) {
      setShareStatus(error?.message || "Unable to cancel invite right now.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleMemberRoleUpdate = async (member, nextRole) => {
    if (userRole !== "owner" || !member?.id) return;
    const currentRole = normalizeRole(memberRoles[member.id] || (member.id === trip?.createdById ? "owner" : "suggestor"));
    const targetRole = nextRole === "editor" ? "editor" : "suggestor";
    if (currentRole === targetRole) return;
    if (member.id === trip?.createdById) return;

    try {
      setShareLoading(true);
      const { error: upsertError } = await supabase
        .from("UserTripRole")
        .upsert(
          [
            {
              id: crypto.randomUUID(),
              tripId,
              userId: member.id,
              role: targetRole
            }
          ],
          {
            onConflict: "tripId,userId"
          }
        );
      if (upsertError) throw upsertError;

      setMemberRoles((current) => ({
        ...current,
        [member.id]: targetRole
      }));
      setShareStatus(`${member.name || "User"} is now ${ROLE_LABELS[targetRole]}.`);
    } catch (error) {
      setShareStatus(error?.message || "Unable to update role right now.");
    } finally {
      setShareLoading(false);
    }
  };

  const executeRevokeAccess = async (member) => {
    if (userRole !== "owner" || !member?.id) return;
    if (member.id === trip?.createdById) return;

    try {
      setShareLoading(true);

      const { error: roleDeleteError } = await supabase
        .from("UserTripRole")
        .delete()
        .eq("tripId", tripId)
        .eq("userId", member.id);
      if (roleDeleteError) throw roleDeleteError;

      const { error: memberDeleteError } = await supabase
        .from("TripMember")
        .delete()
        .eq("tripId", tripId)
        .eq("userId", member.id);
      if (memberDeleteError) throw memberDeleteError;

      setTripMembers((current) => current.filter((candidate) => candidate.id !== member.id));
      setMemberRoles((current) => {
        const next = { ...current };
        delete next[member.id];
        return next;
      });
      setShareStatus(`${member.name || "Member"} was removed from the trip.`);
    } catch (error) {
      setShareStatus(error?.message || "Unable to revoke access right now.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeAccess = (member) => {
    if (userRole !== "owner" || !member?.id || member.id === trip?.createdById) return;
    setConfirmDialog({
      kind: "revoke",
      member,
      title: "Remove access?",
      message: `Remove ${member.name || member.email || "this member"} from this trip?`,
      confirmText: "Remove",
      tone: "danger"
    });
  };

  const handleSubmitShare = async () => {
    if (userRole !== "owner") return;

    const draftInvites = parseInvitees(inviteDraft).map((email) => ({
      email: String(email || "").trim().toLowerCase(),
      role: "suggestor"
    }));

    const inviteMap = new Map();
    pendingInvites.forEach((entry) => {
      inviteMap.set(entry.email, entry);
    });
    draftInvites.forEach((entry) => {
      if (!inviteMap.has(entry.email)) {
        inviteMap.set(entry.email, entry);
      }
    });
    const invitesToProcess = Array.from(inviteMap.values());

    if (!invitesToProcess.length) {
      setShareStatus("No invitees to send.");
      return;
    }

    setShareLoading(true);
    setShareStatus("");

    try {
      const memberEmailSet = new Set(
        (tripMembers || [])
          .map((member) => String(member.email || "").trim().toLowerCase())
          .filter(Boolean)
      );
      const persistedPendingSet = new Set(
        (existingPendingInvites || [])
          .map((invite) => String(invite.email || "").trim().toLowerCase())
          .filter(Boolean)
      );

      const eligibleInvites = invitesToProcess.filter((invite) => {
        const email = String(invite.email || "").trim().toLowerCase();
        return !memberEmailSet.has(email) && !persistedPendingSet.has(email);
      });

      if (!eligibleInvites.length) {
        setShareStatus("All invitees are already members or pending.");
        setShareLoading(false);
        return;
      }

      let pendingCreated = 0;
      const newlyNotifiedEmails = [];

      for (const invite of eligibleInvites) {
        const { error: pendingInsertError } = await supabase
          .from("PendingTripInvite")
          .insert([
            {
              id: crypto.randomUUID(),
              tripId,
              email: invite.email,
              role: invite.role === "editor" ? "editor" : "suggestor",
              status: "pending",
              createdById: currentUserId
            }
          ]);
        if (pendingInsertError) throw pendingInsertError;
        pendingCreated += 1;
        newlyNotifiedEmails.push(invite.email);
      }

      let mailSummary = "";
      if (notifyInvitees && newlyNotifiedEmails.length > 0) {
        const result = await sendTripInvites({
          tripId,
          tripName: trip.name,
          invitees: newlyNotifiedEmails,
          inviteUrl: `${window.location.origin}/trips/${tripId}/invite`,
          notify: notifyInvitees
        });
        mailSummary = ` Email sent: ${result.sent}, failed: ${result.failed}.`;
      } else if (!notifyInvitees) {
        mailSummary = " Email notifications skipped.";
      }

      setPendingInvites([]);
      setInviteDraft("");

      // Refresh members and roles
      const { data: memberRelations } = await supabase
        .from("TripMember")
        .select("userId")
        .eq("tripId", tripId);

      const memberIds = [trip.createdById, ...(memberRelations?.map((m) => m.userId) || [])];
      const { data: membersData } = await supabase
        .from("User")
        .select("id, name, email")
        .in("id", memberIds);
      setTripMembers(membersData || []);

      const { data: roleRows } = await supabase
        .from("UserTripRole")
        .select("userId, role")
        .eq("tripId", tripId);
      const roleMap = {};
      (roleRows || []).forEach((row) => {
        roleMap[row.userId] = row.role;
      });
      roleMap[trip.createdById] = "owner";
      setMemberRoles(roleMap);
      await loadPendingInvites();

      setShareStatus(`Created ${pendingCreated} pending invite(s).${mailSummary}`);
    } catch (error) {
      setShareStatus(error?.message || "Unable to share trip right now.");
    } finally {
      setShareLoading(false);
    }
  };

  const executeDeleteTrip = async () => {
    if (userRole !== "owner") return;

    try {
      setActionLoading(true);
      await supabase.from("Trip").delete().eq("id", tripId);
      navigate("/");
    } catch (error) {
      console.error("Failed to delete trip:", error);
      setActionStatus("Failed to delete trip.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTrip = () => {
    if (userRole !== "owner") return;
    setConfirmDialog({
      kind: "delete",
      title: "Delete trip?",
      message: "Delete this trip? This cannot be undone.",
      confirmText: "Delete",
      tone: "danger"
    });
  };

  const executeLeaveTrip = async () => {
    if (userRole === "owner") return;
    try {
      setActionLoading(true);
      await leaveTrip(tripId);
      navigate("/");
    } catch (error) {
      console.error("Failed to leave trip:", error);
      setActionStatus(error?.message || "Failed to leave trip");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeaveTrip = () => {
    if (userRole === "owner") return;
    setConfirmDialog({
      kind: "leave",
      title: "Leave trip?",
      message: "Leave this trip? You will need a new invite link to rejoin.",
      confirmText: "Leave",
      tone: "warning"
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmDialog || actionLoading || shareLoading || leaveTripLoading) return;
    if (confirmDialog.kind === "delete") {
      await executeDeleteTrip();
      setConfirmDialog(null);
      return;
    }
    if (confirmDialog.kind === "leave") {
      await executeLeaveTrip();
      setConfirmDialog(null);
      return;
    }
    if (confirmDialog.kind === "revoke") {
      await executeRevokeAccess(confirmDialog.member);
      setConfirmDialog(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-slate-600">Loading trip...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Header />
        <div className="text-slate-600">Trip not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />

      {/* Trip Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div>
            <div className="group inline-flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-ink">{trip.name}</h1>
              {canEditTripName ? (
                <button
                  onClick={() => setEditTripNameOpen(true)}
                  className="rounded-md px-1.5 py-0.5 text-slate-400 opacity-0 transition hover:bg-mist hover:text-ocean group-hover:opacity-100"
                  aria-label="Edit trip name"
                >
                  ✎
                </button>
              ) : null}
            </div>
            {trip.startDate && trip.endDate && (
              <p className="text-sm text-slate-600 mt-1">
                {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            {userRole === "owner" ? (
              <button
                onClick={() => setShareOpen(true)}
                className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-300"
              >
                Invite
              </button>
            ) : null}

            {userRole === "owner" ? (
              <button
                onClick={handleDeleteTrip}
                className="rounded-lg bg-coral px-4 py-2 text-sm font-semibold text-white hover:bg-red-600"
              >
                Delete Trip
              </button>
            ) : (
              <button
                onClick={handleLeaveTrip}
                disabled={leaveTripLoading}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {leaveTripLoading ? "Leaving..." : "Leave Trip"}
              </button>
            )}
          </div>
        </div>
        {actionStatus ? <p className="mx-auto max-w-6xl px-6 pb-3 text-sm text-coral">{actionStatus}</p> : null}
      </div>

      {/* Tab Manager */}
      <div className="flex-1 mx-auto max-w-6xl w-full">
        {trip && (
          <TabManager
            trip={trip}
            tripId={tripId}
            userId={currentUserId}
            userRole={userRole}
            ideas={ideas}
            tripMembers={tripMembers}
          />
        )}
      </div>

      {shareOpen && userRole === "owner" ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4 py-6"
          onClick={() => setShareOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-2xl font-semibold text-ink">Share &quot;{trip.name}&quot;</h2>
              <button
                onClick={() => setShareOpen(false)}
                aria-label="Close share dialog"
                className="rounded-full bg-mist px-3 py-1.5 text-sm font-semibold text-slate-600"
              >
                X
              </button>
            </div>

            <div className="mt-5">
              <label className="text-sm font-semibold text-ink">Add people by email</label>
              <div className="mt-2 flex gap-2">
                <input
                  value={inviteDraft}
                  onChange={(event) => setInviteDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === ",") {
                      event.preventDefault();
                      addPendingInvitees();
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Type email and press Enter"
                />
                <button
                  onClick={addPendingInvitees}
                  className="rounded-xl bg-ocean px-4 py-2 text-sm font-semibold text-white"
                >
                  Add
                </button>
              </div>

              {pendingInvites.length ? (
                <div className="mt-3 space-y-2">
                  {pendingInvites.map((invite) => (
                    <div key={invite.email} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                      <span className="text-sm text-ink">{invite.email}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={invite.role}
                          onChange={(event) => handlePendingRoleChange(invite.email, event.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-sm"
                        >
                          <option value="suggestor">Suggestor</option>
                          <option value="editor">Editor</option>
                        </select>
                        <button
                          onClick={() => handleRemovePendingInvite(invite.email)}
                          className="rounded-full bg-mist px-2 py-1 text-xs font-semibold text-slate-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-4">
                <h4 className="text-sm font-semibold text-ink">Pending invites</h4>
                {existingPendingInvites.length ? (
                  <div className="mt-2 space-y-2">
                    {existingPendingInvites.map((invite) => (
                      <div key={invite.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                        <div>
                          <p className="text-sm text-ink">{invite.email}</p>
                          <p className="text-xs text-slate-500">Role: {ROLE_LABELS[normalizeRole(invite.role)]}</p>
                        </div>
                        <button
                          onClick={() => handleCancelExistingPendingInvite(invite.id)}
                          disabled={shareLoading}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-coral hover:bg-mist disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">No pending invites.</p>
                )}
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-ink">People with access</h3>
              <div className="mt-3 space-y-2">
                {tripMembers
                  .slice()
                  .sort((left, right) => {
                    const leftRole = memberRoles[left.id] || (left.id === trip.createdById ? "owner" : "suggestor");
                    const rightRole = memberRoles[right.id] || (right.id === trip.createdById ? "owner" : "suggestor");
                    const leftRank = ROLE_ORDER[normalizeRole(leftRole)] ?? 99;
                    const rightRank = ROLE_ORDER[normalizeRole(rightRole)] ?? 99;
                    if (leftRank !== rightRank) return leftRank - rightRank;
                    return String(left.name || "").localeCompare(String(right.name || ""));
                  })
                  .map((member) => {
                    const role = normalizeRole(memberRoles[member.id] || (member.id === trip.createdById ? "owner" : "suggestor"));
                    const isCreator = member.id === trip.createdById;
                    return (
                      <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-ink">{member.name || "Member"}</p>
                          <p className="text-xs text-slate-500">{member.email || "No email"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={role === "owner" ? "owner" : role}
                            onChange={(event) => handleMemberRoleUpdate(member, event.target.value)}
                            disabled={shareLoading || isCreator}
                            className="rounded-lg border border-slate-200 px-2 py-1 text-sm disabled:opacity-60"
                          >
                            <option value="suggestor">Suggestor</option>
                            <option value="editor">Editor</option>
                            {isCreator ? <option value="owner">Owner</option> : null}
                          </select>
                          {!isCreator ? (
                            <button
                              onClick={() => handleRevokeAccess(member)}
                              disabled={shareLoading}
                              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-coral hover:bg-mist disabled:opacity-60"
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <label className="mt-5 inline-flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={notifyInvitees}
                onChange={(event) => setNotifyInvitees(event.target.checked)}
                className="h-4 w-4"
              />
              Notify people
            </label>

            {shareStatus ? <p className="mt-3 text-sm text-slate-600">{shareStatus}</p> : null}

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={handleCopyInviteLink}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-ocean"
              >
                {copied ? "Link Copied!" : "Copy link"}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShareOpen(false)}
                  className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitShare}
                  disabled={shareLoading}
                  className="rounded-xl bg-ocean px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {shareLoading ? "Sending..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDialog ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => {
            if (actionLoading || shareLoading || leaveTripLoading) return;
            setConfirmDialog(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">{confirmDialog.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{confirmDialog.message}</p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDialog(null)}
                disabled={actionLoading || shareLoading || leaveTripLoading}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading || shareLoading || leaveTripLoading}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60 ${
                  confirmDialog.tone === "danger" ? "bg-coral hover:bg-red-600" : "bg-amber-500 hover:bg-amber-600"
                }`}
              >
                {actionLoading || shareLoading || leaveTripLoading ? "Working..." : confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editTripNameOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/35 px-4"
          onClick={() => {
            if (!tripNameSaving) setEditTripNameOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-card"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-ink">Edit trip name</h3>
            <input
              ref={tripNameInputRef}
              value={tripNameDraft}
              onChange={(event) => setTripNameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleSaveTripName();
                }
              }}
              className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Trip name"
            />
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                onClick={() => setEditTripNameOpen(false)}
                disabled={tripNameSaving}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTripName}
                disabled={tripNameSaving}
                className="rounded-xl bg-ocean px-3 py-1.5 text-sm font-semibold text-white hover:opacity-95 disabled:opacity-60"
              >
                {tripNameSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
