import type { Job } from 'bullmq';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';
import { resolveLLC } from '../../gemini/llcResolver.js';
import { CONFIDENCE_THRESHOLD } from '@trackrock/shared';

const BATCH_SIZE = 20;
const RATE_LIMIT_MS = 1100; // ~1 RPS sustained (Gemini 1.5 Pro free: 15 RPM)

export async function resolveHandler(job: Job): Promise<void> {
  const city: string = job.data.city ?? 'Austin';

  // Fetch unique owner names that need resolution
  // Deduplicate — many properties share the same LLC name
  const unresolved = await prisma.property.findMany({
    where: {
      city,
      OR: [
        { parentEntity: 'OTHER' },
        { confidenceScore: { lt: CONFIDENCE_THRESHOLD } },
      ],
    },
    select: {
      ownerName: true,
      mailingAddress: true,
      matchReason: true,
    },
    distinct: ['ownerName'],
  });

  logger.info(`[Resolve] ${unresolved.length} unique owner names to resolve for ${city}`);

  let resolved = 0;
  let reclassified = 0;

  for (let i = 0; i < unresolved.length; i += BATCH_SIZE) {
    const batch = unresolved.slice(i, i + BATCH_SIZE);

    for (const property of batch) {
      const result = await resolveLLC(
        property.ownerName,
        property.mailingAddress ?? '',
        property.matchReason,
      );

      // Update all properties with this owner name
      const updated = await prisma.property.updateMany({
        where: { ownerName: property.ownerName, city },
        data: {
          parentEntity: result.parentEntity,
          confidenceScore: result.confidence,
          confidenceReason: result.reasoning,
          subsidiaryChain: result.subsidiaryChain,
        },
      });

      resolved++;
      if (result.parentEntity !== 'OTHER') {
        reclassified += updated.count;

        // Upsert into SubsidiaryEntity table
        for (const llcName of result.subsidiaryChain) {
          if (!llcName.trim()) continue;
          await prisma.subsidiaryEntity.upsert({
            where: { llcName: llcName.trim() },
            create: {
              llcName: llcName.trim(),
              parentEntity: result.parentEntity,
              confidence: result.confidence,
              source: 'gemini',
            },
            update: {
              parentEntity: result.parentEntity,
              confidence: result.confidence,
            },
          });
        }
      }

      // Rate limit — pause between Gemini calls
      await new Promise((r) => setTimeout(r, RATE_LIMIT_MS));
    }

    const pct = Math.round(((i + batch.length) / unresolved.length) * 100);
    await job.updateProgress(pct);
    logger.info(`[Resolve] ${pct}% — resolved ${resolved}, reclassified ${reclassified} properties`);
  }

  logger.info(`[Resolve] Done — ${reclassified} properties reclassified from OTHER`);

  await prisma.pipelineJob.updateMany({
    where: { stage: 'resolve', status: 'running', city },
    data: { rowsProcessed: resolved },
  });
}
