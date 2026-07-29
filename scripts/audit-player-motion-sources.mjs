import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  invalidFinalGradeRunnerUsageRights,
  invalidFinalGradeRunnerCaptureMethod,
  isAcceptedRunnerSourceQuality,
  isFinalGradeRunnerSourceQuality,
  missingFinalGradeRunnerProvenanceFields,
} from './player-motion-quality-policy.mjs';

export const MOTION_SOURCE_DIR = 'asset-inbox/players/motion-sources';
export const MOTION_REPORT_JSON = 'asset-inbox/players/player-motion-source-report.json';
export const MOTION_REPORT_MD = 'asset-inbox/players/player-motion-source-report.md';

const SUPPORTED_EXTENSIONS = new Set(['.fbx', '.bvh', '.glb', '.gltf']);
const MIN_RETARGETABLE_BVH_FRAMES = 4;
const MIN_ACTION_CLIP_BVH_FRAMES = 12;
const MIN_ACTION_CLIP_BVH_DURATION_SECONDS = 0.38;
const MIN_ACTION_CLIP_MAX_ROTATION_RANGE_DEGREES = 4;
const MIN_ACTION_CLIP_ACTIVE_ROTATION_CHANNELS = 3;
const ACTIVE_ROTATION_CHANNEL_RANGE_DEGREES = 3;
const STRIDE_PHASE_DEAD_ZONE_DEGREES = 3;
const STICK_ACTION_PHASE_DEAD_ZONE_DEGREES = 5;
const STICK_ACTION_TORSO_CHANNEL_START = 6;
const STICK_ACTION_TORSO_CHANNEL_END = 9;
const STICK_ACTION_ARM_CHANNEL_START = 12;
const STICK_ACTION_ARM_CHANNEL_END = 18;
const ATHLETIC_TORSO_LEAN_CHANNEL = 7;
const HIP_YAW_CHANNEL = 5;
const SHOULDER_YAW_CHANNEL = 8;
const LOCOMOTION_ARM_SWING_CHANNELS = [12, 15];
const LEFT_ARM_SWING_CHANNEL = 12;
const RIGHT_ARM_SWING_CHANNEL = 15;
const READY_STANCE_LEFT_LEG_LOAD_CHANNEL = 19;
const READY_STANCE_RIGHT_LEG_LOAD_CHANNEL = 22;
const LEFT_LEG_DRIVE_CHANNEL = 19;
const RIGHT_LEG_DRIVE_CHANNEL = 22;
const FOOT_PLANT_ROOT_LOW_RATIO = 0.35;
const FOOT_PLANT_DRIVE_WINDOW_FRAMES = 1;
const STICK_ACTION_RELEASE_SUPPORT_WINDOW_FRAMES = 2;
const STICK_ACTION_TWO_HAND_ACTIVE_RATIO = 0.35;

export const REQUIRED_MOTION_GROUPS = [
  { key: 'ready', tokens: ['ready', 'stance', 'idle'] },
  { key: 'jog', tokens: ['jog', 'run-forward', 'running-forward'] },
  { key: 'sprint', tokens: ['sprint', 'burst'] },
  { key: 'carry', tokens: ['carry', 'stick-carry', 'control', 'stickhandle', 'stick-handle'] },
  { key: 'receive', tokens: ['receive', 'settle', 'catch'] },
  { key: 'pass', tokens: ['pass', 'forehand-pass', 'release-pass'] },
  { key: 'shot', tokens: ['shot', 'wrist-shot', 'shoot'] },
];

export const ACTION_QUALITY_PROFILES = {
  ready: {
    minimumFrameCount: 14,
    minimumDurationSeconds: 0.45,
    maximumFrameRotationDeltaDegrees: 10,
    maximumFrameRotationAccelerationDegrees: 6,
    minimumRootTravelUnits: 0,
    minimumRootForwardTravelUnits: 0,
    minimumRootForwardSpeedChangeUnits: 0,
    minimumRootLateralShiftUnits: 0,
    minimumRootVerticalBounceUnits: 0,
    minimumReadyStanceLegLoadDegrees: 24,
    minimumLegDriveRangeDegrees: 0,
    minimumLocomotionStrideBalanceRatio: 0,
    minimumLocomotionFootPlantDriveRatio: 0,
    minimumAlternatingLegSeparationDegrees: 0,
    minimumLocomotionArmSwingRangeDegrees: 0,
    minimumLocomotionContralateralSyncRatio: 0,
    minimumFootPlantContactFrames: 4,
    minimumFootPlantSideCount: 2,
    minimumFootPlantBalanceRatio: 0.5,
    minimumFootPlantHoldFramesPerSide: 2,
    maximumFootPlantRootDriftUnits: 1,
    minimumTotalRotationRangeDegrees: 45,
    minimumStridePhaseChanges: 0,
    minimumStrideCycleSpanRatio: 0,
    minimumStickActionArmRangeDegrees: 0,
    minimumStickActionTwoHandBalanceRatio: 0,
    minimumStickActionTwoHandSyncRatio: 0,
    minimumStickActionTwoHandContactRatio: 0,
    minimumStickActionPhaseChanges: 0,
    minimumStickActionBeatSpanRatio: 0,
    minimumStickActionReleasePeakRatio: 0,
    maximumStickActionReleasePeakRatio: 1,
    minimumStickActionSupportedReleaseRatio: 0,
    minimumStickActionTorsoRangeDegrees: 0,
    minimumHipShoulderSeparationDegrees: 0,
    minimumStickActionLowerBodyLeadFrames: 0,
    minimumStickActionRecoveryRatio: 0,
    minimumAthleticTorsoLeanDegrees: 0,
    maximumLoopClosureErrorDegrees: 999,
    maximumLoopVerticalOffsetUnits: 999,
  },
  jog: {
    minimumFrameCount: 22,
    minimumDurationSeconds: 0.72,
    maximumFrameRotationDeltaDegrees: 18,
    maximumFrameRotationAccelerationDegrees: 8,
    minimumRootTravelUnits: 30,
    minimumRootForwardTravelUnits: 30,
    minimumRootForwardSpeedChangeUnits: 0.35,
    minimumRootLateralShiftUnits: 24,
    minimumRootVerticalBounceUnits: 0.3,
    minimumReadyStanceLegLoadDegrees: 0,
    minimumLegDriveRangeDegrees: 105,
    minimumLocomotionStrideBalanceRatio: 0.72,
    minimumLocomotionFootPlantDriveRatio: 0.55,
    minimumAlternatingLegSeparationDegrees: 50,
    minimumLocomotionArmSwingRangeDegrees: 80,
    minimumLocomotionContralateralSyncRatio: 0.65,
    minimumFootPlantContactFrames: 8,
    minimumFootPlantSideCount: 2,
    minimumFootPlantBalanceRatio: 0.6,
    minimumFootPlantHoldFramesPerSide: 3,
    maximumFootPlantRootDriftUnits: 10,
    minimumTotalRotationRangeDegrees: 260,
    minimumStridePhaseChanges: 2,
    minimumStrideCycleSpanRatio: 0.5,
    minimumStickActionArmRangeDegrees: 0,
    minimumStickActionTwoHandBalanceRatio: 0,
    minimumStickActionTwoHandSyncRatio: 0,
    minimumStickActionTwoHandContactRatio: 0,
    minimumStickActionPhaseChanges: 0,
    minimumStickActionBeatSpanRatio: 0,
    minimumStickActionReleasePeakRatio: 0,
    maximumStickActionReleasePeakRatio: 1,
    minimumStickActionSupportedReleaseRatio: 0,
    minimumStickActionTorsoRangeDegrees: 0,
    minimumHipShoulderSeparationDegrees: 8,
    minimumStickActionLowerBodyLeadFrames: 0,
    minimumStickActionRecoveryRatio: 0,
    minimumAthleticTorsoLeanDegrees: 8,
    maximumLoopClosureErrorDegrees: 16,
    maximumLoopVerticalOffsetUnits: 0.75,
  },
  sprint: {
    minimumFrameCount: 22,
    minimumDurationSeconds: 0.72,
    maximumFrameRotationDeltaDegrees: 24,
    maximumFrameRotationAccelerationDegrees: 10,
    minimumRootTravelUnits: 40,
    minimumRootForwardTravelUnits: 40,
    minimumRootForwardSpeedChangeUnits: 0.5,
    minimumRootLateralShiftUnits: 28,
    minimumRootVerticalBounceUnits: 0.5,
    minimumReadyStanceLegLoadDegrees: 0,
    minimumLegDriveRangeDegrees: 145,
    minimumLocomotionStrideBalanceRatio: 0.72,
    minimumLocomotionFootPlantDriveRatio: 0.55,
    minimumAlternatingLegSeparationDegrees: 70,
    minimumLocomotionArmSwingRangeDegrees: 105,
    minimumLocomotionContralateralSyncRatio: 0.65,
    minimumFootPlantContactFrames: 8,
    minimumFootPlantSideCount: 2,
    minimumFootPlantBalanceRatio: 0.6,
    minimumFootPlantHoldFramesPerSide: 3,
    maximumFootPlantRootDriftUnits: 12,
    minimumTotalRotationRangeDegrees: 340,
    minimumStridePhaseChanges: 2,
    minimumStrideCycleSpanRatio: 0.5,
    minimumStickActionArmRangeDegrees: 0,
    minimumStickActionTwoHandBalanceRatio: 0,
    minimumStickActionTwoHandSyncRatio: 0,
    minimumStickActionTwoHandContactRatio: 0,
    minimumStickActionPhaseChanges: 0,
    minimumStickActionBeatSpanRatio: 0,
    minimumStickActionReleasePeakRatio: 0,
    maximumStickActionReleasePeakRatio: 1,
    minimumStickActionSupportedReleaseRatio: 0,
    minimumStickActionTorsoRangeDegrees: 0,
    minimumHipShoulderSeparationDegrees: 8,
    minimumStickActionLowerBodyLeadFrames: 0,
    minimumStickActionRecoveryRatio: 0,
    minimumAthleticTorsoLeanDegrees: 12,
    maximumLoopClosureErrorDegrees: 16,
    maximumLoopVerticalOffsetUnits: 0.75,
  },
  carry: {
    minimumFrameCount: 24,
    minimumDurationSeconds: 0.8,
    maximumFrameRotationDeltaDegrees: 18,
    maximumFrameRotationAccelerationDegrees: 8,
    minimumRootTravelUnits: 18,
    minimumRootForwardTravelUnits: 18,
    minimumRootForwardSpeedChangeUnits: 0.4,
    minimumRootLateralShiftUnits: 4,
    minimumRootVerticalBounceUnits: 0,
    minimumReadyStanceLegLoadDegrees: 0,
    minimumLegDriveRangeDegrees: 60,
    minimumLocomotionStrideBalanceRatio: 0,
    minimumLocomotionFootPlantDriveRatio: 0,
    minimumAlternatingLegSeparationDegrees: 0,
    minimumLocomotionArmSwingRangeDegrees: 0,
    minimumLocomotionContralateralSyncRatio: 0,
    minimumFootPlantContactFrames: 8,
    minimumFootPlantSideCount: 2,
    minimumFootPlantBalanceRatio: 0.5,
    minimumFootPlantHoldFramesPerSide: 4,
    maximumFootPlantRootDriftUnits: 8,
    minimumTotalRotationRangeDegrees: 180,
    minimumStridePhaseChanges: 0,
    minimumStrideCycleSpanRatio: 0,
    minimumStickActionArmRangeDegrees: 90,
    minimumStickActionTwoHandBalanceRatio: 0.55,
    minimumStickActionTwoHandSyncRatio: 0.65,
    minimumStickActionTwoHandContactRatio: 0.35,
    minimumStickActionPhaseChanges: 2,
    minimumStickActionBeatSpanRatio: 0.45,
    minimumStickActionReleasePeakRatio: 0.32,
    maximumStickActionReleasePeakRatio: 0.78,
    minimumStickActionSupportedReleaseRatio: 0.4,
    minimumStickActionTorsoRangeDegrees: 18,
    minimumHipShoulderSeparationDegrees: 8,
    minimumStickActionLowerBodyLeadFrames: 0,
    minimumStickActionRecoveryRatio: 0.65,
    minimumAthleticTorsoLeanDegrees: 8,
    maximumLoopClosureErrorDegrees: 999,
    maximumLoopVerticalOffsetUnits: 999,
  },
  receive: {
    minimumFrameCount: 24,
    minimumDurationSeconds: 0.8,
    maximumFrameRotationDeltaDegrees: 32,
    maximumFrameRotationAccelerationDegrees: 16,
    minimumRootTravelUnits: 6,
    minimumRootForwardTravelUnits: 5,
    minimumRootForwardSpeedChangeUnits: 0.15,
    minimumRootLateralShiftUnits: 2.5,
    minimumRootVerticalBounceUnits: 0,
    minimumReadyStanceLegLoadDegrees: 0,
    minimumLegDriveRangeDegrees: 26,
    minimumLocomotionStrideBalanceRatio: 0,
    minimumLocomotionFootPlantDriveRatio: 0.6,
    minimumAlternatingLegSeparationDegrees: 0,
    minimumLocomotionArmSwingRangeDegrees: 0,
    minimumLocomotionContralateralSyncRatio: 0,
    minimumFootPlantContactFrames: 8,
    minimumFootPlantSideCount: 2,
    minimumFootPlantBalanceRatio: 0.5,
    minimumFootPlantHoldFramesPerSide: 3,
    maximumFootPlantRootDriftUnits: 6,
    minimumTotalRotationRangeDegrees: 110,
    minimumStridePhaseChanges: 0,
    minimumStrideCycleSpanRatio: 0,
    minimumStickActionArmRangeDegrees: 90,
    minimumStickActionTwoHandBalanceRatio: 0.55,
    minimumStickActionTwoHandSyncRatio: 0.65,
    minimumStickActionTwoHandContactRatio: 0.75,
    minimumStickActionPhaseChanges: 2,
    minimumStickActionBeatSpanRatio: 0.35,
    minimumStickActionReleasePeakRatio: 0.35,
    maximumStickActionReleasePeakRatio: 0.82,
    minimumStickActionSupportedReleaseRatio: 0.4,
    minimumStickActionTorsoRangeDegrees: 20,
    minimumHipShoulderSeparationDegrees: 6,
    minimumStickActionLowerBodyLeadFrames: 6,
    minimumStickActionRecoveryRatio: 0.75,
    minimumAthleticTorsoLeanDegrees: 10,
    maximumLoopClosureErrorDegrees: 999,
    maximumLoopVerticalOffsetUnits: 999,
  },
  pass: {
    minimumFrameCount: 24,
    minimumDurationSeconds: 0.8,
    maximumFrameRotationDeltaDegrees: 44,
    maximumFrameRotationAccelerationDegrees: 20,
    minimumRootTravelUnits: 5,
    minimumRootForwardTravelUnits: 4,
    minimumRootForwardSpeedChangeUnits: 0.12,
    minimumRootLateralShiftUnits: 3,
    minimumRootVerticalBounceUnits: 0,
    minimumReadyStanceLegLoadDegrees: 0,
    minimumLegDriveRangeDegrees: 28,
    minimumLocomotionStrideBalanceRatio: 0,
    minimumLocomotionFootPlantDriveRatio: 0,
    minimumAlternatingLegSeparationDegrees: 0,
    minimumLocomotionArmSwingRangeDegrees: 0,
    minimumLocomotionContralateralSyncRatio: 0,
    minimumFootPlantContactFrames: 8,
    minimumFootPlantSideCount: 2,
    minimumFootPlantBalanceRatio: 0.56,
    minimumFootPlantHoldFramesPerSide: 3,
    maximumFootPlantRootDriftUnits: 6,
    minimumTotalRotationRangeDegrees: 150,
    minimumStridePhaseChanges: 0,
    minimumStrideCycleSpanRatio: 0,
    minimumStickActionArmRangeDegrees: 100,
    minimumStickActionTwoHandBalanceRatio: 0.55,
    minimumStickActionTwoHandSyncRatio: 0.65,
    minimumStickActionTwoHandContactRatio: 0.75,
    minimumStickActionPhaseChanges: 2,
    minimumStickActionBeatSpanRatio: 0.35,
    minimumStickActionReleasePeakRatio: 0.35,
    maximumStickActionReleasePeakRatio: 0.82,
    minimumStickActionSupportedReleaseRatio: 0.4,
    minimumStickActionTorsoRangeDegrees: 24,
    minimumHipShoulderSeparationDegrees: 6,
    minimumStickActionLowerBodyLeadFrames: 2,
    minimumStickActionRecoveryRatio: 0.75,
    minimumAthleticTorsoLeanDegrees: 8,
    maximumLoopClosureErrorDegrees: 999,
    maximumLoopVerticalOffsetUnits: 999,
  },
  shot: {
    minimumFrameCount: 24,
    minimumDurationSeconds: 0.8,
    maximumFrameRotationDeltaDegrees: 50,
    maximumFrameRotationAccelerationDegrees: 22,
    minimumRootTravelUnits: 7,
    minimumRootForwardTravelUnits: 6,
    minimumRootForwardSpeedChangeUnits: 0.18,
    minimumRootLateralShiftUnits: 3.5,
    minimumRootVerticalBounceUnits: 0,
    minimumReadyStanceLegLoadDegrees: 0,
    minimumLegDriveRangeDegrees: 30,
    minimumLocomotionStrideBalanceRatio: 0,
    minimumLocomotionFootPlantDriveRatio: 0,
    minimumAlternatingLegSeparationDegrees: 0,
    minimumLocomotionArmSwingRangeDegrees: 0,
    minimumLocomotionContralateralSyncRatio: 0,
    minimumFootPlantContactFrames: 8,
    minimumFootPlantSideCount: 2,
    minimumFootPlantBalanceRatio: 0.56,
    minimumFootPlantHoldFramesPerSide: 3,
    maximumFootPlantRootDriftUnits: 7,
    minimumTotalRotationRangeDegrees: 220,
    minimumStridePhaseChanges: 0,
    minimumStrideCycleSpanRatio: 0,
    minimumStickActionArmRangeDegrees: 120,
    minimumStickActionTwoHandBalanceRatio: 0.55,
    minimumStickActionTwoHandSyncRatio: 0.65,
    minimumStickActionTwoHandContactRatio: 0.75,
    minimumStickActionPhaseChanges: 2,
    minimumStickActionBeatSpanRatio: 0.35,
    minimumStickActionReleasePeakRatio: 0.35,
    maximumStickActionReleasePeakRatio: 0.82,
    minimumStickActionSupportedReleaseRatio: 0.4,
    minimumStickActionTorsoRangeDegrees: 32,
    minimumHipShoulderSeparationDegrees: 7,
    minimumStickActionLowerBodyLeadFrames: 2,
    minimumStickActionRecoveryRatio: 0.75,
    minimumAthleticTorsoLeanDegrees: 10,
    maximumLoopClosureErrorDegrees: 999,
    maximumLoopVerticalOffsetUnits: 999,
  },
};

