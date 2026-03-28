import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api.js";
import {
  canUseGoogleMapsJsApi,
  getGoogleMapsMapId,
  loadGoogleMapsJsApi
} from "../lib/googleMaps.js";

function buildMapUrl(query) {
  const encoded = encodeURIComponent(query || "United States");
  return `https://www.google.com/maps?output=embed&q=${encoded}`;
}

function truncateMarkerTitle(value) {
  const title = String(value || "").trim();
  if (!title) return "Plan item";
  if (title.length <= 32) return title;
  return `${title.slice(0, 29)}...`;
}

function createMarkerTooltipContent(value) {
  const label = String(value || "").trim() || "Plan item";
  const node = document.createElement("div");
  node.style.padding = "2px 4px";
  node.style.fontSize = "12px";
  node.style.fontWeight = "600";
  node.style.lineHeight = "1.25";
  node.style.color = "#1f2937";
  node.textContent = label;
  return node;
}

function createAdvancedMarkerContent(PinElement, title) {
  const pin = new PinElement({
    background: "#4F68F5",
    borderColor: "#3B4ED6",
    glyphColor: "#FFFFFF",
    glyphText: String(title || "").trim().slice(0, 1).toUpperCase()
  });

  return pin.element;
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

export default function TripMapPanel({
  destination,
  activeQuery,
  mappedIdeas,
  onFocusLocation,
  immersive = false
}) {
  const fallbackQuery = destination?.mapQuery || destination?.label || "United States";
  const fallbackPosition = useMemo(
    () => normalizeCoordinates(destination?.coordinates),
    [destination?.coordinates]
  );
  const mapQuery = activeQuery || fallbackQuery;
  const mappedMarkerIdeas = useMemo(
    () => (mappedIdeas || []).filter((idea) => idea?.mapQuery),
    [mappedIdeas]
  );
  const visibleIdeas = useMemo(
    () => mappedMarkerIdeas.slice(0, immersive ? 5 : 6),
    [immersive, mappedMarkerIdeas]
  );
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const markerLookupRef = useRef(new Map());
  const locationCacheRef = useRef(new Map());
  const infoWindowRef = useRef(null);
  const persistentInfoWindowsRef = useRef([]);
  const [jsMapReady, setJsMapReady] = useState(false);
  const [jsMapError, setJsMapError] = useState("");
  const [showAllNames, setShowAllNames] = useState(false);

  async function resolveCoordinates(query) {
    const normalizedQuery = String(query || "").trim();
    if (!normalizedQuery) {
      return null;
    }

    if (locationCacheRef.current.has(normalizedQuery)) {
      return locationCacheRef.current.get(normalizedQuery);
    }

    const locationPromise = api.resolveMapLocation(normalizedQuery)
      .catch(() => null);

    locationCacheRef.current.set(normalizedQuery, locationPromise);
    return locationPromise;
  }

  useEffect(() => {
    if (!immersive || !canUseGoogleMapsJsApi() || !mapContainerRef.current) {
      return;
    }

    let cancelled = false;

    const initializeMap = async () => {
      try {
        const googleMaps = await loadGoogleMapsJsApi();
        await googleMaps.importLibrary("marker");
        if (cancelled || !mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
          mapInstanceRef.current = new googleMaps.Map(mapContainerRef.current, {
            center: { lat: 20, lng: 0 },
            zoom: 3,
            mapId: getGoogleMapsMapId(),
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            gestureHandling: "greedy"
          });
        }

        if (!cancelled) {
          setJsMapError("");
          setJsMapReady(true);
        }
      } catch (error) {
        console.error("Unable to initialize Google Maps", error);
        if (!cancelled) {
          setJsMapReady(false);
          setJsMapError("Unable to load the interactive map.");
        }
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, [immersive]);

  useEffect(() => {
    if (!immersive || !jsMapReady || !mapInstanceRef.current) {
      return;
    }

    let cancelled = false;

    const clearMarkers = () => {
      if (infoWindowRef.current) {
        infoWindowRef.current.close();
      }
      persistentInfoWindowsRef.current.forEach((infoWindow) => infoWindow.close());
      persistentInfoWindowsRef.current = [];
      markersRef.current.forEach(({ cleanup, marker }) => {
        cleanup?.();
        window.google?.maps?.event?.clearInstanceListeners?.(marker);
        marker.map = null;
      });
      markersRef.current = [];
      markerLookupRef.current = new Map();
    };

    const renderMarkers = async () => {
      const googleMaps = window.google?.maps;
      if (!googleMaps || cancelled) return;
      const markerLibrary = await googleMaps.importLibrary("marker");
      if (cancelled) return;
      const { AdvancedMarkerElement, PinElement } = markerLibrary;

      clearMarkers();

      const map = mapInstanceRef.current;
      const bounds = new googleMaps.LatLngBounds();
      const nextMarkers = [];
      let firstMarkerPosition = null;
      if (!infoWindowRef.current) {
        infoWindowRef.current = new googleMaps.InfoWindow({
          disableAutoPan: true,
          headerDisabled: true
        });
      }

      for (const idea of mappedMarkerIdeas) {
        const position =
          normalizeCoordinates(idea.coordinates) ||
          (idea.mapQuery ? await resolveCoordinates(idea.mapQuery) : null);
        if (cancelled || !position) continue;

        const markerLabel = String(idea.title || idea.locationLabel || idea.mapQuery || "Plan item").trim();
        const markerTitle = truncateMarkerTitle(markerLabel);
        const markerContent = createAdvancedMarkerContent(PinElement, markerLabel);
        const marker = new AdvancedMarkerElement({
          map,
          position,
          title: markerTitle,
          content: markerContent
        });
        const openHoverLabel = () => {
          infoWindowRef.current?.setContent(createMarkerTooltipContent(markerLabel));
          infoWindowRef.current?.open({
            anchor: marker,
            map,
            shouldFocus: false
          });
        };
        const closeHoverLabel = () => {
          infoWindowRef.current?.close();
        };
        const cleanup = () => {
          markerContent.removeEventListener("mouseenter", openHoverLabel);
          markerContent.removeEventListener("mouseleave", closeHoverLabel);
        };

        if (showAllNames) {
          const persistentInfoWindow = new googleMaps.InfoWindow({
            content: createMarkerTooltipContent(markerLabel),
            disableAutoPan: true,
            headerDisabled: true,
            pixelOffset: new googleMaps.Size(0, -28)
          });
          persistentInfoWindow.open({
            anchor: marker,
            map,
            shouldFocus: false
          });
          persistentInfoWindowsRef.current.push(persistentInfoWindow);
        } else {
          markerContent.addEventListener("mouseenter", openHoverLabel);
          markerContent.addEventListener("mouseleave", closeHoverLabel);
        }

        if (!firstMarkerPosition) {
          firstMarkerPosition = position;
        }
        nextMarkers.push({ cleanup, marker });
        markerLookupRef.current.set(idea.id, { position, query: idea.mapQuery, title: markerTitle });
        markerLookupRef.current.set(idea.mapQuery, { position, query: idea.mapQuery, title: markerTitle });
        bounds.extend(position);
      }

      markersRef.current = nextMarkers;

      if (cancelled) return;

      if (nextMarkers.length === 1) {
        if (firstMarkerPosition) {
          map.setCenter(firstMarkerPosition);
          map.setZoom(14);
          return;
        }
      }

      if (nextMarkers.length > 1) {
        map.fitBounds(bounds, 72);
        return;
      }

      const destinationPosition = fallbackPosition || await resolveCoordinates(fallbackQuery);
      if (cancelled || !destinationPosition) return;
      map.setCenter(destinationPosition);
      map.setZoom(11);
    };

    renderMarkers();

    return () => {
      cancelled = true;
      clearMarkers();
    };
  }, [fallbackPosition, fallbackQuery, immersive, jsMapReady, mappedMarkerIdeas, showAllNames]);

  useEffect(() => {
    if (!immersive || !jsMapReady || !mapInstanceRef.current || !activeQuery) {
      return;
    }

    let cancelled = false;

    const focusSelection = async () => {
      const map = mapInstanceRef.current;
      const matchedMarker = markerLookupRef.current.get(activeQuery);

      if (matchedMarker) {
        map.panTo(matchedMarker.position);
        if ((map.getZoom() || 0) < 13) {
          map.setZoom(13);
        }
        return;
      }

      if (activeQuery === fallbackQuery && fallbackPosition) {
        map.panTo(fallbackPosition);
        if ((map.getZoom() || 0) < 11) {
          map.setZoom(11);
        }
        return;
      }

      const location = await resolveCoordinates(activeQuery);
      if (cancelled || !location) return;

      map.panTo(location);
      if ((map.getZoom() || 0) < 13) {
        map.setZoom(13);
      }
    };

    focusSelection();

    return () => {
      cancelled = true;
    };
  }, [activeQuery, fallbackPosition, fallbackQuery, immersive, jsMapReady]);

  if (immersive) {
    const shouldUseInteractiveMap = canUseGoogleMapsJsApi() && !jsMapError;

    return (
      <section className="relative h-full w-full overflow-hidden bg-white">
        {shouldUseInteractiveMap ? (
          <>
            <div ref={mapContainerRef} className="absolute inset-0" />
            {!jsMapReady ? (
              <div className="absolute inset-0 grid place-items-center bg-slate-100/80 text-sm font-semibold text-slate-500 backdrop-blur-sm">
                Loading interactive map...
              </div>
            ) : null}
          </>
        ) : (
          <iframe
            title="Trip map"
            src={buildMapUrl(mapQuery)}
            className="absolute inset-0 h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}

        <div className="pointer-events-none absolute inset-x-5 top-5 z-10">
          <div className="pointer-events-auto rounded-[28px] bg-white/92 p-5 shadow-card backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-ink">
                  {destination?.name || "Map preview"}
                </h2>
                {jsMapError ? (
                  <p className="mt-2 text-xs font-semibold text-slate-400">{jsMapError}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  aria-pressed={showAllNames}
                  onClick={() => setShowAllNames((current) => !current)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    showAllNames
                      ? "border-ocean bg-ocean text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-mist"
                  }`}
                >
                  Show all names
                </button>
                <button
                  type="button"
                  onClick={() => onFocusLocation(fallbackQuery)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-mist"
                >
                  Reset map
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white/95 shadow-card">
      <div className="border-b border-slate-100 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-ink">
              {destination?.name || "Map preview"}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Only selected-list items with a real map location appear here, including Google-matched activities.
            </p>
          </div>
          <span className="rounded-full bg-mist px-3 py-2 text-xs font-semibold text-slate-500">
            Labels appear on hover in the desktop map.
          </span>
        </div>
      </div>

      <iframe
        title="Trip map"
        src={buildMapUrl(mapQuery)}
        className="h-[420px] w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />

      <div className="px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">Locations in the plan</h3>
          <button
            type="button"
            onClick={() => onFocusLocation(fallbackQuery)}
            className="rounded-full bg-mist px-3 py-1 text-xs font-semibold text-slate-600"
          >
            Reset map
          </button>
        </div>

        {visibleIdeas.length ? (
          <div className="mt-4 grid gap-3">
            {visibleIdeas.map((idea) => (
              <button
                key={idea.id}
                type="button"
                onClick={() => onFocusLocation(idea.mapQuery)}
                className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-left transition hover:border-ocean hover:bg-[#F8FAFF]"
              >
                <div>
                  <p className="text-sm font-semibold text-ink">{idea.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{idea.locationLabel}</p>
                </div>
                {idea.listName ? (
                  <span className="rounded-full bg-mist px-3 py-1 text-[11px] font-semibold text-slate-500">
                    {idea.listName}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-mist px-4 py-5 text-sm text-slate-500">
            Select a list with mapped items, or add places with real addresses to start pinning the plan on the map.
          </div>
        )}
      </div>
    </section>
  );
}
