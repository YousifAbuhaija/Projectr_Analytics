"""IPEDS enrollment adapter — 10-year enrollment trends via Urban Institute.

Docs: https://educationdata.urban.org/documentation/
Base URL: https://educationdata.urban.org/api/v1/
No authentication required. Rate limit: ~60 requests/minute.
"""

import httpx

from backend.models.schemas import EnrollmentTrend

URBAN_BASE = "https://educationdata.urban.org/api/v1"

# We pull fall enrollment for the last 10 years
ENROLLMENT_YEARS = list(range(2013, 2024))


async def fetch_enrollment_trend(unitid: int) -> list[EnrollmentTrend]:
    """Fetch 10-year fall enrollment trend for a university.

    Uses the IPEDS fall enrollment dataset via the Urban Institute API.
    All years are fetched concurrently for speed.
    """
    import asyncio

    async def _fetch_year(client: httpx.AsyncClient, year: int) -> EnrollmentTrend | None:
        url = (
            f"{URBAN_BASE}/college-university/ipeds/"
            f"fall-enrollment/{year}/"
            f"?unitid={unitid}"
        )
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            data = resp.json()
            rows = data.get("results", [])
            if not rows:
                return None
            # Sum est_fte (or rep_fte) across all levels of study
            total = 0
            for r in rows:
                fte = r.get("est_fte") or r.get("rep_fte") or r.get("enrollment_fall") or 0
                total += fte
            if total > 0:
                return EnrollmentTrend(year=year, total_enrollment=total)
        except (httpx.HTTPError, KeyError, ValueError):
            pass
        return None

    async with httpx.AsyncClient(timeout=30) as client:
        tasks = [_fetch_year(client, year) for year in ENROLLMENT_YEARS]
        raw_results = await asyncio.gather(*tasks)

    results = [r for r in raw_results if r is not None]
    results.sort(key=lambda e: e.year)
    return results


def compute_enrollment_cagr(trend: list[EnrollmentTrend], years: int = 5) -> float | None:
    """Compute compound annual growth rate over the last N years.

    Returns the CAGR as a percentage (e.g. 2.5 for 2.5% annual growth).
    Returns None if insufficient data.
    """
    if len(trend) < 2:
        return None

    recent = trend[-years:] if len(trend) >= years else trend
    start_val = recent[0].total_enrollment
    end_val = recent[-1].total_enrollment
    n_years = recent[-1].year - recent[0].year

    if start_val <= 0 or n_years <= 0:
        return None

    cagr = ((end_val / start_val) ** (1 / n_years) - 1) * 100
    return round(cagr, 2)
