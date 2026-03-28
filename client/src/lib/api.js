import { supabase } from "./supabase.js";
import {
  clearGeneratedItinerary,
  createItineraryDraft,
  getGeneratedItinerary,
  hydrateIdea,
  hydrateIdeas,
  hydrateTrip,
  isPlaceLikeList,
  normalizeDestination,
  normalizeListName,
  removeIdeaMeta,
  saveGeneratedItinerary,
  saveIdeaMeta,
  slugify
} from "./tripPlanning.js";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_DESTINATION_AUTOCOMPLETE_FIELDS = [
  "suggestions.placePrediction.place",
  "suggestions.placePrediction.placeId",
  "suggestions.placePrediction.text.text",
  "suggestions.placePrediction.structuredFormat.mainText.text",
  "suggestions.placePrediction.structuredFormat.secondaryText.text",
  "suggestions.placePrediction.types"
].join(",");
const GOOGLE_DESTINATION_DETAILS_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "types",
  "addressComponents"
].join(",");
const GOOGLE_PLACE_BASE_FIELDS = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.shortFormattedAddress",
  "places.location",
  "places.primaryTypeDisplayName",
  "places.photos"
].join(",");
const GOOGLE_PLACE_RECOMMENDATION_FIELDS = [
  GOOGLE_PLACE_BASE_FIELDS,
  "places.editorialSummary"
].join(",");
const DEFAULT_RECOMMENDATION_LIMIT = 10;
const DESTINATION_REGION_TYPES = new Set([
  "country",
  "administrative_area_level_1",
  "administrative_area_level_2",
  "administrative_area_level_3",
  "postal_town"
]);

function buildGoogleMapsHeaders(fieldMask) {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
    "X-Goog-FieldMask": fieldMask
  };
}

export async function getCurrentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

function buildPlaceSearchQuery(textQuery, destination) {
  const trimmed = String(textQuery || "").trim();
  const destinationLabel = String(destination?.label || destination?.name || "").trim();
  if (!trimmed) return "";
  if (!destinationLabel) return trimmed;
  const normalizedQuery = trimmed.toLowerCase();
  const normalizedDestination = destinationLabel.toLowerCase();
  if (normalizedQuery.includes(normalizedDestination)) {
    return trimmed;
  }
  return `${trimmed} in ${destinationLabel}`;
}

function getDestinationLabel(destination) {
  return String(destination?.label || destination?.name || destination?.mapQuery || "").trim();
}

