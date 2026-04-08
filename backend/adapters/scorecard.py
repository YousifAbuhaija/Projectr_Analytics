"""College Scorecard adapter — university metadata, lat/lon, enrollment.

Docs: https://collegescorecard.ed.gov/data/documentation/
Base URL: https://api.data.gov/ed/collegescorecard/v1/schools
Free API key: https://api.data.gov/signup/
"""

import httpx

from backend.config import config
from backend.models.schemas import UniversityMeta

SCORECARD_BASE = "https://api.data.gov/ed/collegescorecard/v1/schools"

# Fields we need from College Scorecard
FIELDS = ",".join([
    "id",
    "school.name",
    "school.city",
    "school.state",
    "location.lat",
    "location.lon",
    "latest.student.size",
    "school.school_url",
])


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
