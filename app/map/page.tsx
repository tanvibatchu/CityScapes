"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const KW_CENTER: [number, number] = [-80.5449, 43.4643];

async function geocode(query: string): Promise<[number, number] | null> {
  if (!query.trim() || !MAPBOX_TOKEN) return null;
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&types=address,poi,neighborhood,place&limit=1`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) return null;
    return [feature.center[0], feature.center[1]];
  } catch {
    return null;
  }
}

/** Add the official Mapbox 3D buildings layer below label layers */
function add3DBuildings(map: mapboxgl.Map) {
  // Find first symbol layer with text-field — insert extrusions below it
  const layers = map.getStyle().layers;
  const labelLayerId = layers.find(
    (layer) =>
      layer.type === "symbol" &&
      (layer.layout as Record<string, unknown>)?.["text-field"]
  )?.id;

  if (map.getLayer("add-3d-buildings")) return; // already added

  map.addLayer(
    {
      id: "add-3d-buildings",
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 15,
      paint: {
        // Terracotta/rust tones matching the reference night-mode image
        "fill-extrusion-color": [
          "interpolate",
          ["linear"],
          ["get", "height"],
          0,   "#2a1410",
          20,  "#4a2817",
          60,  "#6b3c24",
          130, "#8b5030",
          250, "#9b5e38",
        ],
        // Smooth grow-in starting at zoom 15 — per official docs
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15, 0,
          15.05, ["get", "height"],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15, 0,
          15.05, ["get", "min_height"],
        ],
        "fill-extrusion-opacity": 0.88,
      },
    },
    labelLayerId
  );
}

function MapContent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [loading, setLoading] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Kitchener–Waterloo");

  const flyTo = useCallback((lng: number, lat: number, label?: string) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markerRef.current?.remove();

    // Fly in close enough that zoom > 15 so buildings extrude
    map.flyTo({
      center: [lng, lat],
      zoom: 16.5,
      pitch: 62,
      bearing: -17.6,
      duration: 2400,
      essential: true,
    });

    import("mapbox-gl").then((mapboxgl) => {
      const el = document.createElement("div");
      el.className = "map-marker";
      const marker = new mapboxgl.default.Marker({ element: el })
        .setLngLat([lng, lat])
        .addTo(map);
      markerRef.current = marker;
    });

    if (label) setLocationLabel(label);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const qParam   = searchParams.get("q")   ?? "";
    const lngParam = searchParams.get("lng");
    const latParam = searchParams.get("lat");

    let mapInstance: mapboxgl.Map | null = null;

    import("mapbox-gl").then((mapboxgl) => {
      if (!mapRef.current) return;
      mapboxgl.default.accessToken = MAPBOX_TOKEN;

      const hasCoords = !!(lngParam && latParam);
      const initCenter: [number, number] = hasCoords
        ? [parseFloat(lngParam!), parseFloat(latParam!)]
        : KW_CENTER;

      mapInstance = new mapboxgl.default.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/standard",
        config: {
          basemap: {
            lightPreset: "night", // dark navy ground, deep shadows — matches reference
          },
        },
        center: initCenter,
        zoom: hasCoords ? 16.5 : 15.5,
        pitch: 62,
        bearing: -17.6,
        antialias: true,
      });

      mapInstanceRef.current = mapInstance;

      mapInstance.addControl(
        new mapboxgl.default.NavigationControl(),
        "bottom-right"
      );

      // Use style.load (not load) — official docs requirement for standard style
      mapInstance.on("style.load", () => {
        if (!mapInstance) return;

        add3DBuildings(mapInstance);

        // Drop pin if we have coordinates
        if (hasCoords) {
          const lng = parseFloat(lngParam!);
          const lat = parseFloat(latParam!);
          const el = document.createElement("div");
          el.className = "map-marker";
          new mapboxgl.default.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(mapInstance!);
          if (qParam) setLocationLabel(qParam);
        } else if (qParam) {
          // Geocode then fly
          geocode(qParam).then((coords) => {
            if (coords) flyTo(coords[0], coords[1], qParam);
          });
        }
      });
    });

    return () => {
      markerRef.current?.remove();
      mapInstance?.remove();
      mapInstanceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    const coords = await geocode(query);
    setLoading(false);
    if (coords) {
      flyTo(coords[0], coords[1], query);
    }
  };

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <div ref={mapRef} className="map-container" />

      {/* Top bar */}
      <div className="map-topbar">
        <span className="map-logo">City<span>Scapes</span></span>

        <form className="map-search-form" onSubmit={handleSearch}>
          <div className="map-search">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              style={{ color: "rgba(232,220,200,0.35)", flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search an address or place…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              disabled={loading}
            />
            <button type="submit" className="map-search-submit" aria-label="Go" disabled={loading}>
              {loading ? <span className="spinner" /> : "→"}
            </button>
          </div>
        </form>

        <Link href="/" className="back-btn">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Home
        </Link>
      </div>

      {/* Bottom chip */}
      <div className="map-chip">
        <span className="map-chip-dot" />
        {locationLabel}
      </div>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div style={{ background: "#0f1f0f", width: "100vw", height: "100vh" }} />}>
      <MapContent />
    </Suspense>
  );
}
