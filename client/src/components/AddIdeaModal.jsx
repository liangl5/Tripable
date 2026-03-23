import { useEffect, useState } from "react";
import { DEFAULT_LIST_NAMES, normalizeListName, slugify } from "../lib/tripPlanning.js";

function defaultEntryType(listName) {
  return slugify(listName) === "activities" ? "activity" : "place";
}

function buildInitialState(defaultListName) {
  const listName = defaultListName || DEFAULT_LIST_NAMES[0];
  const entryType = defaultEntryType(listName);
  return {
    title: "",
    description: "",
    location: "",
    mapQuery: "",
    category: listName,
    entryType,
    recommendationSource: null
  };
}

export default function AddIdeaModal({
  isOpen,
  onClose,
  onSubmit,
  listNames = DEFAULT_LIST_NAMES,
  defaultListName,
  destination
}) {
  const [form, setForm] = useState(buildInitialState(defaultListName));

  useEffect(() => {
    if (!isOpen) return;
    setForm(buildInitialState(defaultListName));
  }, [defaultListName, isOpen]);

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => {
      if (name === "category") {
        return {
          ...prev,
          category: normalizeListName(value),
          entryType: defaultEntryType(value)
        };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleEntryTypeChange = (entryType) => {
    setForm((prev) => ({
      ...prev,
      entryType,
      mapQuery: entryType === "activity" ? "" : prev.mapQuery
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({
      ...form,
      category: normalizeListName(form.category),
      location: form.location.trim(),
      mapQuery: form.entryType === "place" ? (form.mapQuery.trim() || form.location.trim()) : ""
    });
    onClose();
  };

  const isPlace = form.entryType === "place";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateblue/50 p-4">
      <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-slate-500">Add to the plan</p>
            <h3 className="mt-1 text-2xl font-semibold text-ink">
              New {isPlace ? "place" : "activity"}
            </h3>
            {destination?.name ? (
              <p className="mt-2 text-sm text-slate-500">
                Planning for {destination.name}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={onClose} className="text-sm font-semibold text-slate-500">
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <div className="grid gap-4 md:grid-cols-[1fr,auto]">
            <div>
              <label className="text-sm font-semibold text-ink">List</label>
              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              >
                {listNames.map((listName) => (
                  <option key={listName} value={listName}>
                    {listName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-ink">Type</label>
              <div className="mt-2 flex rounded-full bg-mist p-1 text-xs font-semibold text-slate-500">
                <button
                  type="button"
                  onClick={() => handleEntryTypeChange("place")}
                  className={`rounded-full px-4 py-2 ${isPlace ? "bg-white text-ink shadow-soft" : ""}`}
                >
                  Place
                </button>
                <button
                  type="button"
                  onClick={() => handleEntryTypeChange("activity")}
                  className={`rounded-full px-4 py-2 ${!isPlace ? "bg-white text-ink shadow-soft" : ""}`}
                >
                  Activity
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-semibold text-ink">Name</label>
              <input
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder={isPlace ? "Ex: Diamond Head sunrise hike" : "Ex: Sunset boat ride"}
                required
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-ink">
                {isPlace ? "Address or venue" : "Location note"}
              </label>
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder={isPlace ? "Venue name or street address" : "Optional neighborhood or meeting point"}
                required={isPlace}
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </div>
          </div>

          {isPlace ? (
            <div>
              <label className="text-sm font-semibold text-ink">Google Maps search text</label>
              <input
                name="mapQuery"
                value={form.mapQuery}
                onChange={handleChange}
                placeholder="Optional if the address above is enough"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
              <p className="mt-2 text-xs text-slate-500">
                If this is a real place, we use this to focus the map on the right side of the dashboard.
              </p>
            </div>
          ) : null}

          <div>
            <label className="text-sm font-semibold text-ink">Why should the group vote for it?</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              placeholder="Add context, timing notes, pricing, or why it is worth the group's time."
              rows={4}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            />
          </div>

          <button
            type="submit"
            className="rounded-2xl bg-ocean px-4 py-3 text-sm font-semibold text-white transition hover:bg-ocean/90"
          >
            Add to {form.category}
          </button>
        </form>
      </div>
    </div>
  );
}
