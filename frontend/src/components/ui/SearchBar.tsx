import { useRef, useEffect, useState } from "react";
import {
  Search,
  X,
  MapPin,
  ArrowRight,
  GitCompareArrows,
  Trophy,
  Loader2,
} from "lucide-react";
import { UNIVERSITIES } from "../../lib/universityList";
import type { UniversitySuggestion } from "../../lib/universityList";

interface SearchBarProps {
  query: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSelectUniversity: (
    name: string,
    coords?: { lat: number; lng: number },
  ) => void;
  extraUniversities?: UniversitySuggestion[];
  disabled?: boolean;
  compareMode?: boolean;
  compareLoading?: boolean;
  onToggleCompare?: () => void;
  compareGuide?: string;
  rankingMode?: boolean;
  onToggleRanking?: () => void;
  onHome?: () => void;
}

export function SearchBar({
  query,
  onChange,
  onSubmit,
  onSelectUniversity,
  extraUniversities = [],
  disabled,
  compareMode,
  compareLoading,
  onToggleCompare,
  compareGuide,
  rankingMode,
  onToggleRanking,
  onHome,
}: SearchBarProps) {
  const staticNames = new Set(UNIVERSITIES.map((u) => u.name));
  const allUniversities = [
    ...UNIVERSITIES,
    ...extraUniversities.filter((e) => !staticNames.has(e.name)),
  ];
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const suggestions =
    query.trim().length > 0
      ? allUniversities
          .filter((u) =>
            [u.name, u.city, u.state].some((s) =>
              s.toLowerCase().includes(query.toLowerCase()),
            ),
          )
          .slice(0, 5)
      : [];

  const topIsExact =
    suggestions.length > 0 &&
    suggestions[0].name.toLowerCase().startsWith(query.toLowerCase());

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setActiveIdx(-1);
  }, [suggestions.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const total = suggestions.length + 1;
    if (!open || total === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((prev) => (prev + 1) % total);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((prev) => (prev - 1 + total) % total);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIdx(-1);
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      if (activeIdx < suggestions.length) {
        const uni = suggestions[activeIdx];
        onChange(uni.name);
        onSelectUniversity(uni.name, { lat: uni.lat, lng: uni.lon });
        setOpen(false);
        setActiveIdx(-1);
      } else {
        setOpen(false);
        inputRef.current?.form?.requestSubmit();
      }
    }
  };

  const handleSuggestionClick = (uni: UniversitySuggestion) => {
    onChange(uni.name);
    onSelectUniversity(uni.name, { lat: uni.lat, lng: uni.lon });
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleLiveSearchClick = () => {
    setOpen(false);
    inputRef.current?.form?.requestSubmit();
  };

  return (
    <header
      className="shrink-0 z-10 flex items-center justify-between px-6 py-3 backdrop-blur-md border-b"
      style={{
        background: "rgba(12,12,12,0.97)",
        borderBottomColor: "var(--border)",
      }}
    >
      {/* Logo */}
      <button
        onClick={onHome}
        className="flex items-center gap-2.5 hover:opacity-75 transition-opacity cursor-pointer shrink-0"
      >
        <img
          src="/logo.png"
          alt="CampusLens"
          className="w-8 h-8 object-contain"
        />
        <span
          className="text-sm font-semibold tracking-tight"
          style={{
            fontFamily: "'Inter Tight', sans-serif",
            color: "var(--text)",
          }}
        >
          CampusLens
        </span>
      </button>

      {/* Search form */}
      <form
        onSubmit={(e) => {
          setOpen(false);
          onSubmit(e);
        }}
        className="flex-1 max-w-md mx-8"
      >
        <div ref={containerRef} className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none z-10"
            style={{ color: "var(--text-3)" }}
          />

          <input
            ref={inputRef}
            type="text"
            placeholder={compareGuide ?? "Search any US university..."}
            className={`w-full pl-9 pr-10 py-2 text-sm outline-none transition-all disabled:opacity-50 ${
              open && query.trim().length > 0
                ? "rounded-t-lg rounded-b-none"
                : "rounded-lg"
            }`}
            style={{
              background: "var(--surface-2)",
              border: `1px solid ${compareMode ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.1)"}`,
              color: "var(--text)",
            }}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = compareMode
                ? "rgba(59,130,246,0.6)"
                : "rgba(255,255,255,0.25)";
              if (query.trim().length > 0) setOpen(true);
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = compareMode
                ? "rgba(59,130,246,0.4)"
                : "rgba(255,255,255,0.1)";
            }}
            value={query}
            onChange={(e) => {
              onChange(e.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            autoComplete="off"
          />

          {/* Clear button */}
          {query.length > 0 && !disabled && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                inputRef.current?.focus();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors z-10"
              style={{ color: "var(--text-3)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--text-2)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--text-3)")
              }
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* ⌘K hint */}
          {query.length === 0 && (
            <kbd
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded pointer-events-none"
              style={{
                color: "var(--text-3)",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid var(--border)",
              }}
            >
              ⌘K
            </kbd>
          )}

          {/* Dropdown */}
          {open && query.trim().length > 0 && (
            <div
              className="absolute top-full left-0 right-0 shadow-2xl overflow-hidden z-50"
              style={{
                background: "var(--surface-2)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderTop: "none",
                borderRadius: "0 0 8px 8px",
              }}
            >
              {suggestions.map((uni, i) => (
                <button
                  key={`${uni.name}-${uni.city}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSuggestionClick(uni)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                  style={{
                    background:
                      activeIdx === i
                        ? "rgba(255,255,255,0.05)"
                        : "transparent",
                  }}
                >
                  <MapPin
                    className="w-3 h-3 shrink-0"
                    style={{ color: "var(--text-3)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <HighlightedName name={uni.name} query={query} />
                    <p
                      className="text-[11px] mt-0.5 truncate"
                      style={{ color: "var(--text-3)" }}
                    >
                      {uni.city}, {uni.state}
                    </p>
                  </div>
                  {i === 0 && topIsExact && (
                    <span
                      className="text-[10px] shrink-0"
                      style={{ color: "var(--text-3)" }}
                    >
                      ↵
                    </span>
                  )}
                </button>
              ))}

              {suggestions.length > 0 && (
                <div
                  style={{
                    height: "1px",
                    background: "var(--border)",
                    margin: "0 12px",
                  }}
                />
              )}

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleLiveSearchClick}
                onMouseEnter={() => setActiveIdx(suggestions.length)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors"
                style={{
                  background:
                    activeIdx === suggestions.length
                      ? "rgba(255,255,255,0.05)"
                      : "transparent",
                }}
              >
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: "var(--accent)" }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm" style={{ color: "var(--text-2)" }}>
                    Search for{" "}
                    <span
                      className="font-medium"
                      style={{ color: "var(--text)" }}
                    >
                      "{query}"
                    </span>
                  </p>
                  <p
                    className="text-[11px] mt-0.5"
                    style={{ color: "var(--text-3)" }}
                  >
                    Live analysis via Gemini
                  </p>
                </div>
                <ArrowRight
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ color: "var(--text-3)" }}
                />
              </button>
            </div>
          )}
        </div>
      </form>

      {/* Action buttons — QuantumLab style: label + square icon box */}
      <div className="flex items-center gap-2 shrink-0">
        {onToggleRanking && (
          <button
            onClick={onToggleRanking}
            title={rankingMode ? "Exit rankings" : "View market rankings"}
            className={`btn-ql ${rankingMode ? "btn-ql-active" : "btn-ql-secondary"}`}
          >
            Rankings
            <span className="btn-icon">
              <Trophy className="w-3 h-3" />
            </span>
          </button>
        )}
        {onToggleCompare && (
          <button
            onClick={onToggleCompare}
            title={compareMode ? "Exit compare mode" : "Compare two universities"}
            className={`btn-ql ${compareMode ? "btn-ql-active" : "btn-ql-secondary"}`}
          >
            {compareMode ? "Comparing" : "Compare"}
            <span className="btn-icon">
              {compareMode && compareLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <GitCompareArrows className="w-3 h-3" />
              )}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) {
    return (
      <p className="text-sm truncate" style={{ color: "var(--text-2)" }}>
        {name}
      </p>
    );
  }
  return (
    <p className="text-sm truncate" style={{ color: "var(--text-2)" }}>
      {name.slice(0, idx)}
      <span className="font-medium" style={{ color: "var(--text)" }}>
        {name.slice(idx, idx + query.length)}
      </span>
      {name.slice(idx + query.length)}
    </p>
  );
}
