import { useState } from "react";
import { APIProvider } from "@vis.gl/react-google-maps";
import { streamScore } from "./lib/api";
import { fetchHexGrid } from "./lib/hexApi";
import { readCache, writeEntry } from "./lib/storage";
import { UNIVERSITIES } from "./lib/universityList";
import type { UniversitySuggestion } from "./lib/universityList";
import { SearchBar } from "./components/ui/SearchBar";
import { MapView } from "./components/MapView";
import { SidePanel } from "./components/SidePanel";
import type { HousingPressureScore } from "./lib/api";
import type { HexGeoJSON } from "./lib/hexApi";

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

interface LogEntry {
  message: string;
  ts: Date;
}

/** Extract a bare hostname from a Scorecard URL like "www.vt.edu" or "https://vt.edu/". */
function extractDomain(url: string | null): string {
  if (!url) return "";
  try {
    const withProto = url.startsWith("http") ? url : `https://${url}`;
    return new URL(withProto).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  }
}

function App() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Persistent score + hex caches — survive page refresh for 24 h
  const [scoreCache, setScoreCache] = useState<Record<string, HousingPressureScore>>(
    () => readCache<HousingPressureScore>("campuslens_scores")
  );
  const [hexCache, setHexCache] = useState<Record<string, HexGeoJSON>>(
    () => readCache<HexGeoJSON>("campuslens_hex")
  );

  // Dynamic universities discovered via search — appear as map pins and suggestions
  const [dynamicUnis, setDynamicUnis] = useState<Record<string, UniversitySuggestion>>(
    () => readCache<UniversitySuggestion>("campuslens_dynamic_unis")
  );

  const [loading, setLoading] = useState(false);
  const [agentLogs, setAgentLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const activeScore = selectedName ? (scoreCache[selectedName] ?? null) : null;
  const activeHexData = selectedName ? (hexCache[selectedName] ?? null) : null;

  // ── Core computation ──────────────────────────────────────────────────────

  const runReport = async (name: string) => {
    setLoading(true);
    setError(null);
    setAgentLogs([]);

    try {
      for await (const event of streamScore(name)) {
        if (event.type === "log") {
          setAgentLogs((prev) => [...prev, { message: event.message, ts: new Date() }]);
        } else if (event.type === "result") {
          const uni = event.data.university;
          const actualName = uni.name;

          // ── Score cache: store under query key AND actual university name ──
          // This ensures pin clicks (which use actualName) also hit the cache.
          setScoreCache((prev) => {
            const next = { ...prev, [name]: event.data };
            if (actualName !== name) next[actualName] = event.data;
            return next;
          });
          writeEntry("campuslens_scores", name, event.data);
          if (actualName !== name) writeEntry("campuslens_scores", actualName, event.data);

          // ── Dynamic pin: add if not already in the static list ────────────
          const inStatic =
            UNIVERSITIES.some((u) => u.name === name) ||
            UNIVERSITIES.some((u) => u.name === actualName);

          if (!inStatic) {
            const newPin: UniversitySuggestion = {
              name: actualName,
              city: uni.city,
              state: uni.state,
              lat: uni.lat,
              lon: uni.lon,
              domain: extractDomain(uni.url),
            };
            setDynamicUnis((prev) => ({ ...prev, [actualName]: newPin }));
            writeEntry("campuslens_dynamic_unis", actualName, newPin);
          }

          // ── Hex cache ─────────────────────────────────────────────────────
          fetchHexGrid(actualName)
            .then((hex) => {
              setHexCache((prev) => {
                const next = { ...prev, [name]: hex };
                if (actualName !== name) next[actualName] = hex;
                return next;
              });
              writeEntry("campuslens_hex", name, hex);
              if (actualName !== name) writeEntry("campuslens_hex", actualName, hex);
            })
            .catch(() => {});

          setLoading(false);
        } else if (event.type === "error") {
          setError(event.message);
          setLoading(false);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to fetch score");
      setLoading(false);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Pin click or suggestion select — show preview or cached result, no auto-compute. */
  const handleSelectUniversity = (name: string) => {
    setSelectedName(name);
    setSearchQuery(name);
  };

  /** Search bar Enter or "Search for X" — explicit compute request. */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = searchQuery.trim();
    if (!name) return;
    setSelectedName(name);
    await runReport(name);
  };

  /** "Generate Report" button in PreviewPanel. */
  const handleGenerateReport = async (name: string) => {
    setSelectedName(name);
    await runReport(name);
  };

  /** "Recompute" button in ScorePanel. */
  const handleRecompute = async () => {
    if (!selectedName) return;
    await runReport(selectedName);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-50">
      <SearchBar
        query={searchQuery}
        onChange={setSearchQuery}
        onSubmit={handleSearch}
        onSelectUniversity={handleSelectUniversity}
        extraUniversities={Object.values(dynamicUnis)}
        disabled={loading}
      />
      <main className="flex-1 flex mt-[73px]">
        <APIProvider apiKey={MAPS_API_KEY}>
          <MapView
            selectedName={selectedName}
            scoreCache={scoreCache}
            dynamicUnis={dynamicUnis}
            activeHexData={activeHexData}
            onPinClick={handleSelectUniversity}
          />
        </APIProvider>
        <SidePanel
          loading={loading}
          error={error}
          selectedName={selectedName}
          activeScore={activeScore}
          agentLogs={agentLogs}
          onRecompute={handleRecompute}
          onGenerateReport={handleGenerateReport}
        />
      </main>
    </div>
  );
}

export default App;
