/**
 * Fetch and normalize all external data sources (Census, Zillow, FRED, HUD, Eviction Lab).
 * Runs inline — no BullMQ required.
 *
 * Usage (from trackrock/):
 *   npx dotenv -e ../.env -- tsx scripts/normalize-data.ts
 *
 * Options:
 *   --city Austin        Target city (default: Austin)
 *   --source census      Only run a specific source (census|zillow|fred|hud|eviction)
 */
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const args = process.argv.slice(2);
const cityArg = args.find((a) => a.startsWith('--city='))?.split('=')[1] ?? 'Austin';
const sourceArg = args.find((a) => a.startsWith('--source='))?.split('=')[1];

const prisma = new PrismaClient();

async function main() {
  const {
    fetchCensusACS,
  } = await import('../backend/src/pipeline/sources/census.js');
  const {
    fetchZillowZHVI,
  } = await import('../backend/src/pipeline/sources/zillow.js');
  const {
    fetchFredData,
  } = await import('../backend/src/pipeline/sources/fred.js');
  const {
    fetchHudFMR,
  } = await import('../backend/src/pipeline/sources/hud.js');
  const {
    fetchEvictionData,
  } = await import('../backend/src/pipeline/sources/evictionlab.js');

  console.log(`[Normalize] City: ${cityArg}`);
  if (sourceArg) console.log(`[Normalize] Source filter: ${sourceArg}`);
  console.log('');

  const results: Record<string, number> = {};

  if (!sourceArg || sourceArg === 'census') {
    process.stdout.write('[Normalize] Fetching Census ACS...');
    results.census = await fetchCensusACS(cityArg);
    console.log(` ${results.census} tract-year records`);
  }

  if (!sourceArg || sourceArg === 'zillow') {
    process.stdout.write('[Normalize] Fetching Zillow ZHVI...');
    results.zillow = await fetchZillowZHVI(cityArg);
    console.log(` ${results.zillow} ZIP-year records`);
  }

  if (!sourceArg || sourceArg === 'fred') {
    process.stdout.write('[Normalize] Fetching FRED...');
    results.fred = await fetchFredData(cityArg);
    console.log(` ${results.fred} MSA-year records`);
  }

  if (!sourceArg || sourceArg === 'hud') {
    process.stdout.write('[Normalize] Fetching HUD FMR...');
    results.hud = await fetchHudFMR(cityArg);
    console.log(` ${results.hud} county-year records`);
  }

  if (!sourceArg || sourceArg === 'eviction') {
    process.stdout.write('[Normalize] Fetching Eviction Lab...');
    results.eviction = await fetchEvictionData(cityArg);
    console.log(` ${results.eviction} tract-year records`);
  }

  console.log('\n[Normalize] Summary:');
  for (const [src, count] of Object.entries(results)) {
    console.log(`  ${src.padEnd(12)} ${count} records upserted`);
  }

  // DB totals
  const [tractCount, priceCount, evictionCount] = await Promise.all([
    prisma.tractMetrics.count(),
    prisma.priceIndex.count(),
    prisma.evictionRate.count(),
  ]);

  console.log('\n[Normalize] DB totals:');
  console.log(`  TractMetrics   ${tractCount}`);
  console.log(`  PriceIndex     ${priceCount}`);
  console.log(`  EvictionRate   ${evictionCount}`);
}

main()
  .catch((err) => {
    console.error('\n[Normalize] Error:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    const { redis } = await import('../backend/src/lib/redis.js');
    await redis.quit();
  });
