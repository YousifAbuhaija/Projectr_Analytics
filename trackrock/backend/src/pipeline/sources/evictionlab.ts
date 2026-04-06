/**
 * Eviction Lab — tract-level eviction rate data for target cities.
 * Uses the Eviction Lab public data API.
 * Falls back gracefully if unavailable (non-blocking for pipeline).
 */
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

const EVICTION_LAB_BASE = 'https://evictionlab.org/eviction-tracking';

// City slug → city config
const CITY_SLUGS: Record<string, { slug: string; state: string }> = {
  Austin: { slug: 'austin-tx', state: 'TX' },
  Atlanta: { slug: 'atlanta-ga', state: 'GA' },
};

interface EvictionRow {
  GEOID?: string;
  geoid?: string;
  year?: number | string;
  'eviction-rate'?: number | string;
  'eviction-filing-rate'?: number | string;
  evictions?: number | string;
  'eviction-filings'?: number | string;
}

function parseNum(val: unknown): number | null {
  if (val == null || val === '' || val === '-1') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

export async function fetchEvictionData(city: string): Promise<number> {
  const cfg = CITY_SLUGS[city];
  if (!cfg) {
    logger.warn(`[EvictionLab] No config for "${city}" — skipping`);
    return 0;
  }

  logger.info(`[EvictionLab] Fetching eviction data for ${city}...`);

  // Try primary eviction tracking endpoint
  const urls = [
    `${EVICTION_LAB_BASE}/get-data.php?name=${cfg.slug}&geography=tracts`,
    `https://evictionlab.org/eviction-tracking/data/${cfg.slug}-tracts.csv`,
  ];

  let rows: EvictionRow[] = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) continue;

      const contentType = res.headers.get('content-type') ?? '';

      if (contentType.includes('json')) {
        const data = await res.json() as EvictionRow[] | { data?: EvictionRow[] };
        rows = Array.isArray(data) ? data : (data.data ?? []);
      } else {
        // CSV fallback — parse line by line
        const text = await res.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) continue;

        const headers = lines[0].split(',').map((h) => h.replace(/"/g, '').trim());
        rows = lines.slice(1).map((line) => {
          const cols = line.split(',').map((c) => c.replace(/"/g, '').trim());
          return Object.fromEntries(headers.map((h, i) => [h, cols[i]])) as EvictionRow;
        });
      }

      if (rows.length > 0) {
        logger.info(`[EvictionLab] Retrieved ${rows.length} rows from: ${url}`);
        break;
      }
    } catch (err) {
      logger.debug(`[EvictionLab] Failed ${url}: ${(err as Error).message}`);
    }
  }

  if (!rows.length) {
    logger.warn(`[EvictionLab] No data retrieved for ${city} — skipping (non-fatal)`);
    return 0;
  }

  let upserted = 0;

  for (const row of rows) {
    const geoid = String(row.GEOID ?? row.geoid ?? '').trim();
    if (!geoid || geoid.length < 11) continue;

    const year = parseInt(String(row.year ?? '0'));
    if (!year || year < 2010) continue;

    const evictionRate = parseNum(row['eviction-rate']);
    const evictionFilingRate = parseNum(row['eviction-filing-rate']);
    const evictions = parseNum(row.evictions);
    const evictionFilings = parseNum(row['eviction-filings']);

    try {
      await prisma.evictionRate.upsert({
        where: { fipsTract_year: { fipsTract: geoid, year } },
        create: {
          fipsTract: geoid,
          year,
          evictionRate,
          evictionFilingRate,
          evictions: evictions != null ? Math.round(evictions) : null,
          evictionFilings: evictionFilings != null ? Math.round(evictionFilings) : null,
          city,
          state: cfg.state,
        },
        update: {
          evictionRate,
          evictionFilingRate,
          evictions: evictions != null ? Math.round(evictions) : null,
          evictionFilings: evictionFilings != null ? Math.round(evictionFilings) : null,
        },
      });
      upserted++;
    } catch {
      // Non-fatal — some rows may have invalid GEOIDs
    }
  }

  logger.info(`[EvictionLab] Upserted ${upserted} eviction records for ${city}`);
  return upserted;
}