function normalizeName(fileName) {
  return fileName
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function findSourceRightsEvidence(filePath) {
  const dir = dirname(filePath);
  const baseName = basename(filePath, extname(filePath));
  const candidates = [
    `${baseName}.source.md`,
    `${baseName}.license.md`,
    `${baseName}.attribution.md`,
    'SOURCE_NOTES.md',
    'LICENSE.md',
    'ATTRIBUTION.md',
  ];

  return candidates
    .map((candidate) => join(dir, candidate))
    .find((candidatePath) => existsSync(candidatePath));
}

const SOURCE_RIGHTS_METADATA_PATTERN = /^\s*(source quality|source provider|capture method|usage rights)\s*:\s*(.*?)\s*$/i;

export function readSourceRightsMetadata(sourceRightsPath) {
  const emptyMetadata = {
    sourceQuality: null,
    sourceProvider: null,
    captureMethod: null,
    usageRights: null,
  };
  if (!sourceRightsPath) return emptyMetadata;

  try {
    const source = readFileSync(sourceRightsPath, 'utf8');
    const metadata = { ...emptyMetadata };
    const lines = source.split(/\r?\n/);
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const match = line.match(SOURCE_RIGHTS_METADATA_PATTERN);
      if (!match) continue;
      const continuation = [];
      for (let nextIndex = lineIndex + 1; nextIndex < lines.length; nextIndex += 1) {
        const nextLine = lines[nextIndex];
        const trimmed = nextLine.trim();
        if (!trimmed || SOURCE_RIGHTS_METADATA_PATTERN.test(nextLine)) break;
        continuation.push(trimmed);
      }
      const value = [match[2].trim(), ...continuation].join(' ').trim();
      if (match[1].toLowerCase() === 'source quality') metadata.sourceQuality = value;
      if (match[1].toLowerCase() === 'source provider') metadata.sourceProvider = value;
      if (match[1].toLowerCase() === 'capture method') metadata.captureMethod = value;
      if (match[1].toLowerCase() === 'usage rights') metadata.usageRights = value;
    }
    return metadata;
  } catch {
    return emptyMetadata;
  }
}

export function classifyMotionSource(fileName) {
  const normalized = normalizeName(fileName);
  const primaryGroup = REQUIRED_MOTION_GROUPS
    .find((group) => group.tokens.some((token) => normalized.includes(token)));
  return primaryGroup ? [primaryGroup.key] : [];
}

function roundDuration(value) {
  return Math.round(value * 1000) / 1000;
}

function roundMetric(value) {
  return Math.round(value * 100) / 100;
}

function calculateStrideCycleMetrics(frameRows) {
  let previousSign = 0;
  let changes = 0;
  const changeFrames = [];

  for (let index = 0; index < frameRows.length; index += 1) {
    const row = frameRows[index];
    const leftLegX = row[19] ?? 0;
    const rightLegX = row[22] ?? 0;
    const strideDifference = leftLegX - rightLegX;
    const currentSign = Math.abs(strideDifference) >= STRIDE_PHASE_DEAD_ZONE_DEGREES
      ? Math.sign(strideDifference)
      : 0;

    if (currentSign === 0) {
      continue;
    }
    if (previousSign !== 0 && currentSign !== previousSign) {
      changes += 1;
      changeFrames.push(index);
    }
    previousSign = currentSign;
  }

  const denominator = Math.max(1, frameRows.length - 1);
  const strideCycleSpanRatio = changeFrames.length >= 2
    ? (changeFrames[changeFrames.length - 1] - changeFrames[0]) / denominator
    : 0;

  return {
    stridePhaseChanges: changes,
    strideCycleSpanRatio: roundMetric(strideCycleSpanRatio),
  };
}

function countStridePhaseChanges(frameRows) {
  return calculateStrideCycleMetrics(frameRows).stridePhaseChanges;
}

function calculateStickActionBeatMetrics(frameRows) {
  let previousTrend = 0;
  let changes = 0;
  const beatFrames = [];

  const armSweepValues = frameRows.map((row) => (
    row
      .slice(STICK_ACTION_ARM_CHANNEL_START, STICK_ACTION_ARM_CHANNEL_END)
      .reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
  ));

  for (let index = 1; index < armSweepValues.length; index += 1) {
    const delta = armSweepValues[index] - armSweepValues[index - 1];
    const currentTrend = Math.abs(delta) >= STICK_ACTION_PHASE_DEAD_ZONE_DEGREES
      ? Math.sign(delta)
      : 0;

    if (currentTrend === 0) {
      continue;
    }
    if (previousTrend !== 0 && currentTrend !== previousTrend) {
      changes += 1;
      beatFrames.push(index - 1);
    }
    previousTrend = currentTrend;
  }

  const denominator = Math.max(1, frameRows.length - 1);
  const beatSpanRatio = beatFrames.length >= 2
    ? (beatFrames[beatFrames.length - 1] - beatFrames[0]) / denominator
    : 0;

  return {
    stickActionPhaseChanges: changes,
    stickActionBeatSpanRatio: roundMetric(beatSpanRatio),
  };
}

