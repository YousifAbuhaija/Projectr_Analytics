"""Census Building Permits adapter — downloads annual county-level BPS CSVs.

The BPS timeseries API is unreliable. Instead, we download the official
annual county-level CSV files directly from Census.

Source: https://www2.census.gov/econ/bps/County/
Format: co{year}a.txt — comma-separated, county-level annual totals.
No API key required. Data available 2019–2023.
"""

import csv
import io

import httpx

from backend.config import config
from backend.models.schemas import PermitData

# State FIPS codes
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

BPS_CSV_BASE = "https://www2.census.gov/econ/bps/County"
PERMIT_YEARS = [2019, 2020, 2021, 2022, 2023]

# In-memory cache so we don't re-download for each university in the same county
_csv_cache: dict[int, list[dict]] = {}


async def _download_bps_csv(year: int) -> list[dict]:
    """Download and parse the annual BPS county CSV for a given year."""
    if year in _csv_cache:
        return _csv_cache[year]

    url = f"{BPS_CSV_BASE}/co{year}a.txt"

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                print(f"[BPS] Failed to download {url}: HTTP {resp.status_code}")
                return []
        except httpx.HTTPError as e:
            print(f"[BPS] Download error for {year}: {e}")
            return []

    lines = resp.text.strip().split("\n")
    # Skip the 2 header rows and the blank line (line index 2)
    data_lines = [l for l in lines[2:] if l.strip() and not l.startswith(" ")]

    rows: list[dict] = []
    for line in data_lines:
        parts = line.split(",")
        if len(parts) < 8:
            continue
        try:
            row = {
                "year": int(parts[0].strip()),
                "state_fips": parts[1].strip().zfill(2),
                "county_fips": parts[2].strip().zfill(3),
                "county_name": parts[5].strip(),
                # Total units = 1-unit + 2-unit + 3-4 unit + 5+ unit
                "units_1": int(parts[7].strip()) if parts[7].strip() else 0,
                "units_2": int(parts[10].strip()) if parts[10].strip() else 0,
                "units_34": int(parts[13].strip()) if parts[13].strip() else 0,
                "units_5plus": int(parts[16].strip()) if parts[16].strip() else 0,
            }
            row["total_units"] = (
                row["units_1"] + row["units_2"] +
                row["units_34"] + row["units_5plus"]
            )
            rows.append(row)
        except (ValueError, IndexError):
            continue

    _csv_cache[year] = rows
    print(f"[BPS] Loaded {len(rows)} county records for {year}")
    return rows


async def fetch_permits_by_county(
    state_abbr: str,
    county_fips: str,
) -> list[PermitData]:
    """Fetch annual building permit counts for a county across all years."""
    import asyncio

    state_fips = STATE_FIPS.get(state_abbr.upper())
    if not state_fips:
        return []

    # Pad county FIPS to 3 digits
    county_fips = county_fips.zfill(3)

    results: list[PermitData] = []

    # Download all years concurrently
    csv_data = await asyncio.gather(
        *[_download_bps_csv(year) for year in PERMIT_YEARS]
    )

    for year_rows in csv_data:
        for row in year_rows:
            if row["state_fips"] == state_fips and row["county_fips"] == county_fips:
                if row["total_units"] > 0:
                    results.append(PermitData(
                        year=row["year"],
                        permits=row["total_units"],
                        fips_place=f"{state_fips}{county_fips}",
                    ))
                break  # Only one match per county per year

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
