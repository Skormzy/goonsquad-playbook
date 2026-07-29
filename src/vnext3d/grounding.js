export const GROUND_PENETRATION_TOLERANCE_METERS = 0.004;
export const MAX_GROUND_CORRECTION_METERS = 0.08;
export const MAX_GROUND_LOWERING_METERS = 0.04;
export const GROUNDING_RESPONSE_RATE = 18;
export const NORMAL_GROUND_SAMPLE_INTERVAL_SECONDS = 1 / 4;

const round = (value, precision = 1) => Number(value.toFixed(precision));

export function createFrameSampleBudget(maximumClaims = 2) {
  let activeFrame = null;
  let claims = 0;
  return {
    claim(frame) {
      if (frame !== activeFrame) {
        activeFrame = frame;
        claims = 0;
      }
      if (claims >= maximumClaims) return false;
      claims += 1;
      return true;
    },
  };
}

export function groundTelemetryPhaseOffset(playerId, sampleInterval) {
  if (!playerId || !Number.isFinite(sampleInterval) || sampleInterval <= 0) return 0;
  let hash = 2166136261;
  for (const character of String(playerId)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const phase = (hash >>> 0) % 101 / 101;
  return sampleInterval * phase * 0.85;
}

export function groundCorrectionForMinimum(
  minimumY,
  tolerance = GROUND_PENETRATION_TOLERANCE_METERS,
  allowFlight = false,
  maximumLowering = MAX_GROUND_LOWERING_METERS,
) {
  if (!Number.isFinite(minimumY)) return 0;
  if (minimumY < -tolerance) return Math.min(-minimumY, MAX_GROUND_CORRECTION_METERS);
  if (allowFlight || minimumY <= tolerance) return 0;
  return -Math.min(minimumY - tolerance, maximumLowering);
}

export function summarizeGroundContacts(contacts) {
  const valid = [...contacts].filter((contact) => (
    Number.isFinite(contact?.minimumY)
    && Number.isFinite(contact?.correction)
    && contact.shoeCount > 0
  ));
  if (valid.length === 0) return null;

  const minimumY = Math.min(...valid.map((contact) => contact.minimumY));
  const maximumY = Math.max(...valid.map((contact) => contact.minimumY));
  const maximumCorrection = Math.max(...valid.map((contact) => Math.abs(contact.correction)));

  return {
    groundSampleCount: valid.length,
    groundMinimumMm: round(minimumY * 1000),
    groundMaximumMm: round(maximumY * 1000),
    groundMaximumCorrectionMm: round(maximumCorrection * 1000),
    groundedPlayerCount: valid.filter((contact) => contact.minimumY <= 0.015).length,
  };
}