function countStickActionPhaseChanges(frameRows) {
  return calculateStickActionBeatMetrics(frameRows).stickActionPhaseChanges;
}

function calculateStickActionRecoveryRatio(frameRows) {
  if (frameRows.length < 2) {
    return 0;
  }

  const armActionValues = calculateStickActionArmDistances(frameRows);
  const peakDistance = Math.max(...armActionValues);
  if (peakDistance <= 0) {
    return 0;
  }

  const finalDistance = armActionValues[armActionValues.length - 1] ?? 0;
  const recoveryRatio = (peakDistance - finalDistance) / peakDistance;
  return roundMetric(Math.max(0, Math.min(1, recoveryRatio)));
}

function calculateStickActionArmDistances(frameRows) {
  if (frameRows.length === 0) {
    return [];
  }

  const armVectors = frameRows.map((row) => row.slice(STICK_ACTION_ARM_CHANNEL_START, STICK_ACTION_ARM_CHANNEL_END));
  const startVector = armVectors[0] ?? [];
  const distanceFromStart = (vector) => Math.sqrt(startVector.reduce((sum, value, index) => {
    const delta = (vector[index] ?? 0) - value;
    return sum + (delta * delta);
  }, 0));

  return armVectors.map(distanceFromStart);
}

function calculateStickActionReleasePeakRatio(frameRows) {
  if (frameRows.length < 2) {
    return 0;
  }

  const armActionValues = calculateStickActionArmDistances(frameRows);
  if (Math.max(...armActionValues) <= 0) {
    return 0;
  }

  return roundMetric(indexOfPeak(armActionValues) / Math.max(1, frameRows.length - 1));
}

function calculateStickActionSupportedReleaseRatio(frameRows) {
  if (frameRows.length < 2) {
    return 0;
  }

  const armActionValues = calculateStickActionArmDistances(frameRows);
  if (Math.max(...armActionValues) <= 0) {
    return 0;
  }

  const rootHeights = frameRows.map((row) => row[1]).filter(Number.isFinite);
  if (rootHeights.length === 0) {
    return 0;
  }

  const minRootHeight = Math.min(...rootHeights);
  const maxRootHeight = Math.max(...rootHeights);
  const lowRootThreshold = minRootHeight + ((maxRootHeight - minRootHeight) * FOOT_PLANT_ROOT_LOW_RATIO);
  const releaseIndex = indexOfPeak(armActionValues);
  const startIndex = Math.max(0, releaseIndex - STICK_ACTION_RELEASE_SUPPORT_WINDOW_FRAMES);
  const endIndex = Math.min(frameRows.length - 1, releaseIndex + STICK_ACTION_RELEASE_SUPPORT_WINDOW_FRAMES);
  let supportedFrames = 0;
  let totalFrames = 0;
  for (let index = startIndex; index <= endIndex; index += 1) {
    totalFrames += 1;
    if (footPlantContactSide(frameRows[index], lowRootThreshold) !== 0) {
      supportedFrames += 1;
    }
  }

  return totalFrames > 0 ? roundMetric(supportedFrames / totalFrames) : 0;
}

function indexOfPeak(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((peakIndex, value, index) => (
    value > values[peakIndex] ? index : peakIndex
  ), 0);
}

function calculateStickActionLowerBodyLeadFrames(frameRows) {
  if (frameRows.length < 2) {
    return 0;
  }

  const startVector = frameRows[0].slice(STICK_ACTION_ARM_CHANNEL_START, STICK_ACTION_ARM_CHANNEL_END);
  const armActionValues = frameRows.map((row) => Math.sqrt(startVector.reduce((sum, value, index) => {
    const delta = (row[STICK_ACTION_ARM_CHANNEL_START + index] ?? 0) - value;
    return sum + (delta * delta);
  }, 0)));
  const lowerBodyLoadValues = frameRows.map((row) => (
    Math.abs(row[LEFT_LEG_DRIVE_CHANNEL] ?? 0) + Math.abs(row[RIGHT_LEG_DRIVE_CHANNEL] ?? 0)
  ));

  return indexOfPeak(armActionValues) - indexOfPeak(lowerBodyLoadValues);
}

function calculateStickActionTwoHandBalanceRatio(ranges) {
  const leftRange = ranges
    .slice(STICK_ACTION_ARM_CHANNEL_START, STICK_ACTION_ARM_CHANNEL_START + 3)
    .reduce((sum, range) => sum + range, 0);
  const rightRange = ranges
    .slice(STICK_ACTION_ARM_CHANNEL_START + 3, STICK_ACTION_ARM_CHANNEL_END)
    .reduce((sum, range) => sum + range, 0);

  if (leftRange <= 0 || rightRange <= 0) {
    return 0;
  }

  return roundMetric(Math.min(leftRange, rightRange) / Math.max(leftRange, rightRange));
}

function calculateArmActionDistances(frameRows, startIndex, endIndex) {
  if (frameRows.length === 0) {
    return [];
  }

  const startVector = frameRows[0].slice(startIndex, endIndex);
  return frameRows.map((row) => Math.sqrt(startVector.reduce((sum, value, index) => {
    const delta = (row[startIndex + index] ?? 0) - value;
    return sum + (delta * delta);
  }, 0)));
}

function calculateStickActionTwoHandSyncRatio(frameRows) {
  if (frameRows.length < 2) {
    return 0;
  }

  const leftDistances = calculateArmActionDistances(
    frameRows,
    STICK_ACTION_ARM_CHANNEL_START,
    STICK_ACTION_ARM_CHANNEL_START + 3,
  );
  const rightDistances = calculateArmActionDistances(
    frameRows,
    STICK_ACTION_ARM_CHANNEL_START + 3,
    STICK_ACTION_ARM_CHANNEL_END,
  );
  const leftPeak = Math.max(...leftDistances);
  const rightPeak = Math.max(...rightDistances);
  if (leftPeak <= 0 || rightPeak <= 0) {
    return 0;
  }

  let eitherHandActiveFrames = 0;
  let bothHandsActiveFrames = 0;
  for (let index = 0; index < frameRows.length; index += 1) {
    const leftActive = leftDistances[index] >= leftPeak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO;
    const rightActive = rightDistances[index] >= rightPeak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO;
    if (leftActive || rightActive) eitherHandActiveFrames += 1;
    if (leftActive && rightActive) bothHandsActiveFrames += 1;
  }

  return eitherHandActiveFrames > 0
    ? roundMetric(bothHandsActiveFrames / eitherHandActiveFrames)
    : 0;
}

function calculateStickActionTwoHandContactRatio(frameRows) {
  if (frameRows.length < 2) {
    return 0;
  }

  const leftDistances = calculateArmActionDistances(
    frameRows,
    STICK_ACTION_ARM_CHANNEL_START,
    STICK_ACTION_ARM_CHANNEL_START + 3,
  );
  const rightDistances = calculateArmActionDistances(
    frameRows,
    STICK_ACTION_ARM_CHANNEL_START + 3,
    STICK_ACTION_ARM_CHANNEL_END,
  );
  const leftPeak = Math.max(...leftDistances);
  const rightPeak = Math.max(...rightDistances);
  if (leftPeak <= 0 || rightPeak <= 0) {
    return 0;
  }

  let bothHandsActiveFrames = 0;
  for (let index = 0; index < frameRows.length; index += 1) {
    const leftActive = leftDistances[index] >= leftPeak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO;
    const rightActive = rightDistances[index] >= rightPeak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO;
    if (leftActive && rightActive) bothHandsActiveFrames += 1;
  }

  return roundMetric(bothHandsActiveFrames / frameRows.length);
}

function calculateCorrelation(leftValues, rightValues) {
  const count = Math.min(leftValues.length, rightValues.length);
  if (count < 2) {
    return 0;
  }

  const leftMean = leftValues.slice(0, count).reduce((sum, value) => sum + value, 0) / count;
  const rightMean = rightValues.slice(0, count).reduce((sum, value) => sum + value, 0) / count;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < count; index += 1) {
    const leftDelta = leftValues[index] - leftMean;
    const rightDelta = rightValues[index] - rightMean;
    numerator += leftDelta * rightDelta;
    leftVariance += leftDelta * leftDelta;
    rightVariance += rightDelta * rightDelta;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator > 0 ? numerator / denominator : 0;
}

function calculateLocomotionContralateralSyncRatio(frameRows) {
  if (frameRows.length < 2) {
    return 0;
  }

  const leftArm = frameRows.map((row) => row[LEFT_ARM_SWING_CHANNEL] ?? 0);
  const rightArm = frameRows.map((row) => row[RIGHT_ARM_SWING_CHANNEL] ?? 0);
  const leftLeg = frameRows.map((row) => row[LEFT_LEG_DRIVE_CHANNEL] ?? 0);
  const rightLeg = frameRows.map((row) => row[RIGHT_LEG_DRIVE_CHANNEL] ?? 0);
  const leftArmRightLeg = calculateCorrelation(leftArm, rightLeg);
  const rightArmLeftLeg = calculateCorrelation(rightArm, leftLeg);

  return roundMetric(Math.max(0, (leftArmRightLeg + rightArmLeftLeg) / 2));
}

function calculateAlternatingLegSeparation(frameRows) {
  const separationValues = frameRows
    .map((row) => Math.abs((row[LEFT_LEG_DRIVE_CHANNEL] ?? 0) - (row[RIGHT_LEG_DRIVE_CHANNEL] ?? 0)))
    .filter(Number.isFinite);

  if (separationValues.length === 0) {
    return 0;
  }

  return roundMetric(Math.max(...separationValues));
}

function calculateLocomotionStrideBalanceRatio(ranges) {
  const leftLegRange = ranges[LEFT_LEG_DRIVE_CHANNEL] ?? 0;
  const rightLegRange = ranges[RIGHT_LEG_DRIVE_CHANNEL] ?? 0;
  if (leftLegRange <= 0 || rightLegRange <= 0) {
    return 0;
  }

  return roundMetric(Math.min(leftLegRange, rightLegRange) / Math.max(leftLegRange, rightLegRange));
}

function calculateLoopClosureMetrics(frameRows) {
  const first = frameRows[0] ?? [];
  const last = frameRows[frameRows.length - 1] ?? [];
  const columnCount = Math.min(first.length, last.length);
  let locomotionLoopClosureErrorDegrees = 0;

  for (let columnIndex = 3; columnIndex < columnCount; columnIndex += 1) {
    locomotionLoopClosureErrorDegrees += Math.abs((last[columnIndex] ?? 0) - (first[columnIndex] ?? 0));
  }

  return {
    locomotionLoopClosureErrorDegrees: roundMetric(locomotionLoopClosureErrorDegrees),
    rootVerticalLoopOffsetUnits: roundMetric(Math.abs((last[1] ?? 0) - (first[1] ?? 0))),
  };
}

function calculateRootForwardSpeedChangeUnits(frameRows) {
  if (frameRows.length < 3) {
    return 0;
  }

  const forwardSpeeds = [];
  for (let index = 1; index < frameRows.length; index += 1) {
    forwardSpeeds.push((frameRows[index]?.[2] ?? 0) - (frameRows[index - 1]?.[2] ?? 0));
  }

  return roundMetric(Math.max(...forwardSpeeds) - Math.min(...forwardSpeeds));
}

function calculateMaxFrameRotationDeltaDegrees(frameRows) {
  let maxDelta = 0;

  for (let rowIndex = 1; rowIndex < frameRows.length; rowIndex += 1) {
    const previous = frameRows[rowIndex - 1] ?? [];
    const current = frameRows[rowIndex] ?? [];
    const columnCount = Math.min(previous.length, current.length);
    for (let columnIndex = 3; columnIndex < columnCount; columnIndex += 1) {
      maxDelta = Math.max(maxDelta, Math.abs((current[columnIndex] ?? 0) - (previous[columnIndex] ?? 0)));
    }
  }

  return roundMetric(maxDelta);
}

