import { useState, useEffect } from "react";
import {
  Map,
  AdvancedMarker,
  MapControl,
  ControlPosition,
  useMap,
} from "@vis.gl/react-google-maps";
import { Crosshair } from "lucide-react";
import { HexChoropleth } from "./HexChoropleth";
import { UNIVERSITIES } from "../lib/universityList";
import type { UniversitySuggestion } from "../lib/universityList";
import type { HousingPressureScore } from "../lib/api";
import type { HexGeoJSON } from "../lib/hexApi";

/** Merge static list + dynamic pins, deduplicated by name. */
function mergeUniversities(
  dynamic: Record<string, UniversitySuggestion>
): UniversitySuggestion[] {
  const staticNames = new Set(UNIVERSITIES.map((u) => u.name));
  const extras = Object.values(dynamic).filter((d) => !staticNames.has(d.name));
  return [...UNIVERSITIES, ...extras];
}

const SCORE_COLOR = (score: number) =>
  score >= 70 ? "#ef4444" : score >= 40 ? "#eab308" : "#22c55e";

const NATIONAL_CENTER = { lat: 39.5, lng: -98.35 };
const NATIONAL_ZOOM = 4;
const CAMPUS_ZOOM = 12;

// ── Logo Pin ──────────────────────────────────────────────────────────────────
// Circle with school favicon, pointer triangle at bottom, colored ring.

interface LogoPinProps {
  uni: UniversitySuggestion;
  borderColor: string;
  scale: number;
}

