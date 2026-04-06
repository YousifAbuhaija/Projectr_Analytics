/**
 * Census ACS 5-year estimates for tract-level housing + demographic metrics.
 * Variables fetched for years 2019–2023 for a given county.
 * No API key required (key optional for higher rate limits).
 */
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { config } from '../../config.js';

const ACS_YEARS = [2019, 2020, 2021, 2022, 2023];

const ACS_VARS = [
  'B25003_001E', // Total occupied housing units
  'B25003_002E', // Owner-occupied housing units
  'B25064_001E', // Median gross rent
  'B19013_001E', // Median household income
  'B01003_001E', // Total population
  'B02001_002E', // White alone
  'B02001_003E', // Black or African American alone
  'B03003_003E', // Hispanic or Latino
  'B02001_005E', // Asian alone
  'NAME',
].join(',');

interface CensusCountyConfig {
  stateCode: string;
  countyCode: string;
  stateAbbr: string;
}

const COUNTY_MAP: Record<string, CensusCountyConfig> = {
  Austin: { stateCode: '48', countyCode: '453', stateAbbr: 'TX' },
  Atlanta: { stateCode: '13', countyCode: '121', stateAbbr: 'GA' },
};

export async function fetchCensusACS(city: string): Promise<number> {
  const cfg = COUNTY_MAP[city];
  if (!cfg) {
    logger.warn(`[Census] No config for city "${city}" — skipping`);
    return 0;
  }

  let totalUpserted = 0;

  for (const year of ACS_YEARS) {
    const params = new URLSearchParams({
      get: ACS_VARS,
      for: 'tract:*',
      in: `state:${cfg.stateCode} county:${cfg.countyCode}`,
    });
    if (config.censusKey) params.set('key', config.censusKey);

    try {
      const res = await fetch(
        `https://api.census.gov/data/${year}/acs/acs5?${params}`,
        { signal: AbortSignal.timeout(30_000) },
      );

      if (!res.ok) {
        logger.warn(`[Census] ACS ${year} HTTP ${res.status} — skipping year`);
        continue;
      }

      const rows = await res.json() as string[][];
      const dataRows = rows.slice(1); // first row is header

      const records = dataRows.map((row) => {
        const [
          totalHousingStr,
          ownerOccupiedStr,
          medianRentStr,
          medianIncomeStr,
          totalPopStr,
          whiteStr,
          blackStr,
          hispanicStr,
          asianStr,
          /* NAME */,
          stateCode,
          countyCode,
          tractCode,
        ] = row;

        const totalHousing = parseInt(totalHousingStr);
        const ownerOccupied = parseInt(ownerOccupiedStr);
        const medianRent = parseInt(medianRentStr);
        const medianIncome = parseInt(medianIncomeStr);
        const totalPop = parseInt(totalPopStr);
        const white = parseInt(whiteStr);
        const black = parseInt(blackStr);
        const hispanic = parseInt(hispanicStr);
        const asian = parseInt(asianStr);

        const fipsTract = `${stateCode}${countyCode}${tractCode}`;

        const safeDiv = (n: number, d: number) =>
          d > 0 && !isNaN(n) && !isNaN(d) ? (n / d) * 100 : null;

        return {
          fipsTract,
          year,
          medianIncome: isNaN(medianIncome) || medianIncome < 0 ? null : medianIncome,
          medianRent: isNaN(medianRent) || medianRent < 0 ? null : medianRent,
          totalHousingUnits: isNaN(totalHousing) || totalHousing < 0 ? null : totalHousing,
          homeownershipRate: safeDiv(ownerOccupied, totalHousing),
          pctRenter: safeDiv(totalHousing - ownerOccupied, totalHousing),
          pctWhite: safeDiv(white, totalPop),
          pctBlack: safeDiv(black, totalPop),
          pctHispanic: safeDiv(hispanic, totalPop),
          pctAsian: safeDiv(asian, totalPop),
          city,
          state: cfg.stateAbbr,
        };
      });

      // Upsert in batches of 50
      for (let i = 0; i < records.length; i += 50) {
        const batch = records.slice(i, i + 50);
        await Promise.all(
          batch.map((r) =>
            prisma.tractMetrics.upsert({
              where: { fipsTract_year: { fipsTract: r.fipsTract, year: r.year } },
              create: r,
              update: {
                medianIncome: r.medianIncome,
                medianRent: r.medianRent,
                totalHousingUnits: r.totalHousingUnits,
                homeownershipRate: r.homeownershipRate,
                pctRenter: r.pctRenter,
                pctWhite: r.pctWhite,
                pctBlack: r.pctBlack,
                pctHispanic: r.pctHispanic,
                pctAsian: r.pctAsian,
              },
            }),
          ),
        );
        totalUpserted += batch.length;
      }

      logger.info(`[Census] ACS ${year} ${city}: upserted ${records.length} tracts`);
    } catch (err) {
      logger.warn(`[Census] Error on ACS ${year} for ${city}: ${(err as Error).message}`);
    }
  }

  return totalUpserted;
}
