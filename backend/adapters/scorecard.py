"""College Scorecard adapter — university metadata, lat/lon, enrollment.

Docs: https://collegescorecard.ed.gov/data/documentation/
Base URL: https://api.data.gov/ed/collegescorecard/v1/schools
Free API key: https://api.data.gov/signup/
"""

import httpx

from backend.config import config
from backend.models.schemas import InstitutionalStrength, UniversityMeta

SCORECARD_BASE = "https://api.data.gov/ed/collegescorecard/v1/schools"

# Fields we need from College Scorecard. Includes the institutional-strength
# fields (endowment, retention, selectivity, ownership, Pell share) so a
# single Scorecard call services both UniversityMeta and InstitutionalStrength.
FIELDS = ",".join([
    "id",
    "school.name",
    "school.city",
    "school.state",
    "location.lat",
    "location.lon",
    "latest.student.size",
    "school.school_url",
    # Institutional-strength fields
    "school.ownership",
    "school.endowment.end",
    "latest.aid.pell_grant_rate",
    "latest.admissions.admission_rate.overall",
    "latest.student.retention_rate.four_year.full_time",
    "latest.student.retention_rate.lt_four_year.full_time",
])

# Map College Scorecard ownership integer → human-readable label.
_OWNERSHIP_LABELS = {
    1: "public",
    2: "private nonprofit",
    3: "private for-profit",
}


def _api_key() -> str:
    """Return user key or data.gov's DEMO_KEY (rate-limited to 30 req/hr)."""
    return config.scorecard_api_key or "DEMO_KEY"


def _parse_result(r: dict) -> UniversityMeta:
    return UniversityMeta(
        unitid=r["id"],
        name=r["school.name"],
        city=r["school.city"],
        state=r["school.state"],
        lat=r["location.lat"],
        lon=r["location.lon"],
        enrollment=r.get("latest.student.size"),
        url=r.get("school.school_url"),
    )


def _parse_strength(r: dict) -> InstitutionalStrength | None:
    """Build an InstitutionalStrength record from a Scorecard result row.

    Returns None when ALL strength fields are missing — that signals to the
    scoring layer that we have nothing to say about this institution and the
    multiplier should stay neutral.
    """
    ownership_raw = r.get("school.ownership")
    endowment = r.get("school.endowment.end")
    pell = r.get("latest.aid.pell_grant_rate")
    admission = r.get("latest.admissions.admission_rate.overall")
    # Retention path varies by school length-of-program. Take whichever is
    # populated first; for 4-year schools that's almost always the four_year
    # field, for community colleges it's the lt_four_year field.
    retention = (
        r.get("latest.student.retention_rate.four_year.full_time")
        or r.get("latest.student.retention_rate.lt_four_year.full_time")
    )

    # If the API returned literally nothing useful, bail out.
    if all(v is None for v in (ownership_raw, endowment, pell, admission, retention)):
        return None

    enrollment = r.get("latest.student.size") or 0
    endowment_per_student = (
        round(endowment / enrollment) if endowment and enrollment > 0 else None
    )

    return InstitutionalStrength(
        ownership=ownership_raw,
        ownership_label=_OWNERSHIP_LABELS.get(ownership_raw or 0),
        endowment_end=endowment,
        endowment_per_student=endowment_per_student,
        pell_grant_rate=pell,
        admission_rate=admission,
        retention_rate=retention,
    )


