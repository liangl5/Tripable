import { supabase } from "./supabase.js";
import {
  clearIdeaMeta,
  clearGeneratedItinerary,
  createItineraryDraft,
  getGeneratedItinerary,
  hydrateIdea,
  hydrateIdeas,
  hydrateTrip,
  isPlaceLikeList,
  normalizeListName,
  pruneTripMeta,
  removeIdeaMeta,
  removeTripMeta,
  saveGeneratedItinerary,
  saveIdeaMeta,
  saveTripMeta,
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

function normalizeTripRole(role) {
  if (role === "owner" || role === "editor") return role;
  return "suggestor";
}

async function getTripRoleForUser(tripId, userId) {
  const { data: trip } = await supabase
    .from("Trip")
    .select("createdById")
    .eq("id", tripId)
    .single();

  if (trip?.createdById === userId) {
    return "owner";
  }

  const { data: roleRow } = await supabase
    .from("UserTripRole")
    .select("role")
    .eq("tripId", tripId)
    .eq("userId", userId)
    .maybeSingle();

  return normalizeTripRole(roleRow?.role);
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

function isMissingTripMetaColumnsError(error) {
  const message = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ");
  return /(lists|invitees|budgettotal|expenses)/i.test(message) && /(column|schema cache|PGRST204|not found)/i.test(message);
}

function isMissingIdeaHierarchyColumnError(error) {
  const message = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ");
  return /(entrytype|parentideaid)/i.test(message) && /(column|schema cache|PGRST204|not found)/i.test(message);
}

function isMissingIdeaDetailsColumnError(error) {
  const message = [error?.message, error?.details, error?.hint, error?.code]
    .filter(Boolean)
    .join(" ");
  return /(listid|tabid|costestimate|mapquery|coordinates|photourl|photoattributions|recommendationsource)/i.test(message) &&
    /(column|schema cache|PGRST204|not found)/i.test(message);
}

function normalizeTripListsForDatabase(lists) {
  return (Array.isArray(lists) ? lists : [])
    .map((list) => {
      const name = normalizeListName(list?.name);
      const id = String(list?.id || slugify(name)).trim();
      return name && id ? { id, name } : null;
    })
    .filter(Boolean);
}

function buildTripMetaRecord(payload) {
  const record = {};
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(payload || {}, key);

  if (hasOwn("destination")) {
    record.destination = normalizeDestination(payload.destination);
  }
  if (hasOwn("lists")) {
    record.lists = normalizeTripListsForDatabase(payload.lists);
  }
  if (hasOwn("invitees")) {
    record.invitees = Array.isArray(payload.invitees)
      ? payload.invitees.map((invitee) => String(invitee || "").trim().toLowerCase()).filter(Boolean)
      : [];
  }
  if (hasOwn("budgetTotal")) {
    record.budgetTotal = payload.budgetTotal === "" ? "" : String(payload.budgetTotal ?? "");
  }
  if (hasOwn("expenses")) {
    record.expenses = Array.isArray(payload.expenses) ? payload.expenses : [];
  }

  return record;
}

async function persistTripMetaPatch(tripId, createdById, payload) {
  const record = buildTripMetaRecord(payload);
  if (!tripId || !createdById || !Object.keys(record).length) {
    return true;
  }

  const { data, error } = await supabase
    .from("Trip")
    .update(record)
    .eq("id", tripId)
    .eq("createdById", createdById)
    .select("id")
    .maybeSingle();

  if (!error) {
    if (!data?.id) {
      throw new Error(
        "Trip metadata update did not reach Supabase. Re-run the Trip UPDATE RLS policy in SUPABASE_SETUP_GUIDE.md."
      );
    }
    return true;
  }

  if (isMissingTripDestinationColumnError(error) || isMissingTripMetaColumnsError(error)) {
    console.warn(
      'Trip metadata columns are missing. Run the trip metadata migration to persist destinations, lists, invitees, and budget data in Supabase.'
    );
    return false;
  }

  throw error;
}

async function persistTripDestination(tripId, createdById, destination) {
  if (!normalizeDestination(destination)) {
    return false;
  }

  try {
    return await persistTripMetaPatch(tripId, createdById, { destination });
  } catch (error) {
    console.error("Unable to persist trip destination", error);
    return false;
  }
}

async function syncTripMetaPersistence(tripId, createdById, payload, options = {}) {
  const persisted = await persistTripMetaPatch(tripId, createdById, payload);

  if (persisted) {
    pruneTripMeta(tripId, Object.keys(payload || {}));
  } else if (options.allowLocalFallback !== false) {
    saveTripMeta(tripId, payload);
  }

  return persisted;
}

function buildIdeaDetailsRecord(payload) {
  return {
    entryType: payload.entryType || null,
    parentIdeaId: payload.parentIdeaId || null,
    listId: payload.listId || null,
    tabId: payload.tabId || null,
    costEstimate: payload.costEstimate ?? null,
    mapQuery: payload.mapQuery || null,
    coordinates: payload.coordinates || null,
    photoUrl: payload.photoUrl || null,
    photoAttributions: Array.isArray(payload.photoAttributions) ? payload.photoAttributions : [],
    recommendationSource: payload.recommendationSource || null
  };
}

function buildIdeaRecordVariants(baseIdeaRecord, payload) {
  return {
    full: {
      ...baseIdeaRecord,
      ...buildIdeaDetailsRecord(payload)
    },
    details: {
      ...baseIdeaRecord,
      entryType: payload.entryType || null,
      parentIdeaId: payload.parentIdeaId || null,
      listId: payload.listId || null,
      mapQuery: payload.mapQuery || null,
      coordinates: payload.coordinates || null,
      photoUrl: payload.photoUrl || null,
      photoAttributions: Array.isArray(payload.photoAttributions) ? payload.photoAttributions : [],
      recommendationSource: payload.recommendationSource || null
    },
    hierarchy: {
      ...baseIdeaRecord,
      entryType: payload.entryType || null,
      parentIdeaId: payload.parentIdeaId || null
    },
    core: {
      ...baseIdeaRecord
    }
  };
}

async function insertIdeaRecord(baseIdeaRecord, payload) {
  const variants = buildIdeaRecordVariants(baseIdeaRecord, payload);
  let data;
  let error;
  let persistedDetails = true;

  ({ data, error } = await supabase
    .from("Idea")
    .insert([variants.full])
    .select("*, User(*)")
    .single());

  if (error && isMissingIdeaDetailsColumnError(error)) {
    persistedDetails = false;
    ({ data, error } = await supabase
      .from("Idea")
      .insert([variants.details])
      .select("*, User(*)")
      .single());
  }

  if (error && isMissingIdeaHierarchyColumnError(error)) {
    persistedDetails = false;
    console.warn(
      'Idea hierarchy or detail columns are missing. Run the idea metadata migration to persist grouping and map details in Supabase.'
    );
    ({ data, error } = await supabase
      .from("Idea")
      .insert([variants.core])
      .select("*, User(*)")
      .single());
  }

  return { data, error, persistedDetails };
}

async function updateIdeaRecord(ideaId, baseIdeaRecord, payload) {
  const variants = buildIdeaRecordVariants(baseIdeaRecord, payload);
  let error;
  let persistedDetails = true;
  let updatedIdeaId = null;

  ({ data: updatedIdeaId, error } = await supabase
    .from("Idea")
    .update(variants.full)
    .eq("id", ideaId)
    .select("id")
    .maybeSingle());

  if (error && isMissingIdeaDetailsColumnError(error)) {
    persistedDetails = false;
    ({ data: updatedIdeaId, error } = await supabase
      .from("Idea")
      .update(variants.details)
      .eq("id", ideaId)
      .select("id")
      .maybeSingle());
  }

  if (error && isMissingIdeaHierarchyColumnError(error)) {
    persistedDetails = false;
    console.warn(
      'Idea hierarchy or detail columns are missing. Run the idea metadata migration to persist grouping and map details in Supabase.'
    );
    ({ data: updatedIdeaId, error } = await supabase
      .from("Idea")
      .update(variants.core)
      .eq("id", ideaId)
      .select("id")
      .maybeSingle());
  }

  if (!error && !updatedIdeaId?.id) {
    error = new Error(
      "Idea update did not reach Supabase. Re-run the Idea UPDATE RLS policy in SUPABASE_SETUP_GUIDE.md."
    );
  }

  return { error, persistedDetails };
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
    createdAt: trip.createdAt || trip.created_at || null,
    destination: trip.destination || null,
    lists: trip.lists || null,
    invitees: trip.invitees || [],
    budgetTotal: trip.budgetTotal ?? "",
    expenses: trip.expenses || [],
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
    lists: trip.lists || null,
    invitees: trip.invitees || [],
    budgetTotal: trip.budgetTotal ?? "",
    expenses: trip.expenses || [],
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
  const votesDetailed = votes.map((vote) => ({
    userId: vote.userId,
    value: vote.value,
    name: vote.User?.name || "Traveler"
  }));

  return hydrateIdea(tripId, {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    location: idea.location,
    category: idea.category,
    entryType: idea.entryType,
    parentIdeaId: idea.parentIdeaId || null,
    listId: idea.listId || null,
    tabId: idea.tabId || null,
    costEstimate: idea.costEstimate ?? null,
    mapQuery: idea.mapQuery || null,
    coordinates: idea.coordinates || null,
    photoUrl: idea.photoUrl || null,
    photoAttributions: idea.photoAttributions || [],
    recommendationSource: idea.recommendationSource || null,
    createdAt: idea.createdAt,
    createdById: idea.createdById,
    submittedBy: idea.User?.name || "Traveler",
    voteScore,
    voteCount: votes.length,
    userVote,
    votes: votesDetailed,
    isCreator
  });
}

function formatIdeaWithPersistedDetails(tripId, idea, userId, votes = [], payload = {}) {
  return formatIdea(
    tripId,
    {
      ...idea,
      category: idea.category ?? payload.category ?? null,
      entryType: idea.entryType ?? payload.entryType ?? null,
      parentIdeaId: idea.parentIdeaId ?? payload.parentIdeaId ?? null,
      listId: idea.listId ?? payload.listId ?? null,
      tabId: idea.tabId ?? payload.tabId ?? null,
      costEstimate: idea.costEstimate ?? payload.costEstimate ?? null,
      mapQuery: idea.mapQuery ?? payload.mapQuery ?? null,
      coordinates: idea.coordinates ?? payload.coordinates ?? null,
      photoUrl: idea.photoUrl ?? payload.photoUrl ?? null,
      photoAttributions: Array.isArray(idea.photoAttributions)
        ? idea.photoAttributions
        : Array.isArray(payload.photoAttributions)
          ? payload.photoAttributions
          : [],
      recommendationSource: idea.recommendationSource ?? payload.recommendationSource ?? null
    },
    userId,
    votes
  );
}

function buildHydratedIdeaPersistencePayload(idea) {
  const payload = {
    title: idea.title,
    description: idea.description || "",
    location: idea.location || "",
    category: idea.category || idea.listName || null,
    entryType: idea.entryType || null,
    parentIdeaId: idea.parentIdeaId || null,
    listId: idea.listId || null,
    tabId: idea.tabId || null,
    costEstimate: idea.costEstimate ?? null,
    mapQuery: idea.mapQuery || null,
    coordinates: idea.coordinates || null,
    photoUrl: idea.photoUrl || null,
    photoAttributions: Array.isArray(idea.photoAttributions) ? idea.photoAttributions : [],
    recommendationSource: idea.recommendationSource || null
  };

  const shouldPersist =
    (!idea.category && Boolean(payload.category)) ||
    (!idea.entryType && Boolean(payload.entryType)) ||
    (!idea.parentIdeaId && Boolean(payload.parentIdeaId)) ||
    (!idea.listId && Boolean(payload.listId)) ||
    (!idea.tabId && Boolean(payload.tabId)) ||
    (idea.costEstimate !== payload.costEstimate && payload.costEstimate !== null && payload.costEstimate !== undefined) ||
    (!idea.mapQuery && Boolean(payload.mapQuery)) ||
    (!idea.coordinates && Boolean(payload.coordinates)) ||
    (!idea.photoUrl && Boolean(payload.photoUrl)) ||
    (!(Array.isArray(idea.photoAttributions) && idea.photoAttributions.length) && payload.photoAttributions.length > 0) ||
    (!idea.recommendationSource && Boolean(payload.recommendationSource));

  return shouldPersist ? payload : null;
}

async function migrateHydratedIdeas(tripId, viewerUserId, tripOwnerId, ideas) {
  const syncableIdeas = (ideas || []).filter((idea) => {
    const canEdit = tripOwnerId === viewerUserId || idea.createdById === viewerUserId;
    return canEdit && buildHydratedIdeaPersistencePayload(idea);
  });

  if (!syncableIdeas.length) {
    return;
  }

  await Promise.all(
    syncableIdeas.map(async (idea) => {
      const payload = buildHydratedIdeaPersistencePayload(idea);
      if (!payload) return;

      const baseIdeaRecord = {
        title: payload.title,
        description: payload.description,
        location: payload.location,
        category: payload.category || null
      };

      const { error, persistedDetails } = await updateIdeaRecord(idea.id, baseIdeaRecord, payload);
      if (error) {
        throw error;
      }

      if (persistedDetails) {
        removeIdeaMeta(tripId, idea.id);
      } else {
        saveIdeaMeta(tripId, idea.id, {
          entryType: payload.entryType,
          parentIdeaId: payload.parentIdeaId,
          mapQuery: payload.mapQuery,
          coordinates: payload.coordinates,
          photoUrl: payload.photoUrl,
          photoAttributions: payload.photoAttributions,
          listId: payload.listId,
          tabId: payload.tabId,
          costEstimate: payload.costEstimate,
          listName: payload.category,
          recommendationSource: payload.recommendationSource
        });
      }
    })
  );
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
    const { data: createdTripsData, error: createdError } = await supabase
      .from("Trip")
      .select("*")
      .eq("createdById", userId)
      .order("createdAt", { ascending: false });

    if (createdError) throw createdError;

    // Get trip IDs where user is a member
    const { data: membershipData, error: memberError } = await supabase
      .from("TripMember")
      .select("tripId")
      .eq("userId", userId);

    if (memberError) throw memberError;

    // Fetch those trips if any memberships exist
    let memberTripsData = [];
    if (membershipData && membershipData.length > 0) {
      const tripIds = membershipData.map(m => m.tripId);
      const { data: trips, error: tripError } = await supabase
        .from("Trip")
        .select("*")
        .in("id", tripIds)
        .order("createdAt", { ascending: false });
      
      if (tripError) throw tripError;
      memberTripsData = trips || [];
    }

    const createdTrips = createdTripsData ?? [];

    // Combine and deduplicate
    const tripMap = new Map();
    createdTrips.forEach(trip => tripMap.set(trip.id, trip));
    memberTripsData.forEach(trip => tripMap.set(trip.id, trip));

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

    // NOTE: Legacy metadata persistence removed in v2.0
    // Trip now uses normalized tables (TripDestination, List, Transaction) instead of JSONB
    // Migration from localStorage happens at create time in createTrip()

    return formattedTrip;
  },

  async getTripInvitePreview(tripId) {
    const { data: trip, error } = await supabase
      .from("Trip")
      .select("id, name, createdAt, createdById")
      .eq("id", tripId)
      .single();

    if (error || !trip) {
      throw new Error("Trip not found");
    }

    let ownerDisplayName = "Trip owner";
    if (trip.createdById) {
      const { data: owner } = await supabase
        .from("User")
        .select("name")
        .eq("id", trip.createdById)
        .maybeSingle();
      ownerDisplayName = owner?.name || ownerDisplayName;
    }

    return {
      id: trip.id,
      name: trip.name,
      startDate: null,
      endDate: null,
      memberCount: null,
      createdAt: trip.createdAt,
      ownerDisplayName
    };
  },

  async createTrip(payload) {
    const user = await getOrCreateUser();
    const tripId = crypto.randomUUID();
    const initialLists = Array.isArray(payload.lists) && payload.lists.length ? payload.lists : [];
    
    // Create trip with clean schema (no JSONB)
    const tripInsert = {
      id: tripId,
      name: payload.name,
      createdById: user.id
    };

    const { data: trip, error: tripError } = await supabase
      .from("Trip")
      .insert([tripInsert])
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

    // Create UserTripRole for creator as owner
    const { error: roleError } = await supabase
      .from("UserTripRole")
      .insert([{
        id: crypto.randomUUID(),
        tripId,
        userId: user.id,
        role: "owner"
      }]);

    if (roleError) throw roleError;

    return {
      ...trip,
      destination: null,
      lists: [],
      invitees: Array.isArray(payload.invitees) ? payload.invitees : [],
      budgetTotal: "",
      expenses: []
    };
  },

  async duplicateTrip(sourceTripId, payload = {}) {
    const user = await getOrCreateUser();

    const { data: sourceTrip, error: sourceError } = await supabase
      .from("Trip")
      .select("*")
      .eq("id", sourceTripId)
      .single();

    if (sourceError || !sourceTrip) {
      throw new Error("Trip not found");
    }

    const newTripId = crypto.randomUUID();
    const tripInsert = {
      id: newTripId,
      name: payload?.name || `Copy of ${sourceTrip.name || "Trip"}`,
      createdById: user.id
    };

    const { error: tripError } = await supabase
      .from("Trip")
      .insert([tripInsert]);

    if (tripError) throw tripError;

    const { error: memberError } = await supabase
      .from("TripMember")
      .insert([{
        id: crypto.randomUUID(),
        tripId: newTripId,
        userId: user.id
      }]);

    if (memberError) throw memberError;

    const { error: roleError } = await supabase
      .from("UserTripRole")
      .insert([{
        id: crypto.randomUUID(),
        tripId: newTripId,
        userId: user.id,
        role: "owner"
      }]);

    if (roleError) throw roleError;

    const { data: sourceTabs, error: tabError } = await supabase
      .from("TripTabConfiguration")
      .select("*")
      .eq("tripId", sourceTripId)
      .order("position", { ascending: true });

    if (tabError) throw tabError;

    const tabIdMap = new Map();
    const newTabs = (sourceTabs || []).map((tab) => {
      const id = crypto.randomUUID();
      tabIdMap.set(tab.id, id);
      return {
        id,
        tripId: newTripId,
        name: tab.name,
        tabType: tab.tabType,
        position: tab.position,
        isCollapsible: tab.isCollapsible ?? false
      };
    });

    const mapTabId = (tabId) => {
      if (!tabId) return null;
      const mapped = tabIdMap.get(tabId);
      if (!mapped) {
        throw new Error("Unable to map tab configuration during duplication");
      }
      return mapped;
    };

    if (newTabs.length) {
      const { error } = await supabase.from("TripTabConfiguration").insert(newTabs);
      if (error) throw error;
    }

    const { data: sourceLists, error: listError } = await supabase
      .from("List")
      .select("*")
      .eq("tripId", sourceTripId)
      .order("order", { ascending: true });

    if (listError) throw listError;

    const listIdMap = new Map();
    const newLists = (sourceLists || []).map((list) => {
      const id = crypto.randomUUID();
      listIdMap.set(list.id, id);
      return {
        id,
        tripId: newTripId,
        tabId: mapTabId(list.tabId),
        name: list.name,
        order: list.order
      };
    });

    if (newLists.length) {
      const { error } = await supabase.from("List").insert(newLists);
      if (error) throw error;
    }

    const sourceTabIds = (sourceTabs || []).map((tab) => tab.id);

    if (sourceTabIds.length) {
      const { data: itineraryConfigs, error: configError } = await supabase
        .from("ItineraryTabConfiguration")
        .select("*")
        .in("tabId", sourceTabIds);

      if (configError) throw configError;

      const newConfigs = (itineraryConfigs || []).map((config) => {
        const allowedIds = Array.isArray(config.allowedListIds)
          ? config.allowedListIds.map((id) => listIdMap.get(id)).filter(Boolean)
          : config.allowedListIds;

        return {
          id: crypto.randomUUID(),
          tabId: mapTabId(config.tabId),
          allowedListIds: allowedIds
        };
      });

      if (newConfigs.length) {
        const { error } = await supabase.from("ItineraryTabConfiguration").insert(newConfigs);
        if (error) throw error;
      }
    }

    const { data: sourceIdeas, error: ideaError } = await supabase
      .from("Idea")
      .select("*")
      .eq("tripId", sourceTripId);

    if (ideaError) throw ideaError;

    const ideaIdMap = new Map();
    (sourceIdeas || []).forEach((idea) => {
      ideaIdMap.set(idea.id, crypto.randomUUID());
    });

    const newIdeas = (sourceIdeas || []).map((idea) => ({
      id: ideaIdMap.get(idea.id),
      tripId: newTripId,
      title: idea.title,
      description: idea.description,
      location: idea.location,
      category: idea.category,
      entryType: idea.entryType,
      parentIdeaId: idea.parentIdeaId ? ideaIdMap.get(idea.parentIdeaId) : null,
      listId: idea.listId ? listIdMap.get(idea.listId) : null,
      tabId: mapTabId(idea.tabId),
      costEstimate: idea.costEstimate,
      mapQuery: idea.mapQuery,
      coordinates: idea.coordinates,
      photoUrl: idea.photoUrl,
      photoAttributions: idea.photoAttributions,
      recommendationSource: idea.recommendationSource,
      createdById: idea.createdById
    }));

    if (newIdeas.length) {
      const { error } = await supabase.from("Idea").insert(newIdeas);
      if (error) throw error;
    }

    const { data: sourceDays, error: dayError } = await supabase
      .from("ItineraryDay")
      .select("*")
      .eq("tripId", sourceTripId)
      .order("dayNumber", { ascending: true });

    if (dayError) throw dayError;

    const dayIdMap = new Map();
    (sourceDays || []).forEach((day) => {
      dayIdMap.set(day.id, crypto.randomUUID());
    });

    const newDays = (sourceDays || []).map((day) => ({
      id: dayIdMap.get(day.id),
      tripId: newTripId,
      tabId: mapTabId(day.tabId),
      dayNumber: day.dayNumber,
      date: day.date,
      isDraft: day.isDraft
    }));

    if (newDays.length) {
      const { error } = await supabase.from("ItineraryDay").insert(newDays);
      if (error) throw error;
    }

    if (sourceDays?.length) {
      const { data: items, error: itemError } = await supabase
        .from("ItineraryItem")
        .select("*")
        .in("itineraryDayId", sourceDays.map((day) => day.id));

      if (itemError) throw itemError;

      const newItems = (items || []).map((item) => ({
        id: crypto.randomUUID(),
        itineraryDayId: dayIdMap.get(item.itineraryDayId),
        ideaId: item.ideaId ? ideaIdMap.get(item.ideaId) : null,
        order: item.order,
        title: item.title,
        location: item.location
      }));

      if (newItems.length) {
        const { error } = await supabase.from("ItineraryItem").insert(newItems);
        if (error) throw error;
      }
    }

    const { data: surveyRows, error: surveyError } = await supabase
      .from("SurveyDate")
      .select("date")
      .eq("tripId", sourceTripId);

    if (surveyError) throw surveyError;

    const newSurveyRows = (surveyRows || []).map((row) => ({
      id: crypto.randomUUID(),
      tripId: newTripId,
      date: row.date
    }));

    if (newSurveyRows.length) {
      const { error } = await supabase.from("SurveyDate").insert(newSurveyRows);
      if (error) throw error;
    }

    const { data: transactions, error: transactionError } = await supabase
      .from("Transaction")
      .select("*")
      .eq("tripId", sourceTripId);

    if (transactionError) throw transactionError;

    const transactionIdMap = new Map();
    (transactions || []).forEach((tx) => {
      transactionIdMap.set(tx.id, crypto.randomUUID());
    });

    const newTransactions = (transactions || []).map((tx) => ({
      id: transactionIdMap.get(tx.id),
      tripId: newTripId,
      tabId: mapTabId(tx.tabId),
      name: tx.name,
      totalAmount: tx.totalAmount,
      paidByUserId: tx.paidByUserId,
      createdById: tx.createdById
    }));

    if (newTransactions.length) {
      const { error } = await supabase.from("Transaction").insert(newTransactions);
      if (error) throw error;
    }

    if (transactions?.length) {
      const { data: splits, error: splitError } = await supabase
        .from("TransactionSplit")
        .select("*")
        .in("transactionId", transactions.map((tx) => tx.id));

      if (splitError) throw splitError;

      const newSplits = (splits || []).map((split) => ({
        id: crypto.randomUUID(),
        transactionId: transactionIdMap.get(split.transactionId),
        userId: split.userId,
        amount: split.amount
      }));

      if (newSplits.length) {
        const { error } = await supabase.from("TransactionSplit").insert(newSplits);
        if (error) throw error;
      }
    }

    return this.getTrip(newTripId);
  },

  async sendTripInvites(payload) {
    const user = await getOrCreateUser();
    const shouldNotify = payload?.notify !== false;
    const invitees = Array.isArray(payload?.invitees)
      ? payload.invitees
          .map((invitee) => {
            if (typeof invitee === "string") return invitee;
            if (invitee && typeof invitee === "object") return invitee.email;
            return "";
          })
          .map((email) => String(email || "").trim().toLowerCase())
          .filter(Boolean)
      : [];

    if (!payload?.tripId || !payload?.tripName || invitees.length === 0) {
      return {
        sent: 0,
        failed: 0,
        total: 0,
        results: []
      };
    }

    if (!shouldNotify) {
      return {
        sent: 0,
        failed: 0,
        total: invitees.length,
        results: invitees.map((email) => ({ email, success: false, skipped: true, reason: "notifications_disabled" }))
      };
    }

    const inviteUrl = payload.inviteUrl || `${window.location.origin}/trips/${payload.tripId}/invite`;

    const response = await fetch("/api/send-trip-invites", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        tripId: payload.tripId,
        tripName: payload.tripName,
        invitees,
        inviterName: user?.name || "A teammate",
        inviterUserId: user?.id || null,
        inviteUrl,
        notify: shouldNotify
      })
    });

    const contentType = response.headers.get("content-type") || "";
    const rawBody = await response.text();
    let result = {};
    if (rawBody) {
      if (contentType.includes("application/json")) {
        try {
          result = JSON.parse(rawBody);
        } catch {
          throw new Error("Invite service returned invalid JSON.");
        }
      } else {
        // Local Vite dev often serves index.html for /api routes unless using Vercel dev.
        if (!response.ok) {
          throw new Error("Invite service endpoint unavailable. Use Vercel deployment or run with `vercel dev`.");
        }
        throw new Error("Invite service returned an unexpected response format.");
      }
    }

    if (!response.ok) {
      throw new Error(result?.error || "Unable to send invites right now.");
    }

    return result;
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

    // Delete all related data in correct dependency order
    // 1. Get all idea IDs for this trip, then delete their votes
    const { data: ideas } = await supabase
      .from("Idea")
      .select("id")
      .eq("tripId", tripId);

    if (ideas && ideas.length > 0) {
      const ideaIds = ideas.map(idea => idea.id);
      await supabase.from("Vote").delete().in("ideaId", ideaIds);
    }

    // 2. Delete ideas
    await supabase.from("Idea").delete().eq("tripId", tripId);

    // 3. Get all itinerary day IDs, then delete their items
    const { data: days } = await supabase
      .from("ItineraryDay")
      .select("id")
      .eq("tripId", tripId);

    if (days && days.length > 0) {
      const dayIds = days.map(day => day.id);
      await supabase.from("ItineraryItem").delete().in("itineraryDayId", dayIds);
    }

    // 4. Delete other trip data
    await supabase.from("ItineraryDay").delete().eq("tripId", tripId);
    await supabase.from("UserAvailability").delete().eq("tripId", tripId);
    await supabase.from("SurveyDate").delete().eq("tripId", tripId);
    await supabase.from("TripMember").delete().eq("tripId", tripId);
    await supabase.from("UserTripRole").delete().eq("tripId", tripId);
    await supabase.from("List").delete().eq("tripId", tripId);
    await supabase.from("TripTabConfiguration").delete().eq("tripId", tripId);
    await supabase.from("AvailabilityTabData").delete().eq("tripId", tripId);
    await supabase.from("Transaction").delete().eq("tripId", tripId);

    // 5. Finally delete the trip
    const { error } = await supabase
      .from("Trip")
      .delete()
      .eq("id", tripId);

    if (error) throw error;

    removeTripMeta(tripId);
    clearIdeaMeta(tripId);
    clearGeneratedItinerary(tripId);
  },

  async updateTripDates(tripId, payload) {
    const user = await getOrCreateUser();

    const role = await getTripRoleForUser(tripId, user.id);
    if (role !== "owner" && role !== "editor") {
      throw new Error("Only trip owners and editors can update trip dates");
    }

    if (!payload?.startDate || !payload?.endDate) {
      throw new Error("Both start and end date are required.");
    }

    // Store the selected window as survey dates since Trip.startDate/endDate are deprecated.
    await supabase.from("SurveyDate").delete().eq("tripId", tripId);

    const records = [payload.startDate, payload.endDate]
      .map((date) => String(date || "").trim())
      .filter(Boolean)
      .map((date) => ({
        id: crypto.randomUUID(),
        tripId,
        date: new Date(date).toISOString()
      }));

    if (records.length > 0) {
      const { error } = await supabase.from("SurveyDate").insert(records);
      if (error) throw error;
    }

    // Invalidate generated itinerary cache only (don't wipe saved itinerary)
    clearGeneratedItinerary(tripId);

    return this.getTrip(tripId);
  },

  async updateTripSurveyDates(tripId, payload) {
    const user = await getOrCreateUser();

    const role = await getTripRoleForUser(tripId, user.id);
    if (role !== "owner" && role !== "editor") {
      throw new Error("Only trip owners and editors can edit selectable dates");
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

  async updateTripMeta(tripId, payload) {
    const user = await getOrCreateUser();

    const role = await getTripRoleForUser(tripId, user.id);
    if (role !== "owner" && role !== "editor") {
      throw new Error("Only trip owners and editors can update trip settings");
    }

    const updates = {};
    if (Object.prototype.hasOwnProperty.call(payload || {}, "name")) {
      const nextName = String(payload?.name || "").trim();
      if (!nextName) {
        throw new Error("Trip name cannot be empty");
      }
      updates.name = nextName;
    }

    if (!Object.keys(updates).length) {
      return this.getTrip(tripId);
    }

    const { error } = await supabase
      .from("Trip")
      .update(updates)
      .eq("id", tripId)
      .select()
      .single();

    if (error) throw error;

    return this.getTrip(tripId);
  },

  async joinTrip(tripId) {
    const user = await getOrCreateUser();
    const normalizedEmail = String(user?.email || "").trim().toLowerCase();
    let pendingInvite = null;

    if (normalizedEmail) {
      const { data: pendingRow, error: pendingError } = await supabase
        .from("PendingTripInvite")
        .select("id, role, status")
        .eq("tripId", tripId)
        .ilike("email", normalizedEmail)
        .eq("status", "pending")
        .maybeSingle();

      // Ignore missing-table errors for backwards compatibility.
      if (pendingError && !String(pendingError.message || "").includes("PendingTripInvite")) {
        throw pendingError;
      }
      pendingInvite = pendingRow || null;
    }

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

    if (existing) {
      // If the user is already a member, finalize any lingering pending invite
      // so they do not appear in both "Pending" and "People with access" lists.
      if (pendingInvite?.id) {
        const { error: inviteFinalizeError } = await supabase
          .from("PendingTripInvite")
          .update({
            status: "accepted",
            acceptedAt: new Date().toISOString(),
            acceptedByUserId: user.id
          })
          .eq("id", pendingInvite.id)
          .eq("status", "pending");

        if (inviteFinalizeError && !String(inviteFinalizeError.message || "").includes("PendingTripInvite")) {
          throw inviteFinalizeError;
        }
      }
      return; // Already a member
    }

    // Add as member
    const { error } = await supabase
      .from("TripMember")
      .insert([{
        id: crypto.randomUUID(),
        tripId,
        userId: user.id
      }]);

    if (error) throw error;

    // Create UserTripRole for invited user based on pending invite role.
    const desiredRole = pendingInvite?.role === "editor" ? "editor" : "suggestor";
    const { error: roleError } = await supabase
      .from("UserTripRole")
      .insert([{
        id: crypto.randomUUID(),
        tripId,
        userId: user.id,
        role: desiredRole
      }]);

    // Duplicate role rows are harmless. Any other failure leaves the trip in a partial state,
    // so roll back membership and surface a real error to the caller.
    const isDuplicateRoleError =
      roleError?.code === "23505" ||
      String(roleError?.message || "").toLowerCase().includes("duplicate") ||
      String(roleError?.details || "").toLowerCase().includes("already exists") ||
      String(roleError?.hint || "").toLowerCase().includes("unique");

    if (roleError && !isDuplicateRoleError) {
      const { error: rollbackError } = await supabase
        .from("TripMember")
        .delete()
        .eq("tripId", tripId)
        .eq("userId", user.id);

      const isPermissionError =
        roleError?.code === "42501" ||
        String(roleError?.message || "").toLowerCase().includes("permission") ||
        String(roleError?.message || "").toLowerCase().includes("row-level security") ||
        String(roleError?.details || "").toLowerCase().includes("policy");

      if (rollbackError) {
        throw new Error("Trip join hit a permissions mismatch and rollback failed. Ask the trip owner to remove you from People with access, then retry.");
      }

      if (isPermissionError) {
        throw new Error("Unable to complete trip join permissions. The trip role policy is blocking invite acceptance.");
      }

      throw new Error("Unable to complete trip join permissions. Please contact the trip owner.");
    }

    if (pendingInvite?.id) {
      await supabase
        .from("PendingTripInvite")
        .update({
          status: "accepted",
          acceptedAt: new Date().toISOString(),
          acceptedByUserId: user.id
        })
        .eq("id", pendingInvite.id);
    }
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

    const { error: roleDeleteError } = await supabase
      .from("UserTripRole")
      .delete()
      .eq("tripId", tripId)
      .eq("userId", user.id);

    if (roleDeleteError) throw roleDeleteError;

    clearGeneratedItinerary(tripId);
    removeTripMeta(tripId);
    clearIdeaMeta(tripId);
  },

  async getIdeas(tripId) {
    const user = await getOrCreateUser();

    const { data: ideas, error } = await supabase
      .from("Idea")
      .select("*, votes:Vote(*, User(*)), User(*)")
      .eq("tripId", tripId)
      .order("createdAt", { ascending: false });

    if (error) throw error;

    const formattedIdeas = hydrateIdeas(
      tripId,
      ideas?.map((idea) => formatIdea(tripId, idea, user.id, idea.votes)) || []
    );

    const { data: trip } = await supabase
      .from("Trip")
      .select("createdById")
      .eq("id", tripId)
      .single();

    void migrateHydratedIdeas(tripId, user.id, trip?.createdById, formattedIdeas).catch((migrationError) => {
      console.error("Unable to migrate legacy idea metadata into Supabase", migrationError);
    });

    return formattedIdeas;
  },

  async createIdea(tripId, payload) {
    const user = await getOrCreateUser();
    const ideaId = crypto.randomUUID();
    const baseIdeaRecord = {
      id: ideaId,
      tripId,
      createdById: user.id,
      title: payload.title,
      description: payload.description,
      location: payload.location,
      category: payload.category || null
    };

    const { data: idea, error, persistedDetails } = await insertIdeaRecord(baseIdeaRecord, payload);

    if (error) throw error;

    // Invalidate itinerary
    // Invalidate generated itinerary cache only (don't wipe saved itinerary)
    clearGeneratedItinerary(tripId);
    if (persistedDetails) {
      removeIdeaMeta(tripId, ideaId);
    } else {
      saveIdeaMeta(tripId, ideaId, {
        entryType: payload.entryType,
        parentIdeaId: payload.parentIdeaId || null,
        mapQuery: payload.mapQuery,
        coordinates: payload.coordinates || null,
        photoUrl: payload.photoUrl || "",
        photoAttributions: payload.photoAttributions || [],
        listId: payload.listId || "",
        tabId: payload.tabId || null,
        costEstimate: payload.costEstimate ?? null,
        listName: payload.category,
        recommendationSource: payload.recommendationSource || null
      });
    }

    return formatIdeaWithPersistedDetails(tripId, idea, user.id, [], payload);
  },

  async updateIdea(ideaId, tripId, payload) {
    const user = await getOrCreateUser();

    const { data: existingIdea, error: fetchError } = await supabase
      .from("Idea")
      .select("id, createdById")
      .eq("id", ideaId)
      .single();

    if (fetchError || !existingIdea) throw new Error("Idea not found");

    const role = await getTripRoleForUser(tripId, user.id);
    const isOwner = role === "owner";
    const isEditor = role === "editor";
    const isCreator = existingIdea.createdById === user.id;

    if (!isOwner && !isEditor && !isCreator) {
      throw new Error("Only the trip owner, editor, or item creator can edit this item");
    }

    const baseIdeaRecord = {
      title: payload.title,
      description: payload.description,
      location: payload.location,
      category: payload.category || null
    };

    const { error, persistedDetails } = await updateIdeaRecord(ideaId, baseIdeaRecord, payload);

    if (error) throw error;

    await supabase.from("ItineraryDay").delete().eq("tripId", tripId);
    clearGeneratedItinerary(tripId);
    if (persistedDetails) {
      removeIdeaMeta(tripId, ideaId);
    } else {
      saveIdeaMeta(tripId, ideaId, {
        entryType: payload.entryType,
        parentIdeaId: payload.parentIdeaId || null,
        mapQuery: payload.mapQuery,
        coordinates: payload.coordinates || null,
        photoUrl: payload.photoUrl || "",
        photoAttributions: payload.photoAttributions || [],
        listId: payload.listId || "",
        tabId: payload.tabId || null,
        costEstimate: payload.costEstimate ?? null,
        listName: payload.category,
        recommendationSource: payload.recommendationSource || null
      });
    }

    const { data: updatedIdea, error: updatedIdeaError } = await supabase
      .from("Idea")
      .select("*, votes:Vote(*), User(*)")
      .eq("id", ideaId)
      .single();

    if (updatedIdeaError || !updatedIdea) {
      throw updatedIdeaError || new Error("Unable to load the updated item");
    }

    return formatIdeaWithPersistedDetails(tripId, updatedIdea, user.id, updatedIdea.votes || [], payload);
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
    const role = await getTripRoleForUser(tripId, user.id);
    const isOwner = role === "owner";
    const isEditor = role === "editor";
    const isCreator = idea.createdById === user.id;

    if (!isOwner && !isEditor && !isCreator) {
      throw new Error("Only the trip owner, editor, or activity creator can delete this activity");
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

    // Invalidate generated itinerary cache only (don't wipe saved itinerary)
    clearGeneratedItinerary(idea.tripId);

    // Return updated idea
    const { data: votes } = await supabase
      .from("Vote")
      .select("*, User(*)")
      .eq("ideaId", ideaId);

    const voteScore = votes?.reduce((sum, v) => sum + v.value, 0) || 0;
    const userVote = votes?.find(v => v.userId === user.id)?.value || 0;

    return {
      id: ideaId,
      voteScore,
      voteCount: votes?.length || 0,
      userVote,
      votes: (votes || []).map((vote) => ({
        userId: vote.userId,
        value: vote.value,
        name: vote.User?.name || "Traveler"
      }))
    };
  },

  async generateItinerary(tripId) {
    const trip = await this.getTrip(tripId);

    if (!trip) throw new Error("Trip not found");

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
  },

  async getLists(tripId, tabId) {
    let query = supabase
      .from("List")
      .select("*")
      .eq("tripId", tripId);

    if (tabId) {
      query = query.eq("tabId", tabId);
    }

    const { data: lists, error } = await query.order("order", { ascending: true });

    if (error) throw error;
    return lists || [];
  },

  async createList(tripId, name, tabId) {
    const normalizedName = normalizeListName(name);
    if (!normalizedName) {
      throw new Error("List name is required");
    }

    if (!tabId) {
      throw new Error("Tab id is required to create a list");
    }

    const { data: existingList, error: existingError } = await supabase
      .from("List")
      .select("*")
      .eq("tripId", tripId)
      .eq("tabId", tabId)
      .eq("name", normalizedName)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existingList) {
      return existingList;
    }

    let existingListQuery = supabase
      .from("List")
      .select("order")
      .eq("tripId", tripId);

    existingListQuery = existingListQuery.eq("tabId", tabId);

    const { data: existingLists } = await existingListQuery
      .order("order", { ascending: false })
      .limit(1);

    const nextOrder = (existingLists?.[0]?.order ?? -1) + 1;

    const payload = {
      id: crypto.randomUUID(),
      tripId,
      tabId,
      name: normalizedName,
      order: nextOrder,
      createdAt: new Date().toISOString()
    };

    const { data: list, error } = await supabase
      .from("List")
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (error.code === "23505" || /unique constraint/i.test(String(error.message || ""))) {
        const { data: fallbackList, error: fallbackError } = await supabase
          .from("List")
          .select("*")
          .eq("tripId", tripId)
          .eq("tabId", tabId)
          .eq("name", normalizedName)
          .maybeSingle();

        if (fallbackError) throw fallbackError;
        if (fallbackList) return fallbackList;
      }

      throw error;
    }
    return list;
  },

  async updateList(listId, name) {
    if (!name || !String(name).trim()) {
      throw new Error("List name is required");
    }

    const { data: list, error } = await supabase
      .from("List")
      .update({ name: String(name).trim() })
      .eq("id", listId)
      .select()
      .single();

    if (error) throw error;
    return list;
  },

  async deleteList(listId) {
    const { error } = await supabase
      .from("List")
      .delete()
      .eq("id", listId);

    if (error) throw error;
  }
};
