import { isPlaceLikeList, normalizeListName, slugify } from "./tripPlanning.js";

export const DESTINATION_LIST_NAME = "Destinations";

function getPlaceContextLabel(placeGroup, destination) {
  return String(placeGroup?.title || placeGroup?.locationLabel || destination?.name || destination?.label || "").trim();
}

function getSubmissionDetails(mode, listName, listId) {
  const normalizedListName = mode === "destination" ? DESTINATION_LIST_NAME : normalizeListName(listName);
  const isDestinationMode = mode === "destination";
  const normalizedListId = isDestinationMode ? slugify(DESTINATION_LIST_NAME) : String(listId || slugify(normalizedListName)).trim();

  return {
    normalizedListId,
    normalizedListName,
    isDestinationMode,
    isPlaceLike: isDestinationMode || isPlaceLikeList(normalizedListName)
  };
}

export function buildFreeformIdeaPayload(query, { mode, listId, listName, destination, placeGroup }) {
  const { normalizedListId, normalizedListName, isDestinationMode, isPlaceLike } = getSubmissionDetails(
    mode,
    listName,
    listId
  );
  const placeContextLabel = isDestinationMode ? "" : getPlaceContextLabel(placeGroup, destination);

  return {
    title: query,
    description: "",
    location: isPlaceLike ? query : placeContextLabel,
    category: normalizedListName || "",
    listId: normalizedListId,
    entryType: isPlaceLike ? "place" : "activity",
    parentIdeaId: isDestinationMode ? null : placeGroup?.id || null,
    mapQuery: isPlaceLike ? [query, placeContextLabel].filter(Boolean).join(", ") : "",
    recommendationSource: null
  };
}

export function buildResolvedIdeaPayload(placeMatch, { mode, listId, listName, placeGroup }) {
  const { normalizedListId, normalizedListName, isDestinationMode, isPlaceLike } = getSubmissionDetails(
    mode,
    listName,
    listId
  );

  return {
    title: placeMatch.title,
    description: "",
    location: placeMatch.address || placeMatch.title,
    category: normalizedListName || "",
    listId: normalizedListId,
    entryType: isDestinationMode ? "place" : normalizedListName ? (isPlaceLike ? "place" : "activity") : "place",
    parentIdeaId: isDestinationMode ? null : placeGroup?.id || null,
    mapQuery: placeMatch.mapQuery || placeMatch.address || placeMatch.title,
    coordinates: placeMatch.coordinates || null,
    photoUrl: placeMatch.photoUrl || "",
    photoAttributions: placeMatch.photoAttributions || [],
    recommendationSource: "Google Maps"
  };
}
