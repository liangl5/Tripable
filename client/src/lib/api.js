const API_BASE = "/api";

function getUserId() {
  const stored = localStorage.getItem("tripute_user_id");
  if (stored) return stored;
  const generated = crypto.randomUUID();
  localStorage.setItem("tripute_user_id", generated);
  return generated;
}

export function getCurrentUserId() {
  return getUserId();
}

function getUserName() {
  const stored = localStorage.getItem("tripute_user_name");
  if (stored) return stored;
  return "";
}

async function readErrorMessage(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = await response.json();
      if (data && typeof data === "object" && "message" in data) {
        return String(data.message);
      }
      return JSON.stringify(data);
    } catch {
      return "Request failed";
    }
  }

  try {
    const text = await response.text();
    if (!text) return "Request failed";
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === "object" && "message" in parsed) {
        return String(parsed.message);
      }
    } catch {
      // ignore
    }
    return text;
  } catch {
    return "Request failed";
  }
}

async function apiFetch(path, options = {}) {
  const userId = getUserId();
  const userName = getUserName();
  const response = await fetch(`${API_BASE}${path}`,
    {
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(userName ? { "x-user-name": userName } : {}),
        ...(options.headers || {})
      },
      ...options
    }
  );

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  getTrips: () => apiFetch("/trips"),
  getTrip: (tripId) => apiFetch(`/trips/${tripId}`),
  createTrip: (payload) => apiFetch("/trips", { method: "POST", body: JSON.stringify(payload) }),
  deleteTrip: (tripId) => apiFetch(`/trips/${tripId}`, { method: "DELETE" }),
  updateTripDates: (tripId, payload) =>
    apiFetch(`/trips/${tripId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateTripLeaders: (tripId, payload) =>
    apiFetch(`/trips/${tripId}/leaders`, { method: "PUT", body: JSON.stringify(payload) }),
  updateTripSurveyDates: (tripId, payload) =>
    apiFetch(`/trips/${tripId}/survey-dates`, { method: "PUT", body: JSON.stringify(payload) }),
  updateTripAvailability: (tripId, payload) =>
    apiFetch(`/trips/${tripId}/availability`, { method: "PUT", body: JSON.stringify(payload) }),
  joinTrip: (tripId) => apiFetch(`/trips/${tripId}/join`, { method: "POST" }),
  getIdeas: (tripId) => apiFetch(`/trips/${tripId}/ideas`),
  createIdea: (tripId, payload) => apiFetch(`/trips/${tripId}/ideas`, { method: "POST", body: JSON.stringify(payload) }),
  voteIdea: (ideaId, value) => apiFetch(`/ideas/${ideaId}/vote`, { method: "POST", body: JSON.stringify({ value }) }),
  generateItinerary: (tripId) => apiFetch(`/trips/${tripId}/generate-itinerary`, { method: "POST" }),
  getItinerary: (tripId) => apiFetch(`/trips/${tripId}/itinerary`)
};
