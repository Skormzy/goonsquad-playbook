export const ACCEPTED_RUNNER_SOURCE_QUALITIES = new Set([
  'internal-authored-action-clip',
  'internally-authored-high-quality-action-clip',
  'licensed-motion-capture-action-clip',
  'licensed-authored-action-clip',
  'internally-authored-motion-capture-action-clip',
  'internally-authored-performance-capture-action-clip',
]);

export const FINAL_GRADE_RUNNER_SOURCE_QUALITIES = new Set([
  'licensed-motion-capture-action-clip',
  'licensed-authored-action-clip',
  'internally-authored-high-quality-action-clip',
  'internally-authored-motion-capture-action-clip',
  'internally-authored-performance-capture-action-clip',
]);

export const FINAL_GRADE_RUNNER_PROVENANCE_FIELDS = [
  'sourceRightsPath',
  'sourceProvider',
  'captureMethod',
  'usageRights',
];
export const FINAL_GRADE_USAGE_RIGHTS_REQUIREMENTS = Object.freeze([
  {
    key: 'retargeting',
    pattern: /\bretarget(?:ed|ing)?\b/i,
  },
  {
    key: 'runtime-or-shipping-use',
    pattern: /\b(runtime|run-time|ship(?:ped|ping)?|distribut(?:e|ed|ion)|use|used)\b/i,
  },
]);
export const MIN_FINAL_GRADE_RETARGET_FRAME_RATIO = 0.95;
export const MIN_FINAL_GRADE_RETARGET_DURATION_RATIO = 0.95;

export const FINAL_GRADE_RETARGET_MINIMUM_METRIC_KEYS = Object.freeze({
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
});

export const FINAL_GRADE_RETARGET_MAXIMUM_METRIC_KEYS = Object.freeze({
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
});

export const FINAL_GRADE_RUNNER_CAPTURE_METHODS = Object.freeze({
  'licensed-motion-capture-action-clip': [
    'optical-motion-capture',
    'inertial-motion-capture',
    'markerless-motion-capture',
    'performance-capture',
  ],
  'licensed-authored-action-clip': [
    'professional-keyframe-animation',
    'hand-authored-reference-animation',
    'vendor-authored-animation',
  ],
  'internally-authored-high-quality-action-clip': [
    'professional-keyframe-animation',
    'hand-authored-reference-animation',
    'internal-reference-keyframe-animation',
  ],
  'internally-authored-motion-capture-action-clip': [
    'optical-motion-capture',
    'inertial-motion-capture',
    'markerless-motion-capture',
  ],
  'internally-authored-performance-capture-action-clip': [
    'performance-capture',
    'markerless-performance-capture',
    'video-reference-performance-capture',
  ],
});

export function isAcceptedRunnerSourceQuality(sourceQuality) {
  return ACCEPTED_RUNNER_SOURCE_QUALITIES.has(sourceQuality);
}

export function isFinalGradeRunnerSourceQuality(sourceQuality) {
  return FINAL_GRADE_RUNNER_SOURCE_QUALITIES.has(sourceQuality);
}

export function missingFinalGradeRunnerProvenanceFields(clip) {
  return FINAL_GRADE_RUNNER_PROVENANCE_FIELDS.filter((field) => (
    typeof clip?.[field] !== 'string' || clip[field].trim().length === 0
  ));
}

export function hasFinalGradeRunnerProvenance(clip) {
  return missingFinalGradeRunnerProvenanceFields(clip).length === 0;
}

export function allowedFinalGradeRunnerCaptureMethods(sourceQuality) {
  return FINAL_GRADE_RUNNER_CAPTURE_METHODS[sourceQuality] ?? [];
}

export function invalidFinalGradeRunnerCaptureMethod(clip) {
  const sourceQuality = clip?.sourceQuality;
  if (!isFinalGradeRunnerSourceQuality(sourceQuality) || !hasFinalGradeRunnerProvenance(clip)) {
    return null;
  }

  const captureMethod = clip.captureMethod.trim();
  const allowedMethods = allowedFinalGradeRunnerCaptureMethods(sourceQuality);
  return allowedMethods.includes(captureMethod)
    ? null
    : {
      clipName: clip?.clipName ?? '(unnamed)',
      sourceQuality,
      captureMethod,
      allowedMethods,
    };
}

