"""Census Building Permits Survey (BPS) adapter.

Docs: https://api.census.gov/data/timeseries/eits/bps.html
Base URL: https://api.census.gov/data/timeseries/eits/bps
Free API key: https://api.census.gov/data/key_signup.html
"""

import httpx

from backend.config import config
from backend.models.schemas import PermitData

BPS_BASE = "https://api.census.gov/data/timeseries/eits/bps"

# State FIPS codes for quick lookup
STATE_FIPS: dict[str, str] = {
    "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06",
    "CO": "08", "CT": "09", "DE": "10", "FL": "12", "GA": "13",
    "HI": "15", "ID": "16", "IL": "17", "IN": "18", "IA": "19",
    "KS": "20", "KY": "21", "LA": "22", "ME": "23", "MD": "24",
    "MA": "25", "MI": "26", "MN": "27", "MS": "28", "MO": "29",
    "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34",
    "NM": "35", "NY": "36", "NC": "37", "ND": "38", "OH": "39",
    "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45",
    "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50",
    "VA": "51", "WA": "53", "WV": "54", "WI": "55", "WY": "56",
    "DC": "11",
}

PERMIT_YEARS = list(range(2019, 2025))


async def fetch_permits_by_county(
    state_abbr: str,
    county_fips: str,
) -> list[PermitData]:
    """Fetch annual building permit counts for a county.

    Uses county-level BPS data since place-level is often unavailable
    for smaller college towns.
    """
    state_fips = STATE_FIPS.get(state_abbr.upper())
    if not state_fips:
        return []

    results: list[PermitData] = []

    async with httpx.AsyncClient(timeout=20) as client:
        for year in PERMIT_YEARS:
            params: dict[str, str] = {
                "get": "PERMITS",
                "for": f"county:{county_fips}",
                "in": f"state:{state_fips}",
                "time": str(year),
            }
            if config.census_api_key:
                params["key"] = config.census_api_key

            try:
                resp = await client.get(BPS_BASE, params=params)
                if resp.status_code != 200:
                    continue

                rows = resp.json()
                if len(rows) < 2:
                    continue

                # First row is header, rest is data
                header = rows[0]
                permit_idx = header.index("PERMITS") if "PERMITS" in header else 0

                for row in rows[1:]:
                    permits = int(row[permit_idx]) if row[permit_idx] else 0
                    if permits > 0:
                        results.append(PermitData(
                            year=year,
                            permits=permits,
                            fips_place=f"{state_fips}{county_fips}",
                        ))

            except (httpx.HTTPError, ValueError, IndexError):
                continue

    results.sort(key=lambda p: p.year)
    return results


async def fetch_county_fips(lat: float, lon: float) -> tuple[str, str] | None:
    """Look up county FIPS code from lat/lon using Census Geocoder.

    Returns (state_fips, county_fips) or None.
    """
    params = {
        "x": str(lon),
        "y": str(lat),
        "benchmark": "Public_AR_Current",
        "vintage": "Current_Current",
        "format": "json",
    }

    async with httpx.AsyncClient(timeout=10) as client:
        try:
            resp = await client.get(
                "https://geocoding.geo.census.gov/geocoder/geographies/coordinates",
                params=params,
            )
            data = resp.json()

            counties = (
                data.get("result", {})
                .get("geographies", {})
                .get("Counties", [])
            )
            if not counties:
                return None

            county = counties[0]
            return (county["STATE"], county["COUNTY"])

        except (httpx.HTTPError, KeyError):
            return None
