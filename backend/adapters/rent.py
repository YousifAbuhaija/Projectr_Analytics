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


async def load_rent_data(city: str, state: str, fips: str = "") -> list[RentData]:
    """Load rent data for a city, trying ApartmentList first, then HUD FMR."""

    # Try HUD FMR as the reliable fallback
    fmr_data = await _fetch_hud_fmr(state, fips)
    if fmr_data:
        return fmr_data

    return []


async def _fetch_hud_fmr(state: str, fips: str = "") -> list[RentData]:
    """Fetch HUD Fair Market Rents for a state (county-level) over multiple years.
    
    If fips is provided, only returns the matching county to build history.
    """
    import asyncio

    if not config.hud_api_key:
        print("[Rent] HUD API key missing. Cannot fetch rent data.")
        return []

    async def fetch_year(client: httpx.AsyncClient, year: int) -> RentData | None:
        url = f"{HUD_FMR_BASE}/statedata/{state}?year={year}"
        try:
            headers = {"Authorization": f"Bearer {config.hud_api_key}"}
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                print(f"[Rent] HUD fetch failed for {year}: HTTP {resp.status_code}")
                return None

            data = resp.json()
            if isinstance(data, dict) and "data" in data:
                counties = data["data"].get("counties", [])
                
                # HUD fips codes are state + county + 99999 (usually 10 digits)
                # If we have a 5-digit fips (like 51121), it matches the start.
                target_fips = f"{fips}99999" if fips and len(fips) == 5 else ""
                
                for entry in counties:
                    entry_fips = entry.get("fips_code", "")
                    
                    if target_fips and entry_fips != target_fips:
                        # Some HUD FMR fips might not have 99999 appended or might differ slightly for metros
                        # so we also check if it starts with the 5-digit FIPS.
                        if fips and not entry_fips.startswith(fips):
                            continue
                            
                    fmr_2br = entry.get("Two-Bedroom", 0)
                    if fmr_2br and float(fmr_2br) > 0:
                        return RentData(
                            city=entry.get("county_name", ""),
                            state=state,
                            year=year,
                            median_rent=float(fmr_2br),
                            source="hud_fmr",
                        )
        except (httpx.HTTPError, ValueError, KeyError):
            pass
        return None

    # Fetch 2022-2026 concurrently to establish a history
    years = [2022, 2023, 2024, 2025, 2026]
    async with httpx.AsyncClient(timeout=15) as client:
        tasks = [fetch_year(client, year) for year in years]
        raw_results = await asyncio.gather(*tasks)
        
    results = [r for r in raw_results if r is not None]
    results.sort(key=lambda r: r.year)
    return results


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
