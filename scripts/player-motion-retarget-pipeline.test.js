import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('player motion retarget pipeline', () => {
  it('normalizes production runners from approved motion-source BVH seeds instead of synthetic clip authoring', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('RUNNER_CLIP_MOTION_SOURCES');
    expect(script).toContain('field-player-ready-stance.bvh');
    expect(script).toContain('field-player-jog-forward.bvh');
    expect(script).toContain('field-player-sprint-burst.bvh');
    expect(script).toContain('field-player-stick-carry-control.bvh');
    expect(script).toContain('field-player-receive-pass-settle.bvh');
    expect(script).toContain('field-player-forehand-pass-release.bvh');
    expect(script).toContain('field-player-wrist-shot-release.bvh');
    expect(script).toContain('retarget_runner_required_clips');
    expect(script).toContain('motionSourceClips');
    expect(script).toContain('normalMotionPosture');
    expect(script).toContain('NORMAL_UPPER_ARM_DROP_DEGREES');
    expect(script).toContain('MIN_NORMAL_UPPER_ARM_DROP_DEGREES');
    expect(script).toContain('"minUpperArmDropDegrees"');
    expect(script).toContain('"minRequiredUpperArmDropDegrees"');
    expect(script).toContain('MAX_NORMAL_UPPER_ARM_LIFT_DEGREES');
    expect(script).toContain('MAX_NORMAL_UPPER_ARM_SWING_DEGREES');
    expect(script).toContain('MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES');
    expect(script).toContain('MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES');
    expect(script).toContain('MAX_NORMAL_FOREARM_LIFT_DEGREES');
    expect(script).toContain('MAX_NORMAL_HAND_LIFT_DEGREES');
    expect(script).toContain('"maxUpperArmSwingDegrees"');
    expect(script).toContain('"maxAllowedUpperArmSwingDegrees"');
    expect(script).toContain('"maxUpperArmLateralDegrees"');
    expect(script).toContain('"maxAllowedUpperArmLateralDegrees"');
    expect(script).toContain('"maxUpperArmExposureDegrees"');
    expect(script).toContain('"maxAllowedUpperArmExposureDegrees"');
    expect(script).toContain('"maxForearmLiftDegrees"');
    expect(script).toContain('"maxAllowedForearmLiftDegrees"');
    expect(script).toContain('"maxHandLiftDegrees"');
    expect(script).toContain('"maxAllowedHandLiftDegrees"');
    expect(script).toContain('"clipPostures"');
    expect(script).toContain('normal_clip_postures');
    expect(script).toContain('MIN_USABLE_RETARGET_FRAMES');
    expect(script).toContain('"sourceQuality"');
    expect(script).toContain('"sourceRightsPath"');
    expect(script).toContain('"sourceProvider"');
    expect(script).toContain('"captureMethod"');
    expect(script).toContain('"usageRights"');
    expect(script).toContain('parse_source_rights_metadata');
    expect(script).toContain('DEFAULT_SOURCE_METADATA');
    expect(script).toContain('find_source_rights_evidence');
    expect(script).toContain('"sourceMotionMetrics"');
    expect(script).toContain('"maxRotationRangeDegrees"');
    expect(script).toContain('"activeRotationChannelCount"');
    expect(script).toContain('"maxFrameRotationDeltaDegrees"');
    expect(script).toContain('"maximumFrameRotationDeltaDegrees"');
    expect(script).toContain('"maxFrameRotationAccelerationDegrees"');
    expect(script).toContain('"maximumFrameRotationAccelerationDegrees"');
    expect(script).toContain('"rootTravelUnits"');
    expect(script).toContain('"rootForwardTravelUnits"');
    expect(script).toContain('"minimumRootForwardTravelUnits"');
    expect(script).toContain('"rootForwardSpeedChangeUnits"');
    expect(script).toContain('"minimumRootForwardSpeedChangeUnits"');
    expect(script).toContain('"minimumActionClipFrames"');
    expect(script).toContain('"minimumActionClipDurationSeconds"');
    expect(script).toContain('ACTION_QUALITY_PROFILES');
    expect(script).toContain('quality_profile_for_clip');
    expect(script).toContain('"qualityProfile"');
    expect(script).toContain('"minimumRootTravelUnits"');
    expect(script).toContain('"minimumTotalRotationRangeDegrees"');
    expect(script).toContain('"stridePhaseChanges"');
    expect(script).toContain('"minimumStridePhaseChanges"');
    expect(script).toContain('"strideCycleSpanRatio"');
    expect(script).toContain('"minimumStrideCycleSpanRatio"');
    expect(script).toContain('"stickActionArmRangeDegrees"');
    expect(script).toContain('"minimumStickActionArmRangeDegrees"');
    expect(script).toContain('"stickActionTwoHandBalanceRatio"');
    expect(script).toContain('"minimumStickActionTwoHandBalanceRatio"');
    expect(script).toContain('"stickActionTwoHandSyncRatio"');
    expect(script).toContain('"minimumStickActionTwoHandSyncRatio"');
    expect(script).toContain('"stickActionPhaseChanges"');
    expect(script).toContain('"minimumStickActionPhaseChanges"');
    expect(script).toContain('"stickActionBeatSpanRatio"');
    expect(script).toContain('"minimumStickActionBeatSpanRatio"');
    expect(script).toContain('"stickActionReleasePeakRatio"');
    expect(script).toContain('"minimumStickActionReleasePeakRatio"');
    expect(script).toContain('"maximumStickActionReleasePeakRatio"');
    expect(script).toContain('"stickActionSupportedReleaseRatio"');
    expect(script).toContain('"minimumStickActionSupportedReleaseRatio"');
    expect(script).toContain('"stickActionTorsoRangeDegrees"');
    expect(script).toContain('"minimumStickActionTorsoRangeDegrees"');
    expect(script).toContain('"hipShoulderSeparationDegrees"');
    expect(script).toContain('"minimumHipShoulderSeparationDegrees"');
    expect(script).toContain('"stickActionLowerBodyLeadFrames"');
    expect(script).toContain('"minimumStickActionLowerBodyLeadFrames"');
    expect(script).toContain('"stickActionRecoveryRatio"');
    expect(script).toContain('"minimumStickActionRecoveryRatio"');
    expect(script).toContain('"athleticTorsoLeanDegrees"');
    expect(script).toContain('"minimumAthleticTorsoLeanDegrees"');
    expect(script).toContain('"locomotionLoopClosureErrorDegrees"');
    expect(script).toContain('"rootVerticalLoopOffsetUnits"');
    expect(script).toContain('"maximumLoopClosureErrorDegrees"');
    expect(script).toContain('"maximumLoopVerticalOffsetUnits"');
    expect(script).toContain('"rootLateralShiftUnits"');
    expect(script).toContain('"minimumRootLateralShiftUnits"');
    expect(script).toContain('STICK_ACTION_ROOT_LATERAL_RETARGET_SCALE');
    expect(script).toContain('"rootVerticalBounceUnits"');
    expect(script).toContain('"minimumRootVerticalBounceUnits"');
    expect(script).toContain('"readyStanceLegLoadDegrees"');
    expect(script).toContain('"minimumReadyStanceLegLoadDegrees"');
    expect(script).toContain('"legDriveRangeDegrees"');
    expect(script).toContain('"minimumLegDriveRangeDegrees"');
    expect(script).toContain('"locomotionStrideBalanceRatio"');
    expect(script).toContain('"minimumLocomotionStrideBalanceRatio"');
    expect(script).toContain('calculate_locomotion_stride_balance_ratio');
    expect(script).toContain('"locomotionFootPlantDriveRatio"');
    expect(script).toContain('"minimumLocomotionFootPlantDriveRatio"');
    expect(script).toContain('calculate_locomotion_foot_plant_drive_ratio');
    expect(script).toContain('"alternatingLegSeparationDegrees"');
    expect(script).toContain('"minimumAlternatingLegSeparationDegrees"');
    expect(script).toContain('"minimumHipShoulderSeparationDegrees": 8');
    expect(script).toContain('"locomotionArmSwingRangeDegrees"');
    expect(script).toContain('"minimumLocomotionArmSwingRangeDegrees"');
    expect(script).toContain('"locomotionContralateralSyncRatio"');
    expect(script).toContain('"minimumLocomotionContralateralSyncRatio"');
    expect(script).toContain('LOCOMOTION_ARM_SWING_RETARGET_SCALE');
    expect(script).toContain('STICK_ACTION_LEG_DRIVE_RETARGET_SCALE');
    expect(script).toContain('"footPlantContactFrameCount"');
    expect(script).toContain('"minimumFootPlantContactFrames"');
    expect(script).toContain('"footPlantSideCount"');
    expect(script).toContain('"minimumFootPlantSideCount"');
    expect(script).toContain('"footPlantBalanceRatio"');
    expect(script).toContain('"minimumFootPlantBalanceRatio"');
    expect(script).toContain('"footPlantMinSideHoldFrames"');
    expect(script).toContain('"minimumFootPlantHoldFramesPerSide"');
    expect(script).toContain('"maxFootPlantRootDriftUnits"');
    expect(script).toContain('"maximumFootPlantRootDriftUnits"');
    expect(script).toContain('LOCOMOTION_LEG_DRIVE_RETARGET_SCALE');
    expect(script).toContain('STICK_ACTION_FOREARM_SOURCE_SCALE');
    expect(script).toContain('STICK_ACTION_HAND_SOURCE_SCALE');
    expect(script).toContain('ROOT_VERTICAL_RETARGET_SCALE');
    expect(script).toContain('"retargetedTorsoFollowThroughDegrees"');
    expect(script).toContain('"minimumRetargetedTorsoFollowThroughDegrees"');
    expect(script).toContain('"retargetedHipShoulderSeparationDegrees"');
    expect(script).toContain('"minimumRetargetedHipShoulderSeparationDegrees"');
    expect(script).toContain('"retargetedAthleticTorsoLeanDegrees"');
    expect(script).toContain('"minimumRetargetedAthleticTorsoLeanDegrees"');
    expect(script).toContain('"retargetedLocomotionContralateralSyncRatio"');
    expect(script).toContain('"minimumRetargetedLocomotionContralateralSyncRatio"');
    expect(script).toContain('calculate_retargeted_torso_follow_through_range');
    expect(script).toContain('calculate_retargeted_hip_shoulder_separation');
    expect(script).toContain('calculate_retargeted_athletic_torso_lean');
    expect(script).toContain('calculate_retargeted_locomotion_contralateral_sync_ratio');
    expect(script).toContain('calculate_foot_plant_metrics');
    expect(script).toContain('calculate_stick_action_release_peak_ratio');
    expect(script).toContain('calculate_stick_action_supported_release_ratio');
    expect(script).toContain('count_stick_action_phase_changes');
    expect(script).toContain('count_stride_phase_changes');
    expect(script).toContain('calculate_loop_closure_metrics');
    expect(script).not.toContain('author_runner_required_clips');
    expect(script).not.toContain('"authoredClips"');
  });

  it('reports final-grade internal action sources as production motion instead of seed handoffs', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(runnerTargets.length).toBeGreaterThanOrEqual(2);

    for (const target of runnerTargets) {
      for (const clip of target.motionSourceClips) {
        expect(clip.sourceQuality).toBe('internally-authored-high-quality-action-clip');
        expect(clip.sourceType).toBe('final-grade-bvh-action-clip');
        expect(clip.usageRights).toContain('Authored for this project');
      }
    }
  });

  it('retargets locomotion arm swing at an athletic scale while preserving the normal posture guardrail', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const armSwingScale = Number(script.match(/LOCOMOTION_ARM_SWING_RETARGET_SCALE\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalArmLift = Number(script.match(/MAX_NORMAL_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalArmSwing = Number(script.match(/MAX_NORMAL_UPPER_ARM_SWING_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalArmLateral = Number(script.match(/MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalArmExposure = Number(script.match(/MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(armSwingScale).toBeGreaterThanOrEqual(0.72);
    expect(armSwingScale).toBeLessThanOrEqual(0.82);
    expect(maxNormalArmLift).toBeLessThanOrEqual(23);
    expect(maxNormalArmSwing).toBeLessThanOrEqual(20);
    expect(maxNormalArmLateral).toBeLessThanOrEqual(0.25);
    expect(maxNormalArmExposure).toBeLessThanOrEqual(23);
    expect(script).toContain('NORMAL_UPPER_ARM_LIFT_SOURCE_SCALE');
    expect(script).toContain('clamp_normal_upper_arm_exposure');
    expect(script).toContain('NORMAL_FOREARM_LIFT_BASE_DEGREES');
    expect(script).toContain('NORMAL_FOREARM_LIFT_SOURCE_SCALE');
    expect(script).toContain('normal_forearm_lift_for_frame');
    expect(script).toContain('normal_hand_lift_for_frame');
    expect(script).toContain('"retargetedLocomotionArmSwingRangeDegrees"');
    expect(script).toContain('"minimumRetargetedLocomotionArmSwingRangeDegrees"');
    expect(script).toContain('calculate_retargeted_locomotion_arm_swing_range');
  });

  it('exports a tighter normal runner arm carriage for broadcast posture', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const posture = target.normalMotionPosture;

      expect(posture.status).toBe('passed');
      expect(posture.maxUpperArmSwingDegrees).toBeLessThanOrEqual(15.5);
      expect(posture.maxUpperArmLateralDegrees).toBeLessThanOrEqual(0.25);
      expect(posture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(23);

      for (const clipPosture of posture.clipPostures) {
        expect(clipPosture.maxUpperArmSwingDegrees).toBeLessThanOrEqual(15.5);
        expect(clipPosture.maxUpperArmLateralDegrees).toBeLessThanOrEqual(0.25);
        expect(clipPosture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(23);
      }
    }
  });

  it('exports compact normal runner arm carriage below the broadcast T-pose read', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const posture = target.normalMotionPosture;

      expect(posture.status).toBe('passed');
      expect(posture.maxUpperArmSwingDegrees).toBeLessThanOrEqual(9.5);
      expect(posture.maxAllowedUpperArmSwingDegrees).toBeLessThanOrEqual(9.5);
      expect(posture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(20);
      expect(posture.maxAllowedUpperArmExposureDegrees).toBeLessThanOrEqual(20);

      for (const clipPosture of posture.clipPostures) {
        expect(clipPosture.maxUpperArmSwingDegrees).toBeLessThanOrEqual(9.5);
        expect(clipPosture.maxAllowedUpperArmSwingDegrees).toBeLessThanOrEqual(9.5);
        expect(clipPosture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(20);
        expect(clipPosture.maxAllowedUpperArmExposureDegrees).toBeLessThanOrEqual(20);
      }
    }
  });

  it('exports a tighter normal upper-arm lift envelope for broadcast runner posture', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxNormalArmLift = Number(script.match(/MAX_NORMAL_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalArmExposure = Number(script.match(/MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(maxNormalArmLift).toBeLessThanOrEqual(17);
    expect(maxNormalArmExposure).toBeLessThanOrEqual(17);

    for (const target of runnerTargets) {
      const posture = target.normalMotionPosture;

      expect(posture.status).toBe('passed');
      expect(posture.maxUpperArmLiftDegrees).toBeLessThanOrEqual(17);
      expect(posture.maxAllowedUpperArmLiftDegrees).toBeLessThanOrEqual(17);
      expect(posture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(17);
      expect(posture.maxAllowedUpperArmExposureDegrees).toBeLessThanOrEqual(17);

      for (const clipPosture of posture.clipPostures) {
        expect(clipPosture.maxUpperArmLiftDegrees).toBeLessThanOrEqual(17);
        expect(clipPosture.maxAllowedUpperArmLiftDegrees).toBeLessThanOrEqual(17);
        expect(clipPosture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(17);
        expect(clipPosture.maxAllowedUpperArmExposureDegrees).toBeLessThanOrEqual(17);
      }
    }
  });

  it('exports tight normal lower-arm posture guardrails so final-grade runners do not need pose correction', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const maxNormalForearmLift = Number(script.match(/MAX_NORMAL_FOREARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalHandLift = Number(script.match(/MAX_NORMAL_HAND_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(maxNormalForearmLift).toBeLessThanOrEqual(15);
    expect(maxNormalHandLift).toBeLessThanOrEqual(5);

    for (const target of runnerTargets) {
      const posture = target.normalMotionPosture;

      expect(posture.status).toBe('passed');
      expect(posture.maxForearmLiftDegrees).toBeLessThanOrEqual(15);
      expect(posture.maxAllowedForearmLiftDegrees).toBeLessThanOrEqual(15);
      expect(posture.maxHandLiftDegrees).toBeLessThanOrEqual(5);
      expect(posture.maxAllowedHandLiftDegrees).toBeLessThanOrEqual(5);

      for (const clipPosture of posture.clipPostures) {
        expect(clipPosture.maxForearmLiftDegrees).toBeLessThanOrEqual(15);
        expect(clipPosture.maxAllowedForearmLiftDegrees).toBeLessThanOrEqual(15);
        expect(clipPosture.maxHandLiftDegrees).toBeLessThanOrEqual(5);
        expect(clipPosture.maxAllowedHandLiftDegrees).toBeLessThanOrEqual(5);
      }
    }
  });

  it('exports a tighter normal runner shoulder and hand envelope for broadcast posture', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const minNormalArmDrop = Number(script.match(/MIN_NORMAL_UPPER_ARM_DROP_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalArmLift = Number(script.match(/MAX_NORMAL_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalArmSwing = Number(script.match(/MAX_NORMAL_UPPER_ARM_SWING_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalArmExposure = Number(script.match(/MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalForearmLift = Number(script.match(/MAX_NORMAL_FOREARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalHandLift = Number(script.match(/MAX_NORMAL_HAND_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(minNormalArmDrop).toBeLessThanOrEqual(maxNormalArmLift);
    expect(minNormalArmDrop).toBeLessThanOrEqual(14.4);
    expect(maxNormalArmLift).toBeLessThanOrEqual(14.4);
    expect(maxNormalArmSwing).toBeLessThanOrEqual(9.5);
    expect(maxNormalArmExposure).toBeLessThanOrEqual(14.4);
    expect(maxNormalForearmLift).toBeLessThanOrEqual(13.8);
    expect(maxNormalHandLift).toBeLessThanOrEqual(4.5);

    for (const target of runnerTargets) {
      const posture = target.normalMotionPosture;

      expect(posture.status).toBe('passed');
      expect(posture.minUpperArmDropDegrees).toBeGreaterThanOrEqual(posture.minRequiredUpperArmDropDegrees);
      expect(posture.minRequiredUpperArmDropDegrees).toBeLessThanOrEqual(14.4);
      expect(posture.maxUpperArmLiftDegrees).toBeLessThanOrEqual(14.4);
      expect(posture.maxAllowedUpperArmLiftDegrees).toBeLessThanOrEqual(14.4);
      expect(posture.maxUpperArmSwingDegrees).toBeLessThanOrEqual(9.5);
      expect(posture.maxAllowedUpperArmSwingDegrees).toBeLessThanOrEqual(9.5);
      expect(posture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(14.4);
      expect(posture.maxAllowedUpperArmExposureDegrees).toBeLessThanOrEqual(14.4);
      expect(posture.maxForearmLiftDegrees).toBeLessThanOrEqual(13.8);
      expect(posture.maxAllowedForearmLiftDegrees).toBeLessThanOrEqual(13.8);
      expect(posture.maxHandLiftDegrees).toBeLessThanOrEqual(4.5);
      expect(posture.maxAllowedHandLiftDegrees).toBeLessThanOrEqual(4.5);

      for (const clipPosture of posture.clipPostures) {
        expect(clipPosture.minUpperArmDropDegrees).toBeGreaterThanOrEqual(clipPosture.minRequiredUpperArmDropDegrees);
        expect(clipPosture.minRequiredUpperArmDropDegrees).toBeLessThanOrEqual(14.4);
        expect(clipPosture.maxUpperArmLiftDegrees).toBeLessThanOrEqual(14.4);
        expect(clipPosture.maxUpperArmSwingDegrees).toBeLessThanOrEqual(9.5);
        expect(clipPosture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(14.4);
        expect(clipPosture.maxForearmLiftDegrees).toBeLessThanOrEqual(13.8);
        expect(clipPosture.maxHandLiftDegrees).toBeLessThanOrEqual(4.5);
      }
    }
  });

  it('keeps the final-grade normal runner shoulder and lower-hand envelope tucked from broadcast distance', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const maxNormalArmLift = Number(script.match(/MAX_NORMAL_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalArmExposure = Number(script.match(/MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalForearmLift = Number(script.match(/MAX_NORMAL_FOREARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxNormalHandLift = Number(script.match(/MAX_NORMAL_HAND_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(maxNormalArmLift).toBeLessThanOrEqual(13.6);
    expect(maxNormalArmExposure).toBeLessThanOrEqual(13.6);
    expect(maxNormalForearmLift).toBeLessThanOrEqual(13.2);
    expect(maxNormalHandLift).toBeLessThanOrEqual(4.2);

    for (const target of runnerTargets) {
      const posture = target.normalMotionPosture;

      expect(posture.status).toBe('passed');
      expect(posture.maxUpperArmLiftDegrees).toBeLessThanOrEqual(13.6);
      expect(posture.maxAllowedUpperArmLiftDegrees).toBeLessThanOrEqual(13.6);
      expect(posture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(13.6);
      expect(posture.maxAllowedUpperArmExposureDegrees).toBeLessThanOrEqual(13.6);
      expect(posture.maxForearmLiftDegrees).toBeLessThanOrEqual(13.2);
      expect(posture.maxAllowedForearmLiftDegrees).toBeLessThanOrEqual(13.2);
      expect(posture.maxHandLiftDegrees).toBeLessThanOrEqual(4.2);
      expect(posture.maxAllowedHandLiftDegrees).toBeLessThanOrEqual(4.2);

      for (const clipPosture of posture.clipPostures) {
        expect(clipPosture.maxUpperArmLiftDegrees).toBeLessThanOrEqual(13.6);
        expect(clipPosture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(13.6);
        expect(clipPosture.maxForearmLiftDegrees).toBeLessThanOrEqual(13.2);
        expect(clipPosture.maxHandLiftDegrees).toBeLessThanOrEqual(4.2);
      }
    }
  });

  it('exports a lowered visual upper-arm rest pose instead of a broadcast T-pose silhouette', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const visualArmDrop = Number(script.match(/RUNNER_UPPER_ARM_VISUAL_DROP_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const visualArmTuck = Number(script.match(/RUNNER_UPPER_ARM_VISUAL_TUCK_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(visualArmDrop).toBeGreaterThanOrEqual(90);
    expect(visualArmDrop).toBeLessThanOrEqual(90);
    expect(visualArmTuck).toBeGreaterThanOrEqual(14);
    expect(visualArmTuck).toBeLessThanOrEqual(14);
    expect(script).toContain('x_value - RUNNER_UPPER_ARM_VISUAL_DROP_DEGREES');
    expect(script).toContain('RUNNER_UPPER_ARM_VISUAL_TUCK_DEGREES');

    for (const target of runnerTargets) {
      expect(target.normalMotionPosture.visualUpperArmRestDropDegrees).toBe(visualArmDrop);
      expect(target.normalMotionPosture.visualUpperArmRestDropDegrees).toBeGreaterThanOrEqual(90);
      expect(target.normalMotionPosture.visualUpperArmTuckDegrees).toBe(visualArmTuck);
      expect(target.normalMotionPosture.visualUpperArmTuckDegrees).toBeGreaterThanOrEqual(14);
    }
  });

  it('keeps the final-grade visual rest pose compact enough to avoid wide imported arms', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const visualArmDrop = Number(script.match(/RUNNER_UPPER_ARM_VISUAL_DROP_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const visualArmTuck = Number(script.match(/RUNNER_UPPER_ARM_VISUAL_TUCK_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(visualArmDrop).toBeGreaterThanOrEqual(90);
    expect(visualArmDrop).toBeLessThanOrEqual(90);
    expect(visualArmTuck).toBeGreaterThanOrEqual(14);
    expect(visualArmTuck).toBeLessThanOrEqual(14);

    for (const target of runnerTargets) {
      expect(target.normalMotionPosture.visualUpperArmRestDropDegrees).toBeGreaterThanOrEqual(90);
      expect(target.normalMotionPosture.visualUpperArmTuckDegrees).toBeGreaterThanOrEqual(14);
      expect(target.normalMotionPosture.status).toBe('passed');
    }
  });

  it('preserves enough vertical root bounce for athletic jog and sprint retargets', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const rootVerticalScale = Number(script.match(/ROOT_VERTICAL_RETARGET_SCALE\s*=\s*([0-9.]+)/)?.[1]);
    const locomotionRootVerticalScale = Number(
      script.match(/LOCOMOTION_ROOT_VERTICAL_RETARGET_SCALE\s*=\s*([0-9.]+)/)?.[1],
    );

    expect(rootVerticalScale).toBeGreaterThanOrEqual(0.13);
    expect(locomotionRootVerticalScale).toBeGreaterThanOrEqual(0.16);
    expect(script).toContain('root_vertical_retarget_scale_for_clip');
    expect(script).toContain('"retargetedRootVerticalBounceUnits"');
    expect(script).toContain('"minimumRetargetedRootVerticalBounceUnits"');
    expect(script).toContain('"retargetedStickHandRangeDegrees"');
    expect(script).toContain('"minimumRetargetedStickHandRangeDegrees"');
    expect(script).toContain('"retargetedStickActionTwoHandBalanceRatio"');
    expect(script).toContain('"minimumRetargetedStickActionTwoHandBalanceRatio"');
    expect(script).toContain('"retargetedStickActionTwoHandSyncRatio"');
    expect(script).toContain('"minimumRetargetedStickActionTwoHandSyncRatio"');
    expect(script).toContain('"retargetedStickActionTwoHandContactRatio"');
    expect(script).toContain('"minimumRetargetedStickActionTwoHandContactRatio"');
    expect(script).toContain('"retargetedStickActionRecoveryRatio"');
    expect(script).toContain('"minimumRetargetedStickActionRecoveryRatio"');
    expect(script).toContain('"retargetedStickActionPhaseChanges"');
    expect(script).toContain('"minimumRetargetedStickActionPhaseChanges"');
    expect(script).toContain('"retargetedStickActionBeatSpanRatio"');
    expect(script).toContain('"minimumRetargetedStickActionBeatSpanRatio"');
    expect(script).toContain('"retargetedStickActionReleasePeakRatio"');
    expect(script).toContain('"minimumRetargetedStickActionReleasePeakRatio"');
    expect(script).toContain('"maximumRetargetedStickActionReleasePeakRatio"');
    expect(script).toContain('"retargetedStickActionSupportedReleaseRatio"');
    expect(script).toContain('"minimumRetargetedStickActionSupportedReleaseRatio"');
    expect(script).toContain('calculate_retargeted_stick_hand_range');
    expect(script).toContain('calculate_retargeted_stick_action_two_hand_balance_ratio');
    expect(script).toContain('calculate_retargeted_stick_action_two_hand_sync_ratio');
    expect(script).toContain('calculate_retargeted_stick_action_two_hand_contact_ratio');
  });

  it('keeps exported jog and sprint root bounce high enough to avoid floor-glide reads', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const jogClip = target.motionSourceClips.find((clip) => clip.clipName === 'jog-forward');
      const sprintClip = target.motionSourceClips.find((clip) => clip.clipName === 'sprint-forward');

      expect(jogClip).toBeTruthy();
      expect(sprintClip).toBeTruthy();
      expect(jogClip.minimumRetargetedRootVerticalBounceUnits).toBeGreaterThanOrEqual(0.05);
      expect(jogClip.retargetedRootVerticalBounceUnits).toBeGreaterThanOrEqual(0.06);
      expect(sprintClip.minimumRetargetedRootVerticalBounceUnits).toBeGreaterThanOrEqual(0.08);
      expect(sprintClip.retargetedRootVerticalBounceUnits).toBeGreaterThanOrEqual(0.09);
    }
  });

  it('preserves lower-body drive after retargeting so runner clips do not collapse into floor glide', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const jogLegDriveScale = Number(script.match(/"jog-forward":\s*([0-9.]+)/)?.[1]);
    const sprintLegDriveScale = Number(script.match(/"sprint-forward":\s*([0-9.]+)/)?.[1]);

    expect(jogLegDriveScale).toBeGreaterThanOrEqual(1.12);
    expect(sprintLegDriveScale).toBeGreaterThanOrEqual(1.16);
    expect(script).toContain('"retargetedLegDriveRangeDegrees"');
    expect(script).toContain('"minimumRetargetedLegDriveRangeDegrees"');
    expect(script).toContain('"retargetedLocomotionStrideBalanceRatio"');
    expect(script).toContain('"minimumRetargetedLocomotionStrideBalanceRatio"');
    expect(script).toContain('calculate_retargeted_leg_drive_range');
    expect(script).toContain('calculate_retargeted_locomotion_stride_balance_ratio');
  });

  it('exports retargeted foot-plant stability evidence for runner locomotion', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const ankleDriveScale = Number(script.match(/FOOT_PLANT_ANKLE_DRIVE_RETARGET_SCALE\s*=\s*([0-9.]+)/)?.[1]);

    expect(ankleDriveScale).toBeGreaterThanOrEqual(0.28);
    expect(script).toContain('"retargetedFootPlantStabilityRatio"');
    expect(script).toContain('"minimumRetargetedFootPlantStabilityRatio"');
    expect(script).toContain('"retargetedFootPlantContactFrameCount"');
    expect(script).toContain('"minimumRetargetedFootPlantContactFrames"');
    expect(script).toContain('"retargetedFootPlantSideCount"');
    expect(script).toContain('"minimumRetargetedFootPlantSideCount"');
    expect(script).toContain('"retargetedFootPlantBalanceRatio"');
    expect(script).toContain('"minimumRetargetedFootPlantBalanceRatio"');
    expect(script).toContain('"retargetedFootPlantMinSideHoldFrames"');
    expect(script).toContain('"minimumRetargetedFootPlantHoldFramesPerSide"');
    expect(script).toContain('"retargetedFootPlantMaxSlideUnits"');
    expect(script).toContain('"maximumRetargetedFootPlantMaxSlideUnits"');
    expect(script).toContain('"retargetedFootPlantStrideCoverageRatio"');
    expect(script).toContain('"minimumRetargetedFootPlantStrideCoverageRatio"');
    expect(script).toContain('"retargetedFootPlantGroundedRatio"');
    expect(script).toContain('"minimumRetargetedFootPlantGroundedRatio"');
    expect(script).toContain('calculate_retargeted_foot_plant_stability_ratio');
    expect(script).toContain('calculate_retargeted_foot_plant_metrics');
    expect(script).toContain('minimum_retargeted_foot_plant_stability_ratio');
    expect(script).toContain('minimum_retargeted_foot_plant_stride_coverage_ratio');
    expect(script).toContain('minimum_retargeted_foot_plant_grounded_ratio');
    expect(script).toContain('maximum_retargeted_foot_plant_slide_units');
  });

  it('preserves planted forward-drive timing after jog and sprint retargeting', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(script).toContain('"retargetedLocomotionFootPlantDriveRatio"');
    expect(script).toContain('"minimumRetargetedLocomotionFootPlantDriveRatio"');
    expect(script).toContain('calculate_retargeted_locomotion_foot_plant_drive_ratio');
    expect(script).toContain('minimum_retargeted_locomotion_foot_plant_drive_ratio');

    for (const target of runnerTargets) {
      for (const clipName of ['jog-forward', 'sprint-forward']) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.minimumRetargetedLocomotionFootPlantDriveRatio).toBeGreaterThanOrEqual(0.7);
        expect(clip.retargetedLocomotionFootPlantDriveRatio).toBeGreaterThanOrEqual(0.7);
      }
    }
  });

  it('preserves planted-foot stability for retargeted receive, pass, and shot actions', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const plantedStickActionClips = ['forehand-pass', 'receive-pass', 'wrist-shot'];

    for (const target of runnerTargets) {
      for (const clipName of plantedStickActionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.minimumRetargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.5);
        expect(clip.retargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.5);
        expect(clip.minimumRetargetedFootPlantContactFrames).toBeGreaterThanOrEqual(8);
        expect(clip.retargetedFootPlantContactFrameCount).toBeGreaterThanOrEqual(8);
        expect(clip.minimumRetargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.5);
        expect(clip.retargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.5);
      }
    }
  });

  it('exports wrist-shot retargets with more than minimum planted-foot support', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const shotClip = target.motionSourceClips.find((clip) => clip.clipName === 'wrist-shot');

      expect(shotClip).toBeTruthy();
      expect(shotClip.minimumRetargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.56);
      expect(shotClip.retargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.56);
      expect(shotClip.minimumRetargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.56);
      expect(shotClip.retargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.56);
    }
  });

  it('exports contralateral arm and leg timing evidence for runner locomotion', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('"retargetedLocomotionContralateralSyncRatio"');
    expect(script).toContain('"minimumRetargetedLocomotionContralateralSyncRatio"');
    expect(script).toContain('calculate_retargeted_locomotion_contralateral_sync_ratio');
    expect(script).toContain('minimum_retargeted_locomotion_contralateral_sync_ratio');
  });

  it('keeps sprint gait athletic while normal shoulder carriage stays compact', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(script).toContain('def thigh_pitch_limits_for_clip');
    expect(script).toContain('if clip_name == "sprint-forward":');
    expect(script).toContain('return -44, 52');

    for (const target of runnerTargets) {
      const sprintClip = target.motionSourceClips.find((clip) => clip.clipName === 'sprint-forward');

      expect(sprintClip).toBeTruthy();
      expect(sprintClip.retargetedLocomotionArmSwingRangeDegrees).toBeGreaterThanOrEqual(
        sprintClip.minimumRetargetedLocomotionArmSwingRangeDegrees,
      );
      expect(sprintClip.minimumRetargetedLocomotionArmSwingRangeDegrees).toBeGreaterThanOrEqual(38);
      expect(sprintClip.retargetedLocomotionArmSwingRangeDegrees).toBeGreaterThanOrEqual(38);
      expect(sprintClip.retargetedLegDriveRangeDegrees).toBeGreaterThanOrEqual(300);
      expect(sprintClip.retargetedTorsoFollowThroughDegrees).toBeGreaterThanOrEqual(48);
      expect(sprintClip.retargetedHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(17.8);
      expect(sprintClip.retargetedAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(16);
      expect(target.normalMotionPosture.maxUpperArmSwingDegrees).toBeLessThanOrEqual(9.5);
      expect(target.normalMotionPosture.maxUpperArmLateralDegrees).toBeLessThanOrEqual(0.25);
      expect(target.normalMotionPosture.maxUpperArmExposureDegrees).toBeLessThanOrEqual(20);
    }
  });

  it('preserves source-driven forearm and hand mechanics for stick-action clips', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const forearmScale = Number(script.match(/STICK_ACTION_FOREARM_SOURCE_SCALE\s*=\s*([0-9.]+)/)?.[1]);
    const handScale = Number(script.match(/STICK_ACTION_HAND_SOURCE_SCALE\s*=\s*([0-9.]+)/)?.[1]);
    const maxStickActionForearmLift = Number(script.match(/MAX_STICK_ACTION_FOREARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxStickActionHandLift = Number(script.match(/MAX_STICK_ACTION_HAND_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(forearmScale).toBeGreaterThanOrEqual(0.58);
    expect(handScale).toBeGreaterThanOrEqual(0.3);
    expect(maxStickActionForearmLift).toBeLessThanOrEqual(32);
    expect(maxStickActionHandLift).toBeLessThanOrEqual(14);
  });

  it('keeps active stick-action shoulders compact enough for broadcast posture', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxCompactLift = Number(script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxCompactLateral = Number(script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxCompactSwing = Number(script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_SWING_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxCompactExposure = Number(script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxShotLift = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxShotLateral = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxShotSwing = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_SWING_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxShotExposure = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(maxCompactLift).toBeLessThanOrEqual(25);
    expect(maxCompactLateral).toBeLessThanOrEqual(11);
    expect(maxCompactSwing).toBeLessThanOrEqual(24);
    expect(maxCompactExposure).toBeLessThanOrEqual(24.05);
    expect(maxShotLift).toBeLessThanOrEqual(30);
    expect(maxShotLateral).toBeLessThanOrEqual(17);
    expect(maxShotSwing).toBeLessThanOrEqual(28);
    expect(maxShotExposure).toBeLessThanOrEqual(32);

    for (const target of runnerTargets) {
      for (const clipName of ['stick-handle', 'forehand-pass', 'receive-pass']) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(25);
        expect(clip.maximumRetargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(25);
        expect(clip.retargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(11);
        expect(clip.maximumRetargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(11);
        expect(clip.retargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(24);
        expect(clip.maximumRetargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(24);
        expect(clip.retargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(24.05);
        expect(clip.maximumRetargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(24.05);
      }

      const shotClip = target.motionSourceClips.find((clip) => clip.clipName === 'wrist-shot');
      expect(shotClip).toBeTruthy();
      expect(shotClip.retargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(30);
      expect(shotClip.maximumRetargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(30);
      expect(shotClip.retargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(17);
      expect(shotClip.maximumRetargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(17);
      expect(shotClip.retargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(28);
      expect(shotClip.maximumRetargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(28);
      expect(shotClip.retargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(32);
      expect(shotClip.maximumRetargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(32);
    }
  });

  it('keeps compact carry, pass, and receive upper arms under the tighter broadcast shoulder line', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxCompactLift = Number(script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const compactActionFloors = new Map([
      ['stick-handle', { contact: 21, beat: 0.6, grounded: 0.9 }],
      ['forehand-pass', { contact: 20, beat: 0.75, grounded: 0.94 }],
      ['receive-pass', { contact: 20, beat: 0.7, grounded: 0.86 }],
    ]);

    expect(maxCompactLift).toBeLessThanOrEqual(22.25);

    for (const target of runnerTargets) {
      for (const [clipName, floors] of compactActionFloors) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(22.25);
        expect(clip.maximumRetargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(22.25);
        expect(clip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(floors.contact);
        expect(clip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(floors.beat);
        expect(clip.retargetedFootPlantGroundedRatio).toBeGreaterThanOrEqual(floors.grounded);
      }
    }
  });

  it('keeps compact carry, pass, and receive upper arms from flaring laterally at broadcast distance', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxCompactLateral = Number(
      script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES\s*=\s*([0-9.]+)/)?.[1],
    );
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const compactActionFloors = new Map([
      ['stick-handle', { contact: 21, beat: 0.6, grounded: 0.9 }],
      ['forehand-pass', { contact: 20, beat: 0.75, grounded: 0.94 }],
      ['receive-pass', { contact: 20, beat: 0.7, grounded: 0.86 }],
    ]);

    expect(maxCompactLateral).toBeLessThanOrEqual(9.75);

    for (const target of runnerTargets) {
      for (const [clipName, floors] of compactActionFloors) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(9.75);
        expect(clip.maximumRetargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(9.75);
        expect(clip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(floors.contact);
        expect(clip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(floors.beat);
        expect(clip.retargetedFootPlantGroundedRatio).toBeGreaterThanOrEqual(floors.grounded);
      }
    }
  });

  it('keeps compact carry, pass, and receive upper-arm swing under the tighter broadcast shoulder line', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxCompactSwing = Number(
      script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_SWING_DEGREES\s*=\s*([0-9.]+)/)?.[1],
    );
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const compactActionFloors = new Map([
      ['stick-handle', { contact: 21, beat: 0.6, grounded: 0.9 }],
      ['forehand-pass', { contact: 20, beat: 0.75, grounded: 0.94 }],
      ['receive-pass', { contact: 20, beat: 0.7, grounded: 0.86 }],
    ]);

    expect(maxCompactSwing).toBeLessThanOrEqual(22.4);

    for (const target of runnerTargets) {
      for (const [clipName, floors] of compactActionFloors) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(22.4);
        expect(clip.maximumRetargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(22.4);
        expect(clip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(floors.contact);
        expect(clip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(floors.beat);
        expect(clip.retargetedFootPlantGroundedRatio).toBeGreaterThanOrEqual(floors.grounded);
      }
    }
  });

  it('keeps compact carry, pass, and receive combined shoulder exposure under the tighter broadcast line', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxCompactExposure = Number(
      script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1],
    );
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const compactActionFloors = new Map([
      ['stick-handle', { contact: 21, beat: 0.6, grounded: 0.9 }],
      ['forehand-pass', { contact: 20, beat: 0.75, grounded: 0.94 }],
      ['receive-pass', { contact: 20, beat: 0.7, grounded: 0.86 }],
    ]);

    expect(maxCompactExposure).toBeLessThanOrEqual(24.05);

    for (const target of runnerTargets) {
      for (const [clipName, floors] of compactActionFloors) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(24.05);
        expect(clip.maximumRetargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(24.05);
        expect(clip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(floors.contact);
        expect(clip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(floors.beat);
        expect(clip.retargetedFootPlantGroundedRatio).toBeGreaterThanOrEqual(floors.grounded);
      }
    }
  });

  it('keeps the final-grade wrist-shot shoulder exposure below the wide-arm threshold', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxShotExposure = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(maxShotExposure).toBeLessThanOrEqual(29.75);

    for (const target of runnerTargets) {
      const shotClip = target.motionSourceClips.find((clip) => clip.clipName === 'wrist-shot');

      expect(shotClip).toBeTruthy();
      expect(shotClip.maximumRetargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(29.75);
      expect(shotClip.retargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(29.75);
      expect(shotClip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(20);
      expect(shotClip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('keeps the final-grade wrist-shot upper arm from flaring too far laterally', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxShotLateral = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(maxShotLateral).toBeLessThanOrEqual(15.4);

    for (const target of runnerTargets) {
      const shotClip = target.motionSourceClips.find((clip) => clip.clipName === 'wrist-shot');

      expect(shotClip).toBeTruthy();
      expect(shotClip.maximumRetargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(15.4);
      expect(shotClip.retargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(15.4);
      expect(shotClip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(20);
      expect(shotClip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.8);
      expect(shotClip.retargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(8);
      expect(shotClip.retargetedMaxFrameRotationAccelerationDegrees).toBeLessThanOrEqual(
        shotClip.maximumRetargetedFrameRotationAccelerationDegrees,
      );
    }
  });

  it('keeps the retargeted carry clip wide enough for visible two-hand stick control', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const carryClip = target.motionSourceClips.find((clip) => clip.clipName === 'stick-handle');

      expect(carryClip).toBeTruthy();
      expect(carryClip.retargetedStickHandRangeDegrees).toBeGreaterThanOrEqual(20);
      expect(carryClip.retargetedStickActionTwoHandSyncRatio).toBeGreaterThanOrEqual(0.9);
      expect(carryClip.retargetedStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('keeps the retargeted carry clip in sustained two-hand contact through the control window', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const carryClip = target.motionSourceClips.find((clip) => clip.clipName === 'stick-handle');

      expect(carryClip).toBeTruthy();
      expect(carryClip.minimumRetargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(21);
      expect(carryClip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(
        carryClip.minimumRetargetedStickActionTwoHandContactFrameCount,
      );
    }
  });

  it('keeps the retargeted carry beat sequence after compact shoulder clamping', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const carryClip = target.motionSourceClips.find((clip) => clip.clipName === 'stick-handle');

      expect(carryClip).toBeTruthy();
      expect(carryClip.retargetedStickActionPhaseChanges).toBeGreaterThanOrEqual(
        carryClip.minimumRetargetedStickActionPhaseChanges,
      );
      expect(carryClip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(
        carryClip.minimumRetargetedStickActionBeatSpanRatio,
      );
      expect(carryClip.retargetedStickActionReleasePeakRatio).toBeGreaterThanOrEqual(
        carryClip.minimumRetargetedStickActionReleasePeakRatio,
      );
      expect(carryClip.retargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(
        carryClip.minimumRetargetedStickActionLowerBodyLeadFrames,
      );
    }
  });

  it('keeps the retargeted carry beat sequence spread across the control window', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('STICK_HANDLE_MIN_RETARGETED_BEAT_SPAN_RATIO = 0.4');

    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const carryClip = target.motionSourceClips.find((clip) => clip.clipName === 'stick-handle');

      expect(carryClip).toBeTruthy();
      expect(carryClip.minimumRetargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.4);
      expect(carryClip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.4);
    }
  });

  it('keeps the stick-handle retarget below its broadcast snap threshold', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const carryClip = target.motionSourceClips.find((clip) => clip.clipName === 'stick-handle');

      expect(carryClip).toBeTruthy();
      expect(carryClip.retargetedMaxFrameRotationAccelerationDegrees).toBeLessThanOrEqual(
        carryClip.maximumRetargetedFrameRotationAccelerationDegrees,
      );
    }
  });

  it('keeps pass, receive, and shot retargets in two-hand contact through catch and release windows', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const actionExpectations = [
      ['forehand-pass', 0.75, 24, 20],
      ['receive-pass', 0.75, 14, 20],
      ['wrist-shot', 0.75, 36, 21],
    ];

    for (const target of runnerTargets) {
      for (const [clipName, minimumContactRatio, minimumHandRange, minimumContactFrames = 12] of actionExpectations) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(minimumContactRatio);
        expect(clip.retargetedStickHandRangeDegrees).toBeGreaterThanOrEqual(minimumHandRange);
        expect(clip.retargetedStickActionTwoHandContactFrameIndices.length).toBeGreaterThanOrEqual(minimumContactFrames);
      }
    }
  });

  it('exports a sustained retargeted two-hand contact frame floor for pass, receive, and shot actions', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const sustainedTwoHandActionClips = ['forehand-pass', 'receive-pass', 'wrist-shot'];

    for (const target of runnerTargets) {
      for (const clipName of sustainedTwoHandActionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        const contactFloor = clipName === 'wrist-shot' ? 21 : 20;

        expect(clip.minimumRetargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(contactFloor);
        expect(clip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(
          clip.minimumRetargetedStickActionTwoHandContactFrameCount,
        );
        expect(clip.retargetedStickActionTwoHandContactFrameIndices.length).toBe(
          clip.retargetedStickActionTwoHandContactFrameCount,
        );
      }
    }
  });

  it('keeps the wrist-shot retarget in sustained two-hand contact through release', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const shotClip = target.motionSourceClips.find((clip) => clip.clipName === 'wrist-shot');

      expect(shotClip).toBeTruthy();
      expect(shotClip.minimumRetargetedStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);
      expect(shotClip.retargetedStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);
      expect(shotClip.minimumRetargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(21);
      expect(shotClip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(21);
      expect(shotClip.retargetedStickActionTwoHandContactFrameIndices.length).toBeGreaterThanOrEqual(21);
      expect(shotClip.retargetedStickActionTwoHandSyncRatio).toBeGreaterThanOrEqual(0.78);
      expect(shotClip.retargetedStickActionSupportedReleaseRatio).toBe(1);
      expect(shotClip.retargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(8);
    }
  });

  it('keeps the forehand-pass retarget in two-hand contact through a longer release window', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const passClip = target.motionSourceClips.find((clip) => clip.clipName === 'forehand-pass');

      expect(passClip).toBeTruthy();
      expect(passClip.retargetedStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);
      expect(passClip.retargetedStickActionTwoHandContactFrameIndices.length).toBeGreaterThanOrEqual(20);
      expect(passClip.retargetedStickActionTwoHandSyncRatio).toBeGreaterThanOrEqual(0.75);
      expect(passClip.retargetedStickActionSupportedReleaseRatio).toBe(1);
      expect(passClip.retargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(8);
    }
  });

  it('keeps the forehand-pass retarget release beats spread across the two-hand action window', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const passClip = target.motionSourceClips.find((clip) => clip.clipName === 'forehand-pass');

      expect(passClip).toBeTruthy();
      expect(passClip.retargetedStickActionTwoHandBalanceRatio).toBeGreaterThanOrEqual(0.75);
      expect(passClip.retargetedStickActionTwoHandSyncRatio).toBeGreaterThanOrEqual(0.75);
      expect(passClip.retargetedStickActionTwoHandContactFrameIndices.length).toBeGreaterThanOrEqual(20);
      expect(passClip.retargetedStickActionPhaseChanges).toBeGreaterThanOrEqual(5);
      expect(passClip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.7);
      expect(passClip.retargetedStickActionSupportedReleaseRatio).toBe(1);
    }
  });

  it('keeps the forehand-pass retarget grounded through a stronger planted support window', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const passClip = target.motionSourceClips.find((clip) => clip.clipName === 'forehand-pass');

      expect(passClip).toBeTruthy();
      expect(passClip.minimumRetargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.56);
      expect(passClip.retargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.56);
      expect(passClip.minimumRetargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.56);
      expect(passClip.retargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.56);
    }
  });

  it('keeps the wrist-shot retarget synchronized through its two-hand release window', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const shotClip = target.motionSourceClips.find((clip) => clip.clipName === 'wrist-shot');

      expect(shotClip).toBeTruthy();
      expect(shotClip.retargetedStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);
      expect(shotClip.retargetedStickActionTwoHandContactFrameIndices.length).toBeGreaterThanOrEqual(21);
      expect(shotClip.retargetedStickActionTwoHandSyncRatio).toBeGreaterThanOrEqual(0.75);
      expect(shotClip.retargetedStickActionSupportedReleaseRatio).toBe(1);
      expect(shotClip.retargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(8);
    }
  });

  it('keeps the wrist-shot retarget release smooth enough to avoid a broadcast-visible snap', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const shotClip = target.motionSourceClips.find((clip) => clip.clipName === 'wrist-shot');

      expect(shotClip).toBeTruthy();
      expect(shotClip.maximumRetargetedFrameRotationAccelerationDegrees).toBeLessThanOrEqual(31);
      expect(shotClip.retargetedMaxFrameRotationAccelerationDegrees).toBeLessThanOrEqual(31);
    }
  });

  it('keeps the sprint retarget smooth enough to avoid a broadcast-visible running snap', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const sprintClip = target.motionSourceClips.find((clip) => clip.clipName === 'sprint-forward');

      expect(sprintClip).toBeTruthy();
      expect(sprintClip.maximumRetargetedFrameRotationAccelerationDegrees).toBeLessThanOrEqual(14.6);
      expect(sprintClip.retargetedMaxFrameRotationAccelerationDegrees).toBeLessThanOrEqual(14.6);
    }
  });

  it('keeps the jog retarget smooth enough to avoid a broadcast-visible running snap', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const jogClip = target.motionSourceClips.find((clip) => clip.clipName === 'jog-forward');

      expect(jogClip).toBeTruthy();
      expect(jogClip.maximumRetargetedFrameRotationAccelerationDegrees).toBeLessThanOrEqual(8.2);
      expect(jogClip.retargetedMaxFrameRotationAccelerationDegrees).toBeLessThanOrEqual(8.2);
    }
  });

  it('keeps the receive-pass retarget broad enough to read as a controlled two-hand catch', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const receiveClip = target.motionSourceClips.find((clip) => clip.clipName === 'receive-pass');

      expect(receiveClip).toBeTruthy();
      expect(receiveClip.retargetedStickHandRangeDegrees).toBeGreaterThanOrEqual(18);
      expect(receiveClip.retargetedStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);
      expect(receiveClip.retargetedStickActionTwoHandContactFrameIndices.length).toBeGreaterThanOrEqual(18);
      expect(receiveClip.minimumRetargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(6);
      expect(receiveClip.retargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(6);
    }
  });

  it('keeps receive-pass planted-drive retargets smooth enough to avoid a catch snap', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(script).toContain('"receive-pass": 24.8');
    expect(script).toContain('RECEIVE_PASS_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES = 6');

    for (const target of runnerTargets) {
      const receiveClip = target.motionSourceClips.find((clip) => clip.clipName === 'receive-pass');

      expect(receiveClip).toBeTruthy();
      expect(receiveClip.minimumRetargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(6);
      expect(receiveClip.retargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(6);
      expect(receiveClip.retargetedLocomotionFootPlantDriveRatio).toBeGreaterThanOrEqual(0.9);
      expect(receiveClip.retargetedMaxFrameRotationAccelerationDegrees).toBeLessThanOrEqual(
        receiveClip.maximumRetargetedFrameRotationAccelerationDegrees,
      );
    }
  });

  it('preserves source-driven trunk mechanics after Blender retarget export', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const hipTwistScale = Number(script.match(/HIP_TWIST_RETARGET_SCALE\s*=\s*([0-9.]+)/)?.[1]);
    const spineTwistScale = Number(script.match(/SPINE_TWIST_RETARGET_SCALE\s*=\s*([0-9.]+)/)?.[1]);
    const hipShoulderMinimumFunction = script.match(
      /def minimum_retargeted_hip_shoulder_separation\(quality_profile\):[\s\S]+?def minimum_retargeted_athletic_torso_lean/,
    )?.[0] ?? '';
    const hipShoulderMinimumScale = Number(
      hipShoulderMinimumFunction.match(/return round_metric\(source_minimum \* ([0-9.]+)\)/)?.[1],
    );

    expect(script).toContain('"retargetedTorsoFollowThroughDegrees"');
    expect(script).toContain('"minimumRetargetedTorsoFollowThroughDegrees"');
    expect(script).toContain('"retargetedHipShoulderSeparationDegrees"');
    expect(script).toContain('"minimumRetargetedHipShoulderSeparationDegrees"');
    expect(script).toContain('"retargetedAthleticTorsoLeanDegrees"');
    expect(script).toContain('"minimumRetargetedAthleticTorsoLeanDegrees"');
    expect(script).toContain('minimum_retargeted_torso_follow_through_range');
    expect(script).toContain('minimum_retargeted_hip_shoulder_separation');
    expect(script).toContain('minimum_retargeted_athletic_torso_lean');
    expect(script).toContain('LOCOMOTION_TRUNK_COUNTER_ROTATION_RETARGET_SCALE');
    expect(script).toContain('calculate_locomotion_counter_rotation_drive');
    expect(hipTwistScale).toBeLessThanOrEqual(0.25);
    expect(spineTwistScale).toBeGreaterThanOrEqual(1);
    expect(hipShoulderMinimumScale).toBeGreaterThanOrEqual(1);
  });

  it('keeps jog and sprint retarget counter-rotation at the source-quality floor', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const jogClip = target.motionSourceClips.find((clip) => clip.clipName === 'jog-forward');
      const sprintClip = target.motionSourceClips.find((clip) => clip.clipName === 'sprint-forward');

      expect(jogClip).toBeTruthy();
      expect(sprintClip).toBeTruthy();
      expect(jogClip.minimumRetargetedHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(8);
      expect(sprintClip.minimumRetargetedHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(8);
      expect(jogClip.retargetedHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(
        jogClip.minimumRetargetedHipShoulderSeparationDegrees,
      );
      expect(sprintClip.retargetedHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(
        sprintClip.minimumRetargetedHipShoulderSeparationDegrees,
      );
    }
  });

  it('exports stronger jog and sprint trunk counter-rotation for athletic broadcast motion', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const counterRotationScale = Number(script.match(/LOCOMOTION_TRUNK_COUNTER_ROTATION_RETARGET_SCALE\s*=\s*([0-9.]+)/)?.[1]);
    const counterRotationMax = Number(script.match(/LOCOMOTION_TRUNK_COUNTER_ROTATION_MAX_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(counterRotationScale).toBeGreaterThanOrEqual(0.064);
    expect(counterRotationMax).toBeGreaterThanOrEqual(6.2);

    for (const target of runnerTargets) {
      const jogClip = target.motionSourceClips.find((clip) => clip.clipName === 'jog-forward');
      const sprintClip = target.motionSourceClips.find((clip) => clip.clipName === 'sprint-forward');

      expect(jogClip).toBeTruthy();
      expect(sprintClip).toBeTruthy();
      expect(jogClip.retargetedHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(13.6);
      expect(sprintClip.retargetedHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(15.4);
    }
  });

  it('keeps jog and sprint retargets in a forward athletic torso posture', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const jogClip = target.motionSourceClips.find((clip) => clip.clipName === 'jog-forward');
      const sprintClip = target.motionSourceClips.find((clip) => clip.clipName === 'sprint-forward');

      expect(jogClip).toBeTruthy();
      expect(sprintClip).toBeTruthy();
      expect(jogClip.retargetedAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(11.0);
      expect(sprintClip.retargetedAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(14.4);
    }
  });

  it('exports stronger capture-like torso drive for jog and sprint retargets', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const counterRotationScale = Number(script.match(/LOCOMOTION_TRUNK_COUNTER_ROTATION_RETARGET_SCALE\s*=\s*([0-9.]+)/)?.[1]);
    const counterRotationMax = Number(script.match(/LOCOMOTION_TRUNK_COUNTER_ROTATION_MAX_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(counterRotationScale).toBeGreaterThanOrEqual(0.076);
    expect(counterRotationMax).toBeGreaterThanOrEqual(7.2);

    for (const target of runnerTargets) {
      const jogClip = target.motionSourceClips.find((clip) => clip.clipName === 'jog-forward');
      const sprintClip = target.motionSourceClips.find((clip) => clip.clipName === 'sprint-forward');

      expect(jogClip).toBeTruthy();
      expect(sprintClip).toBeTruthy();
      expect(jogClip.retargetedTorsoFollowThroughDegrees).toBeGreaterThanOrEqual(43);
      expect(sprintClip.retargetedTorsoFollowThroughDegrees).toBeGreaterThanOrEqual(48);
      expect(jogClip.retargetedHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(15.8);
      expect(sprintClip.retargetedHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(17.8);
      expect(jogClip.retargetedAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(12.2);
      expect(sprintClip.retargetedAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(16.0);
      expect(target.normalMotionPosture.status).toBe('passed');
    }
  });

  it('exports retargeted ready-stance leg-load evidence for athletic idle posture', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('"retargetedReadyStanceLegLoadDegrees"');
    expect(script).toContain('"minimumRetargetedReadyStanceLegLoadDegrees"');
    expect(script).toContain('calculate_retargeted_ready_stance_leg_load');
    expect(script).toContain('minimum_retargeted_ready_stance_leg_load');
  });

  it('keeps the ready-stance retarget long enough to read as authored athletic set posture', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const readyClip = target.motionSourceClips.find((clip) => clip.clipName === 'idle-ready');

      expect(readyClip).toBeTruthy();
      expect(readyClip.sourceFrameCount).toBeGreaterThanOrEqual(24);
      expect(readyClip.retargetedFrameCount).toBeGreaterThanOrEqual(24);
      expect(readyClip.sourceDurationSeconds).toBeGreaterThanOrEqual(0.75);
      expect(readyClip.retargetedDurationSeconds).toBeGreaterThanOrEqual(0.75);
      expect(readyClip.retargetedReadyStanceLegLoadDegrees).toBeGreaterThanOrEqual(28);
      expect(readyClip.minimumRetargetedAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(9.5);
      expect(readyClip.retargetedAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(9.5);
      expect(readyClip.retargetedStickActionTwoHandContactFrameIndices.length).toBeGreaterThanOrEqual(18);
    }
  });

  it('exports planted two-foot ready stance evidence after retargeting', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(script).toContain('calculate_retargeted_ready_stance_foot_plant_metrics');

    for (const target of runnerTargets) {
      const readyClip = target.motionSourceClips.find((clip) => clip.clipName === 'idle-ready');

      expect(readyClip).toBeTruthy();
      expect(readyClip.minimumRetargetedFootPlantContactFrames).toBeGreaterThanOrEqual(4);
      expect(readyClip.retargetedFootPlantContactFrameCount).toBeGreaterThanOrEqual(4);
      expect(readyClip.minimumRetargetedFootPlantSideCount).toBe(2);
      expect(readyClip.retargetedFootPlantSideCount).toBe(2);
      expect(readyClip.minimumRetargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.8);
      expect(readyClip.retargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.8);
      expect(readyClip.minimumRetargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.8);
      expect(readyClip.retargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.8);
      expect(readyClip.minimumRetargetedFootPlantGroundedRatio).toBeGreaterThanOrEqual(0.8);
      expect(readyClip.retargetedFootPlantGroundedRatio).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('preserves lower-body lead timing for retargeted stick actions', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('"retargetedStickActionLowerBodyLeadFrames"');
    expect(script).toContain('"minimumRetargetedStickActionLowerBodyLeadFrames"');
    expect(script).toContain('calculate_retargeted_stick_action_lower_body_lead_frames');
    expect(script).toContain('minimum_retargeted_stick_action_lower_body_lead_frames');
  });

  it('requires pass and shot retargets to preserve leg-before-stick timing', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const actionLeadFloors = [
      ['forehand-pass', 8],
      ['wrist-shot', 8],
    ];

    expect(script).toContain('PASS_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES = 8');
    expect(script).toContain('SHOT_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES = 8');
    expect(script).toContain('reinforce_wrist_shot_retargeted_lower_body_lead');

    for (const target of runnerTargets) {
      for (const [clipName, minimumLeadFrames] of actionLeadFloors) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.minimumRetargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(minimumLeadFrames);
        expect(clip.retargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(
          clip.minimumRetargetedStickActionLowerBodyLeadFrames,
        );
      }
    }
  });

  it('requires the carry retarget to preserve a leg-before-stick control beat', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(script).toContain('STICK_HANDLE_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES = 4');
    expect(script).toContain('reinforce_stick_handle_retargeted_lower_body_lead');

    for (const target of runnerTargets) {
      const carryClip = target.motionSourceClips.find((candidate) => candidate.clipName === 'stick-handle');

      expect(carryClip).toBeTruthy();
      expect(carryClip.minimumRetargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(4);
      expect(carryClip.retargetedStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(
        carryClip.minimumRetargetedStickActionLowerBodyLeadFrames,
      );
    }
  });

  it('requires stick release and catch beats to stay supported by planted-foot windows after retargeting', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('"stickActionSupportedReleaseRatio"');
    expect(script).toContain('"minimumStickActionSupportedReleaseRatio"');
    expect(script).toContain('"retargetedStickActionSupportedReleaseRatio"');
    expect(script).toContain('"minimumRetargetedStickActionSupportedReleaseRatio"');
    expect(script).toContain('calculate_stick_action_supported_release_ratio');
    expect(script).toContain('calculate_retargeted_stick_action_supported_release_ratio');
    expect(script).toContain('minimum_retargeted_stick_action_supported_release_ratio');
  });

  it('preserves recovery evidence for retargeted stick actions', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('"retargetedStickActionRecoveryRatio"');
    expect(script).toContain('"minimumRetargetedStickActionRecoveryRatio"');
    expect(script).toContain('calculate_retargeted_stick_action_recovery_ratio');
    expect(script).toContain('minimum_retargeted_stick_action_recovery_ratio');
  });

  it('preserves exported beat sequencing for retargeted stick actions', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('"retargetedStickActionPhaseChanges"');
    expect(script).toContain('"minimumRetargetedStickActionPhaseChanges"');
    expect(script).toContain('"retargetedStickActionBeatSpanRatio"');
    expect(script).toContain('"minimumRetargetedStickActionBeatSpanRatio"');
    expect(script).toContain('"retargetedStickActionReleasePeakRatio"');
    expect(script).toContain('"minimumRetargetedStickActionReleasePeakRatio"');
    expect(script).toContain('"maximumRetargetedStickActionReleasePeakRatio"');
    expect(script).toContain('calculate_retargeted_stick_action_beat_metrics');
    expect(script).toContain('calculate_retargeted_stick_action_sweep_values');
    expect(script).toContain('calculate_retargeted_stick_action_release_peak_ratio');
    expect(script).toContain('minimum_retargeted_stick_action_phase_changes');
    expect(script).toContain('minimum_retargeted_stick_action_beat_span_ratio');
    expect(script).toContain('minimum_retargeted_stick_action_release_peak_ratio');
    expect(script).toContain('maximum_retargeted_stick_action_release_peak_ratio');
  });

  it('exports retargeted frame smoothness evidence so Blender cannot introduce action snaps', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('"retargetedMaxFrameRotationDeltaDegrees"');
    expect(script).toContain('"maximumRetargetedFrameRotationDeltaDegrees"');
    expect(script).toContain('"retargetedMaxFrameRotationAccelerationDegrees"');
    expect(script).toContain('"maximumRetargetedFrameRotationAccelerationDegrees"');
    expect(script).toContain('calculate_retargeted_frame_motion_smoothness');
    expect(script).toContain('maximum_retargeted_frame_rotation_delta');
    expect(script).toContain('maximum_retargeted_frame_rotation_acceleration');
  });

  it('uses distance-based beat sequencing so upper-arm caps do not flatten stick-action evidence', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const beatFunction = script.match(
      /def calculate_retargeted_stick_action_beat_metrics\(rotation_frames\):[\s\S]+?def calculate_retargeted_stick_action_release_peak_ratio/,
    )?.[0] ?? '';

    expect(beatFunction).toContain('calculate_retargeted_stick_action_distances(rotation_frames)');
  });

  it('reinforces pass, receive, and wrist-shot two-hand windows during retargeting', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('reinforce_wrist_shot_two_hand_window');
    expect(script).toContain('clip_name != "wrist-shot"');
    expect(script).toContain('rotations = reinforce_wrist_shot_two_hand_window');
    expect(script).toContain('reinforce_receive_pass_two_hand_window');
    expect(script).toContain('clip_name != "receive-pass"');
    expect(script).toContain('rotations = reinforce_receive_pass_two_hand_window');
    expect(script).toContain('STICK_ACTION_MIN_TWO_HAND_CONTACT_FRAMES');
    expect(script).toContain('"forehand-pass": 20');
    expect(script).toContain('"receive-pass": 20');
    expect(script).toContain('"wrist-shot": 21');
    expect(script).toContain('"retargetedStickActionTwoHandContactFrameCount"');
    expect(script).toContain('"minimumRetargetedStickActionTwoHandContactFrameCount"');
    expect(script).toContain('reinforce_stick_action_retargeted_contact_window');
    expect(script).toContain('retargeted_rotation_frames = reinforce_stick_action_retargeted_contact_window');
  });

  it('keeps receive-pass catches planted after retargeting', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    for (const target of runnerTargets) {
      const clip = target.motionSourceClips.find((candidate) => candidate.clipName === 'receive-pass');

      expect(clip).toBeTruthy();
      expect(clip.retargetedLocomotionFootPlantDriveRatio).toBeGreaterThanOrEqual(0.6);
      expect(clip.minimumRetargetedLocomotionFootPlantDriveRatio).toBeGreaterThanOrEqual(0.6);
      expect(clip.retargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.56);
      expect(clip.minimumRetargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.5);
    }
  });

  it('keeps the retargeted wrist-shot release below the broadcast snap threshold', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const wristShotAccelerationLimit = Number(
      script.match(/WRIST_SHOT_RETARGET_ACCELERATION_LIMIT\s*=\s*([0-9.]+)/)?.[1],
    );

    expect(script).toContain('WRIST_SHOT_RETARGET_ACCELERATION_LIMIT');
    expect(script).toContain('smooth_stick_action_rotation_frames');
    expect(wristShotAccelerationLimit).toBeLessThanOrEqual(23);

    for (const target of runnerTargets) {
      const clip = target.motionSourceClips.find((candidate) => candidate.clipName === 'wrist-shot');

      expect(clip).toBeTruthy();
      expect(clip.retargetedMaxFrameRotationAccelerationDegrees).toBeLessThanOrEqual(23);
      expect(clip.maximumRetargetedFrameRotationAccelerationDegrees).toBeLessThanOrEqual(23);
    }
  });

  it('keeps the forehand-pass retarget release below the broadcast snap threshold', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(script).toContain('"forehand-pass": 27');
    expect(script).toContain('smooth_stick_action_rotation_frames');

    for (const target of runnerTargets) {
      const clip = target.motionSourceClips.find((candidate) => candidate.clipName === 'forehand-pass');

      expect(clip).toBeTruthy();
      expect(clip.retargetedMaxFrameRotationAccelerationDegrees).toBeLessThanOrEqual(27);
      expect(clip.maximumRetargetedFrameRotationAccelerationDegrees).toBeLessThanOrEqual(27);
    }
  });

  it('exports an upper-arm lift ceiling for retargeted stick actions so broadcast players do not pop overhead', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxStickActionUpperArmLift = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(script).toContain('"retargetedStickActionUpperArmLiftDegrees"');
    expect(script).toContain('"maximumRetargetedStickActionUpperArmLiftDegrees"');
    expect(script).toContain('MAX_STICK_ACTION_UPPER_ARM_LIFT_DEGREES');
    expect(script).toContain('calculate_retargeted_stick_action_upper_arm_lift');
    expect(script).toContain('maximum_retargeted_stick_action_upper_arm_lift');
    expect(maxStickActionUpperArmLift).toBeLessThanOrEqual(35);
  });

  it('exports an upper-arm swing ceiling for retargeted stick actions so broadcast players do not splay wide', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxStickActionUpperArmSwing = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_SWING_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(script).toContain('"retargetedStickActionUpperArmSwingDegrees"');
    expect(script).toContain('"maximumRetargetedStickActionUpperArmSwingDegrees"');
    expect(script).toContain('MAX_STICK_ACTION_UPPER_ARM_SWING_DEGREES');
    expect(script).toContain('calculate_retargeted_stick_action_upper_arm_swing');
    expect(script).toContain('maximum_retargeted_stick_action_upper_arm_swing');
    expect(maxStickActionUpperArmSwing).toBeLessThanOrEqual(34);
  });

  it('exports an upper-arm lateral ceiling for retargeted stick actions so broadcast arms stay tucked', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxStickActionUpperArmLateral = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(script).toContain('"retargetedStickActionUpperArmLateralDegrees"');
    expect(script).toContain('"maximumRetargetedStickActionUpperArmLateralDegrees"');
    expect(script).toContain('MAX_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES');
    expect(script).toContain('calculate_retargeted_stick_action_upper_arm_lateral');
    expect(script).toContain('maximum_retargeted_stick_action_upper_arm_lateral');
    expect(maxStickActionUpperArmLateral).toBeLessThanOrEqual(23);
  });

  it('exports a combined upper-arm exposure ceiling so stick actions cannot be both high and wide', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const maxStickActionUpperArmExposure = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(script).toContain('"retargetedStickActionUpperArmExposureDegrees"');
    expect(script).toContain('"maximumRetargetedStickActionUpperArmExposureDegrees"');
    expect(script).toContain('clamp_stick_action_upper_arm_exposure');
    expect(script).toContain('clamp_retargeted_stick_action_frames');
    expect(script).toContain('calculate_retargeted_stick_action_upper_arm_exposure');
    expect(script).toContain('maximum_retargeted_stick_action_upper_arm_exposure');
    expect(maxStickActionUpperArmExposure).toBeLessThanOrEqual(39);
  });

  it('exports tighter stick-action shoulder carriage for broadcast action posture', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const actionClips = ['stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'];

    for (const target of runnerTargets) {
      for (const clipName of actionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(35);
        expect(clip.retargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(34);
        expect(clip.retargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(23);
        expect(clip.retargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(39);
        expect(clip.maximumRetargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(39);
      }
    }
  });

  it('keeps retargeted stick-action lateral shoulder spread below the broadcast-wide arm threshold', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const actionClips = ['stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'];

    for (const target of runnerTargets) {
      for (const clipName of actionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(23);
        expect(clip.maximumRetargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(23);
      }
    }
  });

  it('keeps retargeted stick-action arm swing below the broadcast arms-out threshold', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const actionClips = ['stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'];

    for (const target of runnerTargets) {
      for (const clipName of actionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(34);
        expect(clip.maximumRetargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(34);
      }
    }
  });

  it('uses a tighter shoulder envelope for non-shot stick actions', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const compactActionClips = ['stick-handle', 'forehand-pass', 'receive-pass'];

    expect(script).toContain('COMPACT_STICK_ACTION_CLIPS');
    expect(script).toContain('MAX_COMPACT_STICK_ACTION_UPPER_ARM_LIFT_DEGREES');
    expect(script).toContain('MAX_COMPACT_STICK_ACTION_UPPER_ARM_SWING_DEGREES');
    expect(script).toContain('MAX_COMPACT_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES');
    expect(script).toContain('MAX_COMPACT_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES');

    for (const target of runnerTargets) {
      for (const clipName of compactActionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(28);
        expect(clip.maximumRetargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(28);
        expect(clip.retargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(26);
        expect(clip.maximumRetargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(26);
        expect(clip.retargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(14);
        expect(clip.maximumRetargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(14);
        expect(clip.retargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(29);
        expect(clip.maximumRetargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(29);
      }
    }
  });

  it('exports a tighter compact shoulder envelope for carry, pass, and receive actions', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const compactActionClips = ['stick-handle', 'forehand-pass', 'receive-pass'];

    const compactLift = Number(script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const compactSwing = Number(script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_SWING_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const compactLateral = Number(script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const compactExposure = Number(script.match(/MAX_COMPACT_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(compactLift).toBeLessThanOrEqual(22.25);
    expect(compactSwing).toBeLessThanOrEqual(22.5);
    expect(compactLateral).toBeLessThanOrEqual(9.75);
    expect(compactExposure).toBeLessThanOrEqual(24.05);

    for (const target of runnerTargets) {
      for (const clipName of compactActionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(22.25);
        expect(clip.maximumRetargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(22.25);
        expect(clip.retargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(22.5);
        expect(clip.maximumRetargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(22.5);
        expect(clip.retargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(9.75);
        expect(clip.maximumRetargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(9.75);
        expect(clip.retargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(24.05);
        expect(clip.maximumRetargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(24.05);
        if (clipName === 'forehand-pass') {
          expect(clip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.75);
        }
      }
    }
  });

  it('keeps compact stick-handle contact support through the late carry frame', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    expect(script).toContain('"stick-handle": [2, 3, 9, 10, 11, 12, 13, 14, 20, 21, 22, 23]');
    expect(script).toContain('23: 1.2');

    for (const target of runnerTargets) {
      const clip = target.motionSourceClips.find((candidate) => candidate.clipName === 'stick-handle');

      expect(clip).toBeTruthy();
      expect(clip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(21);
      expect(clip.retargetedStickActionTwoHandContactFrameIndices).toContain(2);
      expect(clip.retargetedStickActionTwoHandContactFrameIndices).toContain(23);
      expect(clip.retargetedStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.29);
    }
  });

  it('exports a compact wrist-shot shoulder envelope without relaxing release support', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');

    const maxStickActionUpperArmLift = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxStickActionUpperArmSwing = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_SWING_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxStickActionUpperArmLateral = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxStickActionUpperArmExposure = Number(script.match(/MAX_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(maxStickActionUpperArmLift).toBeLessThanOrEqual(28.75);
    expect(maxStickActionUpperArmSwing).toBeLessThanOrEqual(26.75);
    expect(maxStickActionUpperArmLateral).toBeLessThanOrEqual(16.5);
    expect(maxStickActionUpperArmExposure).toBeLessThanOrEqual(31.5);

    for (const target of runnerTargets) {
      const clip = target.motionSourceClips.find((candidate) => candidate.clipName === 'wrist-shot');

      expect(clip).toBeTruthy();
      expect(clip.retargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(28.75);
      expect(clip.maximumRetargetedStickActionUpperArmLiftDegrees).toBeLessThanOrEqual(28.75);
      expect(clip.retargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(26.75);
      expect(clip.maximumRetargetedStickActionUpperArmSwingDegrees).toBeLessThanOrEqual(26.75);
      expect(clip.retargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(16.5);
      expect(clip.maximumRetargetedStickActionUpperArmLateralDegrees).toBeLessThanOrEqual(16.5);
      expect(clip.retargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(31.5);
      expect(clip.maximumRetargetedStickActionUpperArmExposureDegrees).toBeLessThanOrEqual(31.5);
      expect(clip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(20);
      expect(clip.retargetedStickActionSupportedReleaseRatio).toBeGreaterThanOrEqual(1);
    }
  });

  it('exports forearm and hand lift ceilings for retargeted stick actions so hands stay below shoulder height', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const actionClips = ['stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'];
    const maxStickActionForearmLift = Number(script.match(/MAX_STICK_ACTION_FOREARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxStickActionHandLift = Number(script.match(/MAX_STICK_ACTION_HAND_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(script).toContain('"retargetedStickActionForearmLiftDegrees"');
    expect(script).toContain('"maximumRetargetedStickActionForearmLiftDegrees"');
    expect(script).toContain('"retargetedStickActionHandLiftDegrees"');
    expect(script).toContain('"maximumRetargetedStickActionHandLiftDegrees"');
    expect(script).toContain('calculate_retargeted_stick_action_forearm_lift');
    expect(script).toContain('calculate_retargeted_stick_action_hand_lift');
    expect(script).toContain('maximum_retargeted_stick_action_forearm_lift');
    expect(script).toContain('maximum_retargeted_stick_action_hand_lift');
    expect(maxStickActionForearmLift).toBeLessThanOrEqual(22);
    expect(maxStickActionHandLift).toBeLessThanOrEqual(6);

    for (const target of runnerTargets) {
      for (const clipName of actionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.retargetedStickActionForearmLiftDegrees).toBeLessThanOrEqual(22);
        expect(clip.maximumRetargetedStickActionForearmLiftDegrees).toBeLessThanOrEqual(22);
        expect(clip.retargetedStickActionHandLiftDegrees).toBeLessThanOrEqual(6);
        expect(clip.maximumRetargetedStickActionHandLiftDegrees).toBeLessThanOrEqual(6);
      }
    }
  });

  it('keeps final-grade stick-action forearms and hands under the tighter broadcast shoulder line', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const actionClips = ['stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'];
    const maxStickActionForearmLift = Number(script.match(/MAX_STICK_ACTION_FOREARM_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);
    const maxStickActionHandLift = Number(script.match(/MAX_STICK_ACTION_HAND_LIFT_DEGREES\s*=\s*([0-9.]+)/)?.[1]);

    expect(maxStickActionForearmLift).toBeLessThanOrEqual(20.25);
    expect(maxStickActionHandLift).toBeLessThanOrEqual(5.0);

    for (const target of runnerTargets) {
      for (const clipName of actionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        const contactFloor = clipName === 'stick-handle' ? 21 : clipName === 'wrist-shot' ? 21 : 20;

        expect(clip.retargetedStickActionForearmLiftDegrees).toBeLessThanOrEqual(20.25);
        expect(clip.maximumRetargetedStickActionForearmLiftDegrees).toBeLessThanOrEqual(20.25);
        expect(clip.retargetedStickActionHandLiftDegrees).toBeLessThanOrEqual(5.0);
        expect(clip.maximumRetargetedStickActionHandLiftDegrees).toBeLessThanOrEqual(5.0);
        expect(clip.retargetedStickActionTwoHandContactFrameCount).toBeGreaterThanOrEqual(contactFloor);
        expect(clip.retargetedFootPlantGroundedRatio).toBeGreaterThanOrEqual(0.89);
      }
    }
  });

  it('requires grounded planted-foot support through retargeted stick actions', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const actionClipFloors = new Map([
      ['stick-handle', 0.9],
      ['forehand-pass', 0.94],
      ['receive-pass', 0.86],
      ['wrist-shot', 0.9],
    ]);

    expect(script).toContain('STICK_ACTION_MIN_RETARGET_FOOT_GROUNDED_RATIO');

    for (const target of runnerTargets) {
      for (const [clipName, minimumGroundedRatio] of actionClipFloors) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.minimumRetargetedFootPlantGroundedRatio).toBeGreaterThanOrEqual(minimumGroundedRatio);
        expect(clip.retargetedFootPlantGroundedRatio).toBeGreaterThanOrEqual(minimumGroundedRatio);
      }
    }
  });

  it('caps planted-foot slide for retargeted stick actions', () => {
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const stickActionClips = ['stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'];

    for (const target of runnerTargets) {
      for (const clipName of stickActionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.maximumRetargetedFootPlantMaxSlideUnits).toBeLessThanOrEqual(0.04);
        expect(clip.retargetedFootPlantMaxSlideUnits).toBeLessThanOrEqual(
          clip.maximumRetargetedFootPlantMaxSlideUnits,
        );
      }
    }
  });

  it('raises jog and sprint retargeted foot-contact balance and stability floors', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');
    const report = JSON.parse(readFileSync('asset-inbox/players/generated/blender-normalize-report.json', 'utf8'));
    const runnerTargets = report.targets.filter((target) => target.profile === 'runner');
    const locomotionClips = ['jog-forward', 'sprint-forward'];

    expect(script).toContain('MIN_LOCOMOTION_RETARGET_FOOT_PLANT_BALANCE_RATIO = 0.6');
    expect(script).toContain('MIN_LOCOMOTION_RETARGET_FOOT_PLANT_STABILITY_RATIO = 0.6');

    for (const target of runnerTargets) {
      for (const clipName of locomotionClips) {
        const clip = target.motionSourceClips.find((candidate) => candidate.clipName === clipName);

        expect(clip).toBeTruthy();
        expect(clip.minimumRetargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.6);
        expect(clip.retargetedFootPlantBalanceRatio).toBeGreaterThanOrEqual(
          clip.minimumRetargetedFootPlantBalanceRatio,
        );
        expect(clip.minimumRetargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(0.6);
        expect(clip.retargetedFootPlantStabilityRatio).toBeGreaterThanOrEqual(
          clip.minimumRetargetedFootPlantStabilityRatio,
        );
      }
    }
  });

  it('exports retargeted locomotion loop seam evidence for repeated jog and sprint playback', () => {
    const script = readFileSync('scripts/blender/normalize_player_rigs.py', 'utf8');

    expect(script).toContain('"retargetedLocomotionLoopClosureErrorDegrees"');
    expect(script).toContain('"maximumRetargetedLoopClosureErrorDegrees"');
    expect(script).toContain('"retargetedRootVerticalLoopOffsetUnits"');
    expect(script).toContain('"maximumRetargetedLoopVerticalOffsetUnits"');
    expect(script).toContain('calculate_retargeted_loop_closure_metrics');
    expect(script).toContain('maximum_retargeted_loop_closure_error');
    expect(script).toContain('maximum_retargeted_loop_vertical_offset');
  });
});
