# Projectr Analytics — Data Sources

Two categories: **ownership data** (identifies which properties are institutionally owned) and **impact data** (measures what happened to the neighborhoods after acquisition).

---

## Ownership Data

### 1. TCAD — Travis County Appraisal District (Primary Source)

The anchor dataset. TCAD maintains the official property tax roll for all parcels in Travis County, including owner name, mailing address, property address, and appraised values.

**Where to download**: [traviscad.org/publicinformation](https://www.traviscad.org/publicinformation/)

**What to download**: EARS (Electronic Appraisal Roll Submission) files — one per year. Look for the PTD CSV in each year's submission. These are 700MB–1GB per year.

**Files currently on disk** (in `raw_tcad_data/`, gitignored):

| File | Year | Size |
|---|---|---|
| `20210925_000416_PTD.csv` | 2021 | 716 MB |
| `227EARS092822.csv` | 2022 | 744 MB |
| `227EARS083023.csv` | 2023 | 760 MB |
| `227EARS082824.csv` | 2024 | 973 MB |

2025 data was extracted separately from PROP.TXT (the certified export format). That file has been processed and deleted — output preserved in `processed_owners/institutional_owners_2025_PROP.csv`.

**Key fields**: Owner name, property ID, property address, mailing address, property type code, appraised value.

**Auth**: None. Public data, free download from the TCAD website.

**How the pipeline uses it**: The identification engine (`scripts/master_pipeline.py` + `scripts/clean_data.py`) streams each year's CSV, matches owner names against known institutional patterns, clusters by mailing address zip codes, filters out false positives, and outputs cleaned per-year CSVs.

### 2. TCAD ArcGIS Parcel API (Supplemental — Geocoding)

For geocoding property addresses to lat/lng coordinates for the map.

**API endpoint**: `https://gis.traviscountytx.gov/server1/rest/services/Boundaries_and_Jurisdictions/TCAD_public/MapServer/0/query`

**Query format**: `?where=1%3D1&outFields=*&f=json&resultOffset=0&resultRecordCount=2000`

Paginate by incrementing `resultOffset` by 2000. Returns parcel geometry with `py_owner_name` field. Updated monthly by Travis County TNR.

**Hub site**: [tnr-traviscountytx.hub.arcgis.com](https://tnr-traviscountytx.hub.arcgis.com/) — downloadable as CSV, GeoJSON, or Shapefile.

**Auth**: None. Public API.

### 3. SEC EDGAR — Corporate Subsidiary Verification

Invitation Homes and AMH file 10-K and 10-Q reports that list their subsidiary LLC names by state. These filings confirm which LLCs belong to which parent company.

**Use case**: Seed the identification engine keyword list with confirmed Texas LLC names rather than guessing patterns.

**Key confirmed entities from SEC filings**:
- Invitation Homes: IH1–IH6 holding entities, THR Property Management LP (Starwood Waypoint legacy)
- AMH: AMH 2014-1/2 Borrower LLC, AMH 2015-1/2 Borrower LLC, AH4R Properties LLC

---

## Impact Data (Neighborhood Context)

### 4. U.S. Census Bureau — American Community Survey (ACS)

The primary source for measuring neighborhood-level impact of institutional buying.

**API**: `https://api.census.gov/data`

**Auth**: Free API key — register at [api.census.gov/data/key_signup.html](https://api.census.gov/data/key_signup.html)

**Dataset**: ACS 5-Year Estimates (`acs/acs5`) — finest geography (census tract level).

**Key variables for the story**:

| Variable | Table | Why It Matters |
|---|---|---|
| Homeownership rate | `B25003_002E` / `B25003_001E` | Owner-occupied / total occupied units — the core metric. Did institutional buying reduce homeownership? |
| Median gross rent | `B25064_001E` | Did rents rise faster in institutional-heavy tracts? |
| Rent burden (>30% of income) | `B25070` table | Are residents paying more of their income toward rent? |
| Median household income | `B19013_001E` | Did the income profile of the neighborhood shift? |
| Total population | `B01003_001E` | Population change — displacement signal |

**Pull for years**: 2019 (pre-wave baseline) and 2023 (post-wave). Compute the delta.

**Geography**: Census tract (11-digit FIPS). Travis County tracts start with `48453`.

**Example API call** (homeownership by tract in Travis County):
```
https://api.census.gov/data/2023/acs/acs5?get=B25003_001E,B25003_002E,NAME&for=tract:*&in=state:48&in=county:453&key=YOUR_KEY
```

### 5. FRED — Federal Reserve Economic Data

MSA-level economic context for Austin.

**API**: `https://api.stlouisfed.org/fred`

**Auth**: Free API key — register at [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html)

**Key series**:

| Series | Description |
|---|---|
| `AUSUR` | Austin unemployment rate |
| `SMU48122000000000001SA` | Austin total nonfarm employment |

**Geography**: Metro/MSA level (Austin-Round Rock-Georgetown). Applied uniformly to all tracts — this is macro context, not neighborhood-level.

**Pull 24 months** for trend calculation.

### 6. Zillow Research Data

Monthly rent and home value indexes — fills the recency gap between annual Census snapshots.

**Access**: Free CSV downloads at [zillow.com/research/data](https://www.zillow.com/research/data/)

**Key datasets**:

| Dataset | Description | Geography |
|---|---|---|
| ZORI (Smoothed, All Homes, Monthly) | Observed rent index | ZIP code |
| ZHVI (All Homes, Monthly) | Home value index | ZIP code |

**Auth**: None. Public CSV downloads.

**Use case**: Monthly rent trend sparklines in the UI. Shows the rent trajectory through the institutional buying wave with much more granularity than Census annual data.

**ZIP-to-tract crosswalk**: Available from HUD at [huduser.gov/portal/datasets/usps_crosswalk.html](https://www.huduser.gov/portal/datasets/usps_crosswalk.html).

### 7. HUD — Fair Market Rents

Annual benchmark for what a modest rental costs in a given area.

**Access**: CSV download at [huduser.gov/portal/datasets/fmr.html](https://www.huduser.gov/portal/datasets/fmr.html) or API at `https://www.huduser.gov/hudapi/public/fmr`

**Auth for API**: Free token from [huduser.gov signup](https://www.huduser.gov/portal/site/huduser/signup)

**Key field**: `fmr_2` (2-bedroom Fair Market Rent) — used as a benchmark to flag markets where actual rents exceed the affordability baseline.

**Geography**: County and ZIP code level.

---

## Institutional Investor Reference

Known institutional SFR buyers active in Austin, their parent companies, and HQ mailing addresses used for Layer B clustering:

| Parent Company | Known LLCs in Travis County | HQ Mailing Zip |
|---|---|---|
| American Homes 4 Rent | AMH 2014-1/2 Borrower LLC, AMH 2015-1/2 Borrower LLC, AH4R I TX LLC, AH4R Properties LLC/Two LLC, AMH TX Properties LP, AMH Addison Development LLC, American Homes 4 Rent Properties Two/Eight LLC, American Homes 4 Rent TRS LLC | 91302 (Calabasas, CA) |
| Progress Residential | Progress Residential Borrower 18/19/20/23/24 LLC, Progress Austin LLC | 85256 (Scottsdale, AZ) |
| Tricon American Homes | SFR JV-HD 2024-1 Borrower LLC | Toronto (US ops via Atlanta) |
| Invitation Homes | INVH LP, IH3–IH6 LP, THR Property, Starwood Waypoint, Preeminent Holdings, 2017–2019 IH Borrower LLCs | 75201 (Dallas, TX) |
| BlackRock (via subsidiaries) | Guthrie Property Owner LP, South Lamar Venture LLC (c/o BlackRock Realty Advisors) | New York / San Francisco |
| Main Street Renewal | Main Street Renewal LLC | Austin, TX |
| FirstKey Homes | FirstKey Homes LLC | Atlanta, GA |

---

## API Key Checklist

| Service | Where to Register | Env Variable |
|---|---|---|
| Census ACS | api.census.gov/data/key_signup.html | `CENSUS_API_KEY` |
| FRED | fred.stlouisfed.org (login → API Keys) | `FRED_API_KEY` |
| HUD | huduser.gov/portal/site/huduser/signup | `HUD_API_TOKEN` |
| Google Maps | console.cloud.google.com | `GOOGLE_MAPS_KEY` |
| Gemini | console.cloud.google.com | `GEMINI_API_KEY` |

TCAD data and Zillow Research CSVs require no authentication.
