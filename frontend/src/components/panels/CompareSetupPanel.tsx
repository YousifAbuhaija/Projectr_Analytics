/**
 * CompareSetupPanel — shows the two selection slots & their status
 * while the user is picking universities in compare mode.
 */

import {
  GitCompareArrows,
  Loader2,
  CheckCircle2,
  MousePointerClick,
  Clock,
} from "lucide-react";
import type { HousingPressureScore } from "../../lib/api";

interface LogEntry {
  message: string;
  ts: Date;
}

type SlotStatus = "empty" | "selected" | "queued" | "loading" | "ready";

interface SlotProps {
  index: number;
  name: string | null;
  status: SlotStatus;
  score: HousingPressureScore | null;
}

function Slot({ index, name, status, score }: SlotProps) {
  const borderColor =
    status === "ready"
      ? "rgba(52,211,153,0.25)"
      : status === "loading"
        ? "rgba(255,255,255,0.15)"
        : status === "queued"
          ? "rgba(251,191,36,0.25)"
          : "var(--border)";

  const bgColor =
    status === "ready"
      ? "rgba(52,211,153,0.04)"
      : status === "loading"
        ? "rgba(255,255,255,0.03)"
        : status === "queued"
          ? "rgba(251,191,36,0.04)"
          : "var(--surface-2)";

  return (
    <div
      className="rounded-xl p-4 transition-all"
      style={{ border: `1px solid ${borderColor}`, background: bgColor }}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--text-3)" }}
        >
          University {index === 0 ? "A" : "B"}
        </span>
        {status === "ready" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        {status === "loading" && <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--text-2)" }} />}
        {status === "queued" && <Clock className="w-3.5 h-3.5 text-amber-400" />}
      </div>

      {status === "empty" ? (
        <div className="flex items-center gap-2 mt-2" style={{ color: "var(--text-3)" }}>
          <MousePointerClick className="w-4 h-4" />
          <p className="text-sm">Click a pin on the map</p>
        </div>
      ) : (
        <div>
          <p
            className="text-sm font-semibold leading-tight"
            style={{ fontFamily: "'Inter Tight', sans-serif", color: "var(--text)", letterSpacing: "-0.02em" }}
          >
            {name}
          </p>
          {status === "loading" && (
            <p className="text-xs mt-1 animate-pulse" style={{ color: "var(--text-2)" }}>
              Generating report…
            </p>
          )}
          {status === "queued" && (
            <p className="text-xs mt-1 text-amber-400">Queued…</p>
          )}
          {status === "ready" && score && (
            <p className="text-xs mt-1 text-emerald-400">
              Score: {score.score.toFixed(0)}/100 ✓
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface CompareSetupPanelProps {
  compareNames: [string | null, string | null];
  scoreCache: Record<string, HousingPressureScore>;
  loadingName: string | null;
  queuedNames: string[];
  activeLogs: LogEntry[];
}

export function CompareSetupPanel({
  compareNames,
  scoreCache,
  loadingName,
  queuedNames,
  activeLogs,
}: CompareSetupPanelProps) {
  const getStatus = (name: string | null): SlotStatus => {
    if (!name) return "empty";
    if (scoreCache[name]) return "ready";
    if (loadingName === name) return "loading";
    if (queuedNames.includes(name)) return "queued";
    return "selected";
  };

  const statusA = getStatus(compareNames[0]);
  const statusB = getStatus(compareNames[1]);
  const isGenerating =
    statusA === "loading" || statusB === "loading" ||
    statusA === "queued" || statusB === "queued";
  const oneReady = (statusA === "ready") !== (statusB === "ready");

  const subtitle = isGenerating
    ? "Generating reports, this may take a moment…"
    : oneReady
      ? "Now select a second university"
      : "Click two university pins on the map to compare their housing markets side-by-side.";

  const recentLogs = activeLogs.slice(-4);

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div
        className="w-14 h-14 rounded-xl flex items-center justify-center mb-6"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {isGenerating ? (
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--text-2)" }} />
        ) : (
          <GitCompareArrows className="w-6 h-6" style={{ color: "var(--text-2)" }} />
        )}
      </div>

      <h2
        className="text-base font-semibold mb-2"
        style={{ fontFamily: "'Inter Tight', sans-serif", color: "var(--text)", letterSpacing: "-0.025em" }}
      >
        Compare Mode
      </h2>
      <p
        className="text-sm mb-8 text-center max-w-xs leading-relaxed"
        style={{ color: "var(--text-2)" }}
      >
        {subtitle}
      </p>

      <div className="w-full max-w-xs space-y-3">
        <Slot
          index={0}
          name={compareNames[0]}
          status={statusA}
          score={compareNames[0] ? (scoreCache[compareNames[0]] ?? null) : null}
        />

        <div className="flex justify-center">
          <div className="w-px h-4" style={{ background: "var(--border)" }} />
        </div>

        <Slot
          index={1}
          name={compareNames[1]}
          status={statusB}
          score={compareNames[1] ? (scoreCache[compareNames[1]] ?? null) : null}
        />

        {recentLogs.length > 0 && (
          <div
            className="mt-4 rounded-lg px-3 py-2 font-mono text-[10px] space-y-0.5 max-h-[72px] overflow-y-auto"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            {recentLogs.map((log, i) => (
              <div key={i} className="truncate leading-relaxed" style={{ color: "var(--text-3)" }}>
                <span className="mr-1.5" style={{ color: "rgba(255,255,255,0.15)" }}>
                  {log.ts.toLocaleTimeString("en", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                › {log.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
