export const PLANTED_FOOT_CLEARANCE_METERS = 0.015;

const round = (value, precision = 2) => Number(value.toFixed(precision));

export function measurePlantedFootSliding(contacts, previousFeet) {
  const nextFeet = new Map();
  const samples = [];

  for (const [playerId, contact] of contacts) {
    for (const [side, foot] of Object.entries(contact?.feet ?? {})) {
      if (!Number.isFinite(foot?.x) || !Number.isFinite(foot?.z) || !Number.isFinite(foot?.minimumY)) continue;
      const key = `${playerId}:${side}`;
      const previous = previousFeet.get(key);
      const planted = foot.minimumY <= PLANTED_FOOT_CLEARANCE_METERS;
      if (planted && previous?.planted) {
        samples.push(Math.hypot(foot.x - previous.x, foot.z - previous.z) * 1000);
      }
      nextFeet.set(key, { x: foot.x, z: foot.z, planted });
    }
  }

  return { nextFeet, samples };
}

export function measureFootDisplacement(contacts, previousFeet) {
  const nextFeet = new Map();
  const samples = [];

  for (const [playerId, contact] of contacts) {
    for (const [side, foot] of Object.entries(contact?.feet ?? {})) {
      if (!Number.isFinite(foot?.x) || !Number.isFinite(foot?.z)) continue;
      const key = `${playerId}:${side}`;
      const previous = previousFeet.get(key);
      if (previous) samples.push(Math.hypot(foot.x - previous.x, foot.z - previous.z) * 1000);
      nextFeet.set(key, { x: foot.x, z: foot.z });
    }
  }

  return { nextFeet, samples };
}

export function measureAuthoredContactSliding(contacts, previousFeet) {
  const nextFeet = new Map();
  const samples = [];
  const clearanceSamples = [];
  const oppositeClearanceSamples = [];
  let contactSampleCount = 0;
  let plantedContactSampleCount = 0;

  for (const [playerId, contact] of contacts) {
    const authored = contact?.authoredContact;
    if (!authored?.side) continue;
    const foot = contact?.feet?.[authored.side];
    if (!Number.isFinite(foot?.x) || !Number.isFinite(foot?.z) || !Number.isFinite(foot?.minimumY)) continue;

    contactSampleCount += 1;
    clearanceSamples.push(foot.minimumY * 1000);
    const oppositeSide = authored.side === 'left' ? 'right' : 'left';
    const oppositeFoot = contact?.feet?.[oppositeSide];
    if (Number.isFinite(oppositeFoot?.minimumY)) {
      oppositeClearanceSamples.push(oppositeFoot.minimumY * 1000);
    }
    const key = `${playerId}:${authored.clipName}:${authored.side}`;
    const previous = previousFeet.get(key);
    const planted = foot.minimumY <= PLANTED_FOOT_CLEARANCE_METERS;
    if (planted) plantedContactSampleCount += 1;
    if (planted && previous?.planted) {
      samples.push(Math.hypot(foot.x - previous.x, foot.z - previous.z) * 1000);
    }
    nextFeet.set(key, { x: foot.x, z: foot.z, planted });
  }

  return {
    clearanceSamples,
    contactSampleCount,
    nextFeet,
    oppositeClearanceSamples,
    plantedContactSampleCount,
    samples,
  };
}

export function summarizeFootSlideSamples(samples) {
  const valid = samples.filter((sample) => Number.isFinite(sample) && sample >= 0).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const percentileIndex = Math.min(valid.length - 1, Math.floor(valid.length * 0.95));
  return {
    footSlideSampleCount: valid.length,
    footSlideMeanMm: round(valid.reduce((total, sample) => total + sample, 0) / valid.length),
    footSlideP95Mm: round(valid[percentileIndex]),
    footSlideMaxMm: round(valid.at(-1)),
  };
}
