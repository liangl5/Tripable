import { randomUUID } from "node:crypto";
import { buildItinerary } from "./itineraryBuilder.js";
import { HttpError } from "./httpError.js";

function normalizeName(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 40);
}

function defaultUserName(userId) {
  return `Traveler ${String(userId).slice(0, 4)}`;
}

function toISODate(value) {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function now() {
  return new Date();
}

function compareByDateDesc(a, b) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

const state = {
  users: new Map(), // userId -> { id, name }
  trips: new Map(), // tripId -> { id, name, startDate, endDate, createdById, createdAt }
  tripsByUser: new Map(), // userId -> Set<tripId>
  membersByTrip: new Map(), // tripId -> Set<userId>
  leadersByTrip: new Map(), // tripId -> Set<userId>
  surveyDatesByTrip: new Map(), // tripId -> Set<isoDate>
  availabilityByTrip: new Map(), // tripId -> Map<userId, Set<isoDate>>
  ideas: new Map(), // ideaId -> { id, tripId, title, description, location, category, createdById, createdAt }
  ideasByTrip: new Map(), // tripId -> Set<ideaId>
  votesByIdea: new Map(), // ideaId -> Map<userId, value>
  itineraries: new Map() // tripId -> itinerary payload
};

function ensureTripExists(tripId) {
  const trip = state.trips.get(tripId);
  if (!trip) throw new HttpError(404, "Trip not found");
  return trip;
}

function ensureIdeaExists(ideaId) {
  const idea = state.ideas.get(ideaId);
  if (!idea) throw new HttpError(404, "Idea not found");
  return idea;
}

function getMemberCount(tripId) {
  return state.membersByTrip.get(tripId)?.size || 0;
}

function formatTrip(trip) {
  return {
    id: trip.id,
    name: trip.name,
    startDate: toISODate(trip.startDate),
    endDate: toISODate(trip.endDate),
    memberCount: getMemberCount(trip.id),
    createdById: trip.createdById
  };
}

function formatTripDetails(tripId, viewerUserId) {
  const trip = ensureTripExists(tripId);
  const leaders = state.leadersByTrip.get(tripId) || new Set([trip.createdById]);
  const members = [...(state.membersByTrip.get(tripId) || new Set())]
    .map((userId) => state.users.get(userId))
    .filter(Boolean)
    .map((user) => ({
      id: user.id,
      name: user.name,
      isViewer: user.id === viewerUserId,
      isLeader: leaders.has(user.id)
    }))
    .sort((a, b) => {
      if (a.isViewer) return -1;
      if (b.isViewer) return 1;
      return a.name.localeCompare(b.name);
    });

  const availabilityMap = state.availabilityByTrip.get(tripId) || new Map();
  const availability = Object.fromEntries(
    [...availabilityMap.entries()].map(([userId, dates]) => [userId, [...dates].sort()])
  );
  const surveyDates = [...(state.surveyDatesByTrip.get(tripId) || new Set())].sort();

  return {
    ...formatTrip(trip),
    isViewerCreator: trip.createdById === viewerUserId,
    isViewerLeader: leaders.has(viewerUserId),
    ownerId: trip.createdById,
    leaders: [...leaders],
    members,
    surveyDates,
    availability
  };
}

function getVotes(ideaId) {
  const votesMap = state.votesByIdea.get(ideaId);
  if (!votesMap) return [];
  return [...votesMap.entries()].map(([userId, value]) => ({ userId, value }));
}

function formatIdea(idea, userId) {
  const votes = getVotes(idea.id);
  const voteScore = votes.reduce((sum, vote) => sum + vote.value, 0);
  const userVote = votes.find((vote) => vote.userId === userId)?.value || 0;
  const createdBy = state.users.get(idea.createdById);
  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    location: idea.location,
    category: idea.category,
    createdAt: idea.createdAt,
    submittedBy: createdBy?.name || "Traveler",
    voteScore,
    voteCount: votes.length,
    userVote
  };
}

