import { ShieldCheck } from "lucide-react";
import { LANDING_COPY } from "@/lib/landing/content";

const TECH_CHIPS = [
  { label: "Gmail API", abbr: "G", color: "#4285F4" },
  { label: "Supabase", abbr: "S", color: "#3ECF8E" },
  { label: "Claude AI", abbr: "A", color: "#D97757" },
];

export default function TrustStrip() {
  return (
    <div className="bg-[#0A0A0B] text-white border-b border-gray-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Privacy promise */}
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <ShieldCheck className="size-4 shrink-0 text-emerald-500" />
          <span>{LANDING_COPY.trust}</span>
        </div>

        {/* Powered-by chips */}
        <div className="flex items-center  gap-2 shrink-0">
          <span className="text-xs text-gray-300 mr-1">Powered by</span>
          {TECH_CHIPS.map(({ label, abbr, color }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-muted/50 px-2.5 py-1 text-xs text-gray-100"
            >
              <span
                className="inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-gray-300"
                style={{ backgroundColor: color }}
              >
                {abbr}
              </span>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