function LogoPin({ uni, borderColor, scale }: LogoPinProps) {
  const [srcIdx, setSrcIdx] = useState(0);

  const srcs = [
    `https://www.google.com/s2/favicons?domain=${uni.domain}&sz=64`,
    `https://logo.clearbit.com/${uni.domain}`,
  ];

  const src = srcs[srcIdx];

  // Initials fallback
  const initials = uni.name
    .split(/[\s\-&]+/)
    .filter((w) => !["of", "the", "at", "and", "for", "in", "a"].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `scale(${scale})`,
        transformOrigin: "bottom center",
        transition: "transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
        cursor: "pointer",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.5))",
      }}
    >
      {/* Circle badge */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          background: "#ffffff",
          border: `2.5px solid ${borderColor}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {src ? (
          <img
            src={src}
            width={22}
            height={22}
            style={{ objectFit: "contain", display: "block" }}
            onError={() => setSrcIdx((i) => i + 1)}
          />
        ) : (
          <span style={{ fontSize: 9, fontWeight: 800, color: borderColor, letterSpacing: -0.5 }}>
            {initials}
          </span>
        )}
      </div>

      {/* Pointer triangle */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `7px solid ${borderColor}`,
          marginTop: -1,
        }}
      />
    </div>
  );
}

// ── CameraController ──────────────────────────────────────────────────────────

function CameraController({
  selectedName,
  scoreCache,
}: {
  selectedName: string | null;
  scoreCache: Record<string, HousingPressureScore>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (!selectedName) {
      map.panTo(NATIONAL_CENTER);
      const t = setTimeout(() => map.setZoom(NATIONAL_ZOOM), 250);
      return () => clearTimeout(t);
    }

    const computed = scoreCache[selectedName];
    const target = computed
      ? { lat: computed.university.lat, lng: computed.university.lon }
      : (() => {
          const u = UNIVERSITIES.find((u) => u.name === selectedName);
          return u ? { lat: u.lat, lng: u.lon } : null;
        })();

    if (target) {
      map.panTo(target);
      const t = setTimeout(() => map.setZoom(CAMPUS_ZOOM), 250);
      return () => clearTimeout(t);
    }
  }, [map, selectedName]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ── RecenterButton ────────────────────────────────────────────────────────────

function RecenterButton({
  selectedName,
  scoreCache,
}: {
  selectedName: string | null;
  scoreCache: Record<string, HousingPressureScore>;
}) {
  const map = useMap();

  const handleClick = () => {
    if (!map) return;
    if (!selectedName) {
      map.panTo(NATIONAL_CENTER);
      setTimeout(() => map.setZoom(NATIONAL_ZOOM), 250);
      return;
    }
    const computed = scoreCache[selectedName];
    const target = computed
      ? { lat: computed.university.lat, lng: computed.university.lon }
      : (() => {
          const u = UNIVERSITIES.find((u) => u.name === selectedName);
          return u ? { lat: u.lat, lng: u.lon } : null;
        })();
    if (target) {
      map.panTo(target);
      setTimeout(() => map.setZoom(CAMPUS_ZOOM), 250);
    } else {
      map.panTo(NATIONAL_CENTER);
      setTimeout(() => map.setZoom(NATIONAL_ZOOM), 250);
    }
  };

  return (
    <MapControl position={ControlPosition.RIGHT_BOTTOM}>
      <button
        onClick={handleClick}
        title={selectedName ? "Re-center on campus" : "Re-center national view"}
        className="mb-3 mr-3 w-10 h-10 bg-zinc-900/90 border border-zinc-700
                   hover:border-blue-500 rounded-xl flex items-center justify-center
                   text-zinc-400 hover:text-white transition-all shadow-lg backdrop-blur-sm"
      >
        <Crosshair className="w-4 h-4" />
      </button>
    </MapControl>
  );
}

// ── MapView ───────────────────────────────────────────────────────────────────

interface MapViewProps {
  selectedName: string | null;
  scoreCache: Record<string, HousingPressureScore>;
  dynamicUnis: Record<string, UniversitySuggestion>;
  activeHexData: HexGeoJSON | null;
  onPinClick: (name: string) => void;
}

export function MapView({ selectedName, scoreCache, dynamicUnis, activeHexData, onPinClick }: MapViewProps) {
  const allUniversities = mergeUniversities(dynamicUnis);
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  return (
    <div className="flex-1 bg-zinc-900 relative">
      <Map
        mapId="CampusLensMap"
        defaultCenter={NATIONAL_CENTER}
        defaultZoom={NATIONAL_ZOOM}
        disableDefaultUI={true}
        zoomControl={true}
        gestureHandling="greedy"
      >
        <CameraController selectedName={selectedName} scoreCache={scoreCache} />
        <RecenterButton selectedName={selectedName} scoreCache={scoreCache} />

        {activeHexData && <HexChoropleth hexData={activeHexData} />}

        {allUniversities.map((uni, i) => {
          const computed = scoreCache[uni.name];
          const isSelected = selectedName === uni.name;
          const isHovered = hoveredName === uni.name;

          const borderColor = computed
            ? SCORE_COLOR(computed.score)
            : isSelected
            ? "#3b82f6"
            : "#71717a";

          const scale = isSelected ? 1.45 : isHovered ? 1.2 : 1.0;

          return (
            <AdvancedMarker
              key={uni.name}
              position={{ lat: uni.lat, lng: uni.lon }}
              onClick={() => onPinClick(uni.name)}
              onMouseEnter={() => setHoveredName(uni.name)}
              onMouseLeave={() => setHoveredName(null)}
              title={uni.name}
              zIndex={isSelected ? 20 : computed ? 6 : isHovered ? 10 : 1}
            >
              {/* Staggered entrance animation wrapper */}
              <div
                style={{
                  animationDelay: `${i * 30}ms`,
                  animation: "markerIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards",
                  opacity: 0,
                }}
              >
                <LogoPin uni={uni} borderColor={borderColor} scale={scale} />
              </div>

              {/* Hover tooltip */}
              <div
                className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2
                           bg-zinc-900/95 border border-zinc-700 rounded-xl px-3 py-2.5
                           whitespace-nowrap shadow-2xl pointer-events-none z-50
                           transition-opacity duration-150"
                style={{
                  backdropFilter: "blur(8px)",
                  opacity: isHovered ? 1 : 0,
                  visibility: isHovered ? "visible" : "hidden",
                }}
              >
                <p className="text-xs font-semibold text-white leading-tight">{uni.name}</p>
                <p className="text-xs text-zinc-400 mt-0.5">{uni.city}, {uni.state}</p>
                {computed ? (
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: SCORE_COLOR(computed.score) }} />
                    <span className="text-xs font-medium" style={{ color: SCORE_COLOR(computed.score) }}>
                      {computed.score.toFixed(0)}/100
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-blue-400 mt-1.5">Click to view →</p>
                )}
              </div>
            </AdvancedMarker>
          );
        })}
      </Map>

      {/* Legend */}
      <div className="absolute bottom-6 left-6 bg-zinc-950/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-3 text-xs pointer-events-none">
        {activeHexData ? (
          <div className="flex gap-4">
            {[["High Pressure", "#ef4444"], ["Emerging", "#eab308"], ["Balanced", "#22c55e"]].map(
              ([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-zinc-400">{label}</span>
                </div>
              )
            )}
          </div>
        ) : (
          <p className="text-zinc-500">
            <span className="text-zinc-300 font-medium">{allUniversities.length} universities</span>
            {" "}· click any pin to explore
          </p>
        )}
      </div>
    </div>
  );
}
