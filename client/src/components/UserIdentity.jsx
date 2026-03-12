import { useMemo, useState } from "react";
import { getCurrentUserId } from "../lib/api.js";

function getUserIdSnippet() {
  const id = getCurrentUserId();
  if (!id) return "";
  return `${id.slice(0, 4)}...${id.slice(-4)}`;
}

export default function UserIdentity({ editable = false }) {
  const [savedName, setSavedName] = useState(() => localStorage.getItem("tripute_user_name") || "");
  const [isEditing, setIsEditing] = useState(editable && !savedName);
  const [draftName, setDraftName] = useState(savedName);

  const snippet = useMemo(() => getUserIdSnippet(), []);

  const handleSave = () => {
    const next = draftName.trim();
    localStorage.setItem("tripute_user_name", next);
    setSavedName(next);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setDraftName(savedName);
    setIsEditing(true);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm shadow-card backdrop-blur">
      <div>
        <p className="text-xs font-semibold text-slate-500">Your name (for ideas + votes)</p>
        <p className="text-xs text-slate-400">This browser is a unique voter {snippet ? `· ${snippet}` : ""}</p>
      </div>
      {editable ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <input
            value={isEditing ? draftName : savedName}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="e.g. Maya"
            disabled={!isEditing}
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm disabled:opacity-80 sm:w-56"
          />
          {isEditing ? (
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-ocean px-4 py-2 text-xs font-semibold text-white"
            >
              Save
            </button>
          ) : (
            <button
              type="button"
              onClick={handleEdit}
              className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-ink shadow-card"
            >
              Edit
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-ink shadow-card">
          {savedName ? savedName : "Set your name on Home"}
        </div>
      )}
    </div>
  );
}
