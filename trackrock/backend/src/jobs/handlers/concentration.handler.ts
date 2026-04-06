import type { Job } from 'bullmq';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { CONFIDENCE_THRESHOLD } from '@trackrock/shared';

export async function concentrationHandler(job: Job): Promise<void> {
  const city: string = job.data.city ?? null; // null = all cities
  logger.info(`[Concentration] Computing scores for city=${city ?? 'ALL'}`);

  const count = await computeConcentrationScores(city ?? undefined);
  logger.info(`[Concentration] Upserted ${count} concentration scores`);
}

export async function computeConcentrationScores(city?: string): Promise<number> {
  // Group confirmed institutional properties by FIPS tract
  const byTract = await prisma.property.groupBy({
    by: ['fipsTract'],
    _count: { id: true },
    where: {
      fipsTract: { not: null },
      confidenceScore: { gte: CONFIDENCE_THRESHOLD },
      ...(city ? { city } : {}),
    },
  });

  if (!byTract.length) {
    logger.warn('[Concentration] No geocoded properties found — run geocode stage first');
    return 0;
  }

  // Pull the latest census housing unit counts for each tract (most recent year)
  const tractFips = byTract.map((r) => r.fipsTract as string);

  const tractMetrics = await prisma.tractMetrics.findMany({
    where: { fipsTract: { in: tractFips } },
    orderBy: { year: 'desc' },
    select: { fipsTract: true, totalHousingUnits: true, year: true, city: true, state: true },
  });

  // Keep only the most recent row per tract
  const latestMetrics = new Map<string, { totalHousingUnits: number | null; city: string | null; state: string | null }>();
  for (const m of tractMetrics) {
    if (!latestMetrics.has(m.fipsTract)) {
      latestMetrics.set(m.fipsTract, {
        totalHousingUnits: m.totalHousingUnits,
        city: m.city,
        state: m.state,
      });
    }
  }

  let upserted = 0;

  for (const row of byTract) {
    const fipsTract = row.fipsTract as string;
    const ownedUnits = row._count.id;
    const meta = latestMetrics.get(fipsTract);
    const totalUnits = meta?.totalHousingUnits ?? null;

    // concentrationPct = institutional units / total housing units * 100
    // If we have no census data for this tract, store 0 for pct but keep the raw count
    const concentrationPct =
      totalUnits && totalUnits > 0
        ? Math.min((ownedUnits / totalUnits) * 100, 100)
        : 0;

    await prisma.concentrationScore.upsert({
      where: { fipsTract },
      create: {
        fipsTract,
        city: meta?.city ?? city ?? null,
        state: meta?.state ?? null,
        totalSfrUnits: totalUnits,
        blackrockOwnedUnits: ownedUnits,
        concentrationPct,
        computedAt: new Date(),
      },
      update: {
        totalSfrUnits: totalUnits,
        blackrockOwnedUnits: ownedUnits,
        concentrationPct,
        computedAt: new Date(),
      },
    });

    upserted++;
  }

  return upserted;
}