function calculateMaxFrameRotationAccelerationDegrees(frameRows) {
  if (frameRows.length < 3) {
    return 0;
  }

  const frameDeltas = [];
  for (let rowIndex = 1; rowIndex < frameRows.length; rowIndex += 1) {
    const previous = frameRows[rowIndex - 1] ?? [];
    const current = frameRows[rowIndex] ?? [];
    const columnCount = Math.min(previous.length, current.length);
    const deltas = [];
    for (let columnIndex = 3; columnIndex < columnCount; columnIndex += 1) {
      deltas[columnIndex] = (current[columnIndex] ?? 0) - (previous[columnIndex] ?? 0);
    }
    frameDeltas.push(deltas);
  }

  let maxAcceleration = 0;
  for (let deltaIndex = 1; deltaIndex < frameDeltas.length; deltaIndex += 1) {
    const previous = frameDeltas[deltaIndex - 1] ?? [];
    const current = frameDeltas[deltaIndex] ?? [];
    const columnCount = Math.min(previous.length, current.length);
    for (let columnIndex = 3; columnIndex < columnCount; columnIndex += 1) {
      maxAcceleration = Math.max(
        maxAcceleration,
        Math.abs((current[columnIndex] ?? 0) - (previous[columnIndex] ?? 0)),
      );
    }
  }

  return roundMetric(maxAcceleration);
}

function footPlantContactSide(row, lowRootThreshold) {
  const leftLegX = row?.[19] ?? 0;
  const rightLegX = row?.[22] ?? 0;
  const strideDifference = leftLegX - rightLegX;
  if (
    Number.isFinite(row?.[1])
    && row[1] <= lowRootThreshold
    && Math.abs(strideDifference) >= STRIDE_PHASE_DEAD_ZONE_DEGREES
  ) {
    return Math.sign(strideDifference);
  }
  return 0;
}

function calculateFootPlantMetrics(frameRows) {
  const rootHeights = frameRows.map((row) => row[1]).filter(Number.isFinite);
  if (rootHeights.length === 0) {
    return {
      footPlantContactFrameCount: 0,
      footPlantSideCount: 0,
      footPlantBalanceRatio: 0,
      footPlantMinSideHoldFrames: 0,
      maxFootPlantRootDriftUnits: 0,
    };
  }

  const minRootHeight = Math.min(...rootHeights);
  const maxRootHeight = Math.max(...rootHeights);
  const lowRootThreshold = minRootHeight + ((maxRootHeight - minRootHeight) * FOOT_PLANT_ROOT_LOW_RATIO);
  const contactSides = new Set();
  const contactCounts = new Map();
  const longestHoldBySide = new Map();
  let activeContact = null;
  let footPlantContactFrameCount = 0;
  let maxFootPlantRootDriftUnits = 0;

  for (const row of frameRows) {
    const side = footPlantContactSide(row, lowRootThreshold);
    if (side !== 0) {
      footPlantContactFrameCount += 1;
      contactSides.add(side);
      contactCounts.set(side, (contactCounts.get(side) ?? 0) + 1);

      const rootX = row[0] ?? 0;
      const rootZ = row[2] ?? 0;
      if (Number.isFinite(rootX) && Number.isFinite(rootZ)) {
        if (!activeContact || activeContact.side !== side) {
          activeContact = { side, startX: rootX, startZ: rootZ, frameCount: 0 };
        }
        activeContact.frameCount += 1;
        longestHoldBySide.set(side, Math.max(
          longestHoldBySide.get(side) ?? 0,
          activeContact.frameCount,
        ));
        maxFootPlantRootDriftUnits = Math.max(
          maxFootPlantRootDriftUnits,
          Math.hypot(rootX - activeContact.startX, rootZ - activeContact.startZ),
        );
      }
    } else {
      activeContact = null;
    }
  }

  const sideCounts = [...contactCounts]
    .filter(([side]) => side !== 0)
    .map(([, count]) => count);
  const footPlantBalanceRatio = sideCounts.length >= 2
    ? roundMetric(Math.min(...sideCounts) / Math.max(...sideCounts))
    : 0;
  const sideHoldCounts = [...contactSides]
    .filter((side) => side !== 0)
    .map((side) => longestHoldBySide.get(side) ?? 0);
  const footPlantMinSideHoldFrames = sideHoldCounts.length > 0
    ? Math.min(...sideHoldCounts)
    : 0;

  return {
    footPlantContactFrameCount,
    footPlantSideCount: [...contactSides].filter((side) => side !== 0).length,
    footPlantBalanceRatio,
    footPlantMinSideHoldFrames,
    maxFootPlantRootDriftUnits: roundMetric(maxFootPlantRootDriftUnits),
  };
}

function calculateLocomotionFootPlantDriveRatio(frameRows) {
  const rootHeights = frameRows.map((row) => row[1]).filter(Number.isFinite);
  if (frameRows.length < 2 || rootHeights.length === 0) {
    return 0;
  }

  const minRootHeight = Math.min(...rootHeights);
  const maxRootHeight = Math.max(...rootHeights);
  const lowRootThreshold = minRootHeight + ((maxRootHeight - minRootHeight) * FOOT_PLANT_ROOT_LOW_RATIO);
  let totalForwardDrive = 0;
  let plantedForwardDrive = 0;

  for (let index = 1; index < frameRows.length; index += 1) {
    const forwardDrive = Math.max(0, (frameRows[index]?.[2] ?? 0) - (frameRows[index - 1]?.[2] ?? 0));
    if (forwardDrive <= 0) {
      continue;
    }

    totalForwardDrive += forwardDrive;
    let hasNearbyPlant = false;
    for (
      let contactIndex = index - FOOT_PLANT_DRIVE_WINDOW_FRAMES;
      contactIndex <= index + FOOT_PLANT_DRIVE_WINDOW_FRAMES;
      contactIndex += 1
    ) {
      hasNearbyPlant ||= footPlantContactSide(frameRows[contactIndex], lowRootThreshold) !== 0;
    }
    if (hasNearbyPlant) {
      plantedForwardDrive += forwardDrive;
    }
  }

  return totalForwardDrive > 0
    ? roundMetric(plantedForwardDrive / totalForwardDrive)
    : 0;
}

function calculateReadyStanceLegLoad(frameRows) {
  const frameLoads = frameRows
    .map((row) => {
      const leftLegLoad = Math.abs(row[READY_STANCE_LEFT_LEG_LOAD_CHANNEL] ?? 0);
      const rightLegLoad = Math.abs(row[READY_STANCE_RIGHT_LEG_LOAD_CHANNEL] ?? 0);
      return leftLegLoad + rightLegLoad;
    })
    .filter(Number.isFinite);

  if (frameLoads.length === 0) {
    return 0;
  }

  return roundMetric(frameLoads.reduce((sum, value) => sum + value, 0) / frameLoads.length);
}

function calculateAthleticTorsoLean(frameRows) {
  const leanValues = frameRows
    .map((row) => Math.abs(row[ATHLETIC_TORSO_LEAN_CHANNEL] ?? 0))
    .filter(Number.isFinite);

  if (leanValues.length === 0) {
    return 0;
  }

  return roundMetric(leanValues.reduce((sum, value) => sum + value, 0) / leanValues.length);
}

function calculateHipShoulderSeparation(frameRows) {
  const separationValues = frameRows
    .map((row) => (row[SHOULDER_YAW_CHANNEL] ?? 0) - (row[HIP_YAW_CHANNEL] ?? 0))
    .filter(Number.isFinite);

  if (separationValues.length === 0) {
    return 0;
  }

  return roundMetric(Math.max(...separationValues) - Math.min(...separationValues));
}

function inspectBvhMetadata(filePath) {
  try {
    const source = readFileSync(filePath, 'utf8');
    const frameCount = Number(source.match(/Frames:\s*(\d+)/i)?.[1] ?? 0);
    const frameTime = Number(source.match(/Frame\s+Time:\s*([0-9.]+)/i)?.[1] ?? 0);
    const durationSeconds = roundDuration(frameCount * frameTime);
    const lines = source.split(/\r?\n/);
    const motionIndex = lines.findIndex((line) => line.trim().toUpperCase() === 'MOTION');
    const frameRows = motionIndex >= 0
      ? lines
        .slice(motionIndex + 3)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(/\s+/).map(Number))
        .filter((values) => values.length > 0 && values.every(Number.isFinite))
      : [];
    const columnCount = frameRows[0]?.length ?? 0;
    const ranges = Array.from({ length: columnCount }, (_, columnIndex) => {
      const values = frameRows.map((row) => row[columnIndex]).filter(Number.isFinite);
      return values.length > 0 ? Math.max(...values) - Math.min(...values) : 0;
    });
    const rotationRanges = ranges.slice(3);
    const maxRotationRangeDegrees = rotationRanges.length > 0
      ? roundMetric(Math.max(...rotationRanges))
      : 0;
    const activeRotationChannelCount = rotationRanges
      .filter((range) => range >= ACTIVE_ROTATION_CHANNEL_RANGE_DEGREES)
      .length;
    const maxFrameRotationDeltaDegrees = calculateMaxFrameRotationDeltaDegrees(frameRows);
    const maxFrameRotationAccelerationDegrees = calculateMaxFrameRotationAccelerationDegrees(frameRows);
    const rootTravelUnits = roundMetric(Math.hypot(ranges[0] ?? 0, ranges[2] ?? 0));
    const rootLateralShiftUnits = roundMetric(ranges[0] ?? 0);
    const rootForwardTravelUnits = roundMetric(ranges[2] ?? 0);
    const rootForwardSpeedChangeUnits = calculateRootForwardSpeedChangeUnits(frameRows);
    const rootVerticalBounceUnits = roundMetric(ranges[1] ?? 0);
    const readyStanceLegLoadDegrees = calculateReadyStanceLegLoad(frameRows);
    const legDriveRangeDegrees = roundMetric((ranges[19] ?? 0) + (ranges[22] ?? 0));
    const locomotionStrideBalanceRatio = calculateLocomotionStrideBalanceRatio(ranges);
    const locomotionFootPlantDriveRatio = calculateLocomotionFootPlantDriveRatio(frameRows);
    const alternatingLegSeparationDegrees = calculateAlternatingLegSeparation(frameRows);
    const locomotionArmSwingRangeDegrees = roundMetric(
      LOCOMOTION_ARM_SWING_CHANNELS.reduce((sum, channelIndex) => sum + (ranges[channelIndex] ?? 0), 0),
    );
    const locomotionContralateralSyncRatio = calculateLocomotionContralateralSyncRatio(frameRows);
    const totalRotationRangeDegrees = roundMetric(rotationRanges.reduce((sum, range) => sum + range, 0));
    const strideCycleMetrics = calculateStrideCycleMetrics(frameRows);
    const footPlantMetrics = calculateFootPlantMetrics(frameRows);
    const stickActionArmRangeDegrees = roundMetric(
      ranges
        .slice(STICK_ACTION_ARM_CHANNEL_START, STICK_ACTION_ARM_CHANNEL_END)
        .reduce((sum, range) => sum + range, 0),
    );
    const stickActionTwoHandBalanceRatio = calculateStickActionTwoHandBalanceRatio(ranges);
    const stickActionTwoHandSyncRatio = calculateStickActionTwoHandSyncRatio(frameRows);
    const stickActionTwoHandContactRatio = calculateStickActionTwoHandContactRatio(frameRows);
    const stickActionTorsoRangeDegrees = roundMetric(
      ranges
        .slice(STICK_ACTION_TORSO_CHANNEL_START, STICK_ACTION_TORSO_CHANNEL_END)
        .reduce((sum, range) => sum + range, 0),
    );
    const hipShoulderSeparationDegrees = calculateHipShoulderSeparation(frameRows);
    const stickActionBeatMetrics = calculateStickActionBeatMetrics(frameRows);
    const stickActionReleasePeakRatio = calculateStickActionReleasePeakRatio(frameRows);
    const stickActionSupportedReleaseRatio = calculateStickActionSupportedReleaseRatio(frameRows);
    const stickActionRecoveryRatio = calculateStickActionRecoveryRatio(frameRows);
    const stickActionLowerBodyLeadFrames = calculateStickActionLowerBodyLeadFrames(frameRows);
    const athleticTorsoLeanDegrees = calculateAthleticTorsoLean(frameRows);
    const loopClosureMetrics = calculateLoopClosureMetrics(frameRows);

    return {
      format: 'bvh',
      frameCount,
      frameTime,
      durationSeconds,
      maxRotationRangeDegrees,
      activeRotationChannelCount,
      maxFrameRotationDeltaDegrees,
      maxFrameRotationAccelerationDegrees,
      rootTravelUnits,
      rootForwardTravelUnits,
      rootForwardSpeedChangeUnits,
      rootLateralShiftUnits,
      rootVerticalBounceUnits,
      readyStanceLegLoadDegrees,
      legDriveRangeDegrees,
      locomotionStrideBalanceRatio,
      locomotionFootPlantDriveRatio,
      alternatingLegSeparationDegrees,
      locomotionArmSwingRangeDegrees,
      locomotionContralateralSyncRatio,
      ...footPlantMetrics,
      totalRotationRangeDegrees,
      ...strideCycleMetrics,
      stickActionArmRangeDegrees,
      stickActionTwoHandBalanceRatio,
      stickActionTwoHandSyncRatio,
      stickActionTwoHandContactRatio,
      ...stickActionBeatMetrics,
      stickActionReleasePeakRatio,
      stickActionSupportedReleaseRatio,
      stickActionTorsoRangeDegrees,
      hipShoulderSeparationDegrees,
      stickActionLowerBodyLeadFrames,
      stickActionRecoveryRatio,
      athleticTorsoLeanDegrees,
      ...loopClosureMetrics,
    };
  } catch {
    return {
      format: 'bvh',
      frameCount: 0,
      frameTime: 0,
      durationSeconds: 0,
      maxRotationRangeDegrees: 0,
      activeRotationChannelCount: 0,
      maxFrameRotationDeltaDegrees: 999,
      maxFrameRotationAccelerationDegrees: 999,
      rootTravelUnits: 0,
      rootForwardTravelUnits: 0,
      rootForwardSpeedChangeUnits: 0,
      rootLateralShiftUnits: 0,
      rootVerticalBounceUnits: 0,
      readyStanceLegLoadDegrees: 0,
      legDriveRangeDegrees: 0,
      locomotionStrideBalanceRatio: 0,
      locomotionFootPlantDriveRatio: 0,
      alternatingLegSeparationDegrees: 0,
      locomotionArmSwingRangeDegrees: 0,
      locomotionContralateralSyncRatio: 0,
      footPlantContactFrameCount: 0,
      footPlantSideCount: 0,
      footPlantBalanceRatio: 0,
      footPlantMinSideHoldFrames: 0,
      totalRotationRangeDegrees: 0,
      stridePhaseChanges: 0,
      strideCycleSpanRatio: 0,
      stickActionArmRangeDegrees: 0,
      stickActionTwoHandBalanceRatio: 0,
      stickActionTwoHandSyncRatio: 0,
      stickActionTwoHandContactRatio: 0,
      stickActionPhaseChanges: 0,
      stickActionBeatSpanRatio: 0,
      stickActionReleasePeakRatio: 0,
      stickActionSupportedReleaseRatio: 0,
      stickActionTorsoRangeDegrees: 0,
      hipShoulderSeparationDegrees: 0,
      stickActionRecoveryRatio: 0,
      athleticTorsoLeanDegrees: 0,
      locomotionLoopClosureErrorDegrees: 999,
      rootVerticalLoopOffsetUnits: 999,
      readError: true,
    };
  }
}

