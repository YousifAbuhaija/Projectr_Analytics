import { useState } from "react";
import { MapPin } from "lucide-react";
import { UNIVERSITIES } from "../lib/universityList";
import type { UniversitySuggestion } from "../lib/universityList";

function haversineDistMiles(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findNearest(
  lat: number,
  lng: number,
  extras: UniversitySuggestion[],
): UniversitySuggestion | null {
  const all = [...UNIVERSITIES, ...extras];
  if (all.length === 0) return null;
  let best = all[0];
  let bestDist = haversineDistMiles(lat, lng, best.lat, best.lon);
  for (const uni of all) {
    const d = haversineDistMiles(lat, lng, uni.lat, uni.lon);
    if (d < bestDist) {
      best = uni;
      bestDist = d;
    }
  }
  return best;
}

async function getLocationByIP(): Promise<{ lat: number; lng: number }> {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("IP lookup failed");
  const data = await res.json();
  if (typeof data.latitude !== "number" || typeof data.longitude !== "number") {
    throw new Error("No coordinates in response");
  }
  return { lat: data.latitude, lng: data.longitude };
}

export default function LocationButton({
  onSelectNearest,
  extraUniversities = [],
}: {
  onSelectNearest?: (
    name: string,
    coords: { lat: number; lng: number },
  ) => void;
  extraUniversities?: UniversitySuggestion[];
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const loc = await getLocationByIP();
      const nearest = findNearest(loc.lat, loc.lng, extraUniversities);
      if (nearest && onSelectNearest) {
        onSelectNearest(nearest.name, { lat: nearest.lat, lng: nearest.lon });
      }
    } catch {
      setError("Could not determine location. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={handleClick}
        disabled={loading}
        className="btn-ql btn-ql-primary disabled:opacity-50"
      >
        {loading ? "Locating..." : "Find Nearest University"}
        <span className="btn-icon">
          <MapPin className="w-3 h-3" />
        </span>
      </button>
      {error && (
        <p className="text-xs" style={{ color: "rgba(248,113,113,0.9)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
