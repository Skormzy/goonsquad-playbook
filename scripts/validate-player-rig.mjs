import { NodeIO } from '@gltf-transform/core';
import { EXTTextureWebP, KHRMeshQuantization } from '@gltf-transform/extensions';
import { readFileSync } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyRunnerMotionQuality,
  invalidFinalGradeRunnerCaptureMethod,
  invalidFinalGradeRunnerUsageRights,
  isAcceptedRunnerSourceQuality,
  isFinalGradeRunnerSourceQuality,
} from './player-motion-quality-policy.mjs';
import {
  getRigProfileForKey,
  missingNamedPartGroups,
  missingSideBalancedPartGroups,
} from '../src/replay3d/assets/playerRigAcceptance.js';
import { PLAYER_RIG_ASSETS } from '../src/replay3d/assets/playerRigManifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const strictProduction = process.argv.includes('--strict-production');
const runnersOnly = process.argv.includes('--runners-only');
const requireFinalGradeMotion = process.argv.includes('--require-final-grade-motion') || strictProduction;
const io = new NodeIO().registerExtensions([EXTTextureWebP, KHRMeshQuantization]);
const requiredRuntimeClips = ['Idle', 'Walk', 'Run'];
const requiredNormalMotionClips = ['idle-ready', 'jog-forward', 'sprint-forward'];
const retargetReportPath = path.join(root, 'asset-inbox', 'players', 'generated', 'blender-normalize-report.json');
const requiredRetargetMetricKeys = [
  'maxRotationRangeDegrees',
  'activeRotationChannelCount',
  'maxFrameRotationDeltaDegrees',
  'maxFrameRotationAccelerationDegrees',
  'rootTravelUnits',
  'rootForwardTravelUnits',
  'rootForwardSpeedChangeUnits',
  'rootLateralShiftUnits',
  'rootVerticalBounceUnits',
  'readyStanceLegLoadDegrees',
  'legDriveRangeDegrees',
  'locomotionStrideBalanceRatio',
  'locomotionFootPlantDriveRatio',
  'alternatingLegSeparationDegrees',
  'locomotionArmSwingRangeDegrees',
  'locomotionContralateralSyncRatio',
  'footPlantContactFrameCount',
  'footPlantSideCount',
  'footPlantBalanceRatio',
  'footPlantMinSideHoldFrames',
  'maxFootPlantRootDriftUnits',
  'totalRotationRangeDegrees',
  'stridePhaseChanges',
  'strideCycleSpanRatio',
  'stickActionArmRangeDegrees',
  'stickActionTwoHandBalanceRatio',
  'stickActionTwoHandSyncRatio',
  'stickActionTwoHandContactRatio',
  'stickActionPhaseChanges',
  'stickActionBeatSpanRatio',
  'stickActionReleasePeakRatio',
  'stickActionSupportedReleaseRatio',
  'stickActionTorsoRangeDegrees',
  'hipShoulderSeparationDegrees',
  'stickActionLowerBodyLeadFrames',
  'stickActionRecoveryRatio',
  'athleticTorsoLeanDegrees',
  'locomotionLoopClosureErrorDegrees',
  'rootVerticalLoopOffsetUnits',
];
const retargetMetricMinimumKeys = {
  maxRotationRangeDegrees: 'minimumMaxRotationRangeDegrees',
  activeRotationChannelCount: 'minimumActiveRotationChannelCount',
  rootTravelUnits: 'minimumRootTravelUnits',
  rootForwardTravelUnits: 'minimumRootForwardTravelUnits',
  rootForwardSpeedChangeUnits: 'minimumRootForwardSpeedChangeUnits',
  rootLateralShiftUnits: 'minimumRootLateralShiftUnits',
  rootVerticalBounceUnits: 'minimumRootVerticalBounceUnits',
  readyStanceLegLoadDegrees: 'minimumReadyStanceLegLoadDegrees',
  legDriveRangeDegrees: 'minimumLegDriveRangeDegrees',
  locomotionStrideBalanceRatio: 'minimumLocomotionStrideBalanceRatio',
  locomotionFootPlantDriveRatio: 'minimumLocomotionFootPlantDriveRatio',
  alternatingLegSeparationDegrees: 'minimumAlternatingLegSeparationDegrees',
  locomotionArmSwingRangeDegrees: 'minimumLocomotionArmSwingRangeDegrees',
  locomotionContralateralSyncRatio: 'minimumLocomotionContralateralSyncRatio',
  footPlantContactFrameCount: 'minimumFootPlantContactFrames',
  footPlantSideCount: 'minimumFootPlantSideCount',
  footPlantBalanceRatio: 'minimumFootPlantBalanceRatio',
  footPlantMinSideHoldFrames: 'minimumFootPlantHoldFramesPerSide',
  totalRotationRangeDegrees: 'minimumTotalRotationRangeDegrees',
  stridePhaseChanges: 'minimumStridePhaseChanges',
  strideCycleSpanRatio: 'minimumStrideCycleSpanRatio',
  stickActionArmRangeDegrees: 'minimumStickActionArmRangeDegrees',
  stickActionTwoHandBalanceRatio: 'minimumStickActionTwoHandBalanceRatio',
  stickActionTwoHandSyncRatio: 'minimumStickActionTwoHandSyncRatio',
  stickActionTwoHandContactRatio: 'minimumStickActionTwoHandContactRatio',
  stickActionPhaseChanges: 'minimumStickActionPhaseChanges',
  stickActionBeatSpanRatio: 'minimumStickActionBeatSpanRatio',
  stickActionReleasePeakRatio: 'minimumStickActionReleasePeakRatio',
  stickActionSupportedReleaseRatio: 'minimumStickActionSupportedReleaseRatio',
  stickActionTorsoRangeDegrees: 'minimumStickActionTorsoRangeDegrees',
  hipShoulderSeparationDegrees: 'minimumHipShoulderSeparationDegrees',
  stickActionLowerBodyLeadFrames: 'minimumStickActionLowerBodyLeadFrames',
  stickActionRecoveryRatio: 'minimumStickActionRecoveryRatio',
  athleticTorsoLeanDegrees: 'minimumAthleticTorsoLeanDegrees',
};
const retargetMetricMaximumKeys = {
  maxFrameRotationDeltaDegrees: 'maximumFrameRotationDeltaDegrees',
  maxFrameRotationAccelerationDegrees: 'maximumFrameRotationAccelerationDegrees',
  maxFootPlantRootDriftUnits: 'maximumFootPlantRootDriftUnits',
  stickActionReleasePeakRatio: 'maximumStickActionReleasePeakRatio',
  locomotionLoopClosureErrorDegrees: 'maximumLoopClosureErrorDegrees',
  rootVerticalLoopOffsetUnits: 'maximumLoopVerticalOffsetUnits',
};
const requiredRetargetedClipMetricKeys = [
  'retargetedRootVerticalBounceUnits',
  'retargetedReadyStanceLegLoadDegrees',
  'retargetedMaxFrameRotationDeltaDegrees',
  'retargetedMaxFrameRotationAccelerationDegrees',
  'retargetedStickHandRangeDegrees',
  'retargetedStickActionTwoHandBalanceRatio',
  'retargetedStickActionTwoHandSyncRatio',
  'retargetedStickActionTwoHandContactRatio',
  'retargetedStickActionTwoHandContactFrameCount',
  'retargetedStickActionLowerBodyLeadFrames',
  'retargetedStickActionRecoveryRatio',
  'retargetedStickActionPhaseChanges',
  'retargetedStickActionBeatSpanRatio',
  'retargetedStickActionReleasePeakRatio',
  'retargetedStickActionSupportedReleaseRatio',
  'retargetedStickActionUpperArmLiftDegrees',
  'retargetedStickActionUpperArmSwingDegrees',
  'retargetedStickActionUpperArmLateralDegrees',
  'retargetedStickActionUpperArmExposureDegrees',
  'retargetedStickActionForearmLiftDegrees',
  'retargetedStickActionHandLiftDegrees',
  'retargetedLegDriveRangeDegrees',
  'retargetedLocomotionStrideBalanceRatio',
  'retargetedLocomotionFootPlantDriveRatio',
  'retargetedFootPlantContactFrameCount',
  'retargetedFootPlantSideCount',
  'retargetedFootPlantBalanceRatio',
  'retargetedFootPlantMinSideHoldFrames',
  'retargetedFootPlantStabilityRatio',
  'retargetedFootPlantMaxSlideUnits',
  'retargetedFootPlantStrideCoverageRatio',
  'retargetedFootPlantGroundedRatio',
  'retargetedLocomotionArmSwingRangeDegrees',
  'retargetedLocomotionContralateralSyncRatio',
  'retargetedTorsoFollowThroughDegrees',
  'retargetedHipShoulderSeparationDegrees',
  'retargetedAthleticTorsoLeanDegrees',
  'retargetedLocomotionLoopClosureErrorDegrees',
  'retargetedRootVerticalLoopOffsetUnits',
];
const retargetedClipMetricMinimumKeys = {
  retargetedRootVerticalBounceUnits: 'minimumRetargetedRootVerticalBounceUnits',
  retargetedReadyStanceLegLoadDegrees: 'minimumRetargetedReadyStanceLegLoadDegrees',
  retargetedStickHandRangeDegrees: 'minimumRetargetedStickHandRangeDegrees',
  retargetedStickActionTwoHandBalanceRatio: 'minimumRetargetedStickActionTwoHandBalanceRatio',
  retargetedStickActionTwoHandSyncRatio: 'minimumRetargetedStickActionTwoHandSyncRatio',
  retargetedStickActionTwoHandContactRatio: 'minimumRetargetedStickActionTwoHandContactRatio',
  retargetedStickActionTwoHandContactFrameCount: 'minimumRetargetedStickActionTwoHandContactFrameCount',
  retargetedStickActionLowerBodyLeadFrames: 'minimumRetargetedStickActionLowerBodyLeadFrames',
  retargetedStickActionRecoveryRatio: 'minimumRetargetedStickActionRecoveryRatio',
  retargetedStickActionPhaseChanges: 'minimumRetargetedStickActionPhaseChanges',
  retargetedStickActionBeatSpanRatio: 'minimumRetargetedStickActionBeatSpanRatio',
  retargetedStickActionReleasePeakRatio: 'minimumRetargetedStickActionReleasePeakRatio',
  retargetedStickActionSupportedReleaseRatio: 'minimumRetargetedStickActionSupportedReleaseRatio',
  retargetedLegDriveRangeDegrees: 'minimumRetargetedLegDriveRangeDegrees',
  retargetedLocomotionStrideBalanceRatio: 'minimumRetargetedLocomotionStrideBalanceRatio',
  retargetedLocomotionFootPlantDriveRatio: 'minimumRetargetedLocomotionFootPlantDriveRatio',
  retargetedFootPlantContactFrameCount: 'minimumRetargetedFootPlantContactFrames',
  retargetedFootPlantSideCount: 'minimumRetargetedFootPlantSideCount',
  retargetedFootPlantBalanceRatio: 'minimumRetargetedFootPlantBalanceRatio',
  retargetedFootPlantMinSideHoldFrames: 'minimumRetargetedFootPlantHoldFramesPerSide',
  retargetedFootPlantStabilityRatio: 'minimumRetargetedFootPlantStabilityRatio',
  retargetedFootPlantStrideCoverageRatio: 'minimumRetargetedFootPlantStrideCoverageRatio',
  retargetedFootPlantGroundedRatio: 'minimumRetargetedFootPlantGroundedRatio',
  retargetedLocomotionArmSwingRangeDegrees: 'minimumRetargetedLocomotionArmSwingRangeDegrees',
  retargetedLocomotionContralateralSyncRatio: 'minimumRetargetedLocomotionContralateralSyncRatio',
  retargetedTorsoFollowThroughDegrees: 'minimumRetargetedTorsoFollowThroughDegrees',
  retargetedHipShoulderSeparationDegrees: 'minimumRetargetedHipShoulderSeparationDegrees',
  retargetedAthleticTorsoLeanDegrees: 'minimumRetargetedAthleticTorsoLeanDegrees',
};
const retargetedClipMetricMaximumKeys = {
  retargetedMaxFrameRotationDeltaDegrees: 'maximumRetargetedFrameRotationDeltaDegrees',
  retargetedMaxFrameRotationAccelerationDegrees: 'maximumRetargetedFrameRotationAccelerationDegrees',
  retargetedStickActionReleasePeakRatio: 'maximumRetargetedStickActionReleasePeakRatio',
  retargetedStickActionUpperArmLiftDegrees: 'maximumRetargetedStickActionUpperArmLiftDegrees',
  retargetedStickActionUpperArmSwingDegrees: 'maximumRetargetedStickActionUpperArmSwingDegrees',
  retargetedStickActionUpperArmLateralDegrees: 'maximumRetargetedStickActionUpperArmLateralDegrees',
  retargetedStickActionUpperArmExposureDegrees: 'maximumRetargetedStickActionUpperArmExposureDegrees',
  retargetedStickActionForearmLiftDegrees: 'maximumRetargetedStickActionForearmLiftDegrees',
  retargetedStickActionHandLiftDegrees: 'maximumRetargetedStickActionHandLiftDegrees',
  retargetedLocomotionLoopClosureErrorDegrees: 'maximumRetargetedLoopClosureErrorDegrees',
  retargetedRootVerticalLoopOffsetUnits: 'maximumRetargetedLoopVerticalOffsetUnits',
  retargetedFootPlantMaxSlideUnits: 'maximumRetargetedFootPlantMaxSlideUnits',
};

