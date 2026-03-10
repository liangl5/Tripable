import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTripStore } from "../hooks/useTripStore.js";

export default function CreateTripPage() {
  const navigate = useNavigate();
  const { createTrip, loading, error } = useTripStore();
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: ""
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trip = await createTrip(form);
    navigate(`/trips/${trip.id}`);
  };

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <Link to="/trips" className="text-sm text-slate-500">
        ← Back to trips
      </Link>
      <div className="mt-6 rounded-3xl bg-white/95 p-8 shadow-card">
        <h1 className="text-2xl font-semibold text-ink">Create a trip</h1>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Trip name"
            required
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="date"
              name="startDate"
              value={form.startDate}
              onChange={handleChange}
              required
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
            <input
              type="date"
              name="endDate"
              value={form.endDate}
              onChange={handleChange}
              required
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-2xl bg-ocean px-4 py-3 text-sm font-semibold text-white"
          >
            {loading ? "Creating..." : "Create trip"}
          </button>
          {error ? <p className="text-sm text-coral">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