export function invalidFinalGradeRunnerUsageRights(clip) {
  const sourceQuality = clip?.sourceQuality;
  if (!isFinalGradeRunnerSourceQuality(sourceQuality) || !hasFinalGradeRunnerProvenance(clip)) {
    return null;
  }

  const usageRights = clip.usageRights.trim();
  const missingTerms = FINAL_GRADE_USAGE_RIGHTS_REQUIREMENTS
    .filter((requirement) => !requirement.pattern.test(usageRights))
    .map((requirement) => requirement.key);

  return missingTerms.length === 0
    ? null
    : {
      clipName: clip?.clipName ?? '(unnamed)',
      usageRights,
      missingTerms,
    };
}

function roundedSeconds(value) {
  return Math.round(value * 1000) / 1000;
}

export function invalidFinalGradeRunnerRetargetFrameCount(clip, options = {}) {
  const sourceQuality = clip?.sourceQuality;
  if (!isFinalGradeRunnerSourceQuality(sourceQuality) || !hasFinalGradeRunnerProvenance(clip)) {
    return null;
  }

  const sourceFrameCount = clip.sourceFrameCount;
  const retargetedFrameCount = clip.retargetedFrameCount;
  const minimumRatio = Number.isFinite(options.minimumRatio)
    ? options.minimumRatio
    : MIN_FINAL_GRADE_RETARGET_FRAME_RATIO;

  if (!Number.isFinite(sourceFrameCount) || sourceFrameCount <= 0) {
    return {
      clipName: clip?.clipName ?? '(unnamed)',
      sourceFrameCount,
      retargetedFrameCount,
      minimumRetargetedFrameCount: null,
    };
  }

  const minimumRetargetedFrameCount = Math.ceil(sourceFrameCount * minimumRatio);
  return Number.isFinite(retargetedFrameCount)
    && retargetedFrameCount >= minimumRetargetedFrameCount
    ? null
    : {
      clipName: clip?.clipName ?? '(unnamed)',
      sourceFrameCount,
      retargetedFrameCount,
      minimumRetargetedFrameCount,
    };
}

export function invalidFinalGradeRunnerRetargetDuration(clip, options = {}) {
  const sourceQuality = clip?.sourceQuality;
  if (!isFinalGradeRunnerSourceQuality(sourceQuality) || !hasFinalGradeRunnerProvenance(clip)) {
    return null;
  }

  const sourceDurationSeconds = clip.sourceDurationSeconds;
  const retargetedDurationSeconds = clip.retargetedDurationSeconds;
  const minimumRatio = Number.isFinite(options.minimumRatio)
    ? options.minimumRatio
    : MIN_FINAL_GRADE_RETARGET_DURATION_RATIO;

  if (!Number.isFinite(sourceDurationSeconds) || sourceDurationSeconds <= 0) {
    return {
      clipName: clip?.clipName ?? '(unnamed)',
      sourceDurationSeconds,
      retargetedDurationSeconds,
      minimumRetargetedDurationSeconds: null,
    };
  }

  const minimumRetargetedDurationSeconds = roundedSeconds(sourceDurationSeconds * minimumRatio);
  return Number.isFinite(retargetedDurationSeconds)
    && retargetedDurationSeconds >= minimumRetargetedDurationSeconds
    ? null
    : {
      clipName: clip?.clipName ?? '(unnamed)',
      sourceDurationSeconds,
      retargetedDurationSeconds,
      minimumRetargetedDurationSeconds,
    };
}

function metricActualValue(value) {
  return Number.isFinite(value) ? value : null;
}

