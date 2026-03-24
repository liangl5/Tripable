import { useState } from "react";
import { useSession, useUserProfile } from "../App";
import { updateUserProfileName } from "../lib/userProfile.js";

export default function UserIdentity({ editable = false }) {
  const session = useSession();
  const { profile, profileLoading, refreshProfile } = useUserProfile();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [saving, setSaving] = useState(false);

  const displayName = String(profile?.name || "").trim();
  const inputValue = isEditing ? draftName : displayName;

  const handleSave = () => {
    if (!session) return;
    const next = draftName.trim();
    if (!next) return;

    setSaving(true);
    updateUserProfileName(session, next)
      .then(() => refreshProfile(session))
      .finally(() => {
        setSaving(false);
        setIsEditing(false);
      });
  };

  const handleEdit = () => {
    setDraftName(displayName);
    setIsEditing(true);
  };

  return (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      {editable ? (
        <>
          <input
            value={inputValue}
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="e.g. Maya"
            disabled={!isEditing || profileLoading || saving}
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-2 text-sm disabled:opacity-80 sm:w-64"
          />
          {isEditing ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={!draftName.trim() || saving}
              className="rounded-full bg-ocean px-4 py-2 text-xs font-semibold text-white disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save"}
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
        </>
      ) : (
        <div className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold text-ink shadow-card">
          {displayName ? displayName : "Set your name on Home"}
        </div>
      )}
    </div>
  );
}
