import { useState } from "react";

const initialState = {
  title: "",
  description: "",
  location: "",
  category: ""
};

export default function AddIdeaModal({ isOpen, onClose, onSubmit }) {
  const [form, setForm] = useState(initialState);

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit(form);
    setForm(initialState);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slateblue/50 p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Add an Idea</h3>
          <button type="button" onClick={onClose} className="text-sm text-slate-500">
            Close
          </button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <input
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Title"
            required
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Description"
            required
            rows={3}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <input
            name="location"
            value={form.location}
            onChange={handleChange}
            placeholder="Location"
            required
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <input
            name="category"
            value={form.category}
            onChange={handleChange}
            placeholder="Category (optional)"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm"
          />
          <button
            type="submit"
            className="rounded-2xl bg-ocean px-4 py-3 text-sm font-semibold text-white transition hover:bg-ocean/90"
          >
            Add idea
          </button>
        </form>
      </div>
    </div>
  );
}