function inspectMotionSourceFile(filePath) {
  const extension = extname(filePath).toLowerCase();
  if (extension === '.bvh') {
    return inspectBvhMetadata(filePath);
  }
  return {
    format: extension.replace('.', ''),
    frameCount: null,
    frameTime: null,
    durationSeconds: null,
  };
}

function validateMotionData(source) {
  if (source.format !== 'bvh') {
    return null;
  }

  if (source.readError) {
    return {
      relativePath: source.relativePath ?? source.fileName,
      reason: 'bvh-source-unreadable',
      frameCount: source.frameCount ?? 0,
      durationSeconds: source.durationSeconds ?? 0,
    };
  }

  if ((source.frameCount ?? 0) < MIN_RETARGETABLE_BVH_FRAMES || (source.durationSeconds ?? 0) <= 0) {
    return {
      relativePath: source.relativePath ?? source.fileName,
      reason: 'bvh-source-too-short',
      frameCount: source.frameCount ?? 0,
      durationSeconds: source.durationSeconds ?? 0,
    };
  }

  if (
    (source.frameCount ?? 0) < MIN_ACTION_CLIP_BVH_FRAMES
    || (source.durationSeconds ?? 0) < MIN_ACTION_CLIP_BVH_DURATION_SECONDS
  ) {
    return {
      relativePath: source.relativePath ?? source.fileName,
      reason: 'bvh-action-clip-too-short',
      frameCount: source.frameCount ?? 0,
      durationSeconds: source.durationSeconds ?? 0,
      minimumFrameCount: MIN_ACTION_CLIP_BVH_FRAMES,
      minimumDurationSeconds: MIN_ACTION_CLIP_BVH_DURATION_SECONDS,
    };
  }

  if (
    Number.isFinite(source.maxRotationRangeDegrees)
    && Number.isFinite(source.activeRotationChannelCount)
    && (
      source.maxRotationRangeDegrees < MIN_ACTION_CLIP_MAX_ROTATION_RANGE_DEGREES
      || source.activeRotationChannelCount < MIN_ACTION_CLIP_ACTIVE_ROTATION_CHANNELS
    )
  ) {
    return {
      relativePath: source.relativePath ?? source.fileName,
      reason: 'bvh-action-motion-too-static',
      maxRotationRangeDegrees: source.maxRotationRangeDegrees,
      activeRotationChannelCount: source.activeRotationChannelCount,
      rootTravelUnits: source.rootTravelUnits ?? 0,
      minimumMaxRotationRangeDegrees: MIN_ACTION_CLIP_MAX_ROTATION_RANGE_DEGREES,
      minimumActiveRotationChannelCount: MIN_ACTION_CLIP_ACTIVE_ROTATION_CHANNELS,
    };
  }

  const qualityProfile = qualityProfileForSource(source);
  const qualityFailures = {};
  if ((source.frameCount ?? 0) < qualityProfile.minimumFrameCount) {
    qualityFailures.frameCount = source.frameCount ?? 0;
    qualityFailures.minimumFrameCount = qualityProfile.minimumFrameCount;
  }
  if ((source.durationSeconds ?? 0) < qualityProfile.minimumDurationSeconds) {
    qualityFailures.durationSeconds = source.durationSeconds ?? 0;
    qualityFailures.minimumDurationSeconds = qualityProfile.minimumDurationSeconds;
  }
  if ((source.maxFrameRotationDeltaDegrees ?? 0) > qualityProfile.maximumFrameRotationDeltaDegrees) {
    qualityFailures.maxFrameRotationDeltaDegrees = source.maxFrameRotationDeltaDegrees ?? 0;
    qualityFailures.maximumFrameRotationDeltaDegrees = qualityProfile.maximumFrameRotationDeltaDegrees;
  }
  if (
    (source.maxFrameRotationAccelerationDegrees ?? 0)
    > qualityProfile.maximumFrameRotationAccelerationDegrees
  ) {
    qualityFailures.maxFrameRotationAccelerationDegrees = source.maxFrameRotationAccelerationDegrees ?? 0;
    qualityFailures.maximumFrameRotationAccelerationDegrees = qualityProfile.maximumFrameRotationAccelerationDegrees;
  }
  if ((source.rootTravelUnits ?? 0) < qualityProfile.minimumRootTravelUnits) {
    qualityFailures.rootTravelUnits = source.rootTravelUnits ?? 0;
    qualityFailures.minimumRootTravelUnits = qualityProfile.minimumRootTravelUnits;
  }
  const rootForwardTravelUnits = source.rootForwardTravelUnits ?? source.rootTravelUnits ?? 0;
  if (rootForwardTravelUnits < qualityProfile.minimumRootForwardTravelUnits) {
    qualityFailures.rootForwardTravelUnits = rootForwardTravelUnits;
    qualityFailures.minimumRootForwardTravelUnits = qualityProfile.minimumRootForwardTravelUnits;
  }
  const rootForwardSpeedChangeUnits = source.rootForwardSpeedChangeUnits
    ?? qualityProfile.minimumRootForwardSpeedChangeUnits;
  if (rootForwardSpeedChangeUnits < qualityProfile.minimumRootForwardSpeedChangeUnits) {
    qualityFailures.rootForwardSpeedChangeUnits = rootForwardSpeedChangeUnits;
    qualityFailures.minimumRootForwardSpeedChangeUnits = qualityProfile.minimumRootForwardSpeedChangeUnits;
  }
  if ((source.rootLateralShiftUnits ?? 0) < qualityProfile.minimumRootLateralShiftUnits) {
    qualityFailures.rootLateralShiftUnits = source.rootLateralShiftUnits ?? 0;
    qualityFailures.minimumRootLateralShiftUnits = qualityProfile.minimumRootLateralShiftUnits;
  }
  if ((source.rootVerticalBounceUnits ?? 0) < qualityProfile.minimumRootVerticalBounceUnits) {
    qualityFailures.rootVerticalBounceUnits = source.rootVerticalBounceUnits ?? 0;
    qualityFailures.minimumRootVerticalBounceUnits = qualityProfile.minimumRootVerticalBounceUnits;
  }
  if ((source.readyStanceLegLoadDegrees ?? 0) < qualityProfile.minimumReadyStanceLegLoadDegrees) {
    qualityFailures.readyStanceLegLoadDegrees = source.readyStanceLegLoadDegrees ?? 0;
    qualityFailures.minimumReadyStanceLegLoadDegrees = qualityProfile.minimumReadyStanceLegLoadDegrees;
  }
  if ((source.legDriveRangeDegrees ?? 0) < qualityProfile.minimumLegDriveRangeDegrees) {
    qualityFailures.legDriveRangeDegrees = source.legDriveRangeDegrees ?? 0;
    qualityFailures.minimumLegDriveRangeDegrees = qualityProfile.minimumLegDriveRangeDegrees;
  }
  if (
    Number.isFinite(source.locomotionStrideBalanceRatio)
    && source.locomotionStrideBalanceRatio < qualityProfile.minimumLocomotionStrideBalanceRatio
  ) {
    qualityFailures.locomotionStrideBalanceRatio = source.locomotionStrideBalanceRatio;
    qualityFailures.minimumLocomotionStrideBalanceRatio = qualityProfile.minimumLocomotionStrideBalanceRatio;
  }
  const alternatingLegSeparationDegrees = source.alternatingLegSeparationDegrees
    ?? qualityProfile.minimumAlternatingLegSeparationDegrees;
  if (alternatingLegSeparationDegrees < qualityProfile.minimumAlternatingLegSeparationDegrees) {
    qualityFailures.alternatingLegSeparationDegrees = alternatingLegSeparationDegrees;
    qualityFailures.minimumAlternatingLegSeparationDegrees = qualityProfile.minimumAlternatingLegSeparationDegrees;
  }
  if ((source.locomotionArmSwingRangeDegrees ?? 0) < qualityProfile.minimumLocomotionArmSwingRangeDegrees) {
    qualityFailures.locomotionArmSwingRangeDegrees = source.locomotionArmSwingRangeDegrees ?? 0;
    qualityFailures.minimumLocomotionArmSwingRangeDegrees = qualityProfile.minimumLocomotionArmSwingRangeDegrees;
  }
  if (
    Number.isFinite(source.locomotionContralateralSyncRatio)
    && source.locomotionContralateralSyncRatio < qualityProfile.minimumLocomotionContralateralSyncRatio
  ) {
    qualityFailures.locomotionContralateralSyncRatio = source.locomotionContralateralSyncRatio;
    qualityFailures.minimumLocomotionContralateralSyncRatio = qualityProfile.minimumLocomotionContralateralSyncRatio;
  }
  if (
    Number.isFinite(source.locomotionFootPlantDriveRatio)
    && source.locomotionFootPlantDriveRatio < qualityProfile.minimumLocomotionFootPlantDriveRatio
  ) {
    qualityFailures.locomotionFootPlantDriveRatio = source.locomotionFootPlantDriveRatio;
    qualityFailures.minimumLocomotionFootPlantDriveRatio = qualityProfile.minimumLocomotionFootPlantDriveRatio;
  }
  if ((source.footPlantContactFrameCount ?? 0) < qualityProfile.minimumFootPlantContactFrames) {
    qualityFailures.footPlantContactFrameCount = source.footPlantContactFrameCount ?? 0;
    qualityFailures.minimumFootPlantContactFrames = qualityProfile.minimumFootPlantContactFrames;
  }
  if ((source.footPlantSideCount ?? 0) < qualityProfile.minimumFootPlantSideCount) {
    qualityFailures.footPlantSideCount = source.footPlantSideCount ?? 0;
    qualityFailures.minimumFootPlantSideCount = qualityProfile.minimumFootPlantSideCount;
  }
  if (
    Number.isFinite(source.footPlantBalanceRatio)
    && source.footPlantBalanceRatio < qualityProfile.minimumFootPlantBalanceRatio
  ) {
    qualityFailures.footPlantBalanceRatio = source.footPlantBalanceRatio;
    qualityFailures.minimumFootPlantBalanceRatio = qualityProfile.minimumFootPlantBalanceRatio;
  }
  const footPlantMinSideHoldFrames = source.footPlantMinSideHoldFrames
    ?? qualityProfile.minimumFootPlantHoldFramesPerSide;
  if (footPlantMinSideHoldFrames < qualityProfile.minimumFootPlantHoldFramesPerSide) {
    qualityFailures.footPlantMinSideHoldFrames = footPlantMinSideHoldFrames;
    qualityFailures.minimumFootPlantHoldFramesPerSide = qualityProfile.minimumFootPlantHoldFramesPerSide;
  }
  if (
    Number.isFinite(source.maxFootPlantRootDriftUnits)
    && source.maxFootPlantRootDriftUnits > qualityProfile.maximumFootPlantRootDriftUnits
  ) {
    qualityFailures.maxFootPlantRootDriftUnits = source.maxFootPlantRootDriftUnits;
    qualityFailures.maximumFootPlantRootDriftUnits = qualityProfile.maximumFootPlantRootDriftUnits;
  }
  if ((source.totalRotationRangeDegrees ?? 0) < qualityProfile.minimumTotalRotationRangeDegrees) {
    qualityFailures.totalRotationRangeDegrees = source.totalRotationRangeDegrees ?? 0;
    qualityFailures.minimumTotalRotationRangeDegrees = qualityProfile.minimumTotalRotationRangeDegrees;
  }
  if ((source.stridePhaseChanges ?? 0) < qualityProfile.minimumStridePhaseChanges) {
    qualityFailures.stridePhaseChanges = source.stridePhaseChanges ?? 0;
    qualityFailures.minimumStridePhaseChanges = qualityProfile.minimumStridePhaseChanges;
  }
  const strideCycleSpanRatio = source.strideCycleSpanRatio ?? qualityProfile.minimumStrideCycleSpanRatio;
  if (
    Number.isFinite(strideCycleSpanRatio)
    && strideCycleSpanRatio < qualityProfile.minimumStrideCycleSpanRatio
  ) {
    qualityFailures.strideCycleSpanRatio = strideCycleSpanRatio;
    qualityFailures.minimumStrideCycleSpanRatio = qualityProfile.minimumStrideCycleSpanRatio;
  }
  if ((source.stickActionArmRangeDegrees ?? 0) < qualityProfile.minimumStickActionArmRangeDegrees) {
    qualityFailures.stickActionArmRangeDegrees = source.stickActionArmRangeDegrees ?? 0;
    qualityFailures.minimumStickActionArmRangeDegrees = qualityProfile.minimumStickActionArmRangeDegrees;
  }
  if (
    Number.isFinite(source.stickActionTwoHandBalanceRatio)
    && source.stickActionTwoHandBalanceRatio < qualityProfile.minimumStickActionTwoHandBalanceRatio
  ) {
    qualityFailures.stickActionTwoHandBalanceRatio = source.stickActionTwoHandBalanceRatio;
    qualityFailures.minimumStickActionTwoHandBalanceRatio = qualityProfile.minimumStickActionTwoHandBalanceRatio;
  }
  if (
    Number.isFinite(source.stickActionTwoHandSyncRatio)
    && source.stickActionTwoHandSyncRatio < qualityProfile.minimumStickActionTwoHandSyncRatio
  ) {
    qualityFailures.stickActionTwoHandSyncRatio = source.stickActionTwoHandSyncRatio;
    qualityFailures.minimumStickActionTwoHandSyncRatio = qualityProfile.minimumStickActionTwoHandSyncRatio;
  }
  if (
    Number.isFinite(source.stickActionTwoHandContactRatio)
    && source.stickActionTwoHandContactRatio < qualityProfile.minimumStickActionTwoHandContactRatio
  ) {
    qualityFailures.stickActionTwoHandContactRatio = source.stickActionTwoHandContactRatio;
    qualityFailures.minimumStickActionTwoHandContactRatio = qualityProfile.minimumStickActionTwoHandContactRatio;
  }
  if ((source.stickActionPhaseChanges ?? 0) < qualityProfile.minimumStickActionPhaseChanges) {
    qualityFailures.stickActionPhaseChanges = source.stickActionPhaseChanges ?? 0;
    qualityFailures.minimumStickActionPhaseChanges = qualityProfile.minimumStickActionPhaseChanges;
  }
  if (
    Number.isFinite(source.stickActionBeatSpanRatio)
    && source.stickActionBeatSpanRatio < qualityProfile.minimumStickActionBeatSpanRatio
  ) {
    qualityFailures.stickActionBeatSpanRatio = source.stickActionBeatSpanRatio;
    qualityFailures.minimumStickActionBeatSpanRatio = qualityProfile.minimumStickActionBeatSpanRatio;
  }
  const stickActionReleasePeakRatio = source.stickActionReleasePeakRatio
    ?? qualityProfile.minimumStickActionReleasePeakRatio;
  if (
    Number.isFinite(stickActionReleasePeakRatio)
    && stickActionReleasePeakRatio < qualityProfile.minimumStickActionReleasePeakRatio
  ) {
    qualityFailures.stickActionReleasePeakRatio = stickActionReleasePeakRatio;
    qualityFailures.minimumStickActionReleasePeakRatio = qualityProfile.minimumStickActionReleasePeakRatio;
  }
  if (
    Number.isFinite(stickActionReleasePeakRatio)
    && stickActionReleasePeakRatio > qualityProfile.maximumStickActionReleasePeakRatio
  ) {
    qualityFailures.stickActionReleasePeakRatio = stickActionReleasePeakRatio;
    qualityFailures.maximumStickActionReleasePeakRatio = qualityProfile.maximumStickActionReleasePeakRatio;
  }
  const stickActionSupportedReleaseRatio = source.stickActionSupportedReleaseRatio
    ?? qualityProfile.minimumStickActionSupportedReleaseRatio;
  if (
    Number.isFinite(stickActionSupportedReleaseRatio)
    && stickActionSupportedReleaseRatio < qualityProfile.minimumStickActionSupportedReleaseRatio
  ) {
    qualityFailures.stickActionSupportedReleaseRatio = stickActionSupportedReleaseRatio;
    qualityFailures.minimumStickActionSupportedReleaseRatio = qualityProfile.minimumStickActionSupportedReleaseRatio;
  }
  if (
    Number.isFinite(source.stickActionTorsoRangeDegrees)
    && source.stickActionTorsoRangeDegrees < qualityProfile.minimumStickActionTorsoRangeDegrees
  ) {
    qualityFailures.stickActionTorsoRangeDegrees = source.stickActionTorsoRangeDegrees;
    qualityFailures.minimumStickActionTorsoRangeDegrees = qualityProfile.minimumStickActionTorsoRangeDegrees;
  }
  if (
    Number.isFinite(source.hipShoulderSeparationDegrees)
    && source.hipShoulderSeparationDegrees < qualityProfile.minimumHipShoulderSeparationDegrees
  ) {
    qualityFailures.hipShoulderSeparationDegrees = source.hipShoulderSeparationDegrees;
    qualityFailures.minimumHipShoulderSeparationDegrees = qualityProfile.minimumHipShoulderSeparationDegrees;
  }
  const stickActionLowerBodyLeadFrames = source.stickActionLowerBodyLeadFrames
    ?? qualityProfile.minimumStickActionLowerBodyLeadFrames;
  if (stickActionLowerBodyLeadFrames < qualityProfile.minimumStickActionLowerBodyLeadFrames) {
    qualityFailures.stickActionLowerBodyLeadFrames = stickActionLowerBodyLeadFrames;
    qualityFailures.minimumStickActionLowerBodyLeadFrames = qualityProfile.minimumStickActionLowerBodyLeadFrames;
  }
  if (
    Number.isFinite(source.stickActionRecoveryRatio)
    && source.stickActionRecoveryRatio < qualityProfile.minimumStickActionRecoveryRatio
  ) {
    qualityFailures.stickActionRecoveryRatio = source.stickActionRecoveryRatio;
    qualityFailures.minimumStickActionRecoveryRatio = qualityProfile.minimumStickActionRecoveryRatio;
  }
  const athleticTorsoLeanDegrees = source.athleticTorsoLeanDegrees
    ?? qualityProfile.minimumAthleticTorsoLeanDegrees;
  if (athleticTorsoLeanDegrees < qualityProfile.minimumAthleticTorsoLeanDegrees) {
    qualityFailures.athleticTorsoLeanDegrees = athleticTorsoLeanDegrees;
    qualityFailures.minimumAthleticTorsoLeanDegrees = qualityProfile.minimumAthleticTorsoLeanDegrees;
  }
  if ((source.locomotionLoopClosureErrorDegrees ?? 0) > qualityProfile.maximumLoopClosureErrorDegrees) {
    qualityFailures.locomotionLoopClosureErrorDegrees = source.locomotionLoopClosureErrorDegrees ?? 0;
    qualityFailures.maximumLoopClosureErrorDegrees = qualityProfile.maximumLoopClosureErrorDegrees;
  }
  if ((source.rootVerticalLoopOffsetUnits ?? 0) > qualityProfile.maximumLoopVerticalOffsetUnits) {
    qualityFailures.rootVerticalLoopOffsetUnits = source.rootVerticalLoopOffsetUnits ?? 0;
    qualityFailures.maximumLoopVerticalOffsetUnits = qualityProfile.maximumLoopVerticalOffsetUnits;
  }
  if (Object.keys(qualityFailures).length > 0) {
    return {
      relativePath: source.relativePath ?? source.fileName,
      reason: 'bvh-action-quality-floor',
      groups: source.groups ?? [],
      ...qualityFailures,
    };
  }

  return null;
}