function toDiskPath(assetUrl) {
  return path.join(root, 'public', assetUrl.replace(/^\//, '').replaceAll('/', path.sep));
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function getSceneStats(doc) {
  const rootDoc = doc.getRoot();
  const animations = rootDoc.listAnimations().map((animation) => animation.getName()).filter(Boolean);
  const meshes = rootDoc.listMeshes();
  const nodes = rootDoc.listNodes().map((node) => node.getName()).filter(Boolean);
  const meshNames = meshes.map((mesh) => mesh.getName()).filter(Boolean);
  const materialNames = rootDoc.listMaterials().map((material) => material.getName()).filter(Boolean);
  const uploadedVertices = meshes.reduce((sum, mesh) => (
    sum + mesh.listPrimitives().reduce((innerSum, primitive) => {
      const position = primitive.getAttribute('POSITION');
      return innerSum + (position?.getCount() ?? 0);
    }, 0)
  ), 0);

  return {
    animations,
    dimensions: getSceneDimensions(meshes),
    namedParts: [...meshNames, ...nodes, ...materialNames],
    meshNames,
    nodes,
    uploadedVertices,
  };
}

function getSceneDimensions(meshes) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  for (const mesh of meshes) {
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION');
      const positionArray = position?.getArray();
      if (!positionArray) continue;

      for (let index = 0; index < positionArray.length; index += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
          const value = positionArray[index + axis];
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        }
      }
    }
  }

  if (!Number.isFinite(min[0])) return null;

  return {
    width: max[0] - min[0],
    height: max[1] - min[1],
    depth: max[2] - min[2],
  };
}

