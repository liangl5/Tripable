const TRIP_META_STORAGE_KEY = "tripable.trip-meta.v2";
const IDEA_META_STORAGE_KEY = "tripable.idea-meta.v2";
const ITINERARY_STORAGE_KEY = "tripable.itinerary.v2";

export const DEFAULT_LIST_NAMES = ["Destinations", "Places to Visit", "Activities", "Food"];
export const DEFAULT_LISTS = DEFAULT_LIST_NAMES.map((name) => ({
  id: slugify(name),
  name
}));

export const DESTINATION_OPTIONS = [
  {
    id: "honolulu-hawaii-us",
    label: "Honolulu, Hawaii, United States",
    name: "Honolulu",
    type: "City",
    region: "Hawaii",
    country: "United States",
    mapQuery: "Honolulu, Hawaii",
    coordinates: { lat: 21.3099, lng: -157.8581 },
    summary: "Beach days, hikes, surf culture, and city energy in one trip."
  },
  {
    id: "maui-hawaii-us",
    label: "Maui, Hawaii, United States",
    name: "Maui",
    type: "Region",
    region: "Hawaii",
    country: "United States",
    mapQuery: "Maui, Hawaii",
    coordinates: { lat: 20.7984, lng: -156.3319 },
    summary: "Road trip views, snorkeling stops, and slower island days."
  },
  {
    id: "new-york-city-us",
    label: "New York City, New York, United States",
    name: "New York City",
    type: "City",
    region: "New York",
    country: "United States",
    mapQuery: "New York City",
    coordinates: { lat: 40.7128, lng: -74.006 },
    summary: "Broadway, neighborhoods, rooftop dinners, and nonstop options."
  },
  {
    id: "san-francisco-us",
    label: "San Francisco, California, United States",
    name: "San Francisco",
    type: "City",
    region: "California",
    country: "United States",
    mapQuery: "San Francisco, California",
    coordinates: { lat: 37.7749, lng: -122.4194 },
    summary: "Walkable neighborhoods, iconic views, and strong food scenes."
  },
  {
    id: "rome-italy",
    label: "Rome, Italy",
    name: "Rome",
    type: "City",
    region: "Lazio",
    country: "Italy",
    mapQuery: "Rome, Italy",
    coordinates: { lat: 41.9028, lng: 12.4964 },
    summary: "Historic landmarks, piazzas, late dinners, and easy wandering."
  },
  {
    id: "barcelona-spain",
    label: "Barcelona, Spain",
    name: "Barcelona",
    type: "City",
    region: "Catalonia",
    country: "Spain",
    mapQuery: "Barcelona, Spain",
    coordinates: { lat: 41.3874, lng: 2.1686 },
    summary: "Architecture, beach time, tapas nights, and creative neighborhoods."
  },
  {
    id: "lisbon-portugal",
    label: "Lisbon, Portugal",
    name: "Lisbon",
    type: "City",
    region: "Lisbon",
    country: "Portugal",
    mapQuery: "Lisbon, Portugal",
    coordinates: { lat: 38.7223, lng: -9.1393 },
    summary: "Viewpoints, tram rides, pastelarias, and easy group pacing."
  },
  {
    id: "tokyo-japan",
    label: "Tokyo, Japan",
    name: "Tokyo",
    type: "City",
    region: "Kanto",
    country: "Japan",
    mapQuery: "Tokyo, Japan",
    coordinates: { lat: 35.6762, lng: 139.6503 },
    summary: "Neighborhood hopping, food stalls, shrines, and late-night energy."
  },
  {
    id: "seoul-south-korea",
    label: "Seoul, South Korea",
    name: "Seoul",
    type: "City",
    region: "Seoul",
    country: "South Korea",
    mapQuery: "Seoul, South Korea",
    coordinates: { lat: 37.5665, lng: 126.978 },
    summary: "Markets, cafe culture, palaces, and modern street life."
  },
  {
    id: "paris-france",
    label: "Paris, France",
    name: "Paris",
    type: "City",
    region: "Ile-de-France",
    country: "France",
    mapQuery: "Paris, France",
    coordinates: { lat: 48.8566, lng: 2.3522 },
    summary: "Museum days, riverside walks, bakeries, and classic landmarks."
  },
  {
    id: "hawaii-us",
    label: "Hawaii, United States",
    name: "Hawaii",
    type: "Region",
    region: "Hawaii",
    country: "United States",
    mapQuery: "Hawaii",
    coordinates: { lat: 19.8968, lng: -155.5828 },
    summary: "A wider island plan for groups still choosing between beaches and adventures."
  },
  {
    id: "japan",
    label: "Japan",
    name: "Japan",
    type: "Country",
    region: "East Asia",
    country: "Japan",
    mapQuery: "Japan",
    coordinates: { lat: 36.2048, lng: 138.2529 },
    summary: "Country-level planning for multi-city trips, rail routes, and food stops."
  },
  {
    id: "italy",
    label: "Italy",
    name: "Italy",
    type: "Country",
    region: "Southern Europe",
    country: "Italy",
    mapQuery: "Italy",
    coordinates: { lat: 41.8719, lng: 12.5674 },
    summary: "Perfect when the group wants to compare cities before locking the route."
  }
];

