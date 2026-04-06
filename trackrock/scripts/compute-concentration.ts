/**
 * Compute concentration scores for all geocoded properties.
 * Runs inline — no BullMQ required.
 *
 * Usage (from trackrock/):
 *   npx dotenv -e ../.env -- tsx scripts/compute-concentration.ts
 *
 * Options:
 *   --city Austin   Limit to a specific city (default: all cities)
 */
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const args = process.argv.slice(2);
const cityArg = args.find((a) => a.startsWith('--city='))?.split('=')[1];

const prisma = new PrismaClient();

async function main() {
  const { computeConcentrationScores } = await import(
    '../backend/src/jobs/handlers/concentration.handler.js'
  );

  console.log(`[Concentration] Computing scores for city=${cityArg ?? 'ALL'}\n`);

  const count = await computeConcentrationScores(cityArg);

  console.log(`[Concentration] Upserted ${count} tract scores\n`);

  // Top 10 highest concentration tracts
  const top = await prisma.concentrationScore.findMany({
    where: cityArg ? { city: cityArg } : {},
    orderBy: { concentrationPct: 'desc' },
    take: 10,
    select: { fipsTract: true, concentrationPct: true, blackrockOwnedUnits: true, totalSfrUnits: true, city: true },
  });

  console.log('[Concentration] Top 10 highest-concentration tracts:');
  console.log('  FIPS Tract       City       Owned  Total    Pct');
  console.log('  ─────────────────────────────────────────────────');
  for (const t of top) {
    const pct = t.concentrationPct.toFixed(2).padStart(6);
    const owned = String(t.blackrockOwnedUnits).padStart(5);
    const total = String(t.totalSfrUnits ?? '?').padStart(7);
    console.log(`  ${t.fipsTract}  ${(t.city ?? '').padEnd(9)} ${owned}  ${total}  ${pct}%`);
  }

  const total = await prisma.concentrationScore.count();
  console.log(`\n[Concentration] Total tracts scored: ${total}`);
}

main()
  .catch((err) => {
    console.error('\n[Concentration] Error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    const { redis } = await import('../backend/src/lib/redis.js');
    await redis.quit();
  });
