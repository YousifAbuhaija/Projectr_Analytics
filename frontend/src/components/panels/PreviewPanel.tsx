import { useState } from "react";
import { MapPin, ArrowRight } from "lucide-react";
import { UNIVERSITIES } from "../../lib/universityList";

function getInitials(name: string): string {
  const skip = new Set(["of", "the", "at", "and", "for", "in", "a"]);
  const words = name
    .split(/[\s\-&]+/)
    .filter((w) => w.length > 0 && !skip.has(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function nameToColor(name: string): string {
  const palette = [
    "#3b82f6",
    "#8b5cf6",
    "#f59e0b",
    "#10b981",
    "#f43f5e",
    "#06b6d4",
    "#84cc16",
    "#f97316",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return palette[hash % palette.length];
}

function UniversityLogo({ name, domain }: { name: string; domain?: string }) {
  const [srcIndex, setSrcIndex] = useState(0);
  const color = nameToColor(name);

  const sources = domain
    ? [
        `https://logo.clearbit.com/${domain}`,
        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
      ]
    : [];

  const currentSrc = sources[srcIndex];

  if (currentSrc) {
    return (
      <div
        className="w-16 h-16 rounded-xl flex items-center justify-center overflow-hidden"
        style={{
          background: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <img
          src={currentSrc}
          alt={`${name} logo`}
          className="w-10 h-10 object-contain"
          onError={() => setSrcIndex((i) => i + 1)}
        />
      </div>
    );
  }

  return (
    <div
      className="w-16 h-16 rounded-xl flex items-center justify-center"
      style={{ background: `${color}18`, border: `1px solid ${color}30` }}
    >
      <span className="text-xl font-bold tracking-tight" style={{ color }}>
        {getInitials(name)}
      </span>
    </div>
  );
}

interface PreviewPanelProps {
  name: string;
  onGenerateReport: (name: string) => void;
}

export function PreviewPanel({ name, onGenerateReport }: PreviewPanelProps) {
  const uni = UNIVERSITIES.find((u) => u.name === name);

  return (
    <div className="flex flex-col h-full">
      {/* Hero */}
      <div
        className="flex flex-col items-center justify-center px-8 py-10 text-center"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <UniversityLogo name={name} domain={uni?.domain} />

        <h2
          className="text-lg font-semibold tracking-tight leading-snug mt-5 mb-1"
          style={{
            fontFamily: "'Inter Tight', sans-serif",
            color: "var(--text)",
          }}
        >
          {name}
        </h2>

        {uni ? (
          <div
            className="flex items-center gap-1 text-xs mt-1"
            style={{ color: "var(--text-3)" }}
          >
            <MapPin className="w-3 h-3 shrink-0" />
            {uni.city}, {uni.state}
          </div>
        ) : (
          <p className="text-xs mt-1" style={{ color: "var(--text-3)" }}>
            United States
          </p>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 gap-4">
        <p
          className="text-sm leading-relaxed max-w-[220px] text-center"
          style={{ color: "var(--text-2)" }}
        >
          Run a live housing market analysis — enrollment trends, building
          permits, rent data, and an AI market brief from Gemini.
        </p>

        <button
          onClick={() => onGenerateReport(name)}
          className="btn-ql btn-ql-primary"
        >
          Generate Report
          <span className="btn-icon">
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </button>

        <p className="text-[11px]" style={{ color: "var(--text-3)" }}>
          5 live sources · ~15 seconds
        </p>
      </div>
    </div>
  );
}