const RECOMMENDATION_CATALOG = {
  "honolulu-hawaii-us": {
    "Places to Visit": [
      {
        title: "Diamond Head State Monument",
        description: "Classic crater hike with sunrise payoff and ocean views.",
        location: "Diamond Head Rd, Honolulu, HI 96815",
        entryType: "place",
        mapQuery: "Diamond Head State Monument Honolulu"
      },
      {
        title: "Iolani Palace",
        description: "Historic palace visit for a lighter city day.",
        location: "364 S King St, Honolulu, HI 96813",
        entryType: "place",
        mapQuery: "Iolani Palace Honolulu"
      },
      {
        title: "Waikiki Beach Walk",
        description: "Easy group-friendly waterfront stroll with shopping breaks.",
        location: "Waikiki Beach, Honolulu, HI",
        entryType: "place",
        mapQuery: "Waikiki Beach Honolulu"
      }
    ],
    Activities: [
      {
        title: "Sunset catamaran sail",
        description: "Low-effort, high-payoff group activity with open water views.",
        location: "Waikiki Harbor departure",
        entryType: "activity",
        mapQuery: "Waikiki Harbor Honolulu"
      },
      {
        title: "North Shore surf lesson",
        description: "A strong vote item when the group wants one adventurous day.",
        location: "North Shore pickup",
        entryType: "activity",
        mapQuery: "North Shore Oahu"
      },
      {
        title: "Snorkel day at Hanauma Bay",
        description: "Good anchor activity for one of the middle trip days.",
        location: "Hanauma Bay, Honolulu, HI",
        entryType: "activity",
        mapQuery: "Hanauma Bay Honolulu"
      }
    ],
    Food: [
      {
        title: "Duke's Waikiki dinner",
        description: "Reliable oceanfront dinner choice for a welcome-night meal.",
        location: "2335 Kalakaua Ave, Honolulu, HI 96815",
        entryType: "place",
        mapQuery: "Duke's Waikiki"
      },
      {
        title: "Leonard's Bakery malasadas",
        description: "Fast, iconic dessert stop between activities.",
        location: "933 Kapahulu Ave, Honolulu, HI 96816",
        entryType: "place",
        mapQuery: "Leonard's Bakery Honolulu"
      },
      {
        title: "Helena's Hawaiian Food",
        description: "Local-style meal when the group wants something less touristy.",
        location: "1240 N School St, Honolulu, HI 96817",
        entryType: "place",
        mapQuery: "Helena's Hawaiian Food Honolulu"
      }
    ]
  },
  "maui-hawaii-us": {
    "Places to Visit": [
      {
        title: "Road to Hana lookout stops",
        description: "Best for scenic drives and flexible photo stops.",
        location: "Hana Hwy, Maui, HI",
        entryType: "place",
        mapQuery: "Road to Hana Maui"
      },
      {
        title: "Haleakala National Park",
        description: "A signature Maui day with sunrise or sunset options.",
        location: "Haleakala National Park, Maui, HI",
        entryType: "place",
        mapQuery: "Haleakala National Park Maui"
      },
      {
        title: "Wailea Beach",
        description: "Easy beach day with nearby cafes and resorts.",
        location: "Wailea Beach, Maui, HI",
        entryType: "place",
        mapQuery: "Wailea Beach Maui"
      }
    ],
    Activities: [
      {
        title: "Molokini snorkel tour",
        description: "Great vote item for groups that want one premium excursion.",
        location: "Maalaea Harbor departure",
        entryType: "activity",
        mapQuery: "Maalaea Harbor Maui"
      },
      {
        title: "Upcountry farm tasting",
        description: "A slower inland day with food and scenic drives.",
        location: "Kula, Maui, HI",
        entryType: "activity",
        mapQuery: "Kula Maui"
      },
      {
        title: "Sunset beach picnic",
        description: "Low-budget option that still feels memorable.",
        location: "Kapalua Bay, Maui, HI",
        entryType: "activity",
        mapQuery: "Kapalua Bay Maui"
      }
    ],
    Food: [
      {
        title: "Mama's Fish House",
        description: "Big group dinner candidate worth voting on early.",
        location: "799 Poho Pl, Paia, HI 96779",
        entryType: "place",
        mapQuery: "Mama's Fish House Maui"
      },
      {
        title: "Paia Fish Market lunch",
        description: "Easy casual lunch stop before the north shore.",
        location: "100 Baldwin Ave, Paia, HI 96779",
        entryType: "place",
        mapQuery: "Paia Fish Market Maui"
      },
      {
        title: "Leoda's pie stop",
        description: "Quick dessert detour that works well on drive days.",
        location: "820 Olowalu Village Rd, Lahaina, HI 96761",
        entryType: "place",
        mapQuery: "Leoda's Kitchen and Pie Shop Maui"
      }
    ]
  },
  "new-york-city-us": {
    "Places to Visit": [
      {
        title: "The High Line",
        description: "Easy shared walk that lets the group drift into Chelsea.",
        location: "New York, NY 10011",
        entryType: "place",
        mapQuery: "The High Line New York"
      },
      {
        title: "Brooklyn Bridge sunset walk",
        description: "Works well as a bridge between daytime and dinner plans.",
        location: "Brooklyn Bridge, New York, NY",
        entryType: "place",
        mapQuery: "Brooklyn Bridge New York"
      },
      {
        title: "The Met",
        description: "Good anchor for one slower museum day.",
        location: "1000 5th Ave, New York, NY 10028",
        entryType: "place",
        mapQuery: "The Metropolitan Museum of Art"
      }
    ],
    Activities: [
      {
        title: "Broadway show night",
        description: "A high-demand item that benefits from early voting.",
        location: "Theater District, Manhattan",
        entryType: "activity",
        mapQuery: "Broadway Manhattan"
      },
      {
        title: "Rooftop bar crawl",
        description: "Best for a flexible late-night group slot.",
        location: "Midtown Manhattan",
        entryType: "activity",
        mapQuery: "Rooftop bars Midtown Manhattan"
      },
      {
        title: "Central Park bike loop",
        description: "Active daytime plan with simple logistics.",
        location: "Central Park, New York, NY",
        entryType: "activity",
        mapQuery: "Central Park bike rental"
      }
    ],
    Food: [
      {
        title: "Los Tacos No. 1",
        description: "Fast casual option that pleases big groups.",
        location: "75 9th Ave, New York, NY 10011",
        entryType: "place",
        mapQuery: "Los Tacos No. 1 Chelsea Market"
      },
      {
        title: "Katz's Delicatessen",
        description: "Classic stop when the group wants an iconic lunch.",
        location: "205 E Houston St, New York, NY 10002",
        entryType: "place",
        mapQuery: "Katz's Delicatessen"
      },
      {
        title: "L'Industrie pizza run",
        description: "Easy shared food stop in Williamsburg.",
        location: "254 S 2nd St, Brooklyn, NY 11211",
        entryType: "place",
        mapQuery: "L'Industrie Brooklyn"
      }
    ]
  },
  "rome-italy": {
    "Places to Visit": [
      {
        title: "Colosseum and Roman Forum",
        description: "The obvious vote leader for first-time Rome groups.",
        location: "Piazza del Colosseo, 1, 00184 Roma RM, Italy",
        entryType: "place",
        mapQuery: "Colosseum Rome"
      },
      {
        title: "Trastevere evening walk",
        description: "Great for a relaxed final-day plan before dinner.",
        location: "Trastevere, Rome, Italy",
        entryType: "place",
        mapQuery: "Trastevere Rome"
      },
      {
        title: "Villa Borghese gardens",
        description: "Useful reset when the group wants more breathing room.",
        location: "Piazzale Napoleone I, 00197 Roma RM, Italy",
        entryType: "place",
        mapQuery: "Villa Borghese Rome"
      }
    ],
    Activities: [
      {
        title: "Pasta-making class",
        description: "Interactive option for the day with the fewest sights.",
        location: "Central Rome class studio",
        entryType: "activity",
        mapQuery: "Pasta class Rome"
      },
      {
        title: "Vespa photo tour",
        description: "Good for a high-energy travel-content day.",
        location: "Rome historic center",
        entryType: "activity",
        mapQuery: "Vespa tour Rome"
      },
      {
        title: "Twilight fountain route",
        description: "Low-cost evening option covering Rome highlights.",
        location: "Centro Storico, Rome",
        entryType: "activity",
        mapQuery: "Trevi Fountain Rome"
      }
    ],
    Food: [
      {
        title: "Armando al Pantheon dinner",
        description: "Classic Roman meal for a splurge night.",
        location: "Salita de' Crescenzi, 31, 00186 Roma RM, Italy",
        entryType: "place",
        mapQuery: "Armando al Pantheon"
      },
      {
        title: "Roscioli bakery stop",
        description: "Great lunch break between sightseeing blocks.",
        location: "Via dei Giubbonari, 21, 00186 Roma RM, Italy",
        entryType: "place",
        mapQuery: "Roscioli Rome"
      },
      {
        title: "Gelato crawl in Monti",
        description: "Easy low-stakes add-on for the evening.",
        location: "Monti, Rome, Italy",
        entryType: "place",
        mapQuery: "Gelato Monti Rome"
      }
    ]
  },
  "tokyo-japan": {
    "Places to Visit": [
      {
        title: "Senso-ji and Asakusa",
        description: "Great starter day for market snacks and temple time.",
        location: "2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032, Japan",
        entryType: "place",
        mapQuery: "Senso-ji Tokyo"
      },
      {
        title: "Shibuya Sky",
        description: "Easy group win for a first-night city view.",
        location: "2 Chome-24-12 Shibuya, Tokyo 150-6145, Japan",
        entryType: "place",
        mapQuery: "Shibuya Sky"
      },
      {
        title: "Meiji Shrine",
        description: "Lighter cultural stop that pairs well with Harajuku.",
        location: "1-1 Yoyogikamizonocho, Shibuya, Tokyo 151-8557, Japan",
        entryType: "place",
        mapQuery: "Meiji Shrine Tokyo"
      }
    ],
    Activities: [
      {
        title: "Shinjuku izakaya night",
        description: "Easy social evening plan once everyone is settled.",
        location: "Shinjuku, Tokyo",
        entryType: "activity",
        mapQuery: "Shinjuku Tokyo"
      },
      {
        title: "TeamLab art afternoon",
        description: "A clean indoor option with strong group appeal.",
        location: "Toyosu, Tokyo",
        entryType: "activity",
        mapQuery: "teamLab Planets Tokyo"
      },
      {
        title: "Tsukiji food walk",
        description: "Best for a short morning block before other plans.",
        location: "Tsukiji, Tokyo",
        entryType: "activity",
        mapQuery: "Tsukiji Outer Market"
      }
    ],
    Food: [
      {
        title: "Sushi Dai breakfast queue",
        description: "Worth voting on if the group is willing to start early.",
        location: "6 Chome-5-1 Toyosu, Koto City, Tokyo 135-0061, Japan",
        entryType: "place",
        mapQuery: "Sushi Dai Tokyo"
      },
      {
        title: "Ichiran late-night ramen",
        description: "Flexible post-activity meal everyone understands.",
        location: "Shibuya, Tokyo",
        entryType: "place",
        mapQuery: "Ichiran Shibuya"
      },
      {
        title: "Depachika food hall run",
        description: "Easy group option when tastes are split.",
        location: "Tokyo Station area",
        entryType: "place",
        mapQuery: "Tokyo depachika food hall"
      }
    ]
  }
};

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MEMORY_STORAGE = new Map();

