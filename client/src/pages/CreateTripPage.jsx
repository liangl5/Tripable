import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { parseInvitees } from "../lib/tripPlanning.js";
import { createDefaultTripsTab } from "../lib/tabManagement.js";
import { supabase } from "../lib/supabase.js";

function addInvitee(invitees, invitee, role = "suggestor") {
  const normalized = String(invitee || "").trim().toLowerCase();
  if (!normalized) return invitees;
  const exists = invitees.some((entry) => entry.email === normalized);
  if (exists) return invitees;
  const normalizedRole = role === "editor" ? "editor" : "suggestor";
  return [...invitees, { email: normalized, role: normalizedRole }];
}

export default function CreateTripPage() {
  const navigate = useNavigate();
  const session = useSession();
  const createTrip = useTripStore((state) => state.createTrip);
  const sendTripInvites = useTripStore((state) => state.sendTripInvites);
  const createTripLoading = useTripStore((state) => state.createTripLoading);
  const inviteSendLoading = useTripStore((state) => state.inviteSendLoading);
  const error = useTripStore((state) => state.error);
  const [form, setForm] = useState({
    name: ""
  });
  const [inviteDraft, setInviteDraft] = useState("");
  const [invitees, setInvitees] = useState([]);
  const [formError, setFormError] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");

  useEffect(() => {
    if (!session) {
      navigate("/auth");
    }
  }, [session, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const commitInviteDraft = () => {
    const parsedInvitees = parseInvitees(inviteDraft);
    if (!parsedInvitees.length) return;
    setInvitees((prev) => {
      let next = [...prev];
      parsedInvitees.forEach((invitee) => {
        next = addInvitee(next, invitee, "suggestor");
      });
      return next;
    });
    setInviteDraft("");
  };

  const removeInvitee = (emailToRemove) => {
    setInvitees((prev) => prev.filter((invitee) => invitee.email !== emailToRemove));
  };

  const handleInviteeRoleChange = (email, role) => {
    setInvitees((prev) =>
      prev.map((invitee) =>
        invitee.email === email
          ? { ...invitee, role: role === "editor" ? "editor" : "suggestor" }
          : invitee
      )
    );
  };

  const handleInviteKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitInviteDraft();
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");
    setInviteStatus("");
    const pendingInvitees = parseInvitees(inviteDraft);
    const nextInvitees = pendingInvitees.reduce(
      (allInvitees, invitee) => addInvitee(allInvitees, invitee, "suggestor"),
      invitees
    );
    const inviteeEmails = nextInvitees.map((invitee) => invitee.email);

    const tripName = form.name.trim();
    if (!tripName) {
      setFormError("Give your trip a title before creating it.");
      return;
    }

    const payload = {
      name: tripName,
      invitees: inviteeEmails
    };

    try {
      const trip = await createTrip(payload);

      // Create default tabs for the new trip
      if (session?.user?.id) {
        await createDefaultTripsTab(trip.id, session.user.id);
      }

      if (nextInvitees.length > 0) {
        try {
          const pendingInvites = nextInvitees.map((invitee) => ({
            id: crypto.randomUUID(),
            tripId: trip.id,
            email: invitee.email,
            role: invitee.role === "editor" ? "editor" : "suggestor",
            status: "pending",
            createdById: session?.user?.id || null
          }));

          const { error: pendingInviteError } = await supabase
            .from("PendingTripInvite")
            .insert(pendingInvites);

          if (pendingInviteError && !String(pendingInviteError.message || "").includes("PendingTripInvite")) {
            throw pendingInviteError;
          }
        } catch (pendingInviteError) {
          setInviteStatus("Trip created, but role-based invites could not be saved. You can resend from the trip page.");
          console.error("Pending invite save failed", pendingInviteError);
        }

        try {
          const inviteResult = await sendTripInvites({
            tripId: trip.id,
            tripName: trip.name || tripName,
            invitees: nextInvitees,
            inviteUrl: `${window.location.origin}/trips/${trip.id}/invite`
          });

          if (inviteResult.failed > 0) {
            setInviteStatus(`Trip created. ${inviteResult.sent} invite(s) sent, ${inviteResult.failed} failed. You can retry from the trip page.`);
          } else {
            setInviteStatus(`Trip created and ${inviteResult.sent} invite(s) sent.`);
          }
        } catch (inviteError) {
          setInviteStatus("Trip created, but invite emails could not be sent right now. You can retry from the trip page.");
          console.error("Invite email send failed", inviteError);
        }
      }

      navigate(`/trips/${trip.id}`);
    } catch (submitError) {
      setFormError(submitError.message || "We could not create the trip. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />
      <div className="mx-auto max-w-5xl px-6 py-12">
      <section className="grid justify-items-center gap-6">
        <div className="w-full max-w-2xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mist text-base text-ocean">
              ←
            </span>
            Back to trips
          </Link>
        </div>
        <div className="w-full max-w-2xl rounded-[32px] bg-white/95 p-8 shadow-card">
          <h1 className="mt-2 text-3xl font-semibold text-ink">Start a collaborative trip plan</h1>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-5">
            <div>
              <label className="text-sm font-semibold text-ink">Trip title</label>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Ex: Spring break with roommates"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-ink">Invite by email (optional)</label>
              <input
                value={inviteDraft}
                onChange={(event) => setInviteDraft(event.target.value)}
                onKeyDown={handleInviteKeyDown}
                onBlur={commitInviteDraft}
                placeholder="Add emails, press Enter or comma"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
              {invitees.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {invitees.map((invitee) => (
                    <div
                      key={invitee.email}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-mist px-3 py-2"
                    >
                      <span className="min-w-0 truncate text-xs font-medium text-ocean">{invitee.email}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={invitee.role}
                          onChange={(event) => handleInviteeRoleChange(invitee.email, event.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs"
                        >
                          <option value="suggestor">Suggestor</option>
                          <option value="editor">Editor</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeInvitee(invitee.email)}
                          className="rounded-full bg-white/80 px-2 leading-none text-slate-600 hover:bg-white"
                          aria-label={`Remove ${invitee.email}`}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="mt-2 text-xs text-slate-500">
                Invite one or more people by email. Separate emails with commas or press Enter after each one. New invitees default to Suggestor, and you can promote specific invites to Editor.
              </p>
            </div>

            <button
              type="submit"
              disabled={createTripLoading || inviteSendLoading}
              className="rounded-2xl bg-ocean px-4 py-3 text-sm font-semibold text-white"
            >
              {createTripLoading || inviteSendLoading ? "Creating..." : "Create trip workspace"}
            </button>
            {formError ? <p className="text-sm text-coral">{formError}</p> : null}
            {inviteStatus ? <p className="text-sm text-slate-600">{inviteStatus}</p> : null}
            {error ? <p className="text-sm text-coral">{error}</p> : null}
          </form>
        </div>

      </section>
      </div>
    </div>
  );
}