export function invalidFinalGradeRunnerRetargetQualityMetrics(clip) {
  const sourceQuality = clip?.sourceQuality;
  if (
    !isFinalGradeRunnerSourceQuality(sourceQuality)
    || !hasFinalGradeRunnerProvenance(clip)
    || invalidFinalGradeRunnerCaptureMethod(clip)
  ) {
    return null;
  }

  const metricFailures = [];
  for (const [metricKey, thresholdKey] of Object.entries(FINAL_GRADE_RETARGET_MINIMUM_METRIC_KEYS)) {
    const minimum = clip?.[thresholdKey];
    const actual = clip?.[metricKey];
    if (Number.isFinite(minimum) && (!Number.isFinite(actual) || actual < minimum)) {
      metricFailures.push({
        actual: metricActualValue(actual),
        metricKey,
        minimum,
        thresholdKey,
        type: 'minimum',
      });
    }
  }
  for (const [metricKey, thresholdKey] of Object.entries(FINAL_GRADE_RETARGET_MAXIMUM_METRIC_KEYS)) {
    const maximum = clip?.[thresholdKey];
    const actual = clip?.[metricKey];
    if (Number.isFinite(maximum) && (!Number.isFinite(actual) || actual > maximum)) {
      metricFailures.push({
        actual: metricActualValue(actual),
        maximum,
        metricKey,
        thresholdKey,
        type: 'maximum',
      });
    }
  }

  return metricFailures.length === 0
    ? null
    : {
      clipName: clip?.clipName ?? '(unnamed)',
      metricFailures,
    };
}

