# Projectr Analytics — System Architecture

## What We're Building

A data journalism platform that tracks institutional investor ownership of single-family homes in Austin, TX. The core question: **Wall Street-backed firms bought thousands of houses in Austin. What happened to those neighborhoods?**

The platform identifies properties owned by institutional investors (Invitation Homes, American Homes 4 Rent, Progress Residential, Tricon, and their shell LLCs), maps them geospatially, and overlays neighborhood-level data on rent increases, homeownership rate changes, and demographic shifts to tell a three-act story:

1. **Before** — What did the neighborhood look like pre-acquisition?
2. **The Wave** — When did institutional buying spike? (2020–2022)
3. **After** — Did rents rise? Did homeownership fall? Did residents get displaced?

---

## System Overview

```
TCAD Appraisal Rolls (EARS CSV files, 2021–2025)
        |
        v
[Identification Engine — Python]
  Layer A: Corporate entity keyword matching
  Layer B: Mailing address zip code clustering
        |
        v
[Cleaned CSVs — 501 confirmed institutional properties]
        |
        v
[Enrichment Pipeline — Python]
  Census ACS: homeownership rate, rent, income by tract
  FRED: job growth, unemployment by MSA
  Zillow: monthly rent index by ZIP
        |
        v
[Backend API — FastAPI on Cloud Run]
        |               |
        v               v
[React Frontend]    [Gemini API]
[Firebase Hosting]  (NL queries + insight cards)
        |
        v
[Google Maps JS API — Property pins, tract choropleth, heatmaps]
```

---

## Components

### 1. Identification Engine (Python — Local / Cloud Run)

The engine that cuts through shell company structures to identify which properties in Travis County are owned by institutional investors.

**Input**: TCAD EARS appraisal roll CSVs (one per year, 2021–2025) downloaded from traviscad.org/publicinformation/

**Three identification layers**:

**Layer A — Corporate Entity Keywords**
Regex matching against owner name fields for known institutional patterns:

| Parent Company | Keywords Matched |
|---|---|
| American Homes 4 Rent | `AMH 2014`, `AMH 2015`, `AMH TX PROPERTIES`, `AMH ADDISON`, `AH4R`, `AMERICAN HOMES 4 RENT` |
| Progress Residential | `PROGRESS RESIDENTIAL BORROWER`, `PROGRESS AUSTIN LLC` |
| Tricon | `SFR JV-HD`, `TRICON RESIDENTIAL`, `TRICON AMERICAN HOMES` |
| Invitation Homes | `INVH LP`, `IH3 LP`–`IH6 LP`, `THR PROPERTY`, `STARWOOD WAYPOINT`, `PREEMINENT HOLDINGS` |
| BlackRock | `BLACKROCK REALTY ADVISORS`, `GUTHRIE PROPERTY OWNER` |
| Other | `MAIN STREET RENEWAL`, `FIRSTKEY HOMES` |

**Layer B — Mailing Address Clustering**
Institutional investors route tax bills to corporate HQs regardless of the LLC name on the deed. Flag properties whose mailing address zip matches a known corporate HQ, but only if the owner name contains a corporate entity pattern (LLC, LP, BORROWER, etc.):

| Zip | Company HQ |
|---|---|
| 75201 | Invitation Homes — Dallas, TX |
| 85256 | Progress Residential — Scottsdale, AZ |
| 91302 | American Homes 4 Rent — Calabasas, CA |
| 91301 | AMH alternate — Agoura Hills, CA |
| 89119 | AMH alternate — Las Vegas, NV |

**Data quality safeguards** (implemented in `scripts/clean_data.py`):
- Filter out personal property records (business equipment, not houses)
- Reject bare substring matches that catch street names (Amherst Dr) or person names
- Reject highway references (IH-35) matching IH3/IH4 keywords
- Require corporate entity pattern for zip-based matches
- Deduplicate per property per year

**Output**: Cleaned CSVs per year + a master file with 501 confirmed institutional properties.

### 2. Enrichment Pipeline (Python — Cloud Run)

Layers neighborhood context data onto the institutional ownership map. Sources:

| Source | What It Adds | Geography |
|---|---|---|
| Census ACS | Homeownership rate, median rent, median income, rent burden | Census tract |
| FRED | Job growth, unemployment | MSA (applied uniformly) |
| Zillow Research | Monthly rent index, home value index | ZIP code |
| HUD | Fair Market Rents | County/ZIP |

Each institutional property is geocoded to a census tract. Tracts are then scored by institutional ownership concentration: what percentage of single-family homes in that tract are institutionally owned?

