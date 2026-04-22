const tripBackgroundModules = import.meta.glob("../../imgs/trip_bg/*.{png,jpg,jpeg,webp}", {
  eager: true,
  query: "?url",
  import: "default"
});

const toImageUrl = (moduleValue) => {
  if (typeof moduleValue === "string") return moduleValue;
  return moduleValue?.default || "";
};

const formatBackgroundLabel = (fileName) =>
  String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

export const TRIP_BACKGROUND_OPTIONS = Object.entries(tripBackgroundModules)
  .map(([path, moduleValue]) => {
    const id = path.split("/").pop();
    return {
      id,
      src: toImageUrl(moduleValue),
      label: formatBackgroundLabel(id)
    };
  })
  .filter((option) => option.id && option.src)
  .sort((a, b) => a.label.localeCompare(b.label));

const TRIP_BACKGROUND_IDS = new Set(TRIP_BACKGROUND_OPTIONS.map((option) => option.id));

export const DEFAULT_TRIP_BACKGROUND_IMAGE = TRIP_BACKGROUND_OPTIONS[0]?.id || null;

export function normalizeTripBackgroundImage(value) {
  const imageName = String(value || "").trim();
  return TRIP_BACKGROUND_IDS.has(imageName) ? imageName : null;
}

export function getTripBackgroundOption(value) {
  const imageName = normalizeTripBackgroundImage(value) || DEFAULT_TRIP_BACKGROUND_IMAGE;
  return TRIP_BACKGROUND_OPTIONS.find((option) => option.id === imageName) || TRIP_BACKGROUND_OPTIONS[0] || null;
}

export function getRandomTripBackgroundImage() {
  if (!TRIP_BACKGROUND_OPTIONS.length) return null;
  const randomIndex = Math.floor(Math.random() * TRIP_BACKGROUND_OPTIONS.length);
  return TRIP_BACKGROUND_OPTIONS[randomIndex].id;
}
