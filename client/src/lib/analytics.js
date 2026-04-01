const GA_MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID || "";

let analyticsInitialized = false;
let initPromise = null;
let cachedAnonymousId = null;

function getGtag() {
  if (typeof window === "undefined") return null;
  if (typeof window.gtag !== "function") return null;
  return window.gtag;
}

function getAmplitude() {
  if (typeof window === "undefined") return null;
  if (!window.amplitude) return null;
  return window.amplitude;
}

function hasSubtleCrypto() {
  return typeof window !== "undefined" && Boolean(window.crypto?.subtle) && typeof TextEncoder !== "undefined";
}

async function sha256Hex(value) {
  if (!value) return "";
  if (!hasSubtleCrypto()) {
    return `anon_${String(value).toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(String(value));
  const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sanitizeProperties(properties = {}) {
  const safe = {};
  Object.entries(properties).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (["email", "user_email", "invitee_email", "inviter_email"].includes(key)) return;
    safe[key] = value;
  });
  return safe;
}

export async function getAnonymousIdentifier({ userId, email }) {
  const raw = String(userId || email || "guest").trim().toLowerCase();
  if (!raw) return "guest";
  return sha256Hex(raw);
}

export async function initAnalytics() {
  if (analyticsInitialized) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const hasGa = Boolean(getGtag());
    const hasAmplitude = Boolean(getAmplitude());

    analyticsInitialized = true;
    return hasGa || hasAmplitude;
  })();

  return initPromise;
}

export async function identifyUser({ userId, email, role }) {
  await initAnalytics();
  cachedAnonymousId = await getAnonymousIdentifier({ userId, email });

  const gtag = getGtag();
  if (gtag) {
    gtag("config", GA_MEASUREMENT_ID || "G-LKL1HJW6K4", { user_id: cachedAnonymousId });
  }

  const amplitude = getAmplitude();
  if (amplitude?.setUserId) {
    amplitude.setUserId(cachedAnonymousId);
  }
  if (amplitude?.setUserProperties) {
    amplitude.setUserProperties({
      trip_role: role || "member"
    });
  }

  return cachedAnonymousId;
}

export function resetAnalytics() {
  cachedAnonymousId = null;
  const gtag = getGtag();
  if (gtag) {
    gtag("config", GA_MEASUREMENT_ID || "G-LKL1HJW6K4", { user_id: undefined });
  }

  const amplitude = getAmplitude();
  if (amplitude?.reset) {
    amplitude.reset();
  }
}

export async function trackEvent(eventName, properties = {}) {
  await initAnalytics();
  const safeProperties = sanitizeProperties(properties);

  const gtag = getGtag();
  if (gtag) {
    gtag("event", eventName, safeProperties);
  }

  const amplitude = getAmplitude();
  if (amplitude?.track) {
    amplitude.track(eventName, safeProperties);
  }
}

export async function trackPageView(pathname, title = "Tripable") {
  await initAnalytics();
  const gtag = getGtag();
  if (gtag) {
    gtag("event", "page_view", {
      page_path: pathname,
      page_title: title
    });
  }

  const amplitude = getAmplitude();
  if (amplitude?.track) {
    amplitude.track("page_view", { path: pathname, title });
  }
}

export async function getOrCreateAnonymousId() {
  if (cachedAnonymousId) return cachedAnonymousId;
  cachedAnonymousId = await getAnonymousIdentifier({ userId: "anonymous" });
  return cachedAnonymousId;
}