function uniqueQueries(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function slugMatchesAny(slug, tokens) {
  return tokens.some((token) => slug.includes(token));
}

function buildPlaceQueries(destinationLabel, normalizedListSlug) {
  if (slugMatchesAny(normalizedListSlug, ["landmark", "monument", "historic-site", "attraction"])) {
    return [`top landmarks in ${destinationLabel}`, `best historic sites in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["neighborhood", "district", "area"])) {
    return [`best neighborhoods in ${destinationLabel}`, `most interesting districts in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["viewpoint", "view", "scenic", "observation"])) {
    return [`best viewpoints in ${destinationLabel}`, `scenic overlooks in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["park", "garden"])) {
    return [`best parks in ${destinationLabel}`, `best gardens in ${destinationLabel}`];
  }

  return [
    `top landmarks in ${destinationLabel}`,
    `best neighborhoods in ${destinationLabel}`,
    `best viewpoints in ${destinationLabel}`,
    `best parks in ${destinationLabel}`
  ];
}

function buildActivityQueries(destinationLabel, normalizedListSlug) {
  if (slugMatchesAny(normalizedListSlug, ["experience", "experiences"])) {
    return [`best experiences in ${destinationLabel}`, `unique experiences in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["tour", "tours", "guided"])) {
    return [`best tours in ${destinationLabel}`, `guided tours in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["event", "events", "festival", "concert", "show"])) {
    return [`top events in ${destinationLabel}`, `live events in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["class", "classes", "workshop", "making"])) {
    return [`best classes in ${destinationLabel}`, `workshops in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["nightlife", "bar", "bars", "club", "clubbing"])) {
    return [`best nightlife in ${destinationLabel}`, `bar hopping in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["ski", "skiing", "snowboard"])) {
    return [`skiing in ${destinationLabel}`, `best ski resorts near ${destinationLabel}`];
  }

  return [
    `best experiences in ${destinationLabel}`,
    `best tours in ${destinationLabel}`,
    `top events in ${destinationLabel}`,
    `best classes in ${destinationLabel}`
  ];
}

function buildFoodQueries(destinationLabel, normalizedListSlug) {
  if (slugMatchesAny(normalizedListSlug, ["restaurant", "restaurants", "dinner", "lunch"])) {
    return [`best restaurants in ${destinationLabel}`, `top dining in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["cafe", "cafes", "coffee", "bakery"])) {
    return [`best cafes in ${destinationLabel}`, `best coffee shops in ${destinationLabel}`];
  }

  if (slugMatchesAny(normalizedListSlug, ["must-eat", "must-eats", "musteat", "iconic", "signature", "local-food"])) {
    return [`must eat in ${destinationLabel}`, `iconic food in ${destinationLabel}`];
  }

  return [
    `best restaurants in ${destinationLabel}`,
    `best cafes in ${destinationLabel}`,
    `must eat in ${destinationLabel}`
  ];
}

function buildRecommendationQueries(listName, destination) {
  const destinationLabel = getDestinationLabel(destination);
  const normalizedListName = normalizeListName(listName) || "Places to Visit";
  const normalizedListSlug = slugify(normalizedListName);

  if (!destinationLabel) {
    return [];
  }

  if (
    slugMatchesAny(normalizedListSlug, [
      "places-to-visit",
      "landmark",
      "monument",
      "historic-site",
      "attraction",
      "neighborhood",
      "district",
      "viewpoint",
      "view",
      "scenic",
      "park",
      "garden"
    ])
  ) {
    return uniqueQueries(buildPlaceQueries(destinationLabel, normalizedListSlug));
  }

  if (
    slugMatchesAny(normalizedListSlug, [
      "activities",
      "activity",
      "experience",
      "tour",
      "event",
      "class",
      "workshop",
      "nightlife",
      "bar",
      "club",
      "ski"
    ])
  ) {
    return uniqueQueries(buildActivityQueries(destinationLabel, normalizedListSlug));
  }

  if (
    slugMatchesAny(normalizedListSlug, [
      "food",
      "restaurant",
      "cafe",
      "coffee",
      "bakery",
      "must-eat",
      "musteat",
      "eat",
      "brunch"
    ])
  ) {
    return uniqueQueries(buildFoodQueries(destinationLabel, normalizedListSlug));
  }

  const normalizedQueryText = normalizedListName.toLowerCase();
  return uniqueQueries([
    `top ${normalizedQueryText} in ${destinationLabel}`,
    `${normalizedQueryText} in ${destinationLabel}`
  ]);
}

async function runPlacesTextSearch(textQuery, maxResultCount = 5, fieldMask = GOOGLE_PLACE_BASE_FIELDS) {
  if (!textQuery || !GOOGLE_MAPS_API_KEY) {
    return [];
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: buildGoogleMapsHeaders(fieldMask),
    body: JSON.stringify({
      textQuery,
      maxResultCount: Math.max(1, Math.min(20, Number(maxResultCount) || 5))
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Google Places search failed");
  }

  const payload = await response.json();
  return payload.places || [];
}

async function runPlacesAutocomplete(input, includedPrimaryTypes, sessionToken) {
  if (!input || !GOOGLE_MAPS_API_KEY) {
    return [];
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: buildGoogleMapsHeaders(GOOGLE_DESTINATION_AUTOCOMPLETE_FIELDS),
    body: JSON.stringify({
      input,
      includedPrimaryTypes,
      includeQueryPredictions: false,
      ...(sessionToken ? { sessionToken } : {})
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Google Places autocomplete failed");
  }

  const payload = await response.json();
  return payload.suggestions || [];
}

async function getPlaceDetails(placeId, sessionToken) {
  if (!placeId || !GOOGLE_MAPS_API_KEY) {
    return null;
  }

  const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`);
  if (sessionToken) {
    url.searchParams.set("sessionToken", sessionToken);
  }

  const response = await fetch(url, {
    headers: buildGoogleMapsHeaders(GOOGLE_DESTINATION_DETAILS_FIELDS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Google Place Details request failed");
  }

  return response.json();
}

function normalizePlaceMatch(place) {
  const title = place.displayName?.text || "";
  const address = place.formattedAddress || "";
  const shortAddress = place.shortFormattedAddress || "";
  const firstPhoto = Array.isArray(place.photos) ? place.photos[0] : null;
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;

  return {
    id: place.id || `${title.toLowerCase()}-${address.toLowerCase()}`,
    title,
    address,
    shortAddress,
    mapQuery: [title, address].filter(Boolean).join(", "),
    coordinates:
      typeof latitude === "number" && typeof longitude === "number"
        ? { lat: latitude, lng: longitude }
        : null,
    primaryTypeLabel: place.primaryTypeDisplayName?.text || "",
    photoUrl:
      GOOGLE_MAPS_API_KEY && firstPhoto?.name
        ? `https://places.googleapis.com/v1/${firstPhoto.name}/media?maxWidthPx=800&key=${GOOGLE_MAPS_API_KEY}`
        : "",
    photoAttributions: Array.isArray(firstPhoto?.authorAttributions) ? firstPhoto.authorAttributions : []
  };
}

function buildRecommendationDescription(place, listName, destination) {
  const editorialSummary = String(place.editorialSummary?.text || "").trim();
  if (editorialSummary) {
    return editorialSummary;
  }

  const primaryTypeLabel = place.primaryTypeDisplayName?.text || "";
  const shortAddress = String(place.shortFormattedAddress || place.formattedAddress || "").trim();
  const destinationLabel = getDestinationLabel(destination) || "this destination";
  const normalizedListName = normalizeListName(listName);

  if (primaryTypeLabel && shortAddress) {
    return `${primaryTypeLabel} in ${shortAddress}.`;
  }

  if (primaryTypeLabel) {
    return `${primaryTypeLabel} in ${destinationLabel}.`;
  }

  if (shortAddress) {
    return `Popular stop in ${shortAddress}.`;
  }

  if (normalizedListName) {
    return `Popular ${normalizedListName.toLowerCase()} pick in ${destinationLabel}.`;
  }

  return `Popular spot in ${destinationLabel}.`;
}

function getAddressComponentText(addressComponents, type) {
  return (
    addressComponents?.find((component) => Array.isArray(component.types) && component.types.includes(type))?.longText ||
    ""
  );
}

function buildDestinationType(types) {
  const normalizedTypes = Array.isArray(types) ? types : [];

  if (normalizedTypes.includes("country")) {
    return "Country";
  }

  if (normalizedTypes.includes("administrative_area_level_1")) {
    return "State/Province";
  }

  if (normalizedTypes.includes("locality") || normalizedTypes.includes("postal_town")) {
    return "City";
  }

  if (
    normalizedTypes.includes("administrative_area_level_2") ||
    normalizedTypes.includes("administrative_area_level_3")
  ) {
    return "Region";
  }

  return "Destination";
}

function normalizeDestinationPrediction(placePrediction) {
  const label =
    String(placePrediction?.text?.text || placePrediction?.structuredFormat?.mainText?.text || "").trim();
  const secondaryText = String(placePrediction?.structuredFormat?.secondaryText?.text || "").trim();
  const types = Array.isArray(placePrediction?.types) ? placePrediction.types : [];

  if (!label) {
    return null;
  }

  return {
    id: placePrediction.placeId || label.toLowerCase(),
    placeId: placePrediction.placeId || "",
    placeResourceName: placePrediction.place || "",
    label,
    name: String(placePrediction?.structuredFormat?.mainText?.text || label).trim(),
    type: buildDestinationType(types),
    summary: secondaryText,
    region: "",
    country: "",
    mapQuery: String(placePrediction?.text?.text || label).trim(),
    coordinates: null,
    predictionTypes: types
  };
}

function isAllowedRegionPrediction(placePrediction) {
  const types = Array.isArray(placePrediction?.types) ? placePrediction.types : [];
  return types.some((type) => DESTINATION_REGION_TYPES.has(type));
}

function normalizeDestinationDetails(place, fallbackDestination) {
  const displayName = String(place?.displayName?.text || fallbackDestination?.name || fallbackDestination?.label || "").trim();
  const formattedAddress = String(place?.formattedAddress || fallbackDestination?.summary || fallbackDestination?.label || "").trim();
  const addressComponents = Array.isArray(place?.addressComponents) ? place.addressComponents : [];
  const types = Array.isArray(place?.types) && place.types.length
    ? place.types
    : Array.isArray(fallbackDestination?.predictionTypes)
      ? fallbackDestination.predictionTypes
      : [];
  const latitude = place?.location?.latitude;
  const longitude = place?.location?.longitude;
  const region =
    getAddressComponentText(addressComponents, "administrative_area_level_1") ||
    getAddressComponentText(addressComponents, "administrative_area_level_2");
  const country = getAddressComponentText(addressComponents, "country");
  const summary = formattedAddress || [region, country].filter(Boolean).join(", ");

  return {
    id: place?.id || fallbackDestination?.id || displayName.toLowerCase(),
    label: displayName || fallbackDestination?.label || "",
    name: displayName || fallbackDestination?.name || fallbackDestination?.label || "",
    type: buildDestinationType(types),
    region,
    country,
    mapQuery: formattedAddress || displayName || fallbackDestination?.mapQuery || "",
    coordinates:
      typeof latitude === "number" && typeof longitude === "number"
        ? { lat: latitude, lng: longitude }
        : fallbackDestination?.coordinates || null,
    summary
  };
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

function isMissingTripDestinationColumnError(error) {
  const message = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ");
  return /destination/i.test(message) && /(column|schema cache|PGRST204|not found)/i.test(message);
}

async function persistTripDestination(tripId, createdById, destination) {
  const normalizedDestination = normalizeDestination(destination);
  if (!tripId || !createdById || !normalizedDestination) {
    return false;
  }

  const { error } = await supabase
    .from("Trip")
    .update({ destination: normalizedDestination })
    .eq("id", tripId)
    .eq("createdById", createdById);

  if (!error) {
    return true;
  }

  if (isMissingTripDestinationColumnError(error)) {
    console.warn('Trip.destination column is missing. Run the destination migration to persist trip locations.');
    return false;
  }

  console.error("Unable to persist trip destination", error);
  return false;
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

function formatTrip(trip, memberCount = 0) {
  return hydrateTrip({
    id: trip.id,
    name: trip.name,
    startDate: toISODate(trip.startDate),
    endDate: toISODate(trip.endDate),
    destination: trip.destination || null,
    memberCount,
    createdById: trip.createdById
  });
}

async function formatTripDetails(trip, viewerUserId, members, leaders, availability, surveyDates) {
  const isViewerMember =
    trip.createdById === viewerUserId || Boolean((members || []).some((member) => member.id === viewerUserId));

  return hydrateTrip({
    id: trip.id,
    name: trip.name,
    startDate: toISODate(trip.startDate),
    endDate: toISODate(trip.endDate),
    destination: trip.destination || null,
    memberCount: members?.length || 0,
    createdById: trip.createdById,
    isViewerCreator: trip.createdById === viewerUserId,
    isViewerMember,
    isViewerLeader: leaders?.includes(viewerUserId),
    ownerId: trip.createdById,
    leaders: leaders || [trip.createdById],
    members: members || [],
    surveyDates: surveyDates || [],
    availability: availability || {}
  });
}

function formatIdea(tripId, idea, userId, votes = []) {
  const voteScore = votes.reduce((sum, vote) => sum + vote.value, 0);
  const userVote = votes.find((vote) => vote.userId === userId)?.value || 0;
  const isCreator = idea.createdById === userId;

  return hydrateIdea(tripId, {
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
  });
}

export const api = {
  canSearchPlaces() {
    return Boolean(GOOGLE_MAPS_API_KEY);
  },

  async searchPlaces(textQuery, destination) {
    const query = buildPlaceSearchQuery(textQuery, destination);
    if (!query || !GOOGLE_MAPS_API_KEY) {
      return [];
    }

    const results = await runPlacesTextSearch(query, 5);
    return results
      .map((place) => normalizePlaceMatch(place))
      .filter((place) => place.title);
  },

  async searchDestinations(textQuery, options = {}) {
    const query = String(textQuery || "").trim();
    if (!query || !GOOGLE_MAPS_API_KEY) {
      return [];
    }

    const sessionToken = String(options.sessionToken || "").trim();
    const [citySuggestions, regionSuggestions] = await Promise.all([
      runPlacesAutocomplete(query, ["(cities)"], sessionToken),
      runPlacesAutocomplete(query, ["(regions)"], sessionToken)
    ]);

    const seenPlaceIds = new Set();
    const predictions = [];
    const appendPrediction = (placePrediction) => {
      const normalized = normalizeDestinationPrediction(placePrediction);
      if (!normalized?.placeId || seenPlaceIds.has(normalized.placeId)) return;

      seenPlaceIds.add(normalized.placeId);
      predictions.push(normalized);
    };

    citySuggestions.forEach((suggestion) => {
      if (suggestion?.placePrediction) {
        appendPrediction(suggestion.placePrediction);
      }
    });

    regionSuggestions.forEach((suggestion) => {
      const placePrediction = suggestion?.placePrediction;
      if (!placePrediction || !isAllowedRegionPrediction(placePrediction)) return;
      appendPrediction(placePrediction);
    });

    return predictions.slice(0, 8);
  },

  async resolveDestination(destinationPrediction, options = {}) {
    if (!destinationPrediction) {
      return null;
    }

    if (!GOOGLE_MAPS_API_KEY || !destinationPrediction.placeId) {
      return normalizeDestinationDetails(null, destinationPrediction);
    }

    const sessionToken = String(options.sessionToken || "").trim();
    const place = await getPlaceDetails(destinationPrediction.placeId, sessionToken);
    return normalizeDestinationDetails(place, destinationPrediction);
  },

  async resolveMapLocation(textQuery) {
    const query = String(textQuery || "").trim();
    if (!query || !GOOGLE_MAPS_API_KEY) {
      return null;
    }

    const results = await runPlacesTextSearch(query, 1);
    const location = results[0]?.location;
    if (
      !location ||
      typeof location.latitude !== "number" ||
      typeof location.longitude !== "number"
    ) {
      return null;
    }

    return {
      lat: location.latitude,
      lng: location.longitude
    };
  },

  async getRecommendations(destination, listName, options = {}) {
    const queries = buildRecommendationQueries(listName, destination);
    if (!queries.length || !GOOGLE_MAPS_API_KEY) {
      return [];
    }

    const limit = Math.max(1, Math.min(64, Number(options.limit) || DEFAULT_RECOMMENDATION_LIMIT));
    const entryType = isPlaceLikeList(listName) ? "place" : "activity";
    const seenIds = new Set();
    const seenTitles = new Set();
    const recommendations = [];

    for (const query of queries) {
      const remaining = limit - recommendations.length;
      if (remaining <= 0) {
        return recommendations;
      }

      const results = await runPlacesTextSearch(
        query,
        Math.min(20, remaining),
        GOOGLE_PLACE_RECOMMENDATION_FIELDS
      );

      for (const place of results) {
        const normalized = normalizePlaceMatch(place);
        const titleKey = normalized.title.trim().toLowerCase();
        if (!normalized.title || seenIds.has(normalized.id) || seenTitles.has(titleKey)) {
          continue;
        }

        seenIds.add(normalized.id);
        seenTitles.add(titleKey);
        recommendations.push({
          id: normalized.id,
          title: normalized.title,
          description: buildRecommendationDescription(place, listName, destination),
          location: normalized.address || normalized.title,
          entryType,
          mapQuery: normalized.mapQuery || normalized.address || normalized.title,
          coordinates: normalized.coordinates,
          recommendationSource: "Google Maps",
          photoUrl: normalized.photoUrl,
          photoAttributions: normalized.photoAttributions
        });

        if (recommendations.length >= limit) {
          return recommendations;
        }
      }
    }

    return recommendations;
  },

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

    const formattedTrip = await formatTripDetails(trip, userId, members, leaders, availability, surveyDates);

    if (!normalizeDestination(trip.destination) && formattedTrip.destination && trip.createdById === userId) {
      void persistTripDestination(tripId, userId, formattedTrip.destination);
    }

    return formattedTrip;
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

    await persistTripDestination(tripId, user.id, payload.destination);

    return formatTrip({ ...trip, destination: payload.destination || null }, 1);
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
    clearGeneratedItinerary(tripId);

    return this.getTrip(tripId);
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

    clearGeneratedItinerary(tripId);

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

  async leaveTrip(tripId) {
    const user = await getOrCreateUser();

    const { data: trip, error: tripError } = await supabase
      .from("Trip")
      .select("id, createdById")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      throw new Error("Trip not found");
    }

    if (trip.createdById === user.id) {
      throw new Error("Trip owners can't leave their own trip.");
    }

    const { data: membershipRows, error: membershipError } = await supabase
      .from("TripMember")
      .select("id")
      .eq("tripId", tripId)
      .eq("userId", user.id)
      .limit(1);

    if (membershipError) throw membershipError;
    if (!membershipRows?.length) {
      throw new Error("You are not a member of this trip.");
    }

    const membershipIds = membershipRows.map((membership) => membership.id);

    const { data: ideaRows, error: ideaError } = await supabase
      .from("Idea")
      .select("id")
      .eq("tripId", tripId);

    if (ideaError) throw ideaError;

    const ideaIds = (ideaRows || []).map((idea) => idea.id);

    const { data: deletedMemberships, error: deleteMembershipError } = await supabase
      .from("TripMember")
      .delete()
      .in("id", membershipIds)
      .select("id");

    if (deleteMembershipError) throw deleteMembershipError;
    if (!deletedMemberships?.length) {
      throw new Error("Unable to leave this trip right now.");
    }

    const { error: availabilityDeleteError } = await supabase
      .from("UserAvailability")
      .delete()
      .eq("tripId", tripId)
      .eq("userId", user.id);

    if (availabilityDeleteError) throw availabilityDeleteError;

    if (ideaIds.length) {
      const { error: voteDeleteError } = await supabase
        .from("Vote")
        .delete()
        .eq("userId", user.id)
        .in("ideaId", ideaIds);

      if (voteDeleteError) throw voteDeleteError;
    }

    const { error: itineraryDeleteError } = await supabase
      .from("ItineraryDay")
      .delete()
      .eq("tripId", tripId);

    if (itineraryDeleteError) throw itineraryDeleteError;

    clearGeneratedItinerary(tripId);
  },

  async getIdeas(tripId) {
    const user = await getOrCreateUser();

    const { data: ideas, error } = await supabase
      .from("Idea")
      .select("*, votes:Vote(*), User(*)")
      .eq("tripId", tripId)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    return hydrateIdeas(
      tripId,
      ideas?.map((idea) => formatIdea(tripId, idea, user.id, idea.votes)) || []
    );
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
    clearGeneratedItinerary(tripId);
    saveIdeaMeta(tripId, ideaId, {
      entryType: payload.entryType,
      mapQuery: payload.mapQuery,
      coordinates: payload.coordinates || null,
      photoUrl: payload.photoUrl || "",
      photoAttributions: payload.photoAttributions || [],
      listName: payload.category,
      recommendationSource: payload.recommendationSource || null
    });

    return formatIdea(tripId, idea, user.id, []);
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
    clearGeneratedItinerary(tripId);
    removeIdeaMeta(tripId, ideaId);
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
    clearGeneratedItinerary(idea.tripId);

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
    const trip = await this.getTrip(tripId);

    if (!trip) throw new Error("Trip not found");

    if (!trip.startDate || !trip.endDate) {
      throw new Error("Set trip dates before generating an itinerary");
    }
    const ideas = await this.getIdeas(tripId);
    const itinerary = createItineraryDraft(trip, ideas);
    return saveGeneratedItinerary(tripId, itinerary);
  },

  async getItinerary(tripId) {
    const saved = getGeneratedItinerary(tripId);
    if (saved) {
      return saved;
    }

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
