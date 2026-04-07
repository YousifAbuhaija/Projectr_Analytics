"""Pydantic models for CampusLens API requests and responses."""

from pydantic import BaseModel, Field


class UniversityMeta(BaseModel):
    """Core university metadata from College Scorecard."""

    unitid: int
    name: str
    city: str
    state: str
    lat: float
    lon: float
    enrollment: int | None = None
    url: str | None = None


class EnrollmentTrend(BaseModel):
    """Year-over-year enrollment data from IPEDS."""

    year: int
    total_enrollment: int


class PermitData(BaseModel):
    """Building permits from Census BPS."""

    year: int
    permits: int
    fips_place: str = ""


class HousingUnits(BaseModel):
    """Housing unit count from Census ACS."""

    fips_tract: str
    total_units: int
    year: int = 2023


class RentData(BaseModel):
    """Rent data from ApartmentList or HUD FMR."""

    city: str
    state: str
    year: int
    month: int | None = None
    median_rent: float
    source: str = "apartmentlist"  # or "hud_fmr"


class ScoreComponents(BaseModel):
    """Individual components of the Housing Pressure Score."""

    enrollment_pressure: float = Field(ge=0, le=100, description="Enrollment growth component (0-100)")
    permit_gap: float = Field(ge=0, le=100, description="Permit shortfall component (0-100)")
    rent_pressure: float = Field(ge=0, le=100, description="Rent growth component (0-100)")


class HousingPressureScore(BaseModel):
    """Complete Housing Pressure Score for a university market."""

    university: UniversityMeta
    score: float = Field(ge=0, le=100, description="Overall pressure score (0-100)")
    components: ScoreComponents
    enrollment_trend: list[EnrollmentTrend] = []
    permit_history: list[PermitData] = []
    rent_history: list[RentData] = []
    nearby_housing_units: int | None = None
    gemini_summary: str | None = None
    scored_at: str = ""


class ScoreRequest(BaseModel):
    """Request to compute a score for a university."""

    university_name: str
    unitid: int | None = None


class UniversityListItem(BaseModel):
    """Abbreviated university for the national map."""

    unitid: int
    name: str
    city: str
    state: str
    lat: float
    lon: float
    score: float
    score_label: str = ""  # "high", "medium", "low"
