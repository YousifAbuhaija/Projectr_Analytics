import {
  TrendingUp,
  Building2,
  DollarSign,
  MapPin,
  RefreshCw,
  BedDouble,
  Home,
  CloudRain,
  GraduationCap,
  Warehouse,
  Scale,
  ShieldAlert,
} from "lucide-react";
import { ScoreGauge } from "../ui/ScoreGauge";
import { EnrollmentChart } from "../charts/EnrollmentChart";
import { RentChart } from "../charts/RentChart";
import { PermitChart } from "../charts/PermitChart";
import { ExportButton } from "../ui/ExportButton";
import type { HousingPressureScore } from "../../lib/api";
import {
  PBSH_CURATED,
  getConcentrationLevel,
  concentrationStyle,
} from "../../lib/pbshOperators";

// "high" pressure score = good developer opportunity (undersupplied market).
// We keep the internal label keys (high/medium/low) so cached scores still
// resolve, but flip the colors and copy so the UI reads as opportunity rather
// than pressure.
const LABEL_STYLES = {
  high: { color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' },
  medium: { color: '#fbbf24', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' },
  low: { color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' },
} as const;

const LABEL_TEXT = {
  high: "Strong Opportunity",
  medium: "Emerging Market",
  low: "Saturated Market",
} as const;

function getLabel(score: number): "high" | "medium" | "low" {
  return score >= 70 ? "high" : score >= 40 ? "medium" : "low";
}

function ChartSection({
  title,
  accentColor,
  children,
}: {
  title: string;
  accentColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: accentColor }}>
        {title}
      </p>
      {children}
    </div>
  );
}

export function ScorePanel({
  score,
  onRecompute,
}: {
  score: HousingPressureScore;
  onRecompute?: () => void;
}) {
  const label = getLabel(score.score);

  const enrollmentFirst = score.enrollment_trend.at(0);
  const enrollmentLast = score.enrollment_trend.at(-1);
  const latestEnrollment = enrollmentLast?.total_enrollment;
  const earliestEnrollment = enrollmentFirst?.total_enrollment;
  const enrollmentChange =
    latestEnrollment && earliestEnrollment
      ? (
          ((latestEnrollment - earliestEnrollment) / earliestEnrollment) *
          100
        ).toFixed(1)
      : null;
  const enrollmentPeriod =
    enrollmentFirst && enrollmentLast
      ? `${enrollmentFirst.year}–${enrollmentLast.year}`
      : null;

  const rentFirst = score.rent_history.at(0);
  const rentLast = score.rent_history.at(-1);
  const latestRent = rentLast?.median_rent;
  const earliestRent = rentFirst?.median_rent;
  const rentChange =
    latestRent && earliestRent
      ? (((latestRent - earliestRent) / earliestRent) * 100).toFixed(1)
      : null;
  const rentPeriod =
    rentFirst && rentLast ? `${rentFirst.year}–${rentLast.year}` : null;

  const totalPermits = score.permit_history.reduce((s, p) => s + p.permits, 0);

  // Supply pipeline risk: permits (5yr) as % of current enrollment.
  // Research thresholds: <5% = low risk, 5–8% = moderate, >8% = high risk.
  const pipelinePct =
    latestEnrollment && latestEnrollment > 0 && totalPermits > 0
      ? (totalPermits / latestEnrollment) * 100
      : null;
  const pipelineRiskLabel =
    pipelinePct == null
      ? null
      : pipelinePct < 5
        ? { label: "Low supply risk", color: "text-emerald-400" }
        : pipelinePct < 8
          ? { label: "Moderate supply risk", color: "text-amber-400" }
          : { label: "High supply risk", color: "text-red-400" };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold mb-1 tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
            {score.university.city}, {score.university.state}
          </p>
          <h2 className="text-lg font-semibold leading-tight tracking-tight" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
            {score.university.name}
          </h2>
          {score.university.enrollment && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
              {score.university.enrollment.toLocaleString()} students enrolled
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          <ExportButton score={score} />
          {onRecompute && (
            <button
              onClick={onRecompute}
              title="Re-run live analysis"
              className="btn-ql btn-ql-secondary"
            >
              Recompute
              <span className="btn-icon">
                <RefreshCw className="w-3 h-3" />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Score card */}
      <div className="card-quantum p-5">
        <div className="flex items-start justify-between mb-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            Housing Pressure Score
          </p>
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style={LABEL_STYLES[label]}
          >
            {LABEL_TEXT[label]}
          </span>
        </div>

        <div className="flex justify-center">
          <ScoreGauge score={score.score} label={label} />
        </div>
      </div>

      {/* Gemini summary */}
      {score.gemini_summary && (
        <div className="rounded-xl p-5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.15)' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
              Gemini Market Brief
            </span>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {score.gemini_summary}
          </p>
        </div>
      )}

      {/* 2×2 stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Enrollment</p>
          </div>
          <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
            {latestEnrollment?.toLocaleString() ?? "N/A"}
          </p>
          {enrollmentChange && (
            <p
              className={`text-xs mt-0.5 ${
                parseFloat(enrollmentChange) >= 0
                  ? "text-green-400"
                  : "text-red-400"
              }`}
            >
              {parseFloat(enrollmentChange) >= 0 ? "+" : ""}
              {enrollmentChange}%
              {enrollmentPeriod ? ` (${enrollmentPeriod})` : ""}
            </p>
          )}
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-rose-400" />
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Median Rent</p>
          </div>
          <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
            {latestRent ? `$${latestRent.toLocaleString()}` : "N/A"}
          </p>
          {rentChange && (
            <p
              className={`text-xs mt-0.5 ${
                parseFloat(rentChange) >= 0 ? "text-red-400" : "text-green-400"
              }`}
            >
              {parseFloat(rentChange) >= 0 ? "+" : ""}
              {rentChange}%{rentPeriod ? ` (${rentPeriod})` : ""}
            </p>
          )}
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-3.5 h-3.5 text-purple-400" />
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Permits Filed</p>
          </div>
          <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
            {totalPermits > 0 ? totalPermits.toLocaleString() : "N/A"}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            residential units (5yr)
          </p>
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Supply Pipeline</p>
          </div>
          {pipelinePct != null ? (
            <>
              <p
                className={`text-lg font-bold tabular-nums ${pipelineRiskLabel?.color ?? ""}`}
              >
                {pipelinePct.toFixed(1)}%
              </p>
              <p
                className={`text-xs mt-0.5 ${pipelineRiskLabel?.color ?? ""}`}
              >
                {pipelineRiskLabel?.label}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-3)' }}>N/A</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                permits / enrollment
              </p>
            </>
          )}
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--text-3)' }} />
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Housing Stock</p>
          </div>
          <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
            {score.nearby_housing_units && score.nearby_housing_units > 0
              ? score.nearby_housing_units.toLocaleString()
              : "N/A"}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>county total (ACS)</p>
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <BedDouble className="w-3.5 h-3.5 text-emerald-400" />
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Beds / Student</p>
          </div>
          {score.housing_capacity?.beds_per_student != null ? (
            <p
              className={`text-lg font-bold tabular-nums ${
                score.housing_capacity.beds_per_student < 0.25
                  ? "text-red-400"
                  : score.housing_capacity.beds_per_student > 0.75
                    ? "text-emerald-400"
                    : "text-white"
              }`}
            >
              {score.housing_capacity.beds_per_student.toFixed(2)}
            </p>
          ) : (
            <p className="text-lg font-semibold" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-3)' }}>N/A</p>
          )}
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>on-campus dorm ratio</p>
          {score.master_plan && (
            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[10px] text-amber-400 font-semibold uppercase tracking-wide mb-0.5">
                Planned pipeline
              </p>
              <p className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-2)' }}>
                +{score.master_plan.planned_beds.toLocaleString()} beds
                {score.master_plan.horizon_year
                  ? ` (by ${score.master_plan.horizon_year})`
                  : ""}
              </p>
              {score.master_plan.p3_deal && score.master_plan.p3_partner && (
                <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                  P3 · {score.master_plan.p3_partner}
                </p>
              )}
              <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
                {score.master_plan.confidence} confidence
              </p>
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Home className="w-3.5 h-3.5 text-amber-400" />
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Vacancy Rate</p>
          </div>
          {score.demographics?.vacancy_rate_pct != null ? (
            <p
              className={`text-lg font-bold tabular-nums ${
                score.demographics.vacancy_rate_pct < 3.0
                  ? "text-red-400"
                  : score.demographics.vacancy_rate_pct > 10.0
                    ? "text-emerald-400"
                    : "text-white"
              }`}
            >
              {score.demographics.vacancy_rate_pct.toFixed(1)}%
            </p>
          ) : (
            <p className="text-lg font-semibold" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-3)' }}>N/A</p>
          )}
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>renter market (ACS)</p>
        </div>

        <div className="p-4 rounded-xl" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <CloudRain className="w-3.5 h-3.5 text-sky-400" />
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
              Weather Disasters
            </p>
          </div>
          {score.disaster_risk?.weather_disasters != null ? (
            <p
              className={`text-lg font-bold tabular-nums ${
                score.disaster_risk.weather_disasters >= 10
                  ? "text-red-400"
                  : "text-white"
              }`}
            >
              {score.disaster_risk.weather_disasters}
            </p>
          ) : (
            <p className="text-lg font-semibold" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-3)' }}>N/A</p>
          )}
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-3)' }}>
            FEMA, last {score.disaster_risk?.window_years ?? 10}yr
          </p>
        </div>

        {/* Institutional Strength — Scorecard finance signal */}
        <div className="p-4 rounded-xl col-span-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
              <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Institutional Strength
              </p>
            </div>
            {score.institutional_strength?.strength_label && (
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={
                  score.institutional_strength.strength_label === "strong"
                    ? { color: '#34d399', background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }
                    : score.institutional_strength.strength_label === "watch"
                      ? { color: '#f87171', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }
                      : { color: 'var(--text-2)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)' }
                }
              >
                {score.institutional_strength.strength_label}
              </span>
            )}
          </div>

          {score.institutional_strength ? (
            <>
              {score.institutional_strength.strength_score != null && (
                <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
                  {score.institutional_strength.strength_score.toFixed(0)}
                  <span className="text-xs font-normal" style={{ color: 'var(--text-3)' }}>
                    /100
                  </span>
                </p>
              )}
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Retention</p>
                  <p className="font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>
                    {score.institutional_strength.retention_rate != null
                      ? `${(score.institutional_strength.retention_rate * 100).toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Endow/Stu</p>
                  <p className="font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>
                    {score.institutional_strength.endowment_per_student
                      ? score.institutional_strength.endowment_per_student >=
                        1000
                        ? `$${(score.institutional_strength.endowment_per_student / 1000).toFixed(0)}k`
                        : `$${score.institutional_strength.endowment_per_student}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Admit</p>
                  <p className="font-semibold tabular-nums" style={{ color: 'var(--text-2)' }}>
                    {score.institutional_strength.admission_rate != null
                      ? `${(score.institutional_strength.admission_rate * 100).toFixed(0)}%`
                      : "—"}
                  </p>
                </div>
              </div>
              {score.institutional_strength.ownership_label && (
                <p className="text-[10px] mt-2 capitalize" style={{ color: 'var(--text-3)' }}>
                  {score.institutional_strength.ownership_label}
                </p>
              )}
            </>
          ) : (
            <p className="text-lg font-semibold" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-3)' }}>N/A</p>
          )}
        </div>

        {/* Existing Housing Stock — OSM building footprint within 1.5mi */}
        <div className="p-4 rounded-xl col-span-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Warehouse className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                Existing Housing Stock
              </p>
            </div>
            {score.existing_housing?.saturation_label && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  score.existing_housing.saturation_label === "low"
                    ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                    : score.existing_housing.saturation_label === "high"
                      ? "text-red-400 bg-red-500/10 border-red-500/20"
                      : "text-amber-400 bg-amber-500/10 border-amber-500/20"
                }`}
              >
                {score.existing_housing.saturation_label} saturation
              </span>
            )}
          </div>

          {score.existing_housing ? (
            <>
              <div className="grid grid-cols-3 gap-2 mt-1 text-xs">
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Apartments</p>
                  <p className="font-bold tabular-nums text-base" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
                    {score.existing_housing.apartment_buildings.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Dormitories</p>
                  <p className="font-bold tabular-nums text-base" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
                    {score.existing_housing.dormitory_buildings.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>Houses</p>
                  <p className="font-bold tabular-nums text-base" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
                    {score.existing_housing.house_buildings.toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-[10px] mt-2" style={{ color: 'var(--text-3)' }}>
                {score.existing_housing.apartment_density_per_km2.toFixed(1)}{" "}
                multifamily / km² · {score.existing_housing.radius_miles}mi
                radius
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text-3)' }}>N/A</p>
          )}
        </div>

        {/* Occupancy Ordinance */}
        {score.occupancy_ordinance &&
          score.occupancy_ordinance.ordinance_type !== "none" && (
            <div className="p-4 rounded-xl col-span-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-violet-400" />
                  <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>
                    Occupancy Ordinance
                  </p>
                </div>
                {score.occupancy_ordinance.pbsh_signal === "positive" &&
                  score.occupancy_ordinance.enforced && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                      PBSH Positive
                    </span>
                  )}
              </div>
              <p className="text-lg font-semibold tabular-nums" style={{ fontFamily: "'Inter Tight', sans-serif", color: 'var(--text)' }}>
                {score.occupancy_ordinance.max_unrelated_occupants != null
                  ? `≤${score.occupancy_ordinance.max_unrelated_occupants} unrelated`
                  : "No cap"}
              </p>
              <p
                className="text-xs mt-0.5"
                style={{ color: score.occupancy_ordinance.enforced ? '#fbbf24' : 'var(--text-3)' }}
              >
                {score.occupancy_ordinance.enforced
                  ? "Actively enforced"
                  : "On books, unenforced"}
                {" · "}
                {score.occupancy_ordinance.confidence} confidence
              </p>
              {score.occupancy_ordinance.notes && (
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  {score.occupancy_ordinance.notes}
                </p>
              )}
            </div>
          )}
      </div>

      {/* Institutional PBSH Competition (curated fixture) */}
      {(() => {
        const marketKey = `${score.university.city}, ${score.university.state}`;
        const market = PBSH_CURATED[marketKey];
        const operators = market?.operators ?? [];
        const level = getConcentrationLevel(operators);
        const style = concentrationStyle(level);
        if (level === "None") return null;
        return (
          <div className="rounded-xl p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-orange-400" />
                <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                  Institutional Competition
                </p>
              </div>
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: style.bg, color: style.text }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full inline-block"
                  style={{ background: style.dot }}
                />
                {style.label}
              </span>
            </div>

            <div className="space-y-2">
              {operators.map((op) => (
                <div
                  key={op.operator}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>
                      {op.operator}
                    </span>
                    {op.dominant && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                        Dominant
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
                    {op.note && (
                      <span className="text-[10px] italic truncate max-w-[100px]" style={{ color: 'var(--text-3)' }}>
                        {op.note}
                      </span>
                    )}
                    <span className="font-medium tabular-nums whitespace-nowrap" style={{ color: 'var(--text-2)' }}>
                      ~{op.property_count} propert
                      {op.property_count !== 1 ? "ies" : "y"}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] mt-3" style={{ color: 'var(--text-3)' }}>
              Curated data · verify before underwriting
              {market?.last_verified &&
                ` · last checked ${market.last_verified}`}
            </p>
          </div>
        );
      })()}

      {/* Trend charts */}
      {score.enrollment_trend.length > 1 && (
        <ChartSection title="Enrollment Trend" accentColor="#60a5fa">
          <EnrollmentChart data={score.enrollment_trend} />
        </ChartSection>
      )}

      {score.rent_history.length > 1 && (
        <ChartSection title="Median Rent" accentColor="#fb7185">
          <RentChart data={score.rent_history} />
        </ChartSection>
      )}

      {score.permit_history.length > 1 && (
        <ChartSection title="Building Permits (Annual)" accentColor="#c084fc">
          <PermitChart data={score.permit_history} />
        </ChartSection>
      )}

      {/* Timestamp */}
      {score.scored_at && (
        <p className="text-[10px] text-center pb-2" style={{ color: 'var(--text-3)' }}>
          Scored {new Date(score.scored_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}