export const store = {
  getOrCreateUser: ({ userId, name }) => {
    const normalized = normalizeName(name);
    const existing = state.users.get(userId);
    if (existing) {
      if (normalized && existing.name !== normalized) {
        existing.name = normalized;
      }
      return existing;
    }

    const user = {
      id: userId,
      name: normalized || defaultUserName(userId)
    };
    state.users.set(userId, user);
    return user;
  },

  listTripsForUser: (userId) => {
    const tripIds = state.tripsByUser.get(userId);
    if (!tripIds) return [];
    return [...tripIds]
      .map((tripId) => state.trips.get(tripId))
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((trip) => formatTrip(trip));
  },

  createTrip: ({ userId, name, startDate, endDate }) => {
    const trip = {
      id: randomUUID(),
      name,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      createdById: userId,
      createdAt: now()
    };
    state.trips.set(trip.id, trip);

    const existingForUser = state.tripsByUser.get(userId) || new Set();
    existingForUser.add(trip.id);
    state.tripsByUser.set(userId, existingForUser);

    const members = state.membersByTrip.get(trip.id) || new Set();
    members.add(userId);
    state.membersByTrip.set(trip.id, members);
    state.leadersByTrip.set(trip.id, new Set([userId]));
    state.surveyDatesByTrip.set(trip.id, new Set());
    state.availabilityByTrip.set(trip.id, new Map());

    return formatTrip(trip);
  },

  updateTripDates: ({ tripId, userId, startDate, endDate }) => {
    const trip = ensureTripExists(tripId);
    if (trip.createdById !== userId) {
      throw new HttpError(403, "Only the trip owner can update the trip dates");
    }
    trip.startDate = new Date(startDate);
    trip.endDate = new Date(endDate);
    state.itineraries.delete(tripId);
    return formatTrip(trip);
  },

  getTrip: ({ tripId, userId }) => {
    return formatTripDetails(tripId, userId);
  },

  joinTrip: ({ tripId, userId }) => {
    ensureTripExists(tripId);

    const members = state.membersByTrip.get(tripId) || new Set();
    members.add(userId);
    state.membersByTrip.set(tripId, members);

    const userTrips = state.tripsByUser.get(userId) || new Set();
    userTrips.add(tripId);
    state.tripsByUser.set(userId, userTrips);
  },

  setAvailability: ({ tripId, userId, dates }) => {
    ensureTripExists(tripId);
    const surveyDates = state.surveyDatesByTrip.get(tripId) || new Set();
    const tripAvailability = state.availabilityByTrip.get(tripId) || new Map();
    const filtered = dates.filter((date) => surveyDates.has(date));
    tripAvailability.set(userId, new Set(filtered));
    state.availabilityByTrip.set(tripId, tripAvailability);
    return formatTripDetails(tripId, userId);
  },

  setSurveyDates: ({ tripId, userId, dates }) => {
    const trip = ensureTripExists(tripId);
    if (trip.createdById !== userId) {
      throw new HttpError(403, "Only the trip owner can edit selectable dates");
    }

    const nextSurveyDates = new Set(dates);
    state.surveyDatesByTrip.set(tripId, nextSurveyDates);
    const sortedDates = [...nextSurveyDates].sort();
    trip.startDate = sortedDates[0] ? new Date(sortedDates[0]) : null;
    trip.endDate = sortedDates[sortedDates.length - 1] ? new Date(sortedDates[sortedDates.length - 1]) : null;

    const tripAvailability = state.availabilityByTrip.get(tripId) || new Map();
    for (const [memberId, memberDates] of tripAvailability.entries()) {
      tripAvailability.set(
        memberId,
        new Set([...memberDates].filter((date) => nextSurveyDates.has(date)))
      );
    }
    state.availabilityByTrip.set(tripId, tripAvailability);

    return formatTripDetails(tripId, userId);
  },

  setLeaders: ({ tripId, userId, leaderIds }) => {
    const trip = ensureTripExists(tripId);
    const currentLeaders = state.leadersByTrip.get(tripId) || new Set([trip.createdById]);
    if (!currentLeaders.has(userId)) {
      throw new HttpError(403, "Only trip leaders can manage leaders");
    }

    const members = state.membersByTrip.get(tripId) || new Set();
    const nextLeaders = new Set(leaderIds.filter((memberId) => members.has(memberId)));
    if (nextLeaders.size === 0) {
      throw new HttpError(400, "A trip must have at least one leader");
    }

    state.leadersByTrip.set(tripId, nextLeaders);
    return formatTripDetails(tripId, userId);
  },

  deleteTrip: ({ tripId, userId }) => {
    const trip = ensureTripExists(tripId);
    if (trip.createdById !== userId) {
      throw new HttpError(403, "Only the trip owner can delete this trip");
    }

    state.trips.delete(tripId);
    state.membersByTrip.delete(tripId);
    state.leadersByTrip.delete(tripId);
    state.surveyDatesByTrip.delete(tripId);
    state.availabilityByTrip.delete(tripId);
    state.itineraries.delete(tripId);

    const ideaIds = state.ideasByTrip.get(tripId) || new Set();
    for (const ideaId of ideaIds) {
      state.ideas.delete(ideaId);
      state.votesByIdea.delete(ideaId);
    }
    state.ideasByTrip.delete(tripId);

    for (const tripIds of state.tripsByUser.values()) {
      tripIds.delete(tripId);
    }
  },

  listIdeas: ({ tripId, userId }) => {
    ensureTripExists(tripId);
    const ideaIds = state.ideasByTrip.get(tripId);
    if (!ideaIds) return [];
    return [...ideaIds]
      .map((ideaId) => state.ideas.get(ideaId))
      .filter(Boolean)
      .sort(compareByDateDesc)
      .map((idea) => formatIdea(idea, userId));
  },

  createIdea: ({ tripId, userId, title, description, location, category }) => {
    ensureTripExists(tripId);
    const idea = {
      id: randomUUID(),
      tripId,
      title,
      description,
      location,
      category: category || null,
      createdById: userId,
      createdAt: now()
    };
    state.ideas.set(idea.id, idea);
    const ideasForTrip = state.ideasByTrip.get(tripId) || new Set();
    ideasForTrip.add(idea.id);
    state.ideasByTrip.set(tripId, ideasForTrip);

    state.itineraries.delete(tripId);
    return formatIdea(idea, userId);
  },

  voteIdea: ({ ideaId, userId, value }) => {
    const idea = ensureIdeaExists(ideaId);
    const votes = state.votesByIdea.get(ideaId) || new Map();
    if (value === 0) {
      votes.delete(userId);
    } else {
      votes.set(userId, value);
    }
    state.votesByIdea.set(ideaId, votes);

    state.itineraries.delete(idea.tripId);
    return formatIdea(idea, userId);
  },

  generateItinerary: ({ tripId }) => {
    const trip = ensureTripExists(tripId);
    if (!trip.startDate || !trip.endDate) {
      throw new HttpError(400, "Set trip dates before generating an itinerary");
    }
    const ideaIds = state.ideasByTrip.get(tripId) || new Set();
    const ideas = [...ideaIds]
      .map((ideaId) => state.ideas.get(ideaId))
      .filter(Boolean)
      .map((idea) => ({
        ...idea,
        votes: getVotes(idea.id)
      }));

    const itinerary = buildItinerary({ trip, ideas });
    state.itineraries.set(tripId, itinerary);
    return itinerary;
  },

  getItinerary: ({ tripId }) => {
    ensureTripExists(tripId);
    return state.itineraries.get(tripId) || { tripId, days: [] };
  }
};
