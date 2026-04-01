import { hashIdentifier, trackServerAnalyticsEvent } from "./_analytics.js";

const ALLOWED_EVENTS = new Set(["trip_invite_accepted_server", "trip_invite_declined_server"]);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { eventType, tripId, userId, email } = req.body || {};
  if (!tripId || !eventType || !ALLOWED_EVENTS.has(eventType)) {
    return res.status(400).json({ error: "Missing or invalid event payload" });
  }

  await trackServerAnalyticsEvent({
    eventType,
    tripId,
    userId,
    email,
    properties: {
      invitee_hash: hashIdentifier(email),
      status: eventType.includes("accepted") ? "accepted" : "declined"
    }
  });

  return res.status(200).json({ ok: true });
}
