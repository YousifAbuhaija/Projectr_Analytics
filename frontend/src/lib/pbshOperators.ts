// ── PBSH Operator Detection ───────────────────────────────────────────────────
//
// Two-signal approach:
//
//   Option A — automated name matching: run fragment patterns against
//   owner_name in tax-record parcel data. Catches operators land-banking
//   (holding vacant parcels). False-negative rate is high for built PBSH
//   (operators use opaque LLCs) but the signal is free and automated.
//
//   Option B — curated market fixture: hand-researched presence data keyed by
//   "City, ST". Authoritative for built, operating properties. Needs periodic
//   update as operators enter/exit markets.
//
// Add new entries to either list as markets are expanded.
// ─────────────────────────────────────────────────────────────────────────────

// ── Option A: Name fragment matching ─────────────────────────────────────────

export interface PBSHNameFragment {
  fragment: string; // uppercase substring to match against owner_name
  operator: string; // brand / company name to display
}

// Patterns are sorted roughly by match specificity (more specific first).
// Each parcel is only counted once (first matching fragment wins).
export const PBSH_NAME_FRAGMENTS: PBSHNameFragment[] = [
  { fragment: "AMERICAN CAMPUS", operator: "ACC" },
  { fragment: "ACC PROPERTIES", operator: "ACC" },
  { fragment: "ACC OP LP", operator: "ACC" },
  { fragment: "GREYSTAR", operator: "Greystar" },
  { fragment: "EDUCATION REALTY", operator: "Greystar/EdR" }, // EdR merged into Greystar
  { fragment: "LANDMARK PROP", operator: "Landmark" },
  { fragment: "LANDMARK APART", operator: "Landmark" },
  { fragment: "CORE SPACES", operator: "Core Spaces" },
  { fragment: "HUB STUDENT", operator: "Core Spaces" }, // The Hub brand
  { fragment: "SCION GROUP", operator: "Scion Group" },
  { fragment: "SCION STUDENT", operator: "Scion Group" },
  { fragment: "TRINITAS", operator: "Trinitas" },
  { fragment: "PREISS COMPANY", operator: "Preiss Co." },
  { fragment: "PREISS STUDENT", operator: "Preiss Co." },
  { fragment: "CAPSTONE COLLEGIATE", operator: "Capstone" },
  { fragment: "ASSET CAMPUS", operator: "Asset Campus" },
  { fragment: "CAMPUS ADVANTAGE", operator: "Campus Advantage" },
  { fragment: "ASPEN HEIGHTS", operator: "Aspen Heights" },
  { fragment: "BALFOUR BEATTY", operator: "Balfour Beatty" },
  { fragment: "CORVIAS", operator: "Corvias" },
  { fragment: "WATERMARK RESIDENTIAL", operator: "Watermark" },
  { fragment: "VESPER HOLDINGS", operator: "Vesper" },
  { fragment: "COLLEGIATE HOUSING", operator: "Collegiate Housing Partners" },
  { fragment: "PIERCE EDUCATION", operator: "Pierce Education" },
  { fragment: "CA STUDENT LIVING", operator: "CA Student Living" },
  { fragment: "INLAND AMERICAN", operator: "Inland American" },
  { fragment: "USTUDENT", operator: "UStudent" },
];

/** Run Option-A matching against a list of parcels with owner_name. */
export function detectPBSHFromParcels(
  parcels: Array<{ owner_name: string }>,
): Array<{ operator: string; parcel_count: number }> {
  const counts: Record<string, number> = {};
  for (const parcel of parcels) {
    if (!parcel.owner_name) continue;
    const upper = parcel.owner_name.toUpperCase();
    for (const { fragment, operator } of PBSH_NAME_FRAGMENTS) {
      if (upper.includes(fragment)) {
        counts[operator] = (counts[operator] ?? 0) + 1;
        break; // one match per parcel
      }
    }
  }
  return Object.entries(counts)
    .map(([operator, parcel_count]) => ({ operator, parcel_count }))
    .sort((a, b) => b.parcel_count - a.parcel_count);
}