function readStorage(key, fallback) {
  if (!MEMORY_STORAGE.has(key)) {
    return fallback;
  }
  return MEMORY_STORAGE.get(key);
}

function writeStorage(key, value) {
  MEMORY_STORAGE.set(key, value);
}

function uniqueStrings(values) {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = normalizeListName(value);
    if (!normalized) return false;
    const slug = slugify(normalized);
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

function normalizeTripList(list) {
  if (typeof list === "string") {
    const normalizedName = normalizeListName(list);
    return normalizedName
      ? {
          id: slugify(normalizedName),
          name: normalizedName
        }
      : null;
  }

  const normalizedName = normalizeListName(list?.name);
  const templateMatch = DEFAULT_LISTS.find(
    (candidate) => candidate.id === String(list?.id || "").trim() || candidate.name === normalizedName
  );
  const normalizedId = String(list?.id || templateMatch?.id || slugify(normalizedName)).trim();

  if (!normalizedId || !normalizedName) {
    return null;
  }

  return {
    id: normalizedId,
    name: normalizedName
  };
}

function uniqueTripLists(values) {
  const seen = new Set();
  return (values || []).reduce((lists, list) => {
    const normalized = normalizeTripList(list);
    if (!normalized || seen.has(normalized.id)) {
      return lists;
    }

    seen.add(normalized.id);
    lists.push(normalized);
    return lists;
  }, []);
}

function normalizeTripLists(lists, legacyCustomLists = []) {
  if (Array.isArray(lists)) {
    return uniqueTripLists(lists);
  }

  return uniqueTripLists([
    ...DEFAULT_LISTS,
    ...uniqueStrings(legacyCustomLists || []).map((name) => ({
      id: slugify(name),
      name
    }))
  ]);
}

function findTripList(lists, listIdOrName) {
  const normalizedValue = String(listIdOrName || "").trim();
  if (!normalizedValue) return null;

  const normalizedSlug = slugify(normalizedValue);
  return (
    (lists || []).find((list) => list.id === normalizedValue) ||
    (lists || []).find((list) => slugify(list.name) === normalizedSlug) ||
    null
  );
}

function emptyTripMeta() {
  return {
    destination: null,
    invitees: [],
    lists: [...DEFAULT_LISTS],
    customLists: [],
    budgetTotal: "",
    expenses: []
  };
}

function sanitizeInvitees(invitees) {
  if (!Array.isArray(invitees)) return [];
  return invitees
    .map((invitee) => String(invitee || "").trim().toLowerCase())
    .filter(Boolean)
    .filter((invitee, index, array) => array.indexOf(invitee) === index);
}

function sanitizeExpenses(expenses) {
  if (!Array.isArray(expenses)) return [];
  return expenses
    .map((expense) => ({
      id: expense?.id || crypto.randomUUID(),
      title: String(expense?.title || "").trim() || "Expense",
      amount: Number(expense?.amount) || 0,
      paidBy: String(expense?.paidBy || "").trim() || "Group",
      category: normalizeListName(expense?.category) || "General",
      notes: String(expense?.notes || "").trim(),
      createdAt: expense?.createdAt || new Date().toISOString()
    }))
    .filter((expense) => expense.amount > 0);
}

function normalizeCoordinates(coordinates) {
  if (!coordinates || typeof coordinates !== "object") {
    return null;
  }

  const lat = Number(coordinates.lat);
  const lng = Number(coordinates.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

export function normalizeDestination(destination) {
  if (!destination) return null;
  const matched = getDestinationById(destination.id) || getDestinationByLabel(destination.label);
  if (matched) return matched;
  const label = String(destination.label || destination.name || "").trim();
  if (!label) return null;
  return {
    id: destination.id || slugify(label),
    label,
    name: String(destination.name || label).trim(),
    type: String(destination.type || "Destination").trim(),
    region: String(destination.region || "").trim(),
    country: String(destination.country || "").trim(),
    mapQuery: String(destination.mapQuery || label).trim(),
    coordinates: normalizeCoordinates(destination.coordinates),
    summary: String(destination.summary || "").trim()
  };
}

export function normalizeListName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isPlaceLikeList(listName) {
  const normalized = slugify(listName);
  return [
    "destination",
    "place",
    "food",
    "restaurant",
    "hotel",
    "stay",
    "visit",
    "cafe",
    "bar"
  ].some((token) => normalized.includes(token));
}

export function getDestinationById(id) {
  return DESTINATION_OPTIONS.find((destination) => destination.id === id) || null;
}

export function getDestinationByLabel(label) {
  const normalized = String(label || "").trim().toLowerCase();
  if (!normalized) return null;
  return DESTINATION_OPTIONS.find((destination) => destination.label.toLowerCase() === normalized) || null;
}

export function parseInvitees(value) {
  return sanitizeInvitees(
    String(value || "")
      .split(/[,\n;]/g)
      .map((segment) => segment.trim())
  );
}

export function getTripMeta(tripId) {
  if (!tripId) return emptyTripMeta();
  const allMeta = readStorage(TRIP_META_STORAGE_KEY, {});
  const tripMeta = allMeta[tripId] || {};
  const lists = normalizeTripLists(tripMeta.lists, tripMeta.customLists);
  return {
    ...emptyTripMeta(),
    ...tripMeta,
    destination: normalizeDestination(tripMeta.destination),
    lists,
    invitees: sanitizeInvitees(tripMeta.invitees),
    customLists: lists.map((list) => list.name),
    expenses: sanitizeExpenses(tripMeta.expenses),
    budgetTotal: tripMeta.budgetTotal === "" ? "" : String(tripMeta.budgetTotal ?? "")
  };
}

export function saveTripMeta(tripId, patch) {
  if (!tripId) return emptyTripMeta();
  const allMeta = readStorage(TRIP_META_STORAGE_KEY, {});
  const nextMeta = {
    ...getTripMeta(tripId),
    ...patch
  };
  nextMeta.destination = normalizeDestination(nextMeta.destination);
  nextMeta.lists = normalizeTripLists(nextMeta.lists, nextMeta.customLists);
  nextMeta.invitees = sanitizeInvitees(nextMeta.invitees);
  nextMeta.customLists = nextMeta.lists.map((list) => list.name);
  nextMeta.expenses = sanitizeExpenses(nextMeta.expenses);
  nextMeta.budgetTotal = nextMeta.budgetTotal === "" ? "" : String(nextMeta.budgetTotal ?? "");
  allMeta[tripId] = nextMeta;
  writeStorage(TRIP_META_STORAGE_KEY, allMeta);
  return nextMeta;
}

export function pruneTripMeta(tripId, fields = []) {
  if (!tripId) return;
  const allMeta = readStorage(TRIP_META_STORAGE_KEY, {});
  const tripMeta = { ...(allMeta[tripId] || {}) };
  const normalizedFields = Array.isArray(fields) ? fields : [];

  normalizedFields.forEach((field) => {
    delete tripMeta[field];
    if (field === "lists") {
      delete tripMeta.customLists;
    }
  });

  if (!Object.keys(tripMeta).length) {
    delete allMeta[tripId];
  } else {
    allMeta[tripId] = tripMeta;
  }

  writeStorage(TRIP_META_STORAGE_KEY, allMeta);
}

export function removeTripMeta(tripId) {
  if (!tripId) return;
  const allMeta = readStorage(TRIP_META_STORAGE_KEY, {});
  delete allMeta[tripId];
  writeStorage(TRIP_META_STORAGE_KEY, allMeta);
}

export function addCustomList(tripId, listName) {
  const normalized = normalizeListName(listName);
  if (!normalized) return getTripMeta(tripId);
  const meta = getTripMeta(tripId);
  const nextList = {
    id: slugify(normalized),
    name: normalized
  };

  if (findTripList(meta.lists, nextList.id) || findTripList(meta.lists, nextList.name)) {
    return meta;
  }

  return saveTripMeta(tripId, { lists: [...meta.lists, nextList] });
}

export function removeCustomList(tripId, listIdOrName) {
  const meta = getTripMeta(tripId);
  const matchedList = findTripList(meta.lists, listIdOrName);
  if (!matchedList) return meta;
  return saveTripMeta(tripId, {
    lists: meta.lists.filter((candidate) => candidate.id !== matchedList.id)
  });
}

export function renameCustomList(tripId, currentListIdOrName, nextListName) {
  const nextNormalized = normalizeListName(nextListName);
  if (!nextNormalized) return getTripMeta(tripId);

  const meta = getTripMeta(tripId);
  const matchedList = findTripList(meta.lists, currentListIdOrName);
  if (!matchedList) return meta;

  return saveTripMeta(tripId, {
    lists: meta.lists.map((candidate) =>
      candidate.id === matchedList.id
        ? {
            ...candidate,
            name: nextNormalized
          }
        : candidate
    )
  });
}

export function updateTripBudget(tripId, budgetTotal) {
  return saveTripMeta(tripId, { budgetTotal: budgetTotal === "" ? "" : String(budgetTotal) });
}

export function addTripExpense(tripId, expense) {
  const meta = getTripMeta(tripId);
  const nextExpense = {
    id: crypto.randomUUID(),
    title: String(expense?.title || "").trim(),
    amount: Number(expense?.amount) || 0,
    paidBy: String(expense?.paidBy || "").trim(),
    category: normalizeListName(expense?.category) || "General",
    notes: String(expense?.notes || "").trim(),
    createdAt: new Date().toISOString()
  };

  if (!nextExpense.title || nextExpense.amount <= 0) {
    return meta;
  }

  return saveTripMeta(tripId, { expenses: [nextExpense, ...meta.expenses] });
}

export function removeTripExpense(tripId, expenseId) {
  const meta = getTripMeta(tripId);
  return saveTripMeta(tripId, {
    expenses: meta.expenses.filter((expense) => expense.id !== expenseId)
  });
}

export function getTripLists(tripOrId) {
  if (typeof tripOrId === "string") {
    return getTripMeta(tripOrId).lists;
  }

  return normalizeTripLists(tripOrId?.lists, tripOrId?.customLists);
}

export function hydrateTrip(trip) {
  if (!trip?.id) return trip;
  const meta = getTripMeta(trip.id);
  const persistedDestination = normalizeDestination(trip.destination);
  const persistedLists = Array.isArray(trip.lists) ? normalizeTripLists(trip.lists) : null;
  const lists = persistedLists || meta.lists;
  const invitees = Array.isArray(trip.invitees) ? sanitizeInvitees(trip.invitees) : meta.invitees;
  const expenses = Array.isArray(trip.expenses) ? sanitizeExpenses(trip.expenses) : meta.expenses;
  const budgetTotal =
    trip.budgetTotal === undefined || trip.budgetTotal === null
      ? meta.budgetTotal
      : trip.budgetTotal === ""
        ? ""
        : String(trip.budgetTotal);

  return {
    ...trip,
    destination: persistedDestination || meta.destination,
    invitees,
    lists,
    customLists: lists.map((list) => list.name),
    budgetTotal,
    expenses
  };
}

function getAllIdeaMeta() {
  return readStorage(IDEA_META_STORAGE_KEY, {});
}

export function getIdeaMeta(tripId, ideaId) {
  if (!tripId || !ideaId) return {};
  const allMeta = getAllIdeaMeta();
  return allMeta[tripId]?.[ideaId] || {};
}

export function saveIdeaMeta(tripId, ideaId, patch) {
  if (!tripId || !ideaId) return {};
  const allMeta = getAllIdeaMeta();
  const tripMeta = allMeta[tripId] || {};
  const nextIdeaMeta = {
    ...tripMeta[ideaId],
    ...patch
  };
  allMeta[tripId] = {
    ...tripMeta,
    [ideaId]: nextIdeaMeta
  };
  writeStorage(IDEA_META_STORAGE_KEY, allMeta);
  return nextIdeaMeta;
}

export function removeIdeaMeta(tripId, ideaId) {
  if (!tripId || !ideaId) return;
  const allMeta = getAllIdeaMeta();
  const tripMeta = { ...(allMeta[tripId] || {}) };
  delete tripMeta[ideaId];
  allMeta[tripId] = tripMeta;
  writeStorage(IDEA_META_STORAGE_KEY, allMeta);
}

export function clearIdeaMeta(tripId) {
  if (!tripId) return;
  const allMeta = getAllIdeaMeta();
  delete allMeta[tripId];
  writeStorage(IDEA_META_STORAGE_KEY, allMeta);
}

function inferEntryType(idea, meta) {
  if (idea?.entryType === "place" || idea?.entryType === "activity") {
    return idea.entryType;
  }
  if (meta.entryType === "place" || meta.entryType === "activity") {
    return meta.entryType;
  }
  const category = String(idea?.category || "").toLowerCase();
  if (category.includes("food") || category.includes("place")) {
    return "place";
  }
  return "activity";
}

export function hydrateIdea(tripId, idea) {
  if (!idea?.id) return idea;
  const meta = getIdeaMeta(tripId, idea.id);
  const entryType = inferEntryType(idea, meta);
  const listName = normalizeListName(idea.category || meta.listName || "");
  const listId = String(idea.listId || meta.listId || slugify(listName)).trim();
  const mapQuery = String(idea.mapQuery || meta.mapQuery || (entryType === "place" ? idea.location || "" : "")).trim();
  const locationLabel = String(idea.location || (entryType === "activity" ? "Flexible activity" : "")).trim();
  const coordinates = normalizeCoordinates(idea.coordinates || meta.coordinates);
  const parentIdeaId = String(idea.parentIdeaId || meta.parentIdeaId || "").trim();
  const photoUrl = String(idea.photoUrl || meta.photoUrl || "").trim();
  const photoAttributions = Array.isArray(idea.photoAttributions)
    ? idea.photoAttributions
    : Array.isArray(meta.photoAttributions)
      ? meta.photoAttributions
      : [];
  const recommendationSource = idea.recommendationSource || meta.recommendationSource || null;

  return {
    ...idea,
    listName,
    listId: listId || slugify(listName),
    entryType,
    parentIdeaId: parentIdeaId || null,
    hasMapLocation: Boolean(mapQuery || coordinates),
    mapQuery,
    coordinates,
    photoUrl,
    photoAttributions,
    locationLabel,
    recommendationSource
  };
}

export function hydrateIdeas(tripId, ideas) {
  return (ideas || []).map((idea) => hydrateIdea(tripId, idea));
}

export function getRecommendations(destination, listName) {
  const normalizedListName = normalizeListName(listName) || DEFAULT_LIST_NAMES[0];
  const matchedDestination = normalizeDestination(destination);
  const recommended =
    (matchedDestination?.id && RECOMMENDATION_CATALOG[matchedDestination.id]?.[normalizedListName]) || [];

  if (recommended.length > 0) {
    return recommended.map((item) => ({
      ...item,
      listName: normalizedListName,
      recommendationSource: matchedDestination?.label || "Curated suggestions"
    }));
  }

  const placeLabel = matchedDestination?.name || matchedDestination?.label || "this destination";

  if (normalizedListName === "Food") {
    return [
      {
        title: `${placeLabel} signature dinner`,
        description: "Well-known dining area with crowd-pleasing dinner options.",
        location: `Top-rated restaurant district in ${placeLabel}`,
        entryType: "place",
        mapQuery: `best restaurants in ${placeLabel}`,
        listName: normalizedListName,
        recommendationSource: "Local fallback"
      },
      {
        title: `${placeLabel} food hall stop`,
        description: "Casual food hall with multiple vendors and easy group seating.",
        location: `Food hall in ${placeLabel}`,
        entryType: "place",
        mapQuery: `food hall in ${placeLabel}`,
        listName: normalizedListName,
        recommendationSource: "Local fallback"
      },
      {
        title: `${placeLabel} cafe morning`,
        description: "Popular cafe stop for coffee, pastries, and a slower start.",
        location: `Popular cafe in ${placeLabel}`,
        entryType: "place",
        mapQuery: `best cafes in ${placeLabel}`,
        listName: normalizedListName,
        recommendationSource: "Local fallback"
      }
    ];
  }

  if (normalizedListName === "Activities") {
    return [
      {
        title: `${placeLabel} walking tour`,
        description: "Guided walk through a central part of the destination with major sights.",
        location: `City center of ${placeLabel}`,
        entryType: "activity",
        mapQuery: `${placeLabel} walking tour`,
        listName: normalizedListName,
        recommendationSource: "Local fallback"
      },
      {
        title: `${placeLabel} sunset outing`,
        description: "Scenic evening stop known for open views and a relaxed pace.",
        location: `Best sunset spot in ${placeLabel}`,
        entryType: "activity",
        mapQuery: `sunset spots in ${placeLabel}`,
        listName: normalizedListName,
        recommendationSource: "Local fallback"
      },
      {
        title: `${placeLabel} market afternoon`,
        description: "Local market area with browsing, snacks, and people-watching.",
        location: `Top market in ${placeLabel}`,
        entryType: "activity",
        mapQuery: `markets in ${placeLabel}`,
        listName: normalizedListName,
        recommendationSource: "Local fallback"
      }
    ];
  }

  return [
    {
      title: `${placeLabel} landmark circuit`,
      description: "A cluster of major landmarks that works well for a first overview.",
      location: `Top landmarks in ${placeLabel}`,
      entryType: "place",
      mapQuery: `top landmarks in ${placeLabel}`,
      listName: normalizedListName,
      recommendationSource: "Local fallback"
    },
    {
      title: `${placeLabel} scenic viewpoint`,
      description: "Elevated or open-air viewpoint with strong city or landscape views.",
      location: `Best viewpoint in ${placeLabel}`,
      entryType: "place",
      mapQuery: `scenic viewpoints in ${placeLabel}`,
      listName: normalizedListName,
      recommendationSource: "Local fallback"
    },
    {
      title: `${placeLabel} neighborhood day`,
      description: "Walkable neighborhood with shops, cafes, and space to wander.",
      location: `Most walkable area in ${placeLabel}`,
      entryType: "place",
      mapQuery: `best neighborhoods in ${placeLabel}`,
      listName: normalizedListName,
      recommendationSource: "Local fallback"
    }
  ];
}

function getTripDayCount(trip) {
  if (!trip?.startDate || !trip?.endDate) return 0;
  const start = new Date(trip.startDate);
  const end = new Date(trip.endDate);
  const diff = Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Number.isNaN(diff) ? 0 : Math.max(1, diff + 1);
}

function formatDate(date) {
  if (!date) return "";
  return new Date(date).toISOString().slice(0, 10);
}

function createDayDate(startDate, offset) {
  if (!startDate) return "";
  const date = new Date(startDate);
  date.setUTCDate(date.getUTCDate() + offset);
  return formatDate(date);
}

function getTimeLabel(item, slotIndex) {
  const activitySlots = ["Morning", "Late Morning", "Afternoon", "Sunset"];
  const foodSlots = ["Breakfast", "Lunch", "Dinner"];
  if (item.listName === "Food") {
    return foodSlots[slotIndex % foodSlots.length];
  }
  return activitySlots[slotIndex % activitySlots.length];
}

export function createItineraryDraft(trip, ideas) {
  const hydratedIdeas = hydrateIdeas(trip?.id, ideas || [])
    .filter((idea) => idea.listId !== slugify("Destinations"))
    .filter((idea) => idea.voteScore >= 0)
    .sort((a, b) => {
      if (b.voteScore !== a.voteScore) return b.voteScore - a.voteScore;
      if (a.entryType !== b.entryType) return a.entryType === "place" ? -1 : 1;
      return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
    });

  const items =
    hydratedIdeas.length > 0
      ? hydratedIdeas
      : hydrateIdeas(trip?.id, ideas || []).filter((idea) => idea.listId !== slugify("Destinations"));
  const totalDays = Math.max(1, getTripDayCount(trip) || Math.min(Math.max(items.length, 1), 3));

  const days = Array.from({ length: totalDays }, (_, index) => ({
    dayNumber: index + 1,
    date: createDayDate(trip?.startDate, index),
    locationLabel: trip?.destination?.name || trip?.name || "Trip day",
    items: []
  }));

  items.forEach((idea, index) => {
    const dayIndex = index % totalDays;
    const day = days[dayIndex];
    const slotIndex = day.items.length;
    day.items.push({
      id: `${trip?.id || "trip"}-${day.dayNumber}-${slotIndex + 1}`,
      order: slotIndex + 1,
      title: idea.title,
      location: idea.locationLabel || idea.location || "Flexible",
      listName: idea.listName,
      entryType: idea.entryType,
      note: idea.description,
      timeLabel: getTimeLabel(idea, slotIndex),
      voteScore: idea.voteScore
    });
    if (idea.hasMapLocation) {
      day.locationLabel = idea.locationLabel || idea.location || day.locationLabel;
    }
  });

  return {
    tripId: trip?.id,
    generatedAt: new Date().toISOString(),
    days
  };
}

export function saveGeneratedItinerary(tripId, itinerary) {
  return itinerary;
}

export function getGeneratedItinerary(tripId) {
  if (!tripId) return null;
  return null;
}

export function clearGeneratedItinerary(tripId) {
  if (!tripId) return;
}

export function getBudgetSummary(trip) {
  const budgetTotal = Number(trip?.budgetTotal) || 0;
  const expenses = sanitizeExpenses(trip?.expenses || []);
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = budgetTotal - spent;
  const memberCount = Math.max(Number(trip?.memberCount) || 0, 1);
  const perPerson = spent / memberCount;
  const byCategory = Object.entries(
    expenses.reduce((groups, expense) => {
      groups[expense.category] = (groups[expense.category] || 0) + expense.amount;
      return groups;
    }, {})
  )
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    budgetTotal,
    spent,
    remaining,
    perPerson,
    expenses,
    byCategory
  };
}

export function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

export { slugify };