async def search_university(name: str) -> UniversityMeta | None:
    """Search for a university by name and return metadata.

    Returns the top match or None if not found.
    """
    params = {
        "school.name": name,
        "fields": FIELDS,
        "per_page": 5,
        "api_key": _api_key(),
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(SCORECARD_BASE, params=params)
        if resp.status_code == 429:
            print("[Scorecard] Rate limit exceeded, using mock fallback")
            name_lower = name.lower()
            if "virginia tech" in name_lower or "polytechnic" in name_lower or name_lower == "vtech":
                return UniversityMeta(unitid=233921, name="Virginia Polytechnic Institute and State University", city="Blacksburg", state="VA", lat=37.229012, lon=-80.423675, enrollment=30923)
            elif "university of virginia" in name_lower or name_lower == "uva":
                return UniversityMeta(unitid=234076, name="University of Virginia", city="Charlottesville", state="VA", lat=38.0336, lon=-78.5080, enrollment=26082)
            elif "texas" in name_lower:
                return UniversityMeta(unitid=228778, name="The University of Texas at Austin", city="Austin", state="TX", lat=30.282825, lon=-97.738273, enrollment=42855)
            elif "arizona" in name_lower:
                return UniversityMeta(unitid=104151, name="Arizona State University Campus Immersion", city="Tempe", state="AZ", lat=33.421921, lon=-111.939763, enrollment=64922)
            elif "villanova" in name_lower:
                return UniversityMeta(unitid=216597, name="Villanova University", city="Villanova", state="PA", lat=40.036463, lon=-75.340502, enrollment=6938)
            
            from fastapi import HTTPException
            raise HTTPException(status_code=429, detail="Scorecard API Rate Limit Exceeded. Please add SCORECARD_API_KEY to your .env file.")
            
        if resp.status_code != 200:
            print(f"[Scorecard] Search failed: HTTP {resp.status_code}")
            return None
        data = resp.json()

    results = data.get("results", [])
    if not results:
        return None

    # First try: exact match (case-insensitive)
    name_lower = name.lower()
    exact = next((r for r in results if r.get("school.name", "").lower() == name_lower), None)
    if exact:
        return _parse_result(exact)

    # Second try: matches where the target name contains the query (e.g. "Virginia Tech" inside "Virginia Polytechnic Institute")
    contained = [r for r in results if name_lower in r.get("school.name", "").lower()]
    pool = contained if contained else results

    top = max(pool, key=lambda r: r.get("latest.student.size") or 0)
    return _parse_result(top)


async def get_university_by_id(unitid: int) -> UniversityMeta | None:
    """Fetch a university by its IPEDS unit ID."""
    params = {
        "id": unitid,
        "fields": FIELDS,
        "api_key": _api_key(),
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(SCORECARD_BASE, params=params)
        if resp.status_code != 200:
            print(f"[Scorecard] Lookup failed: HTTP {resp.status_code}")
            return None
        data = resp.json()

    results = data.get("results", [])
    if not results:
        return None

    return _parse_result(results[0])


# ── Combined fetchers that also surface InstitutionalStrength ──
#
# These wrap the search/lookup paths so the scoring pipeline can pull both
# meta and strength from a single Scorecard call. Existing callers that only
# want UniversityMeta (e.g. /hex) can keep using search_university directly.

async def search_university_with_strength(
    name: str,
) -> tuple[UniversityMeta, InstitutionalStrength | None] | None:
    """Search by name and return (meta, strength).

    Strength is None when Scorecard has no finance/admissions data for the
    school (common for very small or newly-opened institutions). The rate-
    limit fallback path returns (meta, None) since the mock metadata doesn't
    carry strength fields.
    """
    params = {
        "school.name": name,
        "fields": FIELDS,
        "per_page": 5,
        "api_key": _api_key(),
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(SCORECARD_BASE, params=params)
        if resp.status_code == 429:
            # Reuse the existing rate-limit fallback by delegating to
            # search_university — strength will be None for these mocks.
            meta = await search_university(name)
            return (meta, None) if meta else None
        if resp.status_code != 200:
            print(f"[Scorecard] Search failed: HTTP {resp.status_code}")
            return None
        data = resp.json()

    results = data.get("results", [])
    if not results:
        return None

    name_lower = name.lower()
    exact = next((r for r in results if r.get("school.name", "").lower() == name_lower), None)
    if exact:
        return _parse_result(exact), _parse_strength(exact)

    contained = [r for r in results if name_lower in r.get("school.name", "").lower()]
    pool = contained if contained else results
    top = max(pool, key=lambda r: r.get("latest.student.size") or 0)
    return _parse_result(top), _parse_strength(top)


async def get_university_by_id_with_strength(
    unitid: int,
) -> tuple[UniversityMeta, InstitutionalStrength | None] | None:
    """Lookup by IPEDS unitid and return (meta, strength)."""
    params = {
        "id": unitid,
        "fields": FIELDS,
        "api_key": _api_key(),
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(SCORECARD_BASE, params=params)
        if resp.status_code != 200:
            print(f"[Scorecard] Lookup failed: HTTP {resp.status_code}")
            return None
        data = resp.json()

    results = data.get("results", [])
    if not results:
        return None

    row = results[0]
    return _parse_result(row), _parse_strength(row)