export function classifyRunnerMotionQuality(sourceClips, options = {}) {
  const clips = Array.isArray(sourceClips) ? sourceClips : [];
  const requiredClipNames = Array.isArray(options.requiredClipNames) ? options.requiredClipNames : [];
  const unsupportedClipNames = [];
  const seedClipNames = [];
  const finalGradeClipNames = [];
  const finalGradeProvenanceFailures = [];
  const finalGradeCaptureMethodFailures = [];
  const finalGradeRetargetFrameCountFailures = [];
  const finalGradeRetargetDurationFailures = [];
  const finalGradeRetargetQualityMetricFailures = [];
  const finalGradeUsageRightsFailures = [];

  for (const clip of clips) {
    const clipName = clip?.clipName ?? '(unnamed)';
    const sourceQuality = clip?.sourceQuality;

    if (!isAcceptedRunnerSourceQuality(sourceQuality)) {
      unsupportedClipNames.push(clipName);
    } else if (isFinalGradeRunnerSourceQuality(sourceQuality)) {
      const missingFields = missingFinalGradeRunnerProvenanceFields(clip);
      if (missingFields.length > 0) {
        finalGradeProvenanceFailures.push({ clipName, missingFields });
      } else {
        const invalidCaptureMethod = invalidFinalGradeRunnerCaptureMethod(clip);
        if (invalidCaptureMethod) {
          finalGradeCaptureMethodFailures.push(invalidCaptureMethod);
        } else {
          const invalidUsageRights = invalidFinalGradeRunnerUsageRights(clip);
          if (invalidUsageRights) {
            finalGradeUsageRightsFailures.push(invalidUsageRights);
          } else {
            const invalidRetargetFrameCount = invalidFinalGradeRunnerRetargetFrameCount(clip, {
              minimumRatio: options.minimumFinalGradeRetargetFrameRatio,
            });
            if (invalidRetargetFrameCount) {
              finalGradeRetargetFrameCountFailures.push(invalidRetargetFrameCount);
            } else {
              const invalidRetargetDuration = invalidFinalGradeRunnerRetargetDuration(clip, {
                minimumRatio: options.minimumFinalGradeRetargetDurationRatio,
              });
              if (invalidRetargetDuration) {
                finalGradeRetargetDurationFailures.push(invalidRetargetDuration);
              } else {
                const invalidRetargetQualityMetrics = invalidFinalGradeRunnerRetargetQualityMetrics(clip);
                if (invalidRetargetQualityMetrics) {
                  finalGradeRetargetQualityMetricFailures.push(invalidRetargetQualityMetrics);
                } else {
                  finalGradeClipNames.push(clipName);
                }
              }
            }
          }
        }
      }
    } else {
      seedClipNames.push(clipName);
    }
  }

  const missingFinalGradeProvenanceClipNames = finalGradeProvenanceFailures
    .map((failure) => failure.clipName);
  const invalidFinalGradeCaptureMethodClipNames = finalGradeCaptureMethodFailures
    .map((failure) => failure.clipName);
  const invalidFinalGradeUsageRightsClipNames = finalGradeUsageRightsFailures
    .map((failure) => failure.clipName);
  const invalidFinalGradeRetargetFrameCountClipNames = finalGradeRetargetFrameCountFailures
    .map((failure) => failure.clipName);
  const invalidFinalGradeRetargetDurationClipNames = finalGradeRetargetDurationFailures
    .map((failure) => failure.clipName);
  const invalidFinalGradeRetargetQualityMetricClipNames = finalGradeRetargetQualityMetricFailures
    .map((failure) => failure.clipName);
  const finalGradeClipNameSet = new Set(finalGradeClipNames);
  const missingFinalGradeClipNames = requiredClipNames
    .filter((clipName) => !finalGradeClipNameSet.has(clipName));
  const hasRequiredFinalGradeCoverage = requiredClipNames.length === 0
    || missingFinalGradeClipNames.length === 0;
  const isAcceptedForStrictProduction = unsupportedClipNames.length === 0
    && missingFinalGradeProvenanceClipNames.length === 0
    && invalidFinalGradeCaptureMethodClipNames.length === 0
    && invalidFinalGradeUsageRightsClipNames.length === 0
    && invalidFinalGradeRetargetFrameCountClipNames.length === 0
    && invalidFinalGradeRetargetDurationClipNames.length === 0
    && invalidFinalGradeRetargetQualityMetricClipNames.length === 0;
  const isFinalGrade = isAcceptedForStrictProduction
    && clips.length > 0
    && seedClipNames.length === 0
    && hasRequiredFinalGradeCoverage;
  let status = 'source-driven-seed';
  if (unsupportedClipNames.length > 0) {
    status = 'unsupported-source-quality';
  } else if (missingFinalGradeProvenanceClipNames.length > 0) {
    status = 'missing-final-grade-provenance';
  } else if (invalidFinalGradeCaptureMethodClipNames.length > 0) {
    status = 'invalid-final-grade-capture-method';
  } else if (invalidFinalGradeUsageRightsClipNames.length > 0) {
    status = 'invalid-final-grade-usage-rights';
  } else if (invalidFinalGradeRetargetFrameCountClipNames.length > 0) {
    status = 'invalid-final-grade-retarget-frame-count';
  } else if (invalidFinalGradeRetargetDurationClipNames.length > 0) {
    status = 'invalid-final-grade-retarget-duration';
  } else if (invalidFinalGradeRetargetQualityMetricClipNames.length > 0) {
    status = 'invalid-final-grade-retarget-quality-metrics';
  } else if (isFinalGrade) {
    status = 'final-grade-motion';
  } else if (seedClipNames.length === 0 && finalGradeClipNames.length > 0) {
    status = 'partial-final-grade-motion';
  }

  return {
    status,
    isAcceptedForStrictProduction,
    isFinalGrade,
    seedClipNames,
    finalGradeClipNames,
    missingFinalGradeClipNames,
    missingFinalGradeProvenanceClipNames,
    invalidFinalGradeCaptureMethodClipNames,
    invalidFinalGradeUsageRightsClipNames,
    invalidFinalGradeRetargetFrameCountClipNames,
    invalidFinalGradeRetargetDurationClipNames,
    invalidFinalGradeRetargetQualityMetricClipNames,
    finalGradeProvenanceFailures,
    finalGradeCaptureMethodFailures,
    finalGradeUsageRightsFailures,
    finalGradeRetargetFrameCountFailures,
    finalGradeRetargetDurationFailures,
    finalGradeRetargetQualityMetricFailures,
    unsupportedClipNames,
  };
}
