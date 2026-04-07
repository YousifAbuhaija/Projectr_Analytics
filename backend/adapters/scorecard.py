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
        if resp.status_code != 200:
            print(f"[Scorecard] Search failed: HTTP {resp.status_code}")
            return None
        data = resp.json()

    results = data.get("results", [])
    if not results:
        return None

    top = max(results, key=lambda r: r.get("latest.student.size") or 0)
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