function hasAnyNode(stats, suffixes) {
  return suffixes.some((suffix) => stats.nodes.some((name) => (
    name === suffix
    || name.endsWith(suffix)
    || name.endsWith(`:${suffix}`)
    || name.endsWith(`_${suffix}`)
  )));
}

function assertAsset(condition, message, failures) {
  if (!condition) failures.push(message);
}

function loadRunnerRetargetReport() {
  try {
    const report = JSON.parse(readFileSync(retargetReportPath, 'utf8'));
    const targets = new Map();
    for (const target of report.targets ?? []) {
      if (target.profile === 'runner' && target.key) targets.set(target.key, target);
    }
    return { targets, readError: null };
  } catch (error) {
    return { targets: new Map(), readError: error.message };
  }
}

const runnerRetargetReport = strictProduction ? loadRunnerRetargetReport() : { targets: new Map(), readError: null };

function assertEmptyList(value, message, failures) {
  if (Array.isArray(value) && value.length > 0) {
    failures.push(`${message}: ${value.join(', ')}`);
  }
}

function assertRunnerRetargetReport(label, retargetKey, requiredClips, failures) {
  if (runnerRetargetReport.readError) {
    failures.push(`${label} is missing readable Blender retarget report: ${retargetReportPath}`);
    failures.push(`  report error: ${runnerRetargetReport.readError}`);
    return;
  }

  const target = runnerRetargetReport.targets.get(retargetKey);
  if (!target) {
    failures.push(`${label} is missing Blender retarget report target "${retargetKey}" in ${retargetReportPath}`);
    return;
  }

  assertAsset(target.status === 'normalized', `${label} retarget report is not normalized: ${target.status ?? 'unknown'}`, failures);
  assertEmptyList(target.missingMotionSources, `${label} retarget report has missing motion sources`, failures);
  assertEmptyList(target.invalidMotionSources, `${label} retarget report has invalid motion sources`, failures);
  assertEmptyList(target.missingClips, `${label} retarget report has missing clips`, failures);

  const posture = target.normalMotionPosture;
  assertAsset(posture?.status === 'passed', `${label} normalMotionPosture is not passed`, failures);
  if (
    Number.isFinite(posture?.maxUpperArmLiftDegrees)
    && Number.isFinite(posture?.maxAllowedUpperArmLiftDegrees)
    && Number.isFinite(posture?.maxUpperArmSwingDegrees)
    && Number.isFinite(posture?.maxAllowedUpperArmSwingDegrees)
    && Number.isFinite(posture?.maxUpperArmLateralDegrees)
    && Number.isFinite(posture?.maxAllowedUpperArmLateralDegrees)
    && Number.isFinite(posture?.maxUpperArmExposureDegrees)
    && Number.isFinite(posture?.maxAllowedUpperArmExposureDegrees)
    && Number.isFinite(posture?.maxForearmLiftDegrees)
    && Number.isFinite(posture?.maxAllowedForearmLiftDegrees)
    && Number.isFinite(posture?.maxHandLiftDegrees)
    && Number.isFinite(posture?.maxAllowedHandLiftDegrees)
    && Number.isFinite(posture?.minUpperArmDropDegrees)
    && Number.isFinite(posture?.minRequiredUpperArmDropDegrees)
  ) {
    assertAsset(
      posture.maxUpperArmLiftDegrees <= posture.maxAllowedUpperArmLiftDegrees,
      `${label} normal runner upper-arm lift exceeds guardrail: ${posture.maxUpperArmLiftDegrees} > ${posture.maxAllowedUpperArmLiftDegrees}`,
      failures,
    );
    assertAsset(
      posture.maxUpperArmSwingDegrees <= posture.maxAllowedUpperArmSwingDegrees,
      `${label} normal runner upper-arm swing exceeds guardrail: ${posture.maxUpperArmSwingDegrees} > ${posture.maxAllowedUpperArmSwingDegrees}`,
      failures,
    );
    assertAsset(
      posture.maxUpperArmLateralDegrees <= posture.maxAllowedUpperArmLateralDegrees,
      `${label} normal runner upper-arm lateral exceeds guardrail: ${posture.maxUpperArmLateralDegrees} > ${posture.maxAllowedUpperArmLateralDegrees}`,
      failures,
    );
    assertAsset(
      posture.maxUpperArmExposureDegrees <= posture.maxAllowedUpperArmExposureDegrees,
      `${label} normal runner upper-arm exposure exceeds guardrail: ${posture.maxUpperArmExposureDegrees} > ${posture.maxAllowedUpperArmExposureDegrees}`,
      failures,
    );
    assertAsset(
      posture.maxForearmLiftDegrees <= posture.maxAllowedForearmLiftDegrees,
      `${label} normal runner forearm lift exceeds guardrail: ${posture.maxForearmLiftDegrees} > ${posture.maxAllowedForearmLiftDegrees}`,
      failures,
    );
    assertAsset(
      posture.maxHandLiftDegrees <= posture.maxAllowedHandLiftDegrees,
      `${label} normal runner hand lift exceeds guardrail: ${posture.maxHandLiftDegrees} > ${posture.maxAllowedHandLiftDegrees}`,
      failures,
    );
    assertAsset(
      posture.minUpperArmDropDegrees >= posture.minRequiredUpperArmDropDegrees,
      `${label} normal runner upper-arm drop is below guardrail: ${posture.minUpperArmDropDegrees} < ${posture.minRequiredUpperArmDropDegrees}`,
      failures,
    );
  } else {
    failures.push(`${label} normalMotionPosture is missing numeric upper-arm, exposure, lateral-arm, forearm, hand, or drop evidence`);
  }

  const clipPostures = Array.isArray(posture?.clipPostures) ? posture.clipPostures : [];
  const clipPostureByName = new Map(clipPostures.map((clipPosture) => [clipPosture.clipName, clipPosture]));
  for (const clipName of requiredClips.filter((clip) => requiredNormalMotionClips.includes(clip))) {
    const clipPosture = clipPostureByName.get(clipName);
    if (!clipPosture) {
      failures.push(`${label} normalMotionPosture is missing per-clip posture evidence for "${clipName}"`);
      continue;
    }
    assertAsset(
      clipPosture.status === 'passed',
      `${label} normalMotionPosture clip "${clipName}" is not passed: ${clipPosture.status ?? 'unknown'}`,
      failures,
    );
    if (
      Number.isFinite(clipPosture.maxUpperArmLiftDegrees)
      && Number.isFinite(clipPosture.maxAllowedUpperArmLiftDegrees)
      && Number.isFinite(clipPosture.maxUpperArmSwingDegrees)
      && Number.isFinite(clipPosture.maxAllowedUpperArmSwingDegrees)
      && Number.isFinite(clipPosture.maxUpperArmLateralDegrees)
      && Number.isFinite(clipPosture.maxAllowedUpperArmLateralDegrees)
      && Number.isFinite(clipPosture.maxUpperArmExposureDegrees)
      && Number.isFinite(clipPosture.maxAllowedUpperArmExposureDegrees)
      && Number.isFinite(clipPosture.maxForearmLiftDegrees)
      && Number.isFinite(clipPosture.maxAllowedForearmLiftDegrees)
      && Number.isFinite(clipPosture.maxHandLiftDegrees)
      && Number.isFinite(clipPosture.maxAllowedHandLiftDegrees)
      && Number.isFinite(clipPosture.minUpperArmDropDegrees)
      && Number.isFinite(clipPosture.minRequiredUpperArmDropDegrees)
    ) {
      assertAsset(
        clipPosture.maxUpperArmLiftDegrees <= clipPosture.maxAllowedUpperArmLiftDegrees,
        `${label} normalMotionPosture clip "${clipName}" upper-arm lift exceeds guardrail: ${clipPosture.maxUpperArmLiftDegrees} > ${clipPosture.maxAllowedUpperArmLiftDegrees}`,
        failures,
      );
      assertAsset(
        clipPosture.maxUpperArmSwingDegrees <= clipPosture.maxAllowedUpperArmSwingDegrees,
        `${label} normalMotionPosture clip "${clipName}" upper-arm swing exceeds guardrail: ${clipPosture.maxUpperArmSwingDegrees} > ${clipPosture.maxAllowedUpperArmSwingDegrees}`,
        failures,
      );
      assertAsset(
        clipPosture.maxUpperArmLateralDegrees <= clipPosture.maxAllowedUpperArmLateralDegrees,
        `${label} normalMotionPosture clip "${clipName}" upper-arm lateral exceeds guardrail: ${clipPosture.maxUpperArmLateralDegrees} > ${clipPosture.maxAllowedUpperArmLateralDegrees}`,
        failures,
      );
      assertAsset(
        clipPosture.maxUpperArmExposureDegrees <= clipPosture.maxAllowedUpperArmExposureDegrees,
        `${label} normalMotionPosture clip "${clipName}" upper-arm exposure exceeds guardrail: ${clipPosture.maxUpperArmExposureDegrees} > ${clipPosture.maxAllowedUpperArmExposureDegrees}`,
        failures,
      );
      assertAsset(
        clipPosture.maxForearmLiftDegrees <= clipPosture.maxAllowedForearmLiftDegrees,
        `${label} normalMotionPosture clip "${clipName}" forearm lift exceeds guardrail: ${clipPosture.maxForearmLiftDegrees} > ${clipPosture.maxAllowedForearmLiftDegrees}`,
        failures,
      );
      assertAsset(
        clipPosture.maxHandLiftDegrees <= clipPosture.maxAllowedHandLiftDegrees,
        `${label} normalMotionPosture clip "${clipName}" hand lift exceeds guardrail: ${clipPosture.maxHandLiftDegrees} > ${clipPosture.maxAllowedHandLiftDegrees}`,
        failures,
      );
      assertAsset(
        clipPosture.minUpperArmDropDegrees >= clipPosture.minRequiredUpperArmDropDegrees,
        `${label} normalMotionPosture clip "${clipName}" upper-arm drop is below guardrail: ${clipPosture.minUpperArmDropDegrees} < ${clipPosture.minRequiredUpperArmDropDegrees}`,
        failures,
      );
    } else {
      failures.push(`${label} normalMotionPosture clip "${clipName}" is missing numeric upper-arm, exposure, lateral-arm, forearm, hand, or drop evidence`);
    }
  }

  const sourceClips = target.motionSourceClips ?? [];
  const sourceClipByName = new Map(sourceClips.map((clip) => [clip.clipName, clip]));
  for (const clipName of requiredClips) {
    const sourceClip = sourceClipByName.get(clipName);
    if (!sourceClip) {
      failures.push(`${label} retarget report is missing source-driven clip "${clipName}"`);
      continue;
    }

    assertAsset(
      typeof sourceClip.source === 'string' && sourceClip.source.includes('asset-inbox'),
      `${label} retarget clip "${clipName}" is missing source path evidence`,
      failures,
    );
    assertAsset(
      isAcceptedRunnerSourceQuality(sourceClip.sourceQuality),
      `${label} retarget clip "${clipName}" has unsupported sourceQuality "${sourceClip.sourceQuality ?? 'missing'}"`,
      failures,
    );
    assertAsset(
      !isFinalGradeRunnerSourceQuality(sourceClip.sourceQuality)
        || sourceClip.sourceType === 'final-grade-bvh-action-clip',
      `${label} retarget clip "${clipName}" final-grade source is still marked as a seed handoff: ${sourceClip.sourceType ?? 'missing'}`,
      failures,
    );
    const invalidFinalGradeCaptureMethod = invalidFinalGradeRunnerCaptureMethod(sourceClip);
    assertAsset(
      !invalidFinalGradeCaptureMethod,
      `${label} retarget clip "${clipName}" has invalid final-grade capture method "${sourceClip.captureMethod ?? 'missing'}" for ${sourceClip.sourceQuality ?? 'missing'}; expected ${invalidFinalGradeCaptureMethod?.allowedMethods.join(', ') ?? 'n/a'}`,
      failures,
    );
    assertAsset(
      !isFinalGradeRunnerSourceQuality(sourceClip.sourceQuality)
        || (typeof sourceClip.usageRights === 'string' && sourceClip.usageRights.trim().length > 0),
      `${label} retarget clip "${clipName}" final-grade source is missing usage-rights metadata`,
      failures,
    );
    const invalidUsageRights = invalidFinalGradeRunnerUsageRights(sourceClip);
    assertAsset(
      !invalidUsageRights,
      `${label} retarget clip "${clipName}" has invalid final-grade usage rights: missing ${invalidUsageRights?.missingTerms.join(', ') ?? 'n/a'}`,
      failures,
    );
    assertAsset(
      Number.isFinite(sourceClip.sourceFrameCount) && sourceClip.sourceFrameCount > 0,
      `${label} retarget clip "${clipName}" is missing source frame count`,
      failures,
    );
    assertAsset(
      Number.isFinite(sourceClip.retargetedFrameCount) && sourceClip.retargetedFrameCount >= sourceClip.sourceFrameCount,
      `${label} retarget clip "${clipName}" has invalid retargeted frame count`,
      failures,
    );
    assertAsset(
      typeof sourceClip.qualityProfile === 'string' && sourceClip.qualityProfile.length > 0,
      `${label} retarget clip "${clipName}" is missing qualityProfile`,
      failures,
    );

    const metrics = sourceClip.sourceMotionMetrics ?? {};
    for (const metricKey of requiredRetargetedClipMetricKeys) {
      assertAsset(
        Number.isFinite(sourceClip[metricKey]),
        `${label} retarget clip "${clipName}" is missing numeric ${metricKey}`,
        failures,
      );
      const minimumKey = retargetedClipMetricMinimumKeys[metricKey];
      if (Number.isFinite(sourceClip[metricKey]) && Number.isFinite(sourceClip[minimumKey])) {
        assertAsset(
          sourceClip[metricKey] >= sourceClip[minimumKey],
          `${label} retarget clip "${clipName}" is below ${minimumKey}: ${sourceClip[metricKey]} < ${sourceClip[minimumKey]}`,
          failures,
        );
      }
      const maximumKey = retargetedClipMetricMaximumKeys[metricKey];
      if (Number.isFinite(sourceClip[metricKey]) && Number.isFinite(sourceClip[maximumKey])) {
        assertAsset(
          sourceClip[metricKey] <= sourceClip[maximumKey],
          `${label} retarget clip "${clipName}" is above ${maximumKey}: ${sourceClip[metricKey]} > ${sourceClip[maximumKey]}`,
          failures,
        );
      }
    }
    if (Number.isFinite(sourceClip.retargetedStickActionTwoHandContactFrameCount)) {
      assertAsset(
        Array.isArray(sourceClip.retargetedStickActionTwoHandContactFrameIndices),
        `${label} retarget clip "${clipName}" is missing two-hand contact frame indices`,
        failures,
      );
      if (Array.isArray(sourceClip.retargetedStickActionTwoHandContactFrameIndices)) {
        assertAsset(
          sourceClip.retargetedStickActionTwoHandContactFrameIndices.length === sourceClip.retargetedStickActionTwoHandContactFrameCount,
          `${label} retarget clip "${clipName}" two-hand contact frame count does not match indices`,
          failures,
        );
      }
    }
    for (const metricKey of requiredRetargetMetricKeys) {
      assertAsset(
        Number.isFinite(metrics[metricKey]),
        `${label} retarget clip "${clipName}" is missing numeric sourceMotionMetrics.${metricKey}`,
        failures,
      );
      const minimumKey = retargetMetricMinimumKeys[metricKey];
      if (Number.isFinite(metrics[metricKey]) && Number.isFinite(sourceClip[minimumKey])) {
        assertAsset(
          metrics[metricKey] >= sourceClip[minimumKey],
          `${label} retarget clip "${clipName}" is below ${minimumKey}: ${metrics[metricKey]} < ${sourceClip[minimumKey]}`,
          failures,
        );
      }
      const maximumKey = retargetMetricMaximumKeys[metricKey];
      if (Number.isFinite(metrics[metricKey]) && Number.isFinite(sourceClip[maximumKey])) {
        assertAsset(
          metrics[metricKey] <= sourceClip[maximumKey],
          `${label} retarget clip "${clipName}" is above ${maximumKey}: ${metrics[metricKey]} > ${sourceClip[maximumKey]}`,
          failures,
        );
      }
    }
  }

  const motionQuality = classifyRunnerMotionQuality(sourceClips, { requiredClipNames: requiredClips });
  if (motionQuality.unsupportedClipNames.length > 0) {
    failures.push(`${label} retarget report has unsupported source-quality clips: ${motionQuality.unsupportedClipNames.join(', ')}`);
  }
  if (motionQuality.missingFinalGradeProvenanceClipNames.length > 0) {
    const details = motionQuality.finalGradeProvenanceFailures
      .map((failure) => `${failure.clipName} (${failure.missingFields.join(', ')})`)
      .join('; ');
    failures.push(`${label} retarget report has final-grade clips missing provenance: ${details}`);
  }
  if (motionQuality.invalidFinalGradeCaptureMethodClipNames.length > 0) {
    const details = motionQuality.finalGradeCaptureMethodFailures
      .map((failure) => `${failure.clipName} (${failure.captureMethod}; expected ${failure.allowedMethods.join(', ')})`)
      .join('; ');
    failures.push(`${label} retarget report has final-grade clips with invalid capture methods: ${details}`);
  }
  if (motionQuality.invalidFinalGradeUsageRightsClipNames.length > 0) {
    const details = motionQuality.finalGradeUsageRightsFailures
      .map((failure) => `${failure.clipName} (missing ${failure.missingTerms.join(', ')})`)
      .join('; ');
    failures.push(`${label} retarget report has final-grade clips with invalid usage rights: ${details}`);
  }
  if (motionQuality.invalidFinalGradeRetargetFrameCountClipNames.length > 0) {
    const details = motionQuality.finalGradeRetargetFrameCountFailures
      .map((failure) => `${failure.clipName} (${failure.retargetedFrameCount ?? 'missing'} frames; minimum ${failure.minimumRetargetedFrameCount ?? 'n/a'} from source ${failure.sourceFrameCount ?? 'missing'} frames)`)
      .join('; ');
    failures.push(`${label} retarget report has final-grade clips with invalid retarget frame count: ${details}`);
  }
  if (motionQuality.invalidFinalGradeRetargetDurationClipNames.length > 0) {
    const details = motionQuality.finalGradeRetargetDurationFailures
      .map((failure) => `${failure.clipName} (${failure.retargetedDurationSeconds ?? 'missing'}s; minimum ${failure.minimumRetargetedDurationSeconds ?? 'n/a'}s from source ${failure.sourceDurationSeconds ?? 'missing'}s)`)
      .join('; ');
    failures.push(`${label} retarget report has final-grade clips with invalid retarget duration: ${details}`);
  }
  if (motionQuality.invalidFinalGradeRetargetQualityMetricClipNames.length > 0) {
    const details = motionQuality.finalGradeRetargetQualityMetricFailures
      .map((failure) => {
        const metrics = failure.metricFailures
          .map((metricFailure) => {
            const threshold = metricFailure.type === 'minimum'
              ? `minimum ${metricFailure.minimum}`
              : `maximum ${metricFailure.maximum}`;
            return `${metricFailure.metricKey}=${metricFailure.actual ?? 'missing'} (${threshold})`;
          })
          .join(', ');
        return `${failure.clipName} (${metrics})`;
      })
      .join('; ');
    failures.push(`${label} retarget report has final-grade clips with invalid retarget quality metrics: ${details}`);
  }
  if (requireFinalGradeMotion && !motionQuality.isFinalGrade) {
    failures.push(`${label} retarget report is not final-grade motion; missing final-grade clips: ${motionQuality.missingFinalGradeClipNames.join(', ')}`);
  }

  return motionQuality;
}

