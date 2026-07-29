import { getRigProfileForKey } from './playerRigAcceptance.js';

export const PRODUCTION_RIG_LABELS = {
  runnerHome: 'Home runner',
  runnerAway: 'Away runner',
  goalieHome: 'Home goalie',
  goalieAway: 'Away goalie',
};

function productionFileName(asset) {
  return asset.url.split('/').at(-1);
}

function countPresentPartGroups(missingGroups, requiredGroups) {
  return Math.max(0, requiredGroups.length - missingGroups.length);
}

export function getProductionRigReadiness(key, asset) {
  const profile = getRigProfileForKey(key);
  const missingClips = profile.requiredClips.filter((clip) => !asset.clips.includes(clip));
  const missingPartGroups = asset.missingPartGroups ?? [];
  const overVertexBudget = asset.uploadedVertices > profile.maxVertices;
  const overByteBudget = (asset.bytes ?? 0) > profile.maxBytes;
  const fileName = productionFileName(asset);
  const isMissing = !asset.available && asset.uploadedVertices === 0 && asset.clips.length === 0;
  const retargetMotionQuality = asset.retargetMotionQuality ?? null;
  const isFinalGradeMotion = asset.isFinalGradeMotion ?? false;
  const finalGradeClips = asset.finalGradeClips ?? [];
  const missingFinalGradeClips = asset.missingFinalGradeClips ?? [];
  const issues = [];

  if (isMissing) issues.push(`Missing file: ${fileName}`);
  if (missingClips.length > 0 && !isMissing) issues.push(`Missing clips: ${missingClips.join(', ')}`);
  if (missingPartGroups.length > 0 && !isMissing) {
    issues.push(`Missing equipment names: ${missingPartGroups.map((group) => group.join(' / ')).join('; ')}`);
  }
  if (overVertexBudget) issues.push(`Vertex budget exceeded: ${asset.uploadedVertices} / ${profile.maxVertices}`);
  if (overByteBudget) issues.push(`File-size budget exceeded: ${asset.bytes} / ${profile.maxBytes}`);

  const clipScore = profile.requiredClips.length === 0
    ? 1
    : (profile.requiredClips.length - missingClips.length) / profile.requiredClips.length;
  const partScore = profile.requiredNamedPartGroups.length === 0
    ? 1
    : countPresentPartGroups(missingPartGroups, profile.requiredNamedPartGroups) / profile.requiredNamedPartGroups.length;
  const vertexScore = overVertexBudget ? Math.max(0, profile.maxVertices / asset.uploadedVertices) : 1;
  const byteScore = overByteBudget ? Math.max(0, profile.maxBytes / asset.bytes) : 1;
  const readinessScore = isMissing
    ? 0
    : Math.round((clipScore * 0.38 + partScore * 0.38 + vertexScore * 0.12 + byteScore * 0.12) * 100);

  return {
    key,
    label: PRODUCTION_RIG_LABELS[key] ?? key,
    fileName,
    url: asset.url,
    status: asset.available ? 'ready' : (isMissing ? 'missing' : 'needs-work'),
    statusLabel: asset.available ? 'Ready' : (isMissing ? 'Missing' : 'Needs work'),
    readinessScore,
    maxBytes: profile.maxBytes,
    bytes: asset.bytes ?? 0,
    maxVertices: profile.maxVertices,
    uploadedVertices: asset.uploadedVertices,
    requiredClips: profile.requiredClips,
    missingClips,
    requiredPartGroups: profile.requiredNamedPartGroups,
    missingPartGroups,
    retargetMotionQuality,
    isFinalGradeMotion,
    finalGradeClips,
    missingFinalGradeClips,
    issues,
  };
}

export function getProductionRigReadinessReport(availability) {
  const assets = Object.entries(availability.production)
    .map(([key, asset]) => getProductionRigReadiness(key, asset));
  const readyCount = assets.filter((asset) => asset.status === 'ready').length;
  const missingCount = assets.filter((asset) => asset.status === 'missing').length;
  const needsWorkCount = assets.filter((asset) => asset.status === 'needs-work').length;
  const score = Math.round(assets.reduce((sum, asset) => sum + asset.readinessScore, 0) / assets.length);

  return {
    status: readyCount === assets.length ? 'ready' : 'blocked',
    score,
    readyCount,
    missingCount,
    needsWorkCount,
    totalCount: assets.length,
    assets,
  };
}