function qualityProfileForSource(source) {
  const groups = source.groups?.length ? source.groups : classifyMotionSource(source.fileName);
  return groups
    .map((group) => ACTION_QUALITY_PROFILES[group])
    .filter(Boolean)
    .reduce(
      (combined, profile) => ({
        minimumFrameCount: Math.max(combined.minimumFrameCount, profile.minimumFrameCount),
        minimumDurationSeconds: Math.max(combined.minimumDurationSeconds, profile.minimumDurationSeconds),
        maximumFrameRotationDeltaDegrees: Math.min(
          combined.maximumFrameRotationDeltaDegrees,
          profile.maximumFrameRotationDeltaDegrees,
        ),
        maximumFrameRotationAccelerationDegrees: Math.min(
          combined.maximumFrameRotationAccelerationDegrees,
          profile.maximumFrameRotationAccelerationDegrees,
        ),
        minimumRootTravelUnits: Math.max(combined.minimumRootTravelUnits, profile.minimumRootTravelUnits),
        minimumRootForwardTravelUnits: Math.max(
          combined.minimumRootForwardTravelUnits,
          profile.minimumRootForwardTravelUnits,
        ),
        minimumRootForwardSpeedChangeUnits: Math.max(
          combined.minimumRootForwardSpeedChangeUnits,
          profile.minimumRootForwardSpeedChangeUnits,
        ),
        minimumRootLateralShiftUnits: Math.max(
          combined.minimumRootLateralShiftUnits,
          profile.minimumRootLateralShiftUnits,
        ),
        minimumRootVerticalBounceUnits: Math.max(
          combined.minimumRootVerticalBounceUnits,
          profile.minimumRootVerticalBounceUnits,
        ),
        minimumReadyStanceLegLoadDegrees: Math.max(
          combined.minimumReadyStanceLegLoadDegrees,
          profile.minimumReadyStanceLegLoadDegrees,
        ),
        minimumLegDriveRangeDegrees: Math.max(
          combined.minimumLegDriveRangeDegrees,
          profile.minimumLegDriveRangeDegrees,
        ),
        minimumLocomotionStrideBalanceRatio: Math.max(
          combined.minimumLocomotionStrideBalanceRatio,
          profile.minimumLocomotionStrideBalanceRatio,
        ),
        minimumAlternatingLegSeparationDegrees: Math.max(
          combined.minimumAlternatingLegSeparationDegrees,
          profile.minimumAlternatingLegSeparationDegrees,
        ),
        minimumLocomotionArmSwingRangeDegrees: Math.max(
          combined.minimumLocomotionArmSwingRangeDegrees,
          profile.minimumLocomotionArmSwingRangeDegrees,
        ),
        minimumLocomotionContralateralSyncRatio: Math.max(
          combined.minimumLocomotionContralateralSyncRatio,
          profile.minimumLocomotionContralateralSyncRatio,
        ),
        minimumLocomotionFootPlantDriveRatio: Math.max(
          combined.minimumLocomotionFootPlantDriveRatio,
          profile.minimumLocomotionFootPlantDriveRatio,
        ),
        minimumFootPlantContactFrames: Math.max(
          combined.minimumFootPlantContactFrames,
          profile.minimumFootPlantContactFrames,
        ),
        minimumFootPlantSideCount: Math.max(
          combined.minimumFootPlantSideCount,
          profile.minimumFootPlantSideCount,
        ),
        minimumFootPlantBalanceRatio: Math.max(
          combined.minimumFootPlantBalanceRatio,
          profile.minimumFootPlantBalanceRatio,
        ),
        minimumFootPlantHoldFramesPerSide: Math.max(
          combined.minimumFootPlantHoldFramesPerSide,
          profile.minimumFootPlantHoldFramesPerSide,
        ),
        maximumFootPlantRootDriftUnits: Math.min(
          combined.maximumFootPlantRootDriftUnits,
          profile.maximumFootPlantRootDriftUnits,
        ),
        minimumTotalRotationRangeDegrees: Math.max(
          combined.minimumTotalRotationRangeDegrees,
          profile.minimumTotalRotationRangeDegrees,
        ),
        minimumStridePhaseChanges: Math.max(combined.minimumStridePhaseChanges, profile.minimumStridePhaseChanges),
        minimumStrideCycleSpanRatio: Math.max(
          combined.minimumStrideCycleSpanRatio,
          profile.minimumStrideCycleSpanRatio,
        ),
        minimumStickActionArmRangeDegrees: Math.max(
          combined.minimumStickActionArmRangeDegrees,
          profile.minimumStickActionArmRangeDegrees,
        ),
        minimumStickActionTwoHandBalanceRatio: Math.max(
          combined.minimumStickActionTwoHandBalanceRatio,
          profile.minimumStickActionTwoHandBalanceRatio,
        ),
        minimumStickActionTwoHandSyncRatio: Math.max(
          combined.minimumStickActionTwoHandSyncRatio,
          profile.minimumStickActionTwoHandSyncRatio,
        ),
        minimumStickActionTwoHandContactRatio: Math.max(
          combined.minimumStickActionTwoHandContactRatio,
          profile.minimumStickActionTwoHandContactRatio,
        ),
        minimumStickActionPhaseChanges: Math.max(
          combined.minimumStickActionPhaseChanges,
          profile.minimumStickActionPhaseChanges,
        ),
        minimumStickActionBeatSpanRatio: Math.max(
          combined.minimumStickActionBeatSpanRatio,
          profile.minimumStickActionBeatSpanRatio,
        ),
        minimumStickActionReleasePeakRatio: Math.max(
          combined.minimumStickActionReleasePeakRatio,
          profile.minimumStickActionReleasePeakRatio,
        ),
        maximumStickActionReleasePeakRatio: Math.min(
          combined.maximumStickActionReleasePeakRatio,
          profile.maximumStickActionReleasePeakRatio,
        ),
        minimumStickActionSupportedReleaseRatio: Math.max(
          combined.minimumStickActionSupportedReleaseRatio,
          profile.minimumStickActionSupportedReleaseRatio,
        ),
        minimumStickActionTorsoRangeDegrees: Math.max(
          combined.minimumStickActionTorsoRangeDegrees,
          profile.minimumStickActionTorsoRangeDegrees,
        ),
        minimumHipShoulderSeparationDegrees: Math.max(
          combined.minimumHipShoulderSeparationDegrees,
          profile.minimumHipShoulderSeparationDegrees,
        ),
        minimumStickActionLowerBodyLeadFrames: Math.max(
          combined.minimumStickActionLowerBodyLeadFrames,
          profile.minimumStickActionLowerBodyLeadFrames,
        ),
        minimumStickActionRecoveryRatio: Math.max(
          combined.minimumStickActionRecoveryRatio,
          profile.minimumStickActionRecoveryRatio,
        ),
        minimumAthleticTorsoLeanDegrees: Math.max(
          combined.minimumAthleticTorsoLeanDegrees,
          profile.minimumAthleticTorsoLeanDegrees,
        ),
        maximumLoopClosureErrorDegrees: Math.min(
          combined.maximumLoopClosureErrorDegrees,
          profile.maximumLoopClosureErrorDegrees,
        ),
        maximumLoopVerticalOffsetUnits: Math.min(
          combined.maximumLoopVerticalOffsetUnits,
          profile.maximumLoopVerticalOffsetUnits,
        ),
      }),
      {
        minimumFrameCount: MIN_ACTION_CLIP_BVH_FRAMES,
        minimumDurationSeconds: MIN_ACTION_CLIP_BVH_DURATION_SECONDS,
        maximumFrameRotationDeltaDegrees: 999,
        maximumFrameRotationAccelerationDegrees: 999,
        minimumRootTravelUnits: 0,
        minimumRootForwardTravelUnits: 0,
        minimumRootForwardSpeedChangeUnits: 0,
        minimumRootLateralShiftUnits: 0,
        minimumRootVerticalBounceUnits: 0,
        minimumReadyStanceLegLoadDegrees: 0,
        minimumLegDriveRangeDegrees: 0,
        minimumLocomotionStrideBalanceRatio: 0,
        minimumAlternatingLegSeparationDegrees: 0,
        minimumLocomotionArmSwingRangeDegrees: 0,
        minimumLocomotionContralateralSyncRatio: 0,
        minimumLocomotionFootPlantDriveRatio: 0,
        minimumFootPlantContactFrames: 0,
        minimumFootPlantSideCount: 0,
        minimumFootPlantBalanceRatio: 0,
        minimumFootPlantHoldFramesPerSide: 0,
        maximumFootPlantRootDriftUnits: 999,
        minimumTotalRotationRangeDegrees: 0,
        minimumStridePhaseChanges: 0,
        minimumStrideCycleSpanRatio: 0,
        minimumStickActionArmRangeDegrees: 0,
        minimumStickActionTwoHandBalanceRatio: 0,
        minimumStickActionTwoHandSyncRatio: 0,
        minimumStickActionTwoHandContactRatio: 0,
        minimumStickActionPhaseChanges: 0,
        minimumStickActionBeatSpanRatio: 0,
        minimumStickActionReleasePeakRatio: 0,
        maximumStickActionReleasePeakRatio: 1,
        minimumStickActionSupportedReleaseRatio: 0,
        minimumStickActionTorsoRangeDegrees: 0,
        minimumHipShoulderSeparationDegrees: 0,
        minimumStickActionLowerBodyLeadFrames: 0,
        minimumStickActionRecoveryRatio: 0,
        minimumAthleticTorsoLeanDegrees: 0,
        maximumLoopClosureErrorDegrees: 999,
        maximumLoopVerticalOffsetUnits: 999,
      },
    );
}