async function inspectAsset(label, assetUrl, options = {}) {
  const failures = [];
  const file = toDiskPath(assetUrl);
  if (!(await exists(file))) {
    return {
      label,
      file,
      status: 'missing',
      failures: [`Missing ${label}: ${file}`],
    };
  }

  const doc = await io.read(file);
  const fileStat = await stat(file);
  const stats = getSceneStats(doc);
  const maxVertices = options.maxVertices ?? 35000;
  const maxBytes = options.maxBytes ?? 4000000;
  let retargetQuality = null;
  assertAsset(stats.uploadedVertices <= maxVertices, `${label} exceeds vertex budget: ${stats.uploadedVertices} > ${maxVertices}`, failures);
  assertAsset(fileStat.size <= maxBytes, `${label} exceeds file-size budget: ${fileStat.size} > ${maxBytes}`, failures);
  if (options.maxWidth != null) {
    assertAsset(
      Number.isFinite(stats.dimensions?.width) && stats.dimensions.width <= options.maxWidth,
      `${label} exceeds runner width guardrail: ${stats.dimensions?.width?.toFixed(3) ?? 'unknown'} > ${options.maxWidth}`,
      failures,
    );
  }
  if (options.maxDepth != null) {
    assertAsset(
      Number.isFinite(stats.dimensions?.depth) && stats.dimensions.depth <= options.maxDepth,
      `${label} exceeds runner depth guardrail: ${stats.dimensions?.depth?.toFixed(3) ?? 'unknown'} > ${options.maxDepth}`,
      failures,
    );
  }
  if (options.minHeight != null) {
    assertAsset(
      Number.isFinite(stats.dimensions?.height) && stats.dimensions.height >= options.minHeight,
      `${label} is below runner height guardrail: ${stats.dimensions?.height?.toFixed(3) ?? 'unknown'} < ${options.minHeight}`,
      failures,
    );
  }
  if (options.maxHeight != null) {
    assertAsset(
      Number.isFinite(stats.dimensions?.height) && stats.dimensions.height <= options.maxHeight,
      `${label} exceeds runner height guardrail: ${stats.dimensions?.height?.toFixed(3) ?? 'unknown'} > ${options.maxHeight}`,
      failures,
    );
  }
  assertAsset(hasAnyNode(stats, ['Hips', 'Hip']), `${label} is missing a humanoid hip bone`, failures);
  assertAsset(hasAnyNode(stats, ['Head']), `${label} is missing a humanoid Head bone`, failures);
  if (options.requiredClips) {
    for (const clip of options.requiredClips) {
      assertAsset(stats.animations.includes(clip), `${label} is missing animation clip "${clip}"`, failures);
    }
  }
  if (options.requiredMeshFragments) {
    const meshText = stats.meshNames.join(' ').toLowerCase();
    for (const fragment of options.requiredMeshFragments) {
      assertAsset(meshText.includes(fragment), `${label} is missing expected mesh fragment "${fragment}"`, failures);
    }
  }
  if (options.requiredNamedPartGroups) {
    const missingGroups = missingNamedPartGroups(stats.namedParts, options.requiredNamedPartGroups);
    for (const group of missingGroups) {
      assertAsset(false, `${label} is missing a named equipment part matching one of: ${group.join(', ')}`, failures);
    }
  }
  if (options.requiredSideBalancedPartGroups) {
    const missingSideGroups = missingSideBalancedPartGroups(
      stats.meshNames,
      options.requiredSideBalancedPartGroups,
    );
    for (const group of missingSideGroups) {
      assertAsset(
        false,
        `${label} is missing ${group.missingSide}-side runner equipment for ${group.label} matching one of: ${group.fragments.join(', ')}`,
        failures,
      );
    }
  }
  if (options.retargetReportKey) {
    retargetQuality = assertRunnerRetargetReport(label, options.retargetReportKey, options.requiredClips ?? [], failures);
  }

  return {
    label,
    file,
    status: failures.length > 0 ? 'failed' : 'passed',
    failures,
    animations: stats.animations,
    bytes: fileStat.size,
    dimensions: stats.dimensions,
    retargetQuality,
    uploadedVertices: stats.uploadedVertices,
  };
}

