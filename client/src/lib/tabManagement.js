import { supabase } from "./supabase.js";

/**
 * Create default tabs for a new trip
 */
export async function createDefaultTripsTab(tripId, userId) {
  const tabs = [
    { name: "Availability", tabType: "availability", position: 0 },
    { name: "List", tabType: "list", position: 1 },
    { name: "Itinerary", tabType: "itinerary", position: 2 },
    { name: "Expenses", tabType: "expenses", position: 3 }
  ];

  const tabsToInsert = tabs.map((tab) => ({
    ...tab,
    id: crypto.randomUUID(),
    tripId,
    isCollapsible: true,
    createdAt: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from("TripTabConfiguration")
    .insert(tabsToInsert)
    .select();

  if (error) throw error;
  return data;
}

/**
 * Get all tabs for a trip ordered by position
 */
export async function getTripTabs(tripId) {
  const { data, error } = await supabase
    .from("TripTabConfiguration")
    .select("*")
    .eq("tripId", tripId)
    .order("position", { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Reorder tabs by updating positions
 */
export async function reorderTabs(tripId, tabIds) {
  const updates = tabIds.map((tabId, index) => ({
    id: tabId,
    position: index
  }));

  const promises = updates.map(({ id, position }) =>
    supabase
      .from("TripTabConfiguration")
      .update({ position })
      .eq("id", id)
  );

  const results = await Promise.all(promises);
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) throw errors[0].error;

  return results.map((r) => r.data).flat();
}

/**
 * Create a new custom tab
 */
export async function createTab(tripId, name, tabType) {
  const { data: existingTabs } = await getTripTabs(tripId);
  const nextPosition = (existingTabs || []).length;

  const { data, error } = await supabase
    .from("TripTabConfiguration")
    .insert([
      {
        id: crypto.randomUUID(),
        tripId,
        name,
        tabType,
        position: nextPosition,
        isCollapsible: true,
        createdAt: new Date().toISOString()
      }
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update tab (name, collapsibility)
 */
export async function updateTab(tabId, updates) {
  const { data, error } = await supabase
    .from("TripTabConfiguration")
    .update(updates)
    .eq("id", tabId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a tab
 */
export async function deleteTab(tabId) {
  const { error } = await supabase
    .from("TripTabConfiguration")
    .delete()
    .eq("id", tabId);

  if (error) throw error;
}

/**
 * Get user role for a specific trip
 */
export async function getUserTripRole(tripId, userId) {
  const { data, error } = await supabase
    .from("UserTripRole")
    .select("role")
    .eq("tripId", tripId)
    .eq("userId", userId)
    .maybeSingle();

  if (error) throw error;

  // If no explicit role found, check if user is trip creator
  if (!data) {
    const { data: trip } = await supabase
      .from("Trip")
      .select("createdById")
      .eq("id", tripId)
      .single();

    if (trip?.createdById === userId) {
      return "owner";
    }
    return null;
  }

  return data.role;
}

/**
 * Add or update user role for a trip
 */
export async function setUserTripRole(tripId, userId, role) {
  const { data, error } = await supabase
    .from("UserTripRole")
    .upsert(
      {
        id: `${tripId}-${userId}`,
        tripId,
        userId,
        role,
        createdAt: new Date().toISOString()
      },
      { onConflict: "tripId,userId" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get all users and their roles for a trip
 */
export async function getTripUserRoles(tripId) {
  const { data, error } = await supabase
    .from("UserTripRole")
    .select("userId, role")
    .eq("tripId", tripId);

  if (error) throw error;
  return data || [];
}

/**
 * Check if user is owner or has specific role
 */
export async function hasPermission(tripId, userId, requiredRole) {
  const role = await getUserTripRole(tripId, userId);
  
  if (requiredRole === "owner") {
    return role === "owner";
  }
  
  if (requiredRole === "suggestor") {
    return role === "owner" || role === "editor" || role === "suggestor";
  }

  if (requiredRole === "editor") {
    return role === "owner" || role === "editor";
  }

  return role === requiredRole;
}
