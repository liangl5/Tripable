import { supabase } from "./supabase.js";

function normalizeDisplayName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 40);
}

function defaultDisplayNameFromSession(session) {
  const email = session?.user?.email;
  if (email && String(email).includes("@")) {
    return String(email).split("@")[0].slice(0, 40);
  }
  return "Traveler";
}

export function isDeletedUserProfile(profile) {
  const name = String(profile?.name || "").trim().toLowerCase();
  const email = String(profile?.email || "").trim().toLowerCase();
  return /^deleteduser\d+$/.test(name) || email.endsWith("@deleted.tripable.local");
}

export async function fetchUserProfile(session) {
  const userId = session?.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("User")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function touchUserActivity(userId) {
  const trimmedUserId = String(userId || "").trim();
  if (!trimmedUserId) return null;

  const { error } = await supabase
    .from("User")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", trimmedUserId);

  if (error) throw error;
  return true;
}

export async function ensureUserProfile(session, { name } = {}) {
  const userId = session?.user?.id;
  const email = session?.user?.email || null;
  if (!userId) return null;

  const existing = await fetchUserProfile(session);
  if (existing) {
    void touchUserActivity(userId).catch(() => {});
    return existing;
  }

  const nextName = normalizeDisplayName(name) || defaultDisplayNameFromSession(session);

  try {
    const { data, error } = await supabase
      .from("User")
      .insert([
        {
          id: userId,
          name: nextName,
          email
        }
      ])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    if (error?.code === "23505") {
      void touchUserActivity(userId).catch(() => {});
      return fetchUserProfile(session);
    }
    throw error;
  }
}

export async function updateUserProfileName(session, name) {
  const userId = session?.user?.id;
  if (!userId) return null;

  const nextName = normalizeDisplayName(name);
  if (!nextName) {
    throw new Error("Name cannot be empty.");
  }

  const { data, error } = await supabase
    .from("User")
    .update({ name: nextName })
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function getDisplayName(profile, session) {
  const fromProfile = normalizeDisplayName(profile?.name);
  if (fromProfile) return fromProfile;
  return defaultDisplayNameFromSession(session);
}

