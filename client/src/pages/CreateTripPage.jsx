import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DestinationAutocomplete from "../components/DestinationAutocomplete.jsx";
import TripableLogoLink from "../components/TripableLogoLink.jsx";
import { useTripStore } from "../hooks/useTripStore.js";
import { useSession } from "../App";
import { parseInvitees, saveTripMeta } from "../lib/tripPlanning.js";

function addInvitee(invitees, invitee) {
  const normalized = String(invitee || "").trim().toLowerCase();
  if (!normalized || invitees.includes(normalized)) return invitees;
  return [...invitees, normalized];
}

function getDestinationDisplayValue(destination) {
  return String(destination?.mapQuery || destination?.summary || destination?.label || destination?.name || "").trim();
}

export default function CreateTripPage() {
  const navigate = useNavigate();
  const session = useSession();
  const createTrip = useTripStore((state) => state.createTrip);
  const updateTripDates = useTripStore((state) => state.updateTripDates);
  const createTripLoading = useTripStore((state) => state.createTripLoading);
  const error = useTripStore((state) => state.error);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: ""
  });
  const [destinationQuery, setDestinationQuery] = useState("");
  const [selectedDestination, setSelectedDestination] = useState(null);
  const [selectedDestinationDisplay, setSelectedDestinationDisplay] = useState("");
  const [inviteDraft, setInviteDraft] = useState("");
  const [invitees, setInvitees] = useState([]);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!session) {
      navigate("/auth");
    }
  }, [session, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectDestination = (destination, displayValue) => {
    const nextDisplayValue = String(displayValue || getDestinationDisplayValue(destination)).trim();
    setSelectedDestination(destination);
    setSelectedDestinationDisplay(nextDisplayValue);
    setDestinationQuery(nextDisplayValue);
  };

  const handleDestinationQueryChange = (value) => {
    setDestinationQuery(value);
    if (selectedDestination && value !== selectedDestinationDisplay) {
      setSelectedDestination(null);
      setSelectedDestinationDisplay("");
    }
  };

  const commitInviteDraft = () => {
    const parsedInvitees = parseInvitees(inviteDraft);
    if (!parsedInvitees.length) return;
    setInvitees((prev) => {
      let next = [...prev];
      parsedInvitees.forEach((invitee) => {
        next = addInvitee(next, invitee);
      });
      return next;
    });
    setInviteDraft("");
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
    const pendingInvitees = parseInvitees(inviteDraft);
    const nextInvitees = pendingInvitees.reduce((allInvitees, invitee) => addInvitee(allInvitees, invitee), invitees);

    const tripName = form.name.trim();
    const destination = selectedDestination;
    if (!tripName) {
      setFormError("Give your trip a title before creating it.");
      return;
    }

    if ((form.startDate && !form.endDate) || (!form.startDate && form.endDate)) {
      setFormError("Add both dates for the trip window, or leave both blank for now.");
      return;
    }

    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setFormError("The end date needs to be on or after the start date.");
      return;
    }

    const payload = {
      name: tripName,
      destination: destination || null
    };

    try {
      const trip = await createTrip(payload);
      saveTripMeta(trip.id, {
        destination,
        invitees: nextInvitees
      });

      if (form.startDate && form.endDate) {
        await updateTripDates(trip.id, {
          startDate: form.startDate,
          endDate: form.endDate
        });
      }

      navigate(`/trips/${trip.id}`);
    } catch (submitError) {
      setFormError(submitError.message || "We could not create the trip. Please try again.");
    }
  };

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <TripableLogoLink compact />
        <Link
          to="/trips"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-mist text-base text-ocean">
            ←
          </span>
          Back to trips
        </Link>
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="rounded-[32px] bg-white/95 p-8 shadow-card">
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
              <DestinationAutocomplete
                value={destinationQuery}
                selectedDestination={selectedDestination}
                onChange={handleDestinationQueryChange}
                onSelect={handleSelectDestination}
                label="Destination (optional)"
              />
              <p className="mt-2 text-xs text-slate-500">
                Skip this if the group is still deciding. You can vote on destination ideas inside the trip.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-ink">Start date (optional)</label>
                <input
                  type="date"
                  name="startDate"
                  value={form.startDate}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-ink">End date (optional)</label>
                <input
                  type="date"
                  name="endDate"
                  value={form.endDate}
                  onChange={handleChange}
                  className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={createTripLoading}
              className="rounded-2xl bg-ocean px-4 py-3 text-sm font-semibold text-white"
            >
              {createTripLoading ? "Creating..." : "Create trip workspace"}
            </button>
            {formError ? <p className="text-sm text-coral">{formError}</p> : null}
            {error ? <p className="text-sm text-coral">{error}</p> : null}
          </form>
        </div>

        <aside className="rounded-[32px] bg-[#F8FAFF] p-8 shadow-card">
          <p className="text-sm font-semibold text-slate-500">What happens next</p>
          <div className="mt-5 grid gap-4">
            <div className="rounded-2xl bg-white px-5 py-4 shadow-soft">
              <p className="text-sm font-semibold text-ink">1. Plan with lists</p>
              <p className="mt-2 text-sm text-slate-500">
                Start with Places to Visit, Activities, and Food, then add custom lists whenever the trip needs them.
              </p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 shadow-soft">
              <p className="text-sm font-semibold text-ink">2. Vote as a group</p>
              <p className="mt-2 text-sm text-slate-500">
                Everyone can vote on destinations, activities, and food picks before anything lands on the itinerary.
              </p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 shadow-soft">
              <p className="text-sm font-semibold text-ink">3. Build the itinerary</p>
              <p className="mt-2 text-sm text-slate-500">
                Once the date range is set, Tripable can turn the top-voted plans into a day-by-day schedule.
              </p>
            </div>
            <div className="rounded-2xl bg-white px-5 py-4 shadow-soft">
              <p className="text-sm font-semibold text-ink">4. Track budget</p>
              <p className="mt-2 text-sm text-slate-500">
                Keep a group budget visible from the dashboard so spending stays aligned with the plan.
              </p>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
