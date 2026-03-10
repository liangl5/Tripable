const API_BASE = "/api";

function getUserId() {
  const stored = localStorage.getItem("tripute_user_id");
  if (stored) return stored;
  const generated = crypto.randomUUID();
  localStorage.setItem("tripute_user_id", generated);
  return generated;
}

async function apiFetch(path, options = {}) {
  const userId = getUserId();
  const response = await fetch(`${API_BASE}${path}`,
    {
      headers: {
        "Content-Type": "application/json",
        "x-user-id": userId,
        ...(options.headers || {})
      },
      ...options
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  if (response.status === 204) return null;
  return response.json();
}

export const api = {
  getTrips: () => apiFetch("/trips"),
  getTrip: (tripId) => apiFetch(`/trips/${tripId}`),
  createTrip: (payload) => apiFetch("/trips", { method: "POST", body: JSON.stringify(payload) }),
  joinTrip: (tripId) => apiFetch(`/trips/${tripId}/join`, { method: "POST" }),
  getIdeas: (tripId) => apiFetch(`/trips/${tripId}/ideas`),
  createIdea: (tripId, payload) => apiFetch(`/trips/${tripId}/ideas`, { method: "POST", body: JSON.stringify(payload) }),
  voteIdea: (ideaId, value) => apiFetch(`/ideas/${ideaId}/vote`, { method: "POST", body: JSON.stringify({ value }) }),
  generateItinerary: (tripId) => apiFetch(`/trips/${tripId}/generate-itinerary`, { method: "POST" }),
  getItinerary: (tripId) => apiFetch(`/trips/${tripId}/itinerary`)
};
