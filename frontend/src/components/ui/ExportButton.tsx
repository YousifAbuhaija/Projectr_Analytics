import { useState, useRef, useEffect } from "react";
import { Download, ChevronDown, Loader2 } from "lucide-react";
import type { HousingPressureScore } from "../../lib/api";
import { exportToPDF, exportToDocx, exportToJSON } from "../../lib/exportReport";

interface ExportButtonProps {
  score: HousingPressureScore;
}

export function ExportButton({ score }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<"pdf" | "docx" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handle(format: "pdf" | "docx" | "json") {
    setOpen(false);
    if (format === "json") {
      exportToJSON(score);
      return;
    }
    setLoading(format);
    try {
      if (format === "pdf") await exportToPDF(score);
      else await exportToDocx(score);
    } finally {
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => !isLoading && setOpen((v) => !v)}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                   bg-zinc-800 border border-zinc-700 hover:border-zinc-500
                   text-zinc-400 hover:text-white text-xs font-medium transition-all
                   disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isLoading
          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : <Download className="w-3.5 h-3.5" />}
        Export
        {!isLoading && <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {(
            [
              { key: "pdf",  label: "Download PDF",  sub: "Text-searchable report" },
              { key: "docx", label: "Download Word",  sub: ".docx, fully editable" },
              { key: "json", label: "Download JSON",  sub: "Raw data export" },
            ] as const
          ).map(({ key, label, sub }) => (
            <button
              key={key}
              onClick={() => handle(key)}
              className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors border-b border-zinc-800 last:border-0"
            >
              <p className="text-xs font-medium text-zinc-100">{label}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
