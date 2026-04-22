import { createClient } from "@supabase/supabase-js";

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

function getBody(req) {
  if (!req.body || typeof req.body !== "string") {
    return req.body || {};
  }

  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

async function assertNoError(result, fallbackMessage) {
  if (result?.error) {
    throw new Error(result.error.message || fallbackMessage);
  }
  return result?.data || [];
}

function buildDeletedUserName() {
  return `deleteduser${Math.floor(100000 + Math.random() * 900000)}`;
}

function isMissingAvatarColorColumn(error) {
  const message = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return message.includes("avatarcolor") && /(column|schema cache|not found|pgrst204)/i.test(message);
}

async function updateDeletedUserProfile(supabase, userId, profilePatch) {
  const result = await supabase
    .from("User")
    .update(profilePatch)
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (!result.error) {
    return result.data;
  }

  if (!Object.prototype.hasOwnProperty.call(profilePatch, "avatarColor") || !isMissingAvatarColorColumn(result.error)) {
    throw new Error(result.error.message || "Unable to anonymize account profile.");
  }

  const { avatarColor: _avatarColor, ...fallbackPatch } = profilePatch;
  const fallbackResult = await supabase
    .from("User")
    .update(fallbackPatch)
    .eq("id", userId)
    .select("id")
    .maybeSingle();

  if (fallbackResult.error) {
    throw new Error(fallbackResult.error.message || "Unable to anonymize account profile.");
  }

  return fallbackResult.data;
}

async function insertDeletedUserProfile(supabase, userId, profilePatch) {
  const result = await supabase
    .from("User")
    .insert([{ id: userId, ...profilePatch }]);

  if (!result.error) return;

  if (!Object.prototype.hasOwnProperty.call(profilePatch, "avatarColor") || !isMissingAvatarColorColumn(result.error)) {
    throw new Error(result.error.message || "Unable to create anonymized account profile.");
  }

  const { avatarColor: _avatarColor, ...fallbackPatch } = profilePatch;
  const fallbackResult = await supabase
    .from("User")
    .insert([{ id: userId, ...fallbackPatch }]);

  if (fallbackResult.error) {
    throw new Error(fallbackResult.error.message || "Unable to create anonymized account profile.");
  }
}

async function deleteOwnedTripsAndAnonymizeProfile(supabase, userId) {
  const deletedUserName = buildDeletedUserName();

  await assertNoError(
    await supabase.from("Trip").delete().eq("createdById", userId),
    "Unable to delete owned trips."
  );

  const profilePatch = {
    name: deletedUserName,
    email: `${deletedUserName}@deleted.tripable.local`,
    avatarColor: "bg-slate-200 text-slate-700"
  };

  const updatedProfile = await updateDeletedUserProfile(supabase, userId, profilePatch);
  if (!updatedProfile?.id) {
    await insertDeletedUserProfile(supabase, userId, profilePatch);
  }

  return deletedUserName;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const accessToken = getBearerToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: "Missing session token." });
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.getUser(accessToken);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Please sign in again before deleting your account." });
    }

    const body = getBody(req);
    const requestedEmail = normalizeEmail(body.email);
    const accountEmail = normalizeEmail(data.user.email);
    if (!requestedEmail || requestedEmail !== accountEmail) {
      return res.status(400).json({ error: "Account confirmation did not match the signed-in user." });
    }

    if (body.userId && body.userId !== data.user.id) {
      return res.status(400).json({ error: "Account confirmation did not match the signed-in user." });
    }

    const deletedUserName = await deleteOwnedTripsAndAnonymizeProfile(supabase, data.user.id);

    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(data.user.id);
    if (deleteUserError) {
      throw new Error(deleteUserError.message || "Unable to delete auth account.");
    }

    return res.status(200).json({ ok: true, deletedUserName });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to delete your account right now.",
      details: error?.message || "unknown_error"
    });
  }
}