### 3. Backend API (FastAPI — Google Cloud Run)

Serves processed data to the frontend:

- **`GET /properties?city=austin`** — All institutional properties with owner, acquisition year, parent company
- **`GET /tracts?city=austin`** — Census tract summaries: institutional ownership %, rent change, homeownership change
- **`GET /tract/<geo_id>`** — Detailed before/after comparison for a single tract
- **`POST /query`** — Natural language question → Gemini → highlighted tracts + explanation
- **`GET /insights?city=austin`** — AI-generated insight cards from current data

### 4. Gemini API Integration

Two use cases:

**Natural Language Query**: User types "Which neighborhoods saw the biggest rent increases after institutional buying?" → Gemini receives structured tract data, identifies matching areas, returns explanation + geo_ids to highlight on the map.

**Insight Cards**: Auto-generated analyst observations surfaced below the map:
- "Tracts with >15% institutional SFR ownership saw median rent increase 34% vs 18% in comparable tracts"
- "Homeownership rates in the top 10 institutional-ownership tracts dropped an average of 12 points since 2021"

### 5. Frontend (React — Firebase Hosting)

**Map Canvas** — Google Maps with two visualization layers:
- **Property pins**: Individual institutional properties, color-coded by parent company
- **Tract choropleth**: Census tracts shaded by institutional ownership concentration, rent change, or homeownership change

**Neighborhood Panel** — Click a tract to see before/after:
- 2019 vs 2023 homeownership rate
- Rent trajectory (Zillow monthly index)
- Institutional ownership share
- Top institutional buyers in that tract

**Property Panel** — Click a pin to see:
- Owner (shell LLC name → parent company)
- Acquisition year
- Property address

**Comparison Mode** — Pin two tracts side-by-side: one with high institutional ownership, one without. Head-to-head on every metric.

**NL Search Bar** — "Where did homeownership fall the most?" → map highlights matching tracts.

**Insight Cards** — AI-generated observations below the map.

---

## Data Flow

```
TCAD EARS CSVs (raw_tcad_data/, local only, gitignored)
    ↓
scripts/master_pipeline.py → scripts/clean_data.py
    ↓
processed_owners/*.csv (cleaned, committed to repo)
    ↓
enrichment pipeline (Census + FRED + Zillow + HUD)
    ↓
BigQuery or Firestore (normalized, scored data)
    ↓
FastAPI → React + Google Maps
```

---

## Google Technologies

| Technology | Role |
|---|---|
| Google Maps Platform | Property pins, tract choropleth, heatmaps |
| Gemini API | NL query interpretation, insight card generation |
| Google Cloud Run | Hosts enrichment pipeline + backend API |
| BigQuery or Firestore | Processed data storage |
| Firebase Hosting | Frontend deployment |

---

## Repo Structure

```
Projectr_Analytics/
├── .gitignore
├── Architecture.md          ← this file
├── DATA_SOURCES.md          ← data source reference
├── README.md
├── raw_tcad_data/           ← EARS source CSVs (gitignored, local only)
│   ├── 20210925_000416_PTD.csv
│   ├── 227EARS092822.csv
│   ├── 227EARS083023.csv
│   └── 227EARS082824.csv
├── processed_owners/        ← cleaned pipeline output (committed)
│   ├── institutional_owners_2021_PTD.csv
│   ├── institutional_owners_2021.csv
│   ├── institutional_owners_2022.csv
│   ├── institutional_owners_2023.csv
│   ├── institutional_owners_2024.csv
│   ├── institutional_owners_2025.csv
│   ├── institutional_owners_2025_PROP.csv
│   └── institutional_properties_master.csv
└── scripts/
    ├── extract_prop_txt.py   ← extracts ownership from PROP.TXT format
    ├── extract_ptd_csv.py    ← extracts ownership from EARS CSV format
    ├── master_pipeline.py    ← runs extraction across all years
    └── clean_data.py         ← removes false positives, deduplicates, rebuilds master
```

---

## Current Data Summary

**501 confirmed institutional properties** across Travis County, identified from TCAD appraisal rolls 2021–2025.

| Parent Company | Properties | Key LLCs |
|---|---|---|
| American Homes 4 Rent | ~395 | AMH Borrower LLCs, AH4R Properties, AMH TX Properties |
| Progress Residential | ~52 | Progress Residential Borrower LLCs, Progress Austin LLC |
| Tricon | ~37 | SFR JV-HD Borrower LLCs |
| BlackRock | ~3 | Guthrie Property Owner LP, South Lamar Venture LLC |
| Other institutional | ~14 | Mailing address cluster matches |
