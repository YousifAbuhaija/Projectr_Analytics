/**
 * FRED (Federal Reserve Economic Data) — rent CPI + median sales price.
 * Stored with zipCode = 'MSA_AUSTIN' sentinel (metro-level data).
 */
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { config } from '../../config.js';

// Rent of primary residence CPI (US city average)
const RENT_CPI_SERIES = 'CUSR0000SEHA';
// Median sales price of houses sold (US)
const MEDIAN_PRICE_SERIES = 'MSPUS';

const MSA_SENTINEL = 'MSA_AUSTIN';

interface FredObservation {
  date: string; // "YYYY-MM-DD"
  value: string;
}

interface FredResponse {
  observations: FredObservation[];
}

async function fetchFredSeries(seriesId: string): Promise<FredObservation[]> {
  if (!config.fredKey) {
    logger.warn('[FRED] FRED_API_KEY not set — skipping');
    return [];
  }

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: config.fredKey,
    file_type: 'json',
    observation_start: '2019-01-01',
    observation_end: '2024-12-31',
    frequency: 'a', // annual
    aggregation_method: 'avg',
  });

  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?${params}`,
      { signal: AbortSignal.timeout(15_000) },
    );

    if (!res.ok) {
      logger.warn(`[FRED] Series ${seriesId} HTTP ${res.status}`);
      return [];
    }

    const data = await res.json() as FredResponse;
    return data.observations ?? [];
  } catch (err) {
    logger.warn(`[FRED] Error fetching ${seriesId}: ${(err as Error).message}`);
    return [];
  }
}

export async function fetchFredData(city: string): Promise<number> {
  // FRED data is national, so only fetch once regardless of city
  if (city !== 'Austin') {
    logger.info('[FRED] Skipping FRED fetch for non-Austin city (data is national)');
    return 0;
  }

  logger.info('[FRED] Fetching rent CPI + median sales price...');

  const [rentObs, priceObs] = await Promise.all([
    fetchFredSeries(RENT_CPI_SERIES),
    fetchFredSeries(MEDIAN_PRICE_SERIES),
  ]);

  if (!rentObs.length && !priceObs.length) return 0;

  // Build year→value maps
  const rentByYear = new Map<number, number>();
  for (const obs of rentObs) {
    const year = parseInt(obs.date.substring(0, 4));
    const val = parseFloat(obs.value);
    if (!isNaN(year) && !isNaN(val) && obs.value !== '.') {
      rentByYear.set(year, val);
    }
  }

  const priceByYear = new Map<number, number>();
  for (const obs of priceObs) {
    const year = parseInt(obs.date.substring(0, 4));
    const val = parseFloat(obs.value);
    if (!isNaN(year) && !isNaN(val) && obs.value !== '.') {
      priceByYear.set(year, val);
    }
  }

  const allYears = new Set([...rentByYear.keys(), ...priceByYear.keys()]);
  let upserted = 0;

  for (const year of allYears) {
    const zori = rentByYear.get(year) ?? null;
    const zhvi = priceByYear.get(year) ?? null;

    await prisma.priceIndex.upsert({
      where: { zipCode_year_month: { zipCode: MSA_SENTINEL, year, month: 0 } },
      create: {
        zipCode: MSA_SENTINEL,
        year,
        month: 0,
        zori,
        zhvi,
        city: 'National',
        state: 'US',
      },
      update: { zori, zhvi },
    });

    upserted++;
  }

  logger.info(`[FRED] Upserted ${upserted} records (rent CPI + median price)`);
  return upserted;
}
