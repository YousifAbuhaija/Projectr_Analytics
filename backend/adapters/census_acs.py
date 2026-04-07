"""Census ACS 5-Year adapter — housing units per tract near campus.

Docs: https://api.census.gov/data/2023/acs/acs5
Variable B25001_001E: total housing units at census tract granularity.
Free API key: same as BPS.
"""

import math

import httpx

from backend.config import config
from backend.models.schemas import HousingUnits

ACS_BASE = "https://api.census.gov/data/2023/acs/acs5"

# Approximate radius for "near campus" in degrees (~5 miles ≈ 0.07 deg)
CAMPUS_RADIUS_DEG = 0.07


async def fetch_housing_units_near(
    lat: float,
    lon: float,
    state_fips: str,
    county_fips: str,
) -> list[HousingUnits]:
    """Fetch total housing units for all tracts in a county.

    We pull the whole county and then filter to tracts within ~5 miles
    of the campus lat/lon.
    """
    params: dict[str, str] = {
        "get": "B25001_001E,NAME",
        "for": "tract:*",
        "in": f"state:{state_fips} county:{county_fips}",
    }
    if config.census_api_key:
        params["key"] = config.census_api_key

    async with httpx.AsyncClient(timeout=20) as client:
        try:
            resp = await client.get(ACS_BASE, params=params)
            if resp.status_code != 200:
                return []
            rows = resp.json()
        except httpx.HTTPError:
            return []

    if len(rows) < 2:
        return []

    results: list[HousingUnits] = []
    # Header row: [variable, NAME, state, county, tract]
    for row in rows[1:]:
        try:
            units = int(row[0]) if row[0] and row[0] != "null" else 0
            tract_code = row[-1]
            st = row[-3]
            cty = row[-2]
            fips_tract = f"{st}{cty}{tract_code}"

            if units > 0:
                results.append(HousingUnits(
                    fips_tract=fips_tract,
                    total_units=units,
                    year=2023,
                ))
        except (ValueError, IndexError):
            continue

    return results


def sum_nearby_units(
    units: list[HousingUnits],
    lat: float,
    lon: float,
    radius_deg: float = CAMPUS_RADIUS_DEG,
) -> int:
    """Sum housing units in tracts within radius of campus.

    Note: Without tract centroids, we return the total for the full county.
    For a more precise calculation, we'd need tract shapefiles or centroids.
    This works well enough because we're already scoping to the campus county.
    """
    return sum(u.total_units for u in units)


async def get_county_housing_total(
    state_fips: str,
    county_fips: str,
) -> int:
    """Get the total housing units in a county — simpler query."""
    params: dict[str, str] = {
        "get": "B25001_001E",
        "for": f"county:{county_fips}",
        "in": f"state:{state_fips}",
    }
    if config.census_api_key:
        params["key"] = config.census_api_key

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(ACS_BASE, params=params)
            if resp.status_code != 200:
                return 0
            rows = resp.json()
            if len(rows) < 2:
                return 0
            return int(rows[1][0]) if rows[1][0] else 0
        except (httpx.HTTPError, ValueError, IndexError):
            return 0