const checks = [];

if (!strictProduction) {
  checks.push(
    await inspectAsset('detailed runner body', PLAYER_RIG_ASSETS.detailedRunner.url, {
      maxVertices: 35000,
      requiredMeshFragments: ['shirt', 'short', 'shoe'],
    }),
    await inspectAsset('runtime animation source', PLAYER_RIG_ASSETS.detailedRunner.animationSource, {
      maxVertices: 20000,
      requiredClips: requiredRuntimeClips,
    }),
  );
}

for (const [label, assetUrl] of Object.entries({
  runnerHome: PLAYER_RIG_ASSETS.productionTargets.runnerHome,
  runnerAway: PLAYER_RIG_ASSETS.productionTargets.runnerAway,
  goalieHome: PLAYER_RIG_ASSETS.productionTargets.goalieHome,
  goalieAway: PLAYER_RIG_ASSETS.productionTargets.goalieAway,
})) {
  if (runnersOnly && label.toLowerCase().includes('goalie')) continue;
  const profile = getRigProfileForKey(label);
  checks.push(await inspectAsset(`production ${label}`, assetUrl, {
    maxVertices: profile.maxVertices,
    maxBytes: profile.maxBytes,
    minHeight: profile.minHeight,
    maxHeight: profile.maxHeight,
    maxWidth: profile.maxWidth,
    maxDepth: profile.maxDepth,
    requiredClips: profile.requiredClips,
    requiredNamedPartGroups: profile.requiredNamedPartGroups,
    requiredSideBalancedPartGroups: profile.requiredSideBalancedPartGroups,
    retargetReportKey: strictProduction && label.startsWith('runner') ? label : null,
  }));
}

