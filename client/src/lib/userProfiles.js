import { supabase } from "./supabase.js";
import { getAvatarColor } from "./avatarColors.js";

export function buildUserNamesById(users = []) {
  return (Array.isArray(users) ? users : []).reduce((acc, user) => {
    if (!user?.id) return acc;
    acc[user.id] = user.name || user.email || "Traveler";
    return acc;
  }, {});
}

export function buildUserAvatarColorsById(users = []) {
  return (Array.isArray(users) ? users : []).reduce((acc, user) => {
    if (!user?.id) return acc;
    acc[user.id] = user.avatarColor || getAvatarColor(user.id);
    return acc;
  }, {});
}

export async function fetchUserProfilesByIds(ids = []) {
  const uniqueIds = Array.from(
    new Set(
      (Array.isArray(ids) ? ids : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    )
  );

  if (!uniqueIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("User")
    .select("id, name, email, avatarColor")
    .in("id", uniqueIds);

  if (error) throw error;
  return data || [];
}