// ── Option B: Curated market fixture ─────────────────────────────────────────

export interface PBSHOperatorEntry {
  operator: string;
  property_count: number; // approximate known properties in this market
  dominant: boolean; // this operator has plurality or majority presence
  note?: string;
}

export interface PBSHMarketInfo {
  operators: PBSHOperatorEntry[];
  last_verified?: string; // rough date of last manual check (YYYY-MM)
}

/**
 * Curated institutional PBSH presence by market.
 * Key format: "City, ST" — matches university.city + ", " + university.state.
 *
 * Property counts are approximate (±1). Add / update as new deals close.
 * Markets not listed here have no curated data (not necessarily empty).
 */
export const PBSH_CURATED: Record<string, PBSHMarketInfo> = {
  // ── Big Ten ────────────────────────────────────────────────────────────────
  "Columbus, OH": {
    operators: [
      {
        operator: "ACC",
        property_count: 4,
        dominant: true,
        note: "University Commons, others near OSU",
      },
      { operator: "Greystar", property_count: 2, dominant: false },
      { operator: "Scion Group", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Ann Arbor, MI": {
    operators: [
      {
        operator: "Core Spaces",
        property_count: 2,
        dominant: false,
        note: "The Hub brand",
      },
      { operator: "ACC", property_count: 1, dominant: false },
      { operator: "Greystar", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Champaign, IL": {
    operators: [
      {
        operator: "Core Spaces",
        property_count: 2,
        dominant: true,
        note: "The Hub brand",
      },
      { operator: "ACC", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Madison, WI": {
    operators: [
      {
        operator: "Core Spaces",
        property_count: 2,
        dominant: false,
        note: "The Hub brand",
      },
      { operator: "Greystar", property_count: 2, dominant: false },
      { operator: "Landmark", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "College Park, MD": {
    operators: [
      {
        operator: "Core Spaces",
        property_count: 1,
        dominant: false,
        note: "The Hub at College Park",
      },
      { operator: "Greystar", property_count: 2, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Minneapolis, MN": {
    operators: [{ operator: "Greystar", property_count: 2, dominant: false }],
    last_verified: "2025-01",
  },
  "West Lafayette, IN": {
    operators: [{ operator: "ACC", property_count: 2, dominant: false }],
    last_verified: "2025-01",
  },
  "Lincoln, NE": {
    operators: [{ operator: "ACC", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "East Lansing, MI": {
    operators: [
      { operator: "ACC", property_count: 2, dominant: false },
      { operator: "Greystar", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },

  // ── SEC ───────────────────────────────────────────────────────────────────
  "Austin, TX": {
    operators: [
      {
        operator: "ACC",
        property_count: 5,
        dominant: true,
        note: "Multiple complexes near UT Austin",
      },
      { operator: "Greystar", property_count: 3, dominant: false },
      { operator: "Core Spaces", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "College Station, TX": {
    operators: [{ operator: "ACC", property_count: 3, dominant: true }],
    last_verified: "2025-01",
  },
  "Gainesville, FL": {
    operators: [
      { operator: "ACC", property_count: 3, dominant: true },
      { operator: "Landmark", property_count: 2, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Tuscaloosa, AL": {
    operators: [
      { operator: "Landmark", property_count: 2, dominant: false },
      { operator: "Greystar", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Athens, GA": {
    operators: [
      {
        operator: "Landmark",
        property_count: 2,
        dominant: false,
        note: "The Mark at Athens",
      },
      { operator: "Greystar", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Knoxville, TN": {
    operators: [
      { operator: "ACC", property_count: 1, dominant: false },
      { operator: "Landmark", property_count: 2, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Baton Rouge, LA": {
    operators: [
      { operator: "ACC", property_count: 2, dominant: false },
      { operator: "Landmark", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Columbia, SC": {
    operators: [
      { operator: "Landmark", property_count: 1, dominant: false },
      { operator: "ACC", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Columbia, MO": {
    operators: [{ operator: "ACC", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },

  // ── ACC ───────────────────────────────────────────────────────────────────
  "Blacksburg, VA": {
    operators: [{ operator: "ACC", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "Charlottesville, VA": {
    operators: [{ operator: "ACC", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "Chapel Hill, NC": {
    operators: [{ operator: "Greystar", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "Raleigh, NC": {
    operators: [
      { operator: "Greystar", property_count: 2, dominant: false },
      { operator: "Landmark", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Clemson, SC": {
    operators: [{ operator: "ACC", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "Pittsburgh, PA": {
    operators: [{ operator: "Greystar", property_count: 2, dominant: false }],
    last_verified: "2025-01",
  },
  "Atlanta, GA": {
    operators: [
      { operator: "Greystar", property_count: 2, dominant: false },
      { operator: "ACC", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Tallahassee, FL": {
    operators: [
      { operator: "Landmark", property_count: 1, dominant: false },
      { operator: "Greystar", property_count: 1, dominant: false },
    ],
    last_verified: "2025-01",
  },

  // ── Big 12 ────────────────────────────────────────────────────────────────
  "Tempe, AZ": {
    operators: [
      { operator: "ACC", property_count: 3, dominant: true },
      { operator: "Greystar", property_count: 2, dominant: false },
    ],
    last_verified: "2025-01",
  },
  "Lawrence, KS": {
    operators: [{ operator: "Greystar", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "Norman, OK": {
    operators: [{ operator: "ACC", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "Fayetteville, AR": {
    operators: [{ operator: "Landmark", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "Salt Lake City, UT": {
    operators: [{ operator: "Greystar", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "Boulder, CO": {
    operators: [{ operator: "Greystar", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },

  // ── Pac-12 / West ─────────────────────────────────────────────────────────
  "Seattle, WA": {
    operators: [{ operator: "Greystar", property_count: 2, dominant: false }],
    last_verified: "2025-01",
  },
  "Eugene, OR": {
    operators: [{ operator: "ACC", property_count: 1, dominant: false }],
    last_verified: "2025-01",
  },
  "Los Angeles, CA": {
    operators: [
      { operator: "ACC", property_count: 1, dominant: false },
      { operator: "Greystar", property_count: 3, dominant: false },
    ],
    last_verified: "2025-01",
  },
};

// ── Concentration helpers ─────────────────────────────────────────────────────

export type ConcentrationLevel = "None" | "Low" | "Medium" | "High";

export function getConcentrationLevel(
  operators: PBSHOperatorEntry[],
): ConcentrationLevel {
  if (operators.length === 0) return "None";
  const totalProps = operators.reduce((s, o) => s + o.property_count, 0);
  const hasDominant = operators.some((o) => o.dominant);
  if (hasDominant || operators.length >= 3 || totalProps >= 6) return "High";
  if (operators.length >= 2 || totalProps >= 3) return "Medium";
  return "Low";
}

export function concentrationStyle(level: ConcentrationLevel): {
  bg: string;
  text: string;
  dot: string;
  label: string;
} {
  switch (level) {
    case "High":
      return {
        bg: "#fee2e2",
        text: "#991b1b",
        dot: "#ef4444",
        label: "High competition",
      };
    case "Medium":
      return {
        bg: "#ffedd5",
        text: "#9a3412",
        dot: "#f97316",
        label: "Moderate competition",
      };
    case "Low":
      return {
        bg: "#fef9c3",
        text: "#854d0e",
        dot: "#ca8a04",
        label: "Low competition",
      };
    default:
      return {
        bg: "#f0fdf4",
        text: "#15803d",
        dot: "#22c55e",
        label: "Clear market",
      };
  }
}
