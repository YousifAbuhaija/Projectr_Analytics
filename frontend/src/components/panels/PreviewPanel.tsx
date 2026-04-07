import { useState } from "react";
import { Zap, MapPin } from "lucide-react";
import { UNIVERSITIES } from "../../lib/universityList";

function getInitials(name: string): string {
  const skip = new Set(["of", "the", "at", "and", "for", "in", "a"]);
  const words = name.split(/[\s\-&]+/).filter((w) => w.length > 0 && !skip.has(w.toLowerCase()));
  return words
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function nameToColor(name: string): string {
  const palette = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e", "#06b6d4", "#84cc16", "#f97316"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0x7fffffff;
  return palette[hash % palette.length];
}

// Try sources in order: Clearbit (high-quality logos) → Google favicon (always works) → initials
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
      <div className="w-20 h-20 rounded-2xl bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg overflow-hidden">
        <img
          src={currentSrc}
          alt={`${name} logo`}
          className="w-14 h-14 object-contain"
          onError={() => setSrcIndex((i) => i + 1)}
        />
      </div>
    );
  }

  // All sources exhausted — initials avatar
  return (
    <div
      className="w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg"
      style={{ background: `${color}20`, border: `1.5px solid ${color}40` }}
    >
      <span className="text-2xl font-black tracking-tight" style={{ color }}>
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
      <div className="flex flex-col items-center justify-center px-8 py-12 border-b border-zinc-800 text-center">
        <UniversityLogo name={name} domain={uni?.domain} />

        <h2 className="text-xl font-bold text-zinc-50 leading-snug mt-5 mb-1">{name}</h2>

        {uni ? (
          <div className="flex items-center gap-1 text-sm text-zinc-400 mt-1">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            {uni.city}, {uni.state}
          </div>
        ) : (
          <p className="text-sm text-zinc-500 mt-1">United States</p>
        )}
      </div>

      {/* CTA */}
      <div className="flex flex-col items-center justify-center flex-1 px-8 gap-5">
        <p className="text-sm text-zinc-400 text-center leading-relaxed max-w-xs">
          Run a live housing market analysis — enrollment trends, building permits,
          rent data, and an AI-generated market brief from Gemini.
        </p>

        <button
          onClick={() => onGenerateReport(name)}
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl font-semibold text-sm
                     bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg
                     shadow-blue-600/25 active:scale-95"
        >
          <Zap className="w-4 h-4" />
          Generate Report
        </button>

        <p className="text-xs text-zinc-600 text-center">
          Pulls live data from 5 sources · takes ~15 seconds
        </p>
      </div>
    </div>
  );
}
