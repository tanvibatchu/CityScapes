"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import {
  buildSeedGrid,
  scoreGrid,
  KW_BOUNDS,
  type GridCell,
  type Weights,
} from "@/lib/suitability";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
const KW_CENTER: [number, number] = [-80.5449, 43.4643];

const DEFAULT_WEIGHTS: Weights = {
  heatMitigation: 1,
  parkAccess: 1,
  impervious: 1,
  equity: 1,
};

const PRESET_QUESTIONS = [
  { id: "best-plots", label: "🌿 Best places for new greenspace" },
  { id: "greenery-10", label: "🌱 +10% more greenery" },
  { id: "greenery-20", label: "🌳 +20% more greenery" },
  { id: "greenery-30", label: "🌲 +30% more greenery" },
  { id: "greenery-40", label: "🌲 +40% more greenery" },
  { id: "greenery-50", label: "🌲 +50% more greenery" },
  { id: "clear", label: "✕ Clear layers" },
] as const;

type ZonedCell = GridCell & { zone: string };
/** scoreGrid preserves extra fields at runtime; TS needs a hint for ZonedCell. */
type ScoredZoned = ZonedCell & { score: number };

function enrichCellsWithZone(cells: GridCell[]): ZonedCell[] {
  const zones = ["residential", "commercial", "industrial", "mixed", "park"] as const;
  return cells.map((c) => {
    let h = 0;
    for (let i = 0; i < c.id.length; i++) h = (Math.imul(31, h) + c.id.charCodeAt(i)) | 0;
    const zone = zones[Math.abs(h) % zones.length];
    return { ...c, zone };
  });
}

function cellBounds(lat: number, lng: number, dLat: number, dLng: number) {
  const halfLat = dLat / 2;
  const halfLng = dLng / 2;
  return [
    [lng - halfLng, lat - halfLat],
    [lng + halfLng, lat - halfLat],
    [lng + halfLng, lat + halfLat],
    [lng - halfLng, lat + halfLat],
    [lng - halfLng, lat - halfLat],
  ];
}

function getGreeneryStats(pct: number) {
  const trees = Math.round(pct * 142);
  const co2 = (pct * 0.38).toFixed(1);
  const tempDrop = (pct * 0.09).toFixed(1);
  const residents = Math.round(pct * 3200);
  return { trees, co2, tempDrop, residents };
}

