import { supabase } from "./supabase.js";

export async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

function normalizeName(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 40);
}

function toISODate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

async function getOrCreateUser() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    console.error('No active session');
    return null;
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  // Try to get existing user
  const { data: existing } = await supabase
    .from("User")
    .select("*")
    .eq("id", userId);

  if (existing && existing.length > 0) {
    return existing[0];
  }

  // Create new user from auth session
  const userName = userEmail.split('@')[0];
  try {
    const { data, error } = await supabase
      .from("User")
      .insert([{
        id: userId,
        name: normalizeName(userName) || userName,
        email: userEmail
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    // Handle race condition where user was created by another request
    if (error?.code === '23505') {
      const { data: retry } = await supabase
        .from("User")
        .select("*")
        .eq("id", userId)
        .limit(1);
      return retry?.[0] || null;
    }
    throw error;
  }
}

function getMemberCount(tripId, members) {
  return members?.length || 0;
}

function formatTrip(trip, memberCount = 0) {
  return {
    id: trip.id,
    name: trip.name,
    startDate: toISODate(trip.startDate),
    endDate: toISODate(trip.endDate),
    memberCount,
    createdById: trip.createdById
  };
}

async function formatTripDetails(trip, viewerUserId, members, leaders, availability, surveyDates) {
  return {
    id: trip.id,
    name: trip.name,
    startDate: toISODate(trip.startDate),
    endDate: toISODate(trip.endDate),
    memberCount: members?.length || 0,
    createdById: trip.createdById,
    isViewerCreator: trip.createdById === viewerUserId,
    isViewerLeader: leaders?.includes(viewerUserId),
    ownerId: trip.createdById,
    leaders: leaders || [trip.createdById],
    members: members || [],
    surveyDates: surveyDates || [],
    availability: availability || {}
  };
}

function formatIdea(idea, userId, votes = []) {
  const voteScore = votes.reduce((sum, vote) => sum + vote.value, 0);
  const userVote = votes.find((vote) => vote.userId === userId)?.value || 0;
  const isCreator = idea.createdById === userId;

  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    location: idea.location,
    category: idea.category,
    createdAt: idea.createdAt,
    createdById: idea.createdById,
    submittedBy: idea.User?.name || "Traveler",
    voteScore,
    voteCount: votes.length,
    userVote,
    isCreator
  };
}

export const api = {
  async getTrips() {
    const user = await getOrCreateUser();
    const userId = user.id;

    // Get trips created by user
    const { data: createdTripsData } = await supabase
      .from("Trip")
      .select("*")
      .eq("createdById", userId)
      .order("createdAt", { ascending: false });

    // Get trips user is a member of
    const { data: memberTripsData } = await supabase
      .from("TripMember")
      .select("trip:tripId(*)")
      .eq("userId", userId);

    const createdTrips = createdTripsData ?? [];
    const memberTrips = memberTripsData ?? [];

    // Combine and deduplicate
    const tripMap = new Map();
    createdTrips.forEach(trip => tripMap.set(trip.id, trip));
    memberTrips.forEach(member => {
      if (member.trip) tripMap.set(member.trip.id, member.trip);
    });

    // Get member counts
    const trips = Array.from(tripMap.values())
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const tripsWithCounts = await Promise.all(
      trips.map(async (trip) => {
        const { count } = await supabase
          .from("TripMember")
          .select("*", { count: "exact", head: true })
          .eq("tripId", trip.id);
        return formatTrip(trip, count || 0);
      })
    );

    return tripsWithCounts;
  },

  async getTrip(tripId) {
    const user = await getOrCreateUser();
    const userId = user.id;

    // Get trip
    const { data: trip, error: tripError } = await supabase
      .from("Trip")
      .select("*")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");

    // Get members
    const { data: memberRows } = await supabase
      .from("TripMember")
      .select("userId, User(*)")
      .eq("tripId", tripId);

    const members = memberRows?.map(row => ({
      id: row.userId,
      name: row.User?.name || "Member",
      isViewer: row.userId === userId,
      isLeader: row.userId === trip.createdById
    })) || [];

    // Get availability
    const { data: availabilityRows } = await supabase
      .from("UserAvailability")
      .select("userId, date")
      .eq("tripId", tripId);

    const availability = {};
    availabilityRows?.forEach(row => {
      if (!availability[row.userId]) availability[row.userId] = [];
      availability[row.userId].push(toISODate(row.date));
    });

    // Get survey dates
    const { data: surveyRows } = await supabase
      .from("SurveyDate")
      .select("date")
      .eq("tripId", tripId);

    const surveyDates = surveyRows?.map(row => toISODate(row.date)).sort() || [];

    const leaders = [trip.createdById];

    return formatTripDetails(trip, userId, members, leaders, availability, surveyDates);
  },

  async createTrip(payload) {
    const user = await getOrCreateUser();
    const tripId = crypto.randomUUID();

    // Create trip
    const { data: trip, error: tripError } = await supabase
      .from("Trip")
      .insert([{
        id: tripId,
        name: payload.name,
        createdById: user.id,
        startDate: null,
        endDate: null
      }])
      .select()
      .single();

    if (tripError) throw tripError;

    // Add creator as member
    const { error: memberError } = await supabase
      .from("TripMember")
      .insert([{
        id: crypto.randomUUID(),
        tripId,
        userId: user.id
      }]);

    if (memberError) throw memberError;

    return formatTrip(trip, 1);
  },

  async deleteTrip(tripId) {
    const user = await getOrCreateUser();

    const { data: trip } = await supabase
      .from("Trip")
      .select("createdById")
      .eq("id", tripId)
      .single();

    if (trip.createdById !== user.id) {
      throw new Error("Only the trip owner can delete this trip");
    }

    // Delete all related data
    await supabase.from("Vote").delete().eq("idea(tripId)", tripId);
    await supabase.from("Idea").delete().eq("tripId", tripId);
    await supabase.from("UserAvailability").delete().eq("tripId", tripId);
    await supabase.from("SurveyDate").delete().eq("tripId", tripId);
    await supabase.from("ItineraryItem").delete().eq("itineraryDay(tripId)", tripId);
    await supabase.from("ItineraryDay").delete().eq("tripId", tripId);
    await supabase.from("TripMember").delete().eq("tripId", tripId);

    const { error } = await supabase
      .from("Trip")
      .delete()
      .eq("id", tripId);

    if (error) throw error;
  },

  async updateTripDates(tripId, payload) {
    const user = await getOrCreateUser();

    const { data: trip } = await supabase
      .from("Trip")
      .select("createdById")
      .eq("id", tripId)
      .single();

    if (trip.createdById !== user.id) {
      throw new Error("Only the trip owner can update the trip dates");
    }

    const { data: updated, error } = await supabase
      .from("Trip")
      .update({
        startDate: new Date(payload.startDate).toISOString(),
        endDate: new Date(payload.endDate).toISOString()
      })
      .eq("id", tripId)
      .select()
      .single();

    if (error) throw error;

    // Invalidate itinerary
    await supabase.from("ItineraryDay").delete().eq("tripId", tripId);

    return formatTrip(updated, 0);
  },

  async updateTripSurveyDates(tripId, payload) {
    const user = await getOrCreateUser();

    const { data: trip } = await supabase
      .from("Trip")
      .select("createdById")
      .eq("id", tripId)
      .single();

    if (trip.createdById !== user.id) {
      throw new Error("Only the trip owner can edit selectable dates");
    }

    // Delete existing survey dates
    await supabase.from("SurveyDate").delete().eq("tripId", tripId);

    // Insert new survey dates
    if (payload.dates.length > 0) {
      const records = payload.dates.map(date => ({
        id: crypto.randomUUID(),
        tripId,
        date: new Date(date).toISOString()
      }));

      const { error } = await supabase
        .from("SurveyDate")
        .insert(records);

      if (error) throw error;
    }

    // Update trip dates
    const sortedDates = [...payload.dates].sort();
    await supabase
      .from("Trip")
      .update({
        startDate: sortedDates[0] ? new Date(sortedDates[0]).toISOString() : null,
        endDate: sortedDates[sortedDates.length - 1] ? new Date(sortedDates[sortedDates.length - 1]).toISOString() : null
      })
      .eq("id", tripId);

    return this.getTrip(tripId);
  },

  async updateTripAvailability(tripId, payload) {
    const user = await getOrCreateUser();

    // Delete existing availability
    await supabase
      .from("UserAvailability")
      .delete()
      .eq("tripId", tripId)
      .eq("userId", user.id);

    // Insert new availability
    if (payload.dates.length > 0) {
      const records = payload.dates.map(date => ({
        id: crypto.randomUUID(),
        tripId,
        userId: user.id,
        date: new Date(date).toISOString()
      }));

      const { error } = await supabase
        .from("UserAvailability")
        .insert(records);

      if (error) throw error;
    }

    return this.getTrip(tripId);
  },

  async joinTrip(tripId) {
    const user = await getOrCreateUser();

    // Check trip exists
    const { data: trip, error: tripError } = await supabase
      .from("Trip")
      .select("id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");

    // Check if already member
    const { data: existing } = await supabase
      .from("TripMember")
      .select("id")
      .eq("tripId", tripId)
      .eq("userId", user.id)
      .single();

    if (existing) return; // Already a member

    // Add as member
    const { error } = await supabase
      .from("TripMember")
      .insert([{
        id: crypto.randomUUID(),
        tripId,
        userId: user.id
      }]);

    if (error) throw error;
  },

  async getIdeas(tripId) {
    const user = await getOrCreateUser();

    const { data: ideas, error } = await supabase
      .from("Idea")
      .select("*, votes:Vote(*), User(*)")
      .eq("tripId", tripId)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    return ideas?.map(idea => formatIdea(idea, user.id, idea.votes)) || [];
  },

  async createIdea(tripId, payload) {
    const user = await getOrCreateUser();
    const ideaId = crypto.randomUUID();

    const { data: idea, error } = await supabase
      .from("Idea")
      .insert([{
        id: ideaId,
        tripId,
        createdById: user.id,
        title: payload.title,
        description: payload.description,
        location: payload.location,
        category: payload.category || null
      }])
      .select("*, User(*)")
      .single();

    if (error) throw error;

    // Invalidate itinerary
    await supabase.from("ItineraryDay").delete().eq("tripId", tripId);

    return formatIdea(idea, user.id, []);
  },

  async deleteIdea(ideaId, tripId) {
    const user = await getOrCreateUser();

    // Get idea to check permissions
    const { data: idea, error: fetchError } = await supabase
      .from("Idea")
      .select("createdById, tripId")
      .eq("id", ideaId)
      .single();

    if (fetchError || !idea) throw new Error("Idea not found");

    // Check if user is trip owner or idea creator
    const { data: trip } = await supabase
      .from("Trip")
      .select("createdById")
      .eq("id", tripId)
      .single();

    const isOwner = trip?.createdById === user.id;
    const isCreator = idea.createdById === user.id;

    if (!isOwner && !isCreator) {
      throw new Error("Only the trip owner or activity creator can delete this activity");
    }

    // Delete votes first
    const { error: voteError } = await supabase.from("Vote").delete().eq("ideaId", ideaId);
    if (voteError) throw voteError;

    // Delete itinerary items
    const { error: itemError } = await supabase
      .from("ItineraryItem")
      .delete()
      .eq("ideaId", ideaId);
    if (itemError) throw itemError;

    // Delete the idea
    const { error: deleteError } = await supabase
      .from("Idea")
      .delete()
      .eq("id", ideaId);

    if (deleteError) throw deleteError;

    // Invalidate itinerary
    await supabase.from("ItineraryDay").delete().eq("tripId", tripId);
  },

  async voteIdea(ideaId, value) {
    const user = await getOrCreateUser();

    const { data: idea } = await supabase
      .from("Idea")
      .select("tripId")
      .eq("id", ideaId)
      .single();

    if (!idea) throw new Error("Idea not found");

    // Check existing vote
    const { data: existingVote } = await supabase
      .from("Vote")
      .select("id")
      .eq("ideaId", ideaId)
      .eq("userId", user.id)
      .single();

    if (value === 0) {
      if (existingVote) {
        await supabase.from("Vote").delete().eq("id", existingVote.id);
      }
    } else {
      if (existingVote) {
        await supabase
          .from("Vote")
          .update({ value })
          .eq("id", existingVote.id);
      } else {
        await supabase
          .from("Vote")
          .insert([{
            id: crypto.randomUUID(),
            ideaId,
            userId: user.id,
            value
          }]);
      }
    }

    // Invalidate itinerary
    await supabase.from("ItineraryDay").delete().eq("tripId", idea.tripId);

    // Return updated idea
    const { data: votes } = await supabase
      .from("Vote")
      .select("*")
      .eq("ideaId", ideaId);

    const voteScore = votes?.reduce((sum, v) => sum + v.value, 0) || 0;
    const userVote = votes?.find(v => v.userId === user.id)?.value || 0;

    return {
      id: ideaId,
      voteScore,
      voteCount: votes?.length || 0,
      userVote
    };
  },

  async generateItinerary(tripId) {
    const { data: trip, error: tripError } = await supabase
      .from("Trip")
      .select("*")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");

    if (!trip.startDate || !trip.endDate) {
      throw new Error("Set trip dates before generating an itinerary");
    }

    const { data: ideasData } = await supabase
      .from("Idea")
      .select("*, votes:Vote(*)")
      .eq("tripId", tripId);

    const ideas = ideasData ?? [];

    // Build itinerary (simplified - same logic as before)
    const totalDays = Math.max(
      1,
      Math.floor(
        (new Date(trip.endDate) - new Date(trip.startDate)) / (24 * 60 * 60 * 1000)
      ) + 1
    );

    const dayBuckets = Array.from({ length: totalDays }, (_, index) => ({
      dayNumber: index + 1,
      date: new Date(new Date(trip.startDate).getTime() + index * 24 * 60 * 60 * 1000),
      items: []
    }));

    ideas.forEach((idea, idx) => {
      const dayIndex = idx % totalDays;
      dayBuckets[dayIndex].items.push({
        id: `${trip.id}-${dayIndex + 1}-${dayBuckets[dayIndex].items.length + 1}`,
        order: dayBuckets[dayIndex].items.length + 1,
        title: idea.title,
        location: idea.location
      });
    });

    const itinerary = {
      tripId,
      days: dayBuckets.map(day => ({
        dayNumber: day.dayNumber,
        date: toISODate(day.date),
        locationLabel: day.items[0]?.location || "",
        items: day.items
      }))
    };

    return itinerary;
  },

  async getItinerary(tripId) {
    const { data: days } = await supabase
      .from("ItineraryDay")
      .select("*, items:ItineraryItem(*)")
      .eq("tripId", tripId)
      .order("dayNumber");

    if (!days || days.length === 0) {
      return { tripId, days: [] };
    }

    return {
      tripId,
      days: days.map(day => ({
        dayNumber: day.dayNumber,
        date: toISODate(day.date),
        locationLabel: day.items?.[0]?.location || "",
        items: day.items?.map(item => ({
          id: item.id,
          order: item.order,
          title: item.title,
          location: item.location
        })) || []
      }))
    };
  }
};
