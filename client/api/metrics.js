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

async function countRows(queryBuilder) {
  const { count, error } = await queryBuilder;
  if (error) throw error;
  return count || 0;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabase = getSupabaseAdminClient();
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

    const [activeUsers, pageViews] = await Promise.all([
      countRows(
        supabase
          .from("User")
          .select("id", { count: "exact", head: true })
          .gte("updated_at", tenDaysAgo)
      ),
      countRows(
        supabase
          .from("AnalyticsEvent")
          .select("id", { count: "exact", head: true })
          .eq("event_name", "page_view")
      )
    ]);

    return res.status(200).json({
      signups: 0,
      active_users: activeUsers,
      waitlist: 0,
      page_views: pageViews
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch metrics",
      details: error?.message || "unknown_error"
    });
  }
}