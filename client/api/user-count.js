import { createClient } from "@supabase/supabase-js";

function getSupabaseAdminClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getSupabaseAdminClient();

    const { count, error } = await supabase
      .from("User")
      .select("id", { count: "exact", head: true });

    if (error) {
      throw error;
    }

    return res.status(200).json({ count: count || 0 });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch user count",
      details: error?.message || "unknown_error"
    });
  }
}
