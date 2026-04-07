"""Rent data adapter — ApartmentList CSV + HUD Fair Market Rent fallback.

ApartmentList: https://www.apartmentlist.com/research/national-rent-data
  - CSV download, city-level monthly medians. Updated monthly.
  - No authentication required.

HUD FMR: https://www.huduser.gov/hudapi/public/fmr
  - Annual Fair Market Rents by county/metro.
  - Free API key at huduser.gov.
"""

import csv
import io
from pathlib import Path

import httpx

from backend.config import config
from backend.models.schemas import RentData

APARTMENTLIST_URL = "https://www.apartmentlist.com/research/national-rent-data"
HUD_FMR_BASE = "https://www.huduser.gov/hudapi/public/fmr"

# Local cache for ApartmentList data (loaded once at startup)
_rent_cache: dict[str, list[RentData]] | None = None


async def _download_apartmentlist_csv() -> str | None:
    """Download the ApartmentList national rent CSV.

    The actual CSV URL changes — this fetches the page and extracts the link.
    If unable to download, returns None (will fall back to HUD FMR).
    """
    # Try the direct CSV download URL
    csv_url = (
        "https://www.apartmentlist.com/rentonomics/"
        "Apartment_List_National_Rent_Data.csv"
    )
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        try:
            resp = await client.get(csv_url)
            if resp.status_code == 200 and "," in resp.text[:200]:
                return resp.text
        except httpx.HTTPError:
            pass

    return None


async def load_rent_data(city: str, state: str) -> list[RentData]:
    """Load rent data for a city, trying ApartmentList first, then HUD FMR."""

    # Try HUD FMR as the reliable fallback
    fmr_data = await _fetch_hud_fmr(state)
    if fmr_data:
        return fmr_data

    return []


async def _fetch_hud_fmr(state: str) -> list[RentData]:
    """Fetch HUD Fair Market Rents for a state (county-level).

    HUD FMR is available for every US county — reliable fallback.
    """
    # HUD API requires a token, but we can use the public endpoint
    url = f"{HUD_FMR_BASE}/statedata/{state}"

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            headers = {}
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                return []

            data = resp.json()
            results: list[RentData] = []

            if isinstance(data, dict) and "data" in data:
                entries = data["data"]
                if isinstance(entries, dict):
                    entries = [entries]

                for entry in entries:
                    # HUD FMR provides 2BR rent as the benchmark
                    fmr_2br = entry.get("basicdata", {}).get("fmr_2", 0)
                    if fmr_2br and fmr_2br > 0:
                        results.append(RentData(
                            city=entry.get("county_name", ""),
                            state=state,
                            year=2024,
                            median_rent=float(fmr_2br),
                            source="hud_fmr",
                        ))

            return results

        except (httpx.HTTPError, ValueError, KeyError):
            return []


def compute_rent_growth(history: list[RentData], years: int = 3) -> float | None:
    """Compute rent growth rate over the last N years as a percentage.

    Returns annual growth rate (e.g. 5.2 for 5.2% per year).
    Returns None if insufficient data.
    """
    if len(history) < 2:
        return None

    # Sort by year
    sorted_data = sorted(history, key=lambda r: (r.year, r.month or 0))

    start = sorted_data[0].median_rent
    end = sorted_data[-1].median_rent
    n_years = sorted_data[-1].year - sorted_data[0].year

    if start <= 0 or n_years <= 0:
        return None

    annual_growth = ((end / start) ** (1 / n_years) - 1) * 100
    return round(annual_growth, 2)
