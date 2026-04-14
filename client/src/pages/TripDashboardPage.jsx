import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import TabManager from "../components/TabManager.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { supabase } from "../lib/supabase.js";
import { parseInvitees } from "../lib/tripPlanning.js";
import ShareTripModal from "../components/ShareTripModal.jsx";
import { trackEvent } from "../lib/analytics.js";

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
  const ideas = useTripStore((state) => state.ideas);
  const loadIdeas = useTripStore((state) => state.loadIdeas);
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
    if (!currentUserId) {
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

        // Load ideas into shared trip store so tabs stay reactive after add/delete.
        await loadIdeas(tripId);
        void trackEvent("trip_dashboard_loaded", {
          trip_id: tripId,
          ideas_count: useTripStore.getState().ideas.length || 0
        });
        await loadPendingInvites();
      } catch (error) {
        console.error("Failed to load trip:", error);
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    loadTripData();
  }, [tripId, navigate, currentUserId, loadIdeas]);

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
    void trackEvent("trip_invite_link_copied", {
      trip_id: tripId
    });
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
      void trackEvent("trip_name_updated", {
        trip_id: trip.id
      });
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
      void trackEvent("trip_pending_invite_canceled", {
        trip_id: tripId,
        invite_id: inviteId
      });
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
      void trackEvent("trip_member_role_updated", {
        trip_id: tripId,
        member_id: member.id,
        role: targetRole
      });
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
      void trackEvent("trip_member_removed", {
        trip_id: tripId,
        member_id: member.id
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

      void trackEvent("trip_share_submitted", {
        trip_id: tripId,
        pending_created: pendingCreated,
        notifications_enabled: notifyInvitees
      });
      setShareStatus(`Created ${pendingCreated} pending invite(s).${mailSummary}`);
    } catch (error) {
      void trackEvent("trip_share_failed", {
        trip_id: tripId,
        reason: error?.message || "unknown"
      });
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
      void trackEvent("trip_deleted_dashboard", { trip_id: tripId });
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
      void trackEvent("trip_left_dashboard", { trip_id: tripId });
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
      <div className="min-h-screen bg-slate-50">
        <Header />
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
            <div className="inline-flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-ocean/15 hover:text-ocean"
                aria-label="Back to trips"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5" />
                  <path d="M11 6l-6 6 6 6" />
                </svg>
              </Link>
              <div className="group inline-flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (canEditTripName) {
                      setEditTripNameOpen(true);
                    }
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-left ${
                    canEditTripName ? "cursor-pointer hover:bg-ocean/10" : ""
                  }`}
                >
                  <h1 className="text-2xl font-semibold text-ink">{trip.name}</h1>
                  {canEditTripName ? (
                    <span className="px-1.5 py-0.5 text-slate-400 opacity-0 transition group-hover:opacity-100">
                      ✎
                    </span>
                  ) : null}
                </button>
              </div>
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
                onClick={() => {
                  setShareOpen(true);
                  void trackEvent("trip_share_opened", { trip_id: tripId });
                }}
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

      <ShareTripModal
        open={shareOpen && userRole === "owner"}
        trip={trip}
        onClose={() => setShareOpen(false)}
      />

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