function listMotionSourceFiles(sourceDir) {
  const files = [];

  function walk(dir) {
    let entries = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || !SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        continue;
      }
      const stats = statSync(fullPath);
      const sourceRightsPath = findSourceRightsEvidence(fullPath);
      const sourceRightsMetadata = readSourceRightsMetadata(sourceRightsPath);
      files.push({
        fileName: entry.name,
        filePath: fullPath,
        relativePath: relative(sourceDir, fullPath),
        bytes: stats.size,
        ...inspectMotionSourceFile(fullPath),
        ...sourceRightsMetadata,
        sourceRightsPath: sourceRightsPath
          ? relative(sourceDir, sourceRightsPath)
          : null,
      });
    }
  }

  walk(sourceDir);
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function summarizeSourceQuality(sourceSummaries) {
  const unsupportedSourceQuality = sourceSummaries
    .filter((source) => source.sourceQuality && !isAcceptedRunnerSourceQuality(source.sourceQuality))
    .map((source) => ({
      relativePath: source.relativePath ?? source.fileName,
      sourceQuality: source.sourceQuality,
    }));
  const finalGradeProvenanceFailures = sourceSummaries
    .filter((source) => source.sourceQuality && isFinalGradeRunnerSourceQuality(source.sourceQuality))
    .map((source) => {
      const missingFields = missingFinalGradeRunnerProvenanceFields(source);
      return missingFields.length > 0
        ? {
          relativePath: source.relativePath ?? source.fileName,
          groups: source.groups ?? [],
          sourceQuality: source.sourceQuality,
          missingFields,
        }
        : null;
    })
    .filter(Boolean);
  const finalGradeCaptureMethodFailures = sourceSummaries
    .filter((source) => source.sourceQuality && isFinalGradeRunnerSourceQuality(source.sourceQuality))
    .map((source) => {
      const invalidCaptureMethod = invalidFinalGradeRunnerCaptureMethod(source);
      return invalidCaptureMethod
        ? {
          relativePath: source.relativePath ?? source.fileName,
          groups: source.groups ?? [],
          sourceQuality: source.sourceQuality,
          captureMethod: invalidCaptureMethod.captureMethod,
          allowedMethods: invalidCaptureMethod.allowedMethods,
        }
        : null;
    })
    .filter(Boolean);
  const finalGradeUsageRightsFailures = sourceSummaries
    .filter((source) => source.sourceQuality && isFinalGradeRunnerSourceQuality(source.sourceQuality))
    .map((source) => {
      const invalidUsageRights = invalidFinalGradeRunnerUsageRights(source);
      return invalidUsageRights
        ? {
          relativePath: source.relativePath ?? source.fileName,
          groups: source.groups ?? [],
          sourceQuality: source.sourceQuality,
          usageRights: invalidUsageRights.usageRights,
          missingTerms: invalidUsageRights.missingTerms,
        }
        : null;
    })
    .filter(Boolean);
  const finalGradeGroups = REQUIRED_MOTION_GROUPS
    .map((group) => group.key)
    .filter((key) => sourceSummaries.some((source) => (
      source.groups.includes(key)
      && source.sourceQuality
      && isFinalGradeRunnerSourceQuality(source.sourceQuality)
      && missingFinalGradeRunnerProvenanceFields(source).length === 0
      && !invalidFinalGradeRunnerCaptureMethod(source)
      && !invalidFinalGradeRunnerUsageRights(source)
    )));
  const missingFinalGradeGroups = REQUIRED_MOTION_GROUPS
    .map((group) => group.key)
    .filter((key) => !finalGradeGroups.includes(key));

  return {
    motionQualityStatus: unsupportedSourceQuality.length > 0
      ? 'unsupported-source-quality'
      : finalGradeProvenanceFailures.length > 0
        ? 'missing-final-grade-provenance'
        : finalGradeCaptureMethodFailures.length > 0
          ? 'invalid-final-grade-capture-method'
          : finalGradeUsageRightsFailures.length > 0
            ? 'invalid-final-grade-usage-rights'
            : missingFinalGradeGroups.length === 0
              ? 'final-grade-motion'
              : finalGradeGroups.length > 0
                ? 'partial-final-grade-motion'
                : 'source-driven-seed',
    finalGradeGroups,
    missingFinalGradeGroups,
    unsupportedSourceQuality,
    finalGradeProvenanceFailures,
    finalGradeCaptureMethodFailures,
    finalGradeUsageRightsFailures,
  };
}

