import { createHash } from "node:crypto";

function hashIdentifier(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";
  return createHash("sha256").update(normalized).digest("hex");
}

function sanitizeProperties(properties = {}) {
  const safe = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (["email", "inviteeEmail", "inviterEmail", "userEmail"].includes(key)) return;
    safe[key] = value;
  });
  return safe;
}

async function trackAmplitudeEvent({ eventType, userId, eventProperties }) {
  const apiKey = process.env.AMPLITUDE_API_KEY || process.env.VITE_AMPLITUDE_API_KEY;
  if (!apiKey) return;

  await fetch("https://api2.amplitude.com/2/httpapi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      events: [
        {
          event_type: eventType,
          user_id: userId,
          event_properties: eventProperties
        }
      ]
    })
  });
}

async function trackGa4Event({ eventType, userId, eventProperties }) {
  const measurementId = process.env.GA4_MEASUREMENT_ID || process.env.VITE_GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;
  if (!measurementId || !apiSecret) return;

  await fetch(
    `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: userId.slice(0, 36) || "tripable-server",
        user_id: userId,
        events: [
          {
            name: eventType,
            params: eventProperties
          }
        ]
      })
    }
  );
}

export async function trackServerAnalyticsEvent({
  eventType,
  tripId,
  userId,
  email,
  properties = {}
}) {
  const anonymousUserId = hashIdentifier(userId || email || "server-event") || "server-event";
  const eventProperties = sanitizeProperties({
    ...properties,
    trip_id: tripId,
    source: "server"
  });

  try {
    await Promise.allSettled([
      trackAmplitudeEvent({ eventType, userId: anonymousUserId, eventProperties }),
      trackGa4Event({ eventType, userId: anonymousUserId, eventProperties })
    ]);
  } catch {
    // Swallow analytics errors so product flows never fail on telemetry.
  }
}

export { hashIdentifier };
