/**
 * HUD Fair Market Rents (FMR) — annual rent estimates by county.
 * Requires HUD_API_TOKEN env variable.
 * Filters to Travis County TX (FIPS 48453) and Fulton County GA (FIPS 13121).
 */
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { config } from '../../config.js';

const HUD_BASE_URL = 'https://www.huduser.gov/hudapi/public/fmr';

// HUD FMR fiscal years (FY2020 = data for 2019 lease periods, etc.)
const FMR_YEARS = [2020, 2021, 2022, 2023, 2024];

interface HudCounty {
  fips_code: string;
  county_name: string;
  year?: number;
  Efficiency?: number;
  'One-Bedroom'?: number;
  'Two-Bedroom'?: number;
  'Three-Bedroom'?: number;
  'Four-Bedroom'?: number;
  // some API versions use different keys
  fmr_0?: number;
  fmr_1?: number;
  fmr_2?: number;
  fmr_3?: number;
  fmr_4?: number;
}

interface HudStateResponse {
  data?: {
    counties?: HudCounty[];
  };
}

const COUNTY_FIPS_MAP: Record<string, { stateCode: string; countyCode: string; state: string }> = {
  Austin: { stateCode: '48', countyCode: '453', state: 'TX' },
  Atlanta: { stateCode: '13', countyCode: '121', state: 'GA' },
};

function extractTwoBedroom(county: HudCounty): number | null {
  // HUD API returns different field names across versions
  const val = county['Two-Bedroom'] ?? county.fmr_2;
  return val != null && !isNaN(Number(val)) ? Number(val) : null;
}

export async function fetchHudFMR(city: string): Promise<number> {
  if (!config.hudToken) {
    logger.warn('[HUD] HUD_API_TOKEN not set — skipping FMR fetch');
    return 0;
  }

  const cfg = COUNTY_FIPS_MAP[city];
  if (!cfg) {
    logger.warn(`[HUD] No FIPS config for city "${city}" — skipping`);
    return 0;
  }

  const targetFips = `${cfg.stateCode}${cfg.countyCode}`;
  logger.info(`[HUD] Fetching FMR for ${city} (FIPS ${targetFips})...`);

  let upserted = 0;

  for (const year of FMR_YEARS) {
    try {
      const res = await fetch(
        `${HUD_BASE_URL}/statedata/${cfg.state}?year=${year}`,
        {
          headers: { Authorization: `Bearer ${config.hudToken}` },
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!res.ok) {
        logger.warn(`[HUD] FY${year} HTTP ${res.status} — skipping`);
        continue;
      }

      const data = await res.json() as HudStateResponse;
      const counties = data.data?.counties ?? [];

      const match = counties.find((c) => {
        const fips = c.fips_code?.replace(/[^0-9]/g, '');
        return fips?.startsWith(targetFips) || fips === targetFips;
      });

      if (!match) {
        logger.warn(`[HUD] No county match for FIPS ${targetFips} in FY${year}`);
        continue;
      }

      const fmr = extractTwoBedroom(match);
      if (!fmr) continue;

      // Store with a city-level ZIP sentinel and the actual year
      const zipSentinel = `FMR_${city.toUpperCase()}`;
      const dataYear = year - 1; // FY2024 ≈ calendar year 2023

      await prisma.priceIndex.upsert({
        where: { zipCode_year_month: { zipCode: zipSentinel, year: dataYear, month: 0 } },
        create: {
          zipCode: zipSentinel,
          year: dataYear,
          month: 0,
          fmr,
          city,
          state: cfg.state,
        },
        update: { fmr },
      });

      upserted++;
      logger.info(`[HUD] FY${year} ${city}: 2BR FMR = $${fmr}`);
    } catch (err) {
      logger.warn(`[HUD] Error FY${year} for ${city}: ${(err as Error).message}`);
    }
  }

  logger.info(`[HUD] Upserted ${upserted} FMR records for ${city}`);
  return upserted;
}