let hasFailure = false;
let hasMissingProduction = false;

for (const check of checks) {
  console.log(`${check.status.toUpperCase()}: ${check.label}`);
  console.log(`  ${check.file}`);
  if (check.uploadedVertices != null) console.log(`  uploaded vertices: ${check.uploadedVertices}`);
  if (check.bytes != null) console.log(`  bytes: ${check.bytes}`);
  if (check.dimensions) {
    console.log(`  dimensions: ${check.dimensions.height.toFixed(3)}h x ${check.dimensions.width.toFixed(3)}w x ${check.dimensions.depth.toFixed(3)}d`);
  }
  if (check.animations) console.log(`  clips: ${check.animations.join(', ') || '(none)'}`);
  if (check.retargetQuality) {
    console.log(`  retarget motion quality: ${check.retargetQuality.status}`);
    if (check.retargetQuality.seedClipNames.length > 0) {
      console.log(`  seed-quality clips: ${check.retargetQuality.seedClipNames.join(', ')}`);
    }
    if (check.retargetQuality.finalGradeClipNames.length > 0) {
      console.log(`  final-grade clips: ${check.retargetQuality.finalGradeClipNames.join(', ')}`);
    }
    if (check.retargetQuality.missingFinalGradeClipNames.length > 0) {
      console.log(`  missing final-grade clips: ${check.retargetQuality.missingFinalGradeClipNames.join(', ')}`);
    }
    if (check.retargetQuality.missingFinalGradeProvenanceClipNames.length > 0) {
      console.log(`  final-grade clips missing provenance: ${check.retargetQuality.missingFinalGradeProvenanceClipNames.join(', ')}`);
    }
    if (check.retargetQuality.invalidFinalGradeRetargetDurationClipNames.length > 0) {
      console.log(`  final-grade clips with invalid retarget duration: ${check.retargetQuality.invalidFinalGradeRetargetDurationClipNames.join(', ')}`);
    }
    if (check.retargetQuality.invalidFinalGradeRetargetFrameCountClipNames.length > 0) {
      console.log(`  final-grade clips with invalid retarget frame count: ${check.retargetQuality.invalidFinalGradeRetargetFrameCountClipNames.join(', ')}`);
    }
  }
  for (const failure of check.failures) console.log(`  - ${failure}`);
  hasFailure ||= check.status === 'failed';
  hasMissingProduction ||= check.status === 'missing' && check.label.startsWith('production ');
}

if (hasFailure || (strictProduction && hasMissingProduction)) {
  process.exitCode = 1;
}

if (hasMissingProduction && !strictProduction) {
  console.log('TEMPORARY MODE: production rigs are not present yet. Run with --strict-production to fail until final assets exist.');
}
