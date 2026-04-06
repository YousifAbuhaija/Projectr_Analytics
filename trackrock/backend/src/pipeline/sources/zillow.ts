/**
 * Zillow ZHVI (Zillow Home Value Index) for single-family residences.
 * Downloads monthly CSV, filters to target city ZIPs, computes annual averages,
 * and upserts into PriceIndex.
 */
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

const ZHVI_URL =
  'https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv';

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024];

// Austin Travis County ZIPs + outlying suburbs commonly included
const AUSTIN_ZIP_RANGE = { min: 78701, max: 78799 };
const AUSTIN_EXTRA_ZIPS = new Set([
  '78610', '78613', '78617', '78640', '78641', '78642',
  '78645', '78646', '78653', '78660', '78664', '78681',
  '78701', '78702', '78703', '78704', '78705', '78712',
  '78717', '78719', '78721', '78722', '78723', '78724',
  '78725', '78726', '78727', '78728', '78729', '78730',
  '78731', '78732', '78733', '78734', '78735', '78736',
  '78737', '78738', '78739', '78741', '78744', '78745',
  '78746', '78747', '78748', '78749', '78750', '78751',
  '78752', '78753', '78754', '78756', '78757', '78758',
  '78759',
]);

// Atlanta Fulton County ZIPs
const ATLANTA_ZIPS = new Set([
  '30301', '30302', '30303', '30304', '30305', '30306', '30307', '30308',
  '30309', '30310', '30311', '30312', '30313', '30314', '30315', '30316',
  '30317', '30318', '30319', '30324', '30326', '30327', '30328', '30329',
  '30331', '30336', '30337', '30338', '30339', '30340', '30341', '30342',
  '30344', '30346', '30349', '30350', '30354', '30363',
]);

function isTargetZip(zip: string, city: string): boolean {
  if (city === 'Austin') {
    const num = parseInt(zip);
    return (num >= AUSTIN_ZIP_RANGE.min && num <= AUSTIN_ZIP_RANGE.max) ||
      AUSTIN_EXTRA_ZIPS.has(zip);
  }
  if (city === 'Atlanta') return ATLANTA_ZIPS.has(zip);
  return false;
}

/** Parse header row to find column indices for a given year's monthly data */
function getYearColumnIndices(headers: string[], year: number): number[] {
  return headers
    .map((h, i) => ({ h, i }))
    .filter(({ h }) => h.startsWith(`${year}-`))
    .map(({ i }) => i);
}

/** Average of valid (non-NaN, positive) values */
function average(values: number[]): number | null {
  const valid = values.filter((v) => !isNaN(v) && v > 0);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

export async function fetchZillowZHVI(city: string): Promise<number> {
  logger.info(`[Zillow] Downloading ZHVI CSV for ${city}...`);

  let csvText: string;
  try {
    const res = await fetch(ZHVI_URL, { signal: AbortSignal.timeout(120_000) });
    if (!res.ok) {
      logger.warn(`[Zillow] Download failed: HTTP ${res.status}`);
      return 0;
    }
    csvText = await res.text();
  } catch (err) {
    logger.warn(`[Zillow] Network error: ${(err as Error).message}`);
    return 0;
  }

  logger.info(`[Zillow] Downloaded ${(csvText.length / 1024 / 1024).toFixed(1)} MB — parsing...`);

  const lines = csvText.split('\n');
  const headers = lines[0].split(',');

  // Column indices for fixed fields
  const regionNameIdx = headers.indexOf('RegionName'); // ZIP code
  const stateIdx = headers.indexOf('State');
  const cityIdx = headers.indexOf('City');

  if (regionNameIdx === -1) {
    logger.warn('[Zillow] Could not find RegionName column — aborting');
    return 0;
  }

  // Pre-compute year→column-indices map
  const yearCols: Record<number, number[]> = {};
  for (const year of YEARS) {
    yearCols[year] = getYearColumnIndices(headers, year);
  }

  let upserted = 0;

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx].trim();
    if (!line) continue;

    const cols = line.split(',');
    const zip = cols[regionNameIdx]?.replace(/"/g, '').trim();
    if (!zip || !isTargetZip(zip, city)) continue;

    const stateName = cols[stateIdx]?.replace(/"/g, '').trim();
    const cityName = cols[cityIdx]?.replace(/"/g, '').trim();

    for (const year of YEARS) {
      const indices = yearCols[year];
      if (!indices.length) continue;

      const monthlyValues = indices.map((i) => parseFloat(cols[i]));
      const zhvi = average(monthlyValues);
      if (!zhvi) continue;

      await prisma.priceIndex.upsert({
        where: { zipCode_year_month: { zipCode: zip, year, month: 0 } },
        create: {
          zipCode: zip,
          year,
          month: 0, // 0 = annual average
          zhvi,
          city: cityName ?? city,
          state: stateName ?? undefined,
        },
        update: { zhvi },
      });

      upserted++;
    }
  }

  logger.info(`[Zillow] Upserted ${upserted} ZHVI records for ${city}`);
  return upserted;
}