export function summarizeMotionSources(sources) {
  const sourceSummaries = sources.map((source) => ({
    ...source,
    relativePath: source.relativePath ?? source.fileName,
    sourceRightsPath: source.sourceRightsPath ?? null,
    groups: classifyMotionSource(source.fileName),
  }));
  const coveredGroups = REQUIRED_MOTION_GROUPS
    .map((group) => group.key)
    .filter((key) => sourceSummaries.some((source) => source.groups.includes(key)));
  const missingGroups = REQUIRED_MOTION_GROUPS
    .map((group) => group.key)
    .filter((key) => !coveredGroups.includes(key));
  const missingSourceRights = sourceSummaries
    .filter((source) => !source.sourceRightsPath)
    .map((source) => source.relativePath ?? source.fileName);
  const invalidMotionSources = sourceSummaries
    .map(validateMotionData)
    .filter(Boolean);
  const sourceQualitySummary = summarizeSourceQuality(sourceSummaries);

  return {
    status: missingGroups.length === 0
      && missingSourceRights.length === 0
      && invalidMotionSources.length === 0
      && sourceQualitySummary.unsupportedSourceQuality.length === 0
      && sourceQualitySummary.finalGradeProvenanceFailures.length === 0
      && sourceQualitySummary.finalGradeCaptureMethodFailures.length === 0
      && sourceQualitySummary.finalGradeUsageRightsFailures.length === 0
      ? 'ready-for-retarget'
      : 'blocked',
    sourceDir: MOTION_SOURCE_DIR,
    totalCount: sourceSummaries.length,
    coveredGroups,
    missingGroups,
    missingSourceRights,
    invalidMotionSources,
    ...sourceQualitySummary,
    sources: sourceSummaries,
    nextAction: (() => {
      if (missingGroups.length > 0) {
        return `Add licensed or internally authored motion files for ${missingGroups.join(', ')} under asset-inbox/players/motion-sources.`;
      }
      if (missingSourceRights.length > 0) {
        return `Add source-rights notes next to ${missingSourceRights.join(', ')} before retargeting.`;
      }
      if (invalidMotionSources.length > 0) {
        return `Replace or expand ${invalidMotionSources.map((source) => source.relativePath).join(', ')} with retargetable motion data before Blender retargeting.`;
      }
      if (sourceQualitySummary.unsupportedSourceQuality.length > 0) {
        return `Replace unsupported source-quality labels on ${sourceQualitySummary.unsupportedSourceQuality.map((source) => source.relativePath).join(', ')}.`;
      }
      if (sourceQualitySummary.finalGradeProvenanceFailures.length > 0) {
        return `Add final-grade source provider, capture method, and usage-rights metadata for ${sourceQualitySummary.finalGradeProvenanceFailures.map((source) => source.relativePath).join(', ')}.`;
      }
      if (sourceQualitySummary.finalGradeCaptureMethodFailures.length > 0) {
        return `Replace unsupported final-grade capture methods on ${sourceQualitySummary.finalGradeCaptureMethodFailures.map((source) => source.relativePath).join(', ')}.`;
      }
      if (sourceQualitySummary.finalGradeUsageRightsFailures.length > 0) {
        return `Complete final-grade usage-rights metadata for ${sourceQualitySummary.finalGradeUsageRightsFailures.map((source) => source.relativePath).join(', ')}.`;
      }
      if (sourceQualitySummary.missingFinalGradeGroups.length > 0) {
        return `Run Blender retargeting from current seed sources, or add final-grade motion for ${sourceQualitySummary.missingFinalGradeGroups.join(', ')} before closing this requirement.`;
      }
      return 'Run Blender retargeting from asset-inbox/players/motion-sources into the production runner clips.';
    })(),
  };
}

function formatMarkdown(report) {
  const lines = [
    '# Player Motion Source Audit',
    '',
    `Status: ${report.status}`,
    `Source directory: ${report.sourceDir}`,
    `Total source files: ${report.totalCount}`,
    '',
    '## Coverage',
    '',
    `Covered: ${report.coveredGroups.join(', ') || 'none'}`,
    `Missing: ${report.missingGroups.join(', ') || 'none'}`,
    `Missing source-rights notes: ${report.missingSourceRights.join(', ') || 'none'}`,
    `Invalid motion data: ${report.invalidMotionSources.map((source) => `${source.relativePath} (${source.reason})`).join(', ') || 'none'}`,
    `Motion quality status: ${report.motionQualityStatus}`,
    `Final-grade coverage: ${report.finalGradeGroups.join(', ') || 'none'}`,
    `Missing final-grade groups: ${report.missingFinalGradeGroups.join(', ') || 'none'}`,
    `Unsupported source-quality labels: ${report.unsupportedSourceQuality.map((source) => `${source.relativePath} (${source.sourceQuality})`).join(', ') || 'none'}`,
    `Final-grade provenance failures: ${report.finalGradeProvenanceFailures.map((source) => `${source.relativePath} (${source.missingFields.join(', ')})`).join(', ') || 'none'}`,
    `Final-grade capture-method failures: ${report.finalGradeCaptureMethodFailures.map((source) => `${source.relativePath} (${source.captureMethod}; expected ${source.allowedMethods.join('/')})`).join(', ') || 'none'}`,
    '',
    '## Sources',
    '',
  ];

  if (report.sources.length === 0) {
    lines.push('- none');
  } else {
    for (const source of report.sources) {
      const motionDetail = source.format === 'bvh'
        ? `; frames: ${source.frameCount}; duration: ${source.durationSeconds}s; max frame rotation delta: ${source.maxFrameRotationDeltaDegrees ?? 'n/a'}deg; max frame rotation acceleration: ${source.maxFrameRotationAccelerationDegrees ?? 'n/a'}deg; root travel: ${source.rootTravelUnits ?? 'n/a'}; forward root travel: ${source.rootForwardTravelUnits ?? 'n/a'}; forward speed change: ${source.rootForwardSpeedChangeUnits ?? 'n/a'}; lateral root shift: ${source.rootLateralShiftUnits ?? 'n/a'}; vertical root bounce: ${source.rootVerticalBounceUnits ?? 'n/a'}; ready stance leg load: ${source.readyStanceLegLoadDegrees ?? 'n/a'}deg; leg drive range: ${source.legDriveRangeDegrees ?? 'n/a'}deg; stride balance: ${source.locomotionStrideBalanceRatio ?? 'n/a'}; planted forward drive: ${source.locomotionFootPlantDriveRatio ?? 'n/a'}; alternating leg separation: ${source.alternatingLegSeparationDegrees ?? 'n/a'}deg; locomotion arm swing: ${source.locomotionArmSwingRangeDegrees ?? 'n/a'}deg; locomotion contralateral sync: ${source.locomotionContralateralSyncRatio ?? 'n/a'}; foot-plant contact frames: ${source.footPlantContactFrameCount ?? 'n/a'}; foot-plant side count: ${source.footPlantSideCount ?? 'n/a'}; foot-plant balance ratio: ${source.footPlantBalanceRatio ?? 'n/a'}; foot-plant min side hold frames: ${source.footPlantMinSideHoldFrames ?? 'n/a'}; max foot-plant root drift: ${source.maxFootPlantRootDriftUnits ?? 'n/a'}; total rotation range: ${source.totalRotationRangeDegrees ?? 'n/a'}deg; stick-action arm range: ${source.stickActionArmRangeDegrees ?? 'n/a'}deg; stick-action two-hand balance: ${source.stickActionTwoHandBalanceRatio ?? 'n/a'}; stick-action two-hand sync: ${source.stickActionTwoHandSyncRatio ?? 'n/a'}; stick-action two-hand contact window: ${source.stickActionTwoHandContactRatio ?? 'n/a'}; stick-action phase changes: ${source.stickActionPhaseChanges ?? 'n/a'}; stick-action beat span: ${source.stickActionBeatSpanRatio ?? 'n/a'}; stick-action release peak: ${source.stickActionReleasePeakRatio ?? 'n/a'}; supported release/catch window: ${source.stickActionSupportedReleaseRatio ?? 'n/a'}; stick-action torso range: ${source.stickActionTorsoRangeDegrees ?? 'n/a'}deg; hip-shoulder separation: ${source.hipShoulderSeparationDegrees ?? 'n/a'}deg; lower-body lead frames: ${source.stickActionLowerBodyLeadFrames ?? 'n/a'}; stick-action recovery ratio: ${source.stickActionRecoveryRatio ?? 'n/a'}; athletic torso lean: ${source.athleticTorsoLeanDegrees ?? 'n/a'}deg; max rotation range: ${source.maxRotationRangeDegrees ?? 'n/a'}deg; active rotation channels: ${source.activeRotationChannelCount ?? 'n/a'}; stride phase changes: ${source.stridePhaseChanges ?? 'n/a'}; stride cycle span: ${source.strideCycleSpanRatio ?? 'n/a'}; loop seam error: ${source.locomotionLoopClosureErrorDegrees ?? 'n/a'}deg; vertical seam offset: ${source.rootVerticalLoopOffsetUnits ?? 'n/a'}`
        : '';
      const qualityDetail = `; source quality: ${source.sourceQuality || 'unclassified'}; provider: ${source.sourceProvider || 'missing'}; capture method: ${source.captureMethod || 'missing'}; usage rights: ${source.usageRights || 'missing'}`;
      lines.push(`- ${source.relativePath ?? source.fileName}: ${source.groups.join(', ') || 'unclassified'}; source rights: ${source.sourceRightsPath || 'missing'}${qualityDetail}${motionDetail}`);
    }
  }

  lines.push('', '## Next Action', '', report.nextAction, '');
  return lines.join('\n');
}

export function auditMotionSourceDirectory(sourceDir = MOTION_SOURCE_DIR) {
  return summarizeMotionSources(listMotionSourceFiles(sourceDir));
}

function main() {
  const sourceDir = process.argv[2] ?? MOTION_SOURCE_DIR;
  const report = auditMotionSourceDirectory(sourceDir);
  writeFileSync(MOTION_REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(MOTION_REPORT_MD, formatMarkdown(report));
  console.log(`Motion source audit: ${report.status}`);
  console.log(`Report: ${MOTION_REPORT_JSON}`);
  if (report.missingGroups.length > 0) {
    console.log(`Missing: ${report.missingGroups.join(', ')}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
