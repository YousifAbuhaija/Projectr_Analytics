import { redis } from '../lib/redis.js';
import { getGeminiModel, safeParseGeminiJson } from '../lib/gemini.js';
import { logger } from '../lib/logger.js';
import { CACHE_TTL, CONFIDENCE_BY_MATCH_TYPE } from '@trackrock/shared';
import type { ParentEntity, GeminiLLCResolution } from '@trackrock/shared';

const CACHE_PREFIX = 'llc_resolve:';

const VALID_ENTITIES: ParentEntity[] = [
  'INVITATION_HOMES', 'AMH', 'PROGRESS', 'TRICON',
  'BLACKROCK', 'FIRSTKEY', 'MAIN_STREET', 'OTHER',
];

const PROMPT_TEMPLATE = `You are a corporate research analyst specializing in institutional real estate investment.

Analyze this LLC/LP owner from a Texas property tax record and determine if it is affiliated with a major institutional single-family rental (SFR) company.

Known institutional SFR investors:
- INVITATION_HOMES: Invitation Homes, INVH, THR Property, IH2/IH3/IH4/IH5/IH6 LP, Starwood Waypoint
- AMH: American Homes 4 Rent, AMH 2014-2018, AH4R, AMH Borrower
- PROGRESS: Progress Residential, Pretium Partners, Front Yard Residential
- TRICON: Tricon Residential, Tricon American Homes
- BLACKROCK: BlackRock Realty Advisors, Guthrie Property Owner
- FIRSTKEY: FirstKey Homes, Cerberus Capital
- MAIN_STREET: Main Street Renewal, Home Partners of America

Owner name: "{ownerName}"
Mailing address: "{mailingAddress}"
Match context: "{matchReason}"

Respond ONLY with valid JSON, no markdown:
{
  "parentEntity": "INVITATION_HOMES" | "AMH" | "PROGRESS" | "TRICON" | "BLACKROCK" | "FIRSTKEY" | "MAIN_STREET" | "OTHER",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence",
  "subsidiaryChain": ["LLC name"]
}

If this is NOT an institutional SFR investor (e.g. local developer, HOA, small landlord), set parentEntity to "OTHER" with confidence below 0.4.`;

export async function resolveLLC(
  ownerName: string,
  mailingAddress: string,
  matchReason: string,
): Promise<GeminiLLCResolution> {
  const cacheKey = `${CACHE_PREFIX}${ownerName.toUpperCase().trim()}`;

  // Check Redis cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as GeminiLLCResolution;
  } catch {
    // Cache unavailable — proceed without it
  }

  // Fallback result if Gemini fails
  const fallback: GeminiLLCResolution = {
    parentEntity: 'OTHER',
    confidence: 0.4,
    reasoning: 'Gemini unavailable — kept as unresolved',
    subsidiaryChain: [ownerName],
  };

  try {
    const model = getGeminiModel();
    const prompt = PROMPT_TEMPLATE
      .replace('{ownerName}', ownerName)
      .replace('{mailingAddress}', mailingAddress || 'Unknown')
      .replace('{matchReason}', matchReason || 'Unknown');

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = safeParseGeminiJson<GeminiLLCResolution>(text);
    if (!parsed) {
      logger.warn(`[LLC Resolver] Failed to parse JSON for "${ownerName}": ${text.slice(0, 100)}`);
      return fallback;
    }

    // Validate and clamp fields
    const resolution: GeminiLLCResolution = {
      parentEntity: VALID_ENTITIES.includes(parsed.parentEntity)
        ? parsed.parentEntity
        : 'OTHER',
      confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.5)),
      reasoning: parsed.reasoning ?? '',
      subsidiaryChain: Array.isArray(parsed.subsidiaryChain)
        ? parsed.subsidiaryChain
        : [ownerName],
    };

    // Adjust confidence thresholds to match our scoring system
    if (resolution.parentEntity !== 'OTHER') {
      resolution.confidence = resolution.confidence >= 0.8
        ? CONFIDENCE_BY_MATCH_TYPE.gemini_high
        : CONFIDENCE_BY_MATCH_TYPE.gemini_medium;
    }

    // Cache the result
    try {
      await redis.setex(cacheKey, CACHE_TTL.LLC_RESOLUTION, JSON.stringify(resolution));
    } catch {
      // Non-fatal
    }

    return resolution;
  } catch (err) {
    logger.warn(`[LLC Resolver] Gemini error for "${ownerName}": ${(err as Error).message}`);
    return fallback;
  }
}
