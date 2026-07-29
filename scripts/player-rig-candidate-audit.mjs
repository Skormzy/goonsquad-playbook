import { PLAYER_RIG_ACCEPTANCE, missingNamedPartGroups } from '../src/replay3d/assets/playerRigAcceptance.js';

const MIN_USABLE_CLIP_SECONDS = 0.18;
const RUNNER_DIMENSION_LIMITS = {
  minHeight: 1.45,
  maxHeight: 2.45,
  targetHeight: 1.85,
  maxWidth: 1.55,
  maxDepth: 1.55,
};

function clipScore(requiredClips, clips) {
  if (requiredClips.length === 0) return 1;
  const present = requiredClips.filter((clip) => clips.includes(clip)).length;
  return present / requiredClips.length;
}

function usableClips(requiredClips, clips, clipDurations = {}) {
  return requiredClips.filter((clip) => (
    clips.includes(clip)
    && (clipDurations[clip] == null || clipDurations[clip] >= MIN_USABLE_CLIP_SECONDS)
  ));
}

function equipmentScore(requiredGroups, missingGroups) {
  if (requiredGroups.length === 0) return 1;
  return Math.max(0, requiredGroups.length - missingGroups.length) / requiredGroups.length;
}

function vertexScore(maxVertices, uploadedVertices) {
  if (!uploadedVertices) return 0;
  if (uploadedVertices <= maxVertices) return 1;
  return Math.max(0, maxVertices / uploadedVertices);
}

function byteScore(maxBytes, bytes) {
  if (!bytes) return 0;
  if (bytes <= maxBytes) return 1;
  return Math.max(0, maxBytes / bytes);
}

function getDimensionIssue(profileName, dimensions) {
  if (profileName !== 'runner' || !dimensions) return null;
  const { width = 0, height = 0, depth = 0 } = dimensions;
  const limits = RUNNER_DIMENSION_LIMITS;
  const outsideRange = height < limits.minHeight
    || height > limits.maxHeight
    || width > limits.maxWidth
    || depth > limits.maxDepth;
  if (!outsideRange) return null;

  return [
    'Scene bounds outside runner range:',
    `${height.toFixed(2)}m high,`,
    `${width.toFixed(2)}m wide,`,
    `${depth.toFixed(2)}m deep`,
  ].join(' ');
}

function getRecommendedScale(profileName, dimensions) {
  if (profileName !== 'runner' || !dimensions?.height) return null;
  return Number((RUNNER_DIMENSION_LIMITS.targetHeight / dimensions.height).toFixed(3));
}

export function scoreCandidateAgainstProfile(candidate, profileName) {
  const profile = PLAYER_RIG_ACCEPTANCE[profileName];
  const usableRequiredClips = usableClips(profile.requiredClips, candidate.clips, candidate.clipDurations);
  const unusableClips = profile.requiredClips.filter((clip) => (
    candidate.clips.includes(clip)
    && candidate.clipDurations?.[clip] != null
    && candidate.clipDurations[clip] < MIN_USABLE_CLIP_SECONDS
  ));
  const missingClips = profile.requiredClips.filter((clip) => !usableRequiredClips.includes(clip));
  const missingPartGroups = missingNamedPartGroups(candidate.namedParts, profile.requiredNamedPartGroups);
  const dimensionIssue = getDimensionIssue(profileName, candidate.dimensions);
  const recommendedScale = getRecommendedScale(profileName, candidate.dimensions);
  const score = Math.round((
    clipScore(profile.requiredClips, usableRequiredClips) * 0.38
    + equipmentScore(profile.requiredNamedPartGroups, missingPartGroups) * 0.38
    + vertexScore(profile.maxVertices, candidate.uploadedVertices) * 0.12
    + byteScore(profile.maxBytes, candidate.bytes) * 0.12
  ) * 100);

  const issues = [];
  if (missingClips.length > 0) issues.push(`Missing clips: ${missingClips.join(', ')}`);
  if (unusableClips.length > 0) issues.push(`Unusable clips: ${unusableClips.join(', ')}`);
  if (missingPartGroups.length > 0) {
    issues.push(`Missing equipment names: ${missingPartGroups.map((group) => group.join(' / ')).join('; ')}`);
  }
  if (dimensionIssue) issues.push(dimensionIssue);
  if (candidate.uploadedVertices > profile.maxVertices) {
    issues.push(`Vertex budget exceeded: ${candidate.uploadedVertices} / ${profile.maxVertices}`);
  }
  if (candidate.bytes > profile.maxBytes) {
    issues.push(`File-size budget exceeded: ${candidate.bytes} / ${profile.maxBytes}`);
  }

  return {
    profile: profileName,
    score,
    status: score === 100 && issues.length === 0 ? 'ready' : 'needs-work',
    uploadedVertices: candidate.uploadedVertices,
    maxVertices: profile.maxVertices,
    bytes: candidate.bytes,
    maxBytes: profile.maxBytes,
    missingClips,
    unusableClips,
    missingPartGroups,
    dimensions: candidate.dimensions,
    recommendedScale,
    issues,
  };
}

export function auditCandidateRig(candidate) {
  const profiles = Object.keys(PLAYER_RIG_ACCEPTANCE)
    .map((profileName) => scoreCandidateAgainstProfile(candidate, profileName))
    .sort((a, b) => b.score - a.score);
  const best = profiles[0];

  return {
    fileName: candidate.fileName,
    filePath: candidate.filePath,
    previewUrl: candidate.previewUrl,
    bytes: candidate.bytes,
    recommendedProfile: best.profile,
    score: best.score,
    status: best.status,
    clips: candidate.clips,
    clipDurations: candidate.clipDurations,
    dimensions: candidate.dimensions,
    recommendedScale: best.recommendedScale,
    uploadedVertices: candidate.uploadedVertices,
    profiles,
  };
}

export function summarizeCandidateAudits(candidates) {
  const audited = candidates.map(auditCandidateRig)
    .sort((a, b) => b.score - a.score || a.fileName.localeCompare(b.fileName));

  return {
    status: audited.length === 0 ? 'empty' : 'ready-for-review',
    totalCount: audited.length,
    bestCandidate: audited[0] ?? null,
    candidates: audited,
  };
}