function MapContent() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<MapboxMap | null>(null);
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const [greeneryPct, setGreeneryPct] = useState<number | null>(null);
  const [topCells, setTopCells] = useState<ScoredZoned[]>([]);
  const [isSatellite, setIsSatellite] = useState(false);

  const clearLayers = useCallback((map: MapboxMap) => {
    ["greenery-fill", "greenery-outline", "top-plots-fill", "top-plots-outline"].forEach((id) => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    ["greenery-source", "top-plots-source"].forEach((id) => {
      if (map.getSource(id)) map.removeSource(id);
    });
  }, []);

  const showBestPlots = useCallback((map: MapboxMap) => {
    const zoned = enrichCellsWithZone(buildSeedGrid(8, 10));
    const scored = scoreGrid(zoned, DEFAULT_WEIGHTS) as ScoredZoned[];
    const sorted = [...scored].sort((a, b) => b.score - a.score).slice(0, 12);
    setTopCells(sorted);

    const rows = 8;
    const cols = 10;
    const dLat = (KW_BOUNDS.north - KW_BOUNDS.south) / rows;
    const dLng = (KW_BOUNDS.east - KW_BOUNDS.west) / cols;

    const features = sorted.map((cell) => ({
      type: "Feature" as const,
      properties: {
        score: cell.score,
        zone: cell.zone,
        id: cell.id,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [cellBounds(cell.lat, cell.lng, dLat, dLng)],
      },
    }));

    map.addSource("top-plots-source", {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });

    map.addLayer({
      id: "top-plots-fill",
      type: "fill",
      source: "top-plots-source",
      paint: {
        "fill-color": [
          "interpolate",
          ["linear"],
          ["get", "score"],
          0.5,
          "#86efac",
          0.75,
          "#22c55e",
          1.0,
          "#15803d",
        ],
        "fill-opacity": 0.55,
      },
    });

    map.addLayer({
      id: "top-plots-outline",
      type: "line",
      source: "top-plots-source",
      paint: {
        "line-color": "#4ade80",
        "line-width": 1.5,
        "line-opacity": 0.8,
      },
    });
  }, []);

  const showGreenery = useCallback((map: MapboxMap, pct: number) => {
    const rows = 8;
    const cols = 10;
    const dLat = (KW_BOUNDS.north - KW_BOUNDS.south) / rows;
    const dLng = (KW_BOUNDS.east - KW_BOUNDS.west) / cols;

    const zoned = enrichCellsWithZone(buildSeedGrid(8, 10));
    const addableCells = zoned.filter((c) => c.zone !== "park");
    const countToShow = Math.ceil((pct / 50) * addableCells.length);
    const scored = scoreGrid(addableCells, DEFAULT_WEIGHTS) as ScoredZoned[];
    const toGreen = [...scored].sort((a, b) => b.score - a.score).slice(0, countToShow);

    const features = toGreen.map((cell) => ({
      type: "Feature" as const,
      properties: { score: cell.score },
      geometry: {
        type: "Polygon" as const,
        coordinates: [cellBounds(cell.lat, cell.lng, dLat, dLng)],
      },
    }));

    const opacity = 0.3 + (pct / 50) * 0.35;

    map.addSource("greenery-source", {
      type: "geojson",
      data: { type: "FeatureCollection", features },
    });

    map.addLayer({
      id: "greenery-fill",
      type: "fill",
      source: "greenery-source",
      paint: {
        "fill-color": "#22c55e",
        "fill-opacity": opacity,
      },
    });

    map.addLayer({
      id: "greenery-outline",
      type: "line",
      source: "greenery-source",
      paint: {
        "line-color": "#86efac",
        "line-width": 1,
        "line-opacity": 0.6,
      },
    });
  }, []);

  const handleQuestion = useCallback(
    (id: string) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      setActiveQuestion(id);
      clearLayers(map);
      setTopCells([]);
      setGreeneryPct(null);

      if (id === "clear") {
        setActiveQuestion(null);
        if (isSatellite) {
          map.setStyle("mapbox://styles/mapbox/dark-v11");
          setIsSatellite(false);
        }
        return;
      }

      if (id === "best-plots") {
        if (isSatellite) {
          map.setStyle("mapbox://styles/mapbox/dark-v11");
          setIsSatellite(false);
          map.once("style.load", () => showBestPlots(map));
        } else {
          showBestPlots(map);
        }
        return;
      }

      if (id.startsWith("greenery-")) {
        const pct = parseInt(id.replace("greenery-", ""), 10);
        setGreeneryPct(pct);

        if (!isSatellite) {
          map.setStyle("mapbox://styles/mapbox/satellite-streets-v12");
          setIsSatellite(true);
          map.once("style.load", () => showGreenery(map, pct));
        } else {
          showGreenery(map, pct);
        }
      }
    },
    [clearLayers, showBestPlots, showGreenery, isSatellite]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    let map: MapboxMap | null = null;

    import("mapbox-gl").then((mapboxgl) => {
      if (!mapRef.current) return;
      mapboxgl.default.accessToken = MAPBOX_TOKEN;

      map = new mapboxgl.default.Map({
        container: mapRef.current,
        style: "mapbox://styles/mapbox/dark-v11",
        center: KW_CENTER,
        zoom: 12,
        pitch: 45,
        bearing: 0,
        antialias: true,
      });

      mapInstanceRef.current = map;
      map.addControl(new mapboxgl.default.NavigationControl(), "bottom-right");

      map.on("load", () => {
        if (!map) return;

        map.addSource("mapbox-dem", {
          type: "raster-dem",
          url: "mapbox://mapbox.mapbox-terrain-dem-v1",
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: "mapbox-dem", exaggeration: 1.5 });

        map.addLayer({
          id: "sky",
          type: "sky",
          paint: {
            "sky-type": "atmosphere",
            "sky-atmosphere-sun": [0.0, 0.0],
            "sky-atmosphere-sun-intensity": 5,
          },
        });

        map.addLayer(
          {
            id: "3d-buildings",
            source: "composite",
            "source-layer": "building",
            filter: ["==", "extrude", "true"],
            type: "fill-extrusion",
            minzoom: 12,
            paint: {
              "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["get", "height"],
                0,
                "#1a2e1a",
                40,
                "#1f3320",
                80,
                "#2d1a14",
                150,
                "#3d2219",
              ],
              "fill-extrusion-height": [
                "interpolate",
                ["linear"],
                ["zoom"],
                12,
                0,
                12.05,
                ["get", "height"],
              ],
              "fill-extrusion-base": ["get", "min_height"],
              "fill-extrusion-opacity": 0.9,
            },
          },
          "road-label"
        );
      });
    });

    return () => {
      map?.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  const stats = greeneryPct != null ? getGreeneryStats(greeneryPct) : null;

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <div ref={mapRef} className="map-container" />

      <div className="map-topbar">
        <span className="map-logo">
          City<span>Scapes</span>
        </span>
        <div className="map-search">
          <svg
            width="14"
            height="14"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            style={{ color: "rgba(232,220,200,0.35)", flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search a location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Link href="/" className="back-btn">
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Home
        </Link>
      </div>

      <div
        style={{
          position: "absolute",
          left: 16,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 10,
        }}
      >
        {PRESET_QUESTIONS.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => handleQuestion(q.id)}
            style={{
              background:
                activeQuestion === q.id ? "rgba(34,197,94,0.25)" : "rgba(10,20,10,0.75)",
              border:
                activeQuestion === q.id
                  ? "1px solid rgba(34,197,94,0.7)"
                  : "1px solid rgba(255,255,255,0.12)",
              color: activeQuestion === q.id ? "#86efac" : "rgba(232,220,200,0.85)",
              borderRadius: 10,
              padding: "9px 14px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              textAlign: "left",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            {q.label}
          </button>
        ))}
      </div>

      {stats != null && greeneryPct != null && (
        <div
          style={{
            position: "absolute",
            right: 16,
            top: 80,
            background: "rgba(10,20,10,0.85)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 14,
            padding: "16px 20px",
            color: "rgba(232,220,200,0.9)",
            backdropFilter: "blur(10px)",
            zIndex: 10,
            minWidth: 220,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#86efac",
              fontWeight: 600,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            +{greeneryPct}% Greenery Impact
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "New trees", value: stats.trees.toLocaleString() },
              { label: "CO₂ offset/yr", value: `${stats.co2}kt` },
              { label: "Temp reduction", value: `−${stats.tempDrop}°C` },
              { label: "Residents benefiting", value: stats.residents.toLocaleString() },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: "rgba(34,197,94,0.08)", borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 11, color: "rgba(232,220,200,0.5)", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#86efac" }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: "rgba(232,220,200,0.35)", marginTop: 10 }}>
            Illustrative estimates · KW region
          </div>
        </div>
      )}

      {activeQuestion === "best-plots" && topCells.length > 0 && (
        <div
          style={{
            position: "absolute",
            right: 16,
            top: 80,
            background: "rgba(10,20,10,0.85)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 14,
            padding: "16px 20px",
            color: "rgba(232,220,200,0.9)",
            backdropFilter: "blur(10px)",
            zIndex: 10,
            minWidth: 230,
            maxHeight: "60vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: "#86efac",
              fontWeight: 600,
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Top {topCells.length} Greenspace Sites
          </div>
          {topCells.map((cell, i) => (
            <div
              key={cell.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                fontSize: 13,
              }}
            >
              <span style={{ color: "rgba(232,220,200,0.6)" }}>
                #{i + 1} · {cell.zone}
              </span>
              <span
                style={{
                  fontWeight: 600,
                  color: cell.score > 0.7 ? "#4ade80" : cell.score > 0.5 ? "#86efac" : "#d1fae5",
                }}
              >
                {(cell.score * 100).toFixed(0)}%
              </span>
            </div>
          ))}
          <div style={{ fontSize: 11, color: "rgba(232,220,200,0.35)", marginTop: 10 }}>
            Illustrative zones · scored by heat, equity, access (prototype)
          </div>
        </div>
      )}

      <div className="map-chip">
        <span className="map-chip-dot" />
        Kitchener–Waterloo · {isSatellite ? "Satellite View" : "3D Urban View"}
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
