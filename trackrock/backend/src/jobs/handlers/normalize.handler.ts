import type { Job } from 'bullmq';
import { logger } from '../../lib/logger.js';
import { fetchCensusACS } from '../../pipeline/sources/census.js';
import { fetchZillowZHVI } from '../../pipeline/sources/zillow.js';
import { fetchFredData } from '../../pipeline/sources/fred.js';
import { fetchHudFMR } from '../../pipeline/sources/hud.js';
import { fetchEvictionData } from '../../pipeline/sources/evictionlab.js';

export interface NormalizeResult {
  censusTracts: number;
  zillowRecords: number;
  fredRecords: number;
  hudRecords: number;
  evictionRecords: number;
}

export async function normalizeHandler(job: Job): Promise<void> {
  const city: string = job.data.city ?? 'Austin';
  logger.info(`[Normalize] Starting for city=${city}`);

  const result = await normalizeCity(city, (pct) => {
    job.updateProgress(pct).catch(() => {});
  });

  logger.info(
    `[Normalize] Done — Census: ${result.censusTracts}, Zillow: ${result.zillowRecords}, ` +
    `FRED: ${result.fredRecords}, HUD: ${result.hudRecords}, Eviction: ${result.evictionRecords}`,
  );
}

export async function normalizeCity(
  city: string,
  onProgress?: (pct: number) => void,
): Promise<NormalizeResult> {
  logger.info(`[Normalize] Step 1/5 — Census ACS`);
  const censusTracts = await fetchCensusACS(city);
  onProgress?.(20);

  logger.info(`[Normalize] Step 2/5 — Zillow ZHVI`);
  const zillowRecords = await fetchZillowZHVI(city);
  onProgress?.(45);

  logger.info(`[Normalize] Step 3/5 — FRED`);
  const fredRecords = await fetchFredData(city);
  onProgress?.(60);

  logger.info(`[Normalize] Step 4/5 — HUD FMR`);
  const hudRecords = await fetchHudFMR(city);
  onProgress?.(80);

  logger.info(`[Normalize] Step 5/5 — Eviction Lab`);
  const evictionRecords = await fetchEvictionData(city);
  onProgress?.(100);

  return { censusTracts, zillowRecords, fredRecords, hudRecords, evictionRecords };
}
