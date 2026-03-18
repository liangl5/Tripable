const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAPS_MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

let googleMapsLoaderPromise = null;

export function canUseGoogleMapsJsApi() {
  return Boolean(GOOGLE_MAPS_API_KEY);
}

export function getGoogleMapsMapId() {
  return GOOGLE_MAPS_MAP_ID;
}

export async function loadGoogleMapsJsApi() {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Missing VITE_GOOGLE_MAPS_API_KEY");
  }

  if (window.google?.maps?.importLibrary) {
    return window.google.maps;
  }

  if (googleMapsLoaderPromise) {
    return googleMapsLoaderPromise;
  }

  googleMapsLoaderPromise = new Promise((resolve, reject) => {
    const callbackName = "__tripableGoogleMapsInit";
    const existingScript = document.querySelector("script[data-tripable-google-maps='true']");

    const cleanup = () => {
      try {
        delete window[callbackName];
      } catch {
        window[callbackName] = undefined;
      }
    };

    window[callbackName] = () => {
      cleanup();
      resolve(window.google.maps);
    };

    if (existingScript) {
      existingScript.addEventListener(
        "load",
        () => {
          cleanup();
          if (window.google?.maps) {
            resolve(window.google.maps);
            return;
          }
          googleMapsLoaderPromise = null;
          reject(new Error("Google Maps loaded without window.google.maps"));
        },
        { once: true }
      );
      existingScript.addEventListener(
        "error",
        () => {
          cleanup();
          googleMapsLoaderPromise = null;
          reject(new Error("Unable to load Google Maps JavaScript API"));
        },
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.tripableGoogleMaps = "true";
    script.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
      `&v=weekly&loading=async&libraries=marker&callback=${callbackName}`;
    script.onerror = () => {
      cleanup();
      googleMapsLoaderPromise = null;
      reject(new Error("Unable to load Google Maps JavaScript API"));
    };

    document.head.append(script);
  });

  return googleMapsLoaderPromise;
}
