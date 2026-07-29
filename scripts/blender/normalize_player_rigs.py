import argparse
import json
import math
import os
import re
import sys
from pathlib import Path

import bmesh
import bpy


RUNNER_REQUIRED_CLIPS = [
    "idle-ready",
    "jog-forward",
    "sprint-forward",
    "stick-handle",
    "forehand-pass",
    "receive-pass",
    "wrist-shot",
]

PROJECT_ROOT = Path(__file__).resolve().parents[2]
RUNNER_MOTION_SOURCE_DIR = PROJECT_ROOT / "asset-inbox" / "players" / "motion-sources" / "internal-keyframes"
RUNNER_CLIP_MOTION_SOURCES = {
    "idle-ready": "field-player-ready-stance.bvh",
    "jog-forward": "field-player-jog-forward.bvh",
    "sprint-forward": "field-player-sprint-burst.bvh",
    "stick-handle": "field-player-stick-carry-control.bvh",
    "forehand-pass": "field-player-forehand-pass-release.bvh",
    "receive-pass": "field-player-receive-pass-settle.bvh",
    "wrist-shot": "field-player-wrist-shot-release.bvh",
}
SOURCE_RIGHTS_EVIDENCE_FILES = [
    "SOURCE_NOTES.md",
    "LICENSE.md",
    "ATTRIBUTION.md",
]
SOURCE_RIGHTS_EVIDENCE_SUFFIXES = [
    ".source.md",
    ".license.md",
    ".attribution.md",
]
DEFAULT_SOURCE_METADATA = {
    "sourceQuality": "internal-authored-action-clip",
    "sourceProvider": "Goon Squad internal",
    "captureMethod": "hand-keyed-internal-bvh",
    "usageRights": "Authored for this project; retargeting and runtime use permitted",
}
FINAL_GRADE_SOURCE_QUALITIES = {
    "licensed-motion-capture-action-clip",
    "licensed-authored-action-clip",
    "internally-authored-high-quality-action-clip",
    "internally-authored-motion-capture-action-clip",
    "internally-authored-performance-capture-action-clip",
}
NORMAL_RUNNER_MOVEMENT_CLIPS = {"idle-ready", "jog-forward", "sprint-forward"}
STICK_ACTION_CLIPS = {"stick-handle", "forehand-pass", "receive-pass", "wrist-shot"}
COMPACT_STICK_ACTION_CLIPS = {"stick-handle", "forehand-pass", "receive-pass"}
NORMAL_UPPER_ARM_DROP_DEGREES = 15.9
NORMAL_UPPER_ARM_LIFT_SOURCE_SCALE = 0.08
MIN_NORMAL_UPPER_ARM_DROP_DEGREES = 13.6
MAX_NORMAL_UPPER_ARM_SWING_DEGREES = 9.5
MAX_NORMAL_UPPER_ARM_LIFT_DEGREES = 13.6
MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES = 0.25
MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES = 13.6
NORMAL_FOREARM_LIFT_BASE_DEGREES = 11.0
NORMAL_FOREARM_LIFT_SOURCE_SCALE = 0.18
MAX_NORMAL_FOREARM_LIFT_DEGREES = 13.2
NORMAL_HAND_LIFT_BASE_DEGREES = 3.55
NORMAL_HAND_LIFT_SOURCE_SCALE = 0.055
MAX_NORMAL_HAND_LIFT_DEGREES = 4.2
RUNNER_UPPER_ARM_VISUAL_DROP_DEGREES = 90
RUNNER_UPPER_ARM_VISUAL_TUCK_DEGREES = 14
MAX_STICK_ACTION_UPPER_ARM_LIFT_DEGREES = 28.75
MAX_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES = 15.4
MAX_STICK_ACTION_UPPER_ARM_SWING_DEGREES = 26.75
MAX_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES = 29.75
MAX_COMPACT_STICK_ACTION_UPPER_ARM_LIFT_DEGREES = 22.25
MAX_COMPACT_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES = 9.75
MAX_COMPACT_STICK_ACTION_UPPER_ARM_SWING_DEGREES = 22.4
MAX_COMPACT_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES = 24.05
MAX_STICK_ACTION_FOREARM_LIFT_DEGREES = 20.25
MAX_STICK_ACTION_HAND_LIFT_DEGREES = 5.0
LOCOMOTION_ARM_SWING_RETARGET_SCALE = 0.78
ROOT_VERTICAL_RETARGET_SCALE = 0.13
LOCOMOTION_ROOT_VERTICAL_RETARGET_SCALE = 0.16
ROOT_LATERAL_RETARGET_SCALE = 0.0015
STICK_ACTION_ROOT_LATERAL_RETARGET_SCALE = 0.008
FOOT_PLANT_ANKLE_DRIVE_RETARGET_SCALE = 0.32
RUNNER_SHOULDER_PAD_LATERAL_MULTIPLIER = 1.22
RUNNER_ELBOW_PAD_LATERAL_MULTIPLIER = 1.34
RUNNER_SHOULDER_PAD_WIDTH_FACTOR = 0.08
RUNNER_SHOULDER_PAD_DEPTH_FACTOR = 0.066
RUNNER_SHOULDER_PAD_HEIGHT_FACTOR = 0.072
RUNNER_ELBOW_PAD_WIDTH_FACTOR = 0.056
RUNNER_ELBOW_PAD_DEPTH_FACTOR = 0.052
RUNNER_ELBOW_PAD_HEIGHT_FACTOR = 0.062
RUNNER_SHOULDER_PAD_CAP_STRAP_WIDTH_FACTOR = 0.08
RUNNER_SHOULDER_PAD_CAP_STRAP_DEPTH_FACTOR = 0.014
RUNNER_SHOULDER_PAD_CAP_STRAP_HEIGHT_FACTOR = 0.012
RUNNER_ELBOW_PAD_STRAP_WIDTH_FACTOR = 0.054
RUNNER_ELBOW_PAD_STRAP_DEPTH_FACTOR = 0.014
RUNNER_ELBOW_PAD_STRAP_HEIGHT_FACTOR = 0.012
RUNNER_ELBOW_FLEX_BAND_WIDTH_FACTOR = 0.07
RUNNER_ELBOW_FLEX_BAND_DEPTH_FACTOR = 0.016
RUNNER_ELBOW_FLEX_BAND_HEIGHT_FACTOR = 0.026
RUNNER_JERSEY_SLEEVE_LATERAL_OFFSET_FACTOR = 0.124
RUNNER_JERSEY_SLEEVE_LENGTH_FACTOR = 0.12
RUNNER_JERSEY_SLEEVE_DEPTH_FACTOR = 0.052
RUNNER_JERSEY_SLEEVE_HEIGHT_FACTOR = 0.085
RUNNER_JERSEY_COLLAR_WIDTH_FACTOR = 0.15
RUNNER_JERSEY_COLLAR_DEPTH_FACTOR = 0.018
RUNNER_JERSEY_COLLAR_HEIGHT_FACTOR = 0.022
RUNNER_JERSEY_YOKE_WIDTH_FACTOR = 0.34
RUNNER_JERSEY_YOKE_DEPTH_FACTOR = 0.014
RUNNER_JERSEY_YOKE_HEIGHT_FACTOR = 0.056
RUNNER_JERSEY_SLEEVE_CUFF_WIDTH_FACTOR = 0.105
RUNNER_JERSEY_SLEEVE_CUFF_DEPTH_FACTOR = 0.016
RUNNER_JERSEY_SLEEVE_CUFF_HEIGHT_FACTOR = 0.022
RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_WIDTH_FACTOR = 0.098
RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_DEPTH_FACTOR = 0.01
RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_HEIGHT_FACTOR = 0.016
RUNNER_JERSEY_SHOULDER_SEAM_TAPE_WIDTH_FACTOR = 0.072
RUNNER_JERSEY_SHOULDER_SEAM_TAPE_DEPTH_FACTOR = 0.01
RUNNER_JERSEY_SHOULDER_SEAM_TAPE_HEIGHT_FACTOR = 0.038
RUNNER_SHOULDER_SOCKET_BRIDGE_WIDTH_FACTOR = 0.056
RUNNER_SHOULDER_SOCKET_BRIDGE_DEPTH_FACTOR = 0.012
RUNNER_SHOULDER_SOCKET_BRIDGE_HEIGHT_FACTOR = 0.082
RUNNER_NECK_GUARD_WIDTH_FACTOR = 0.074
RUNNER_NECK_GUARD_DEPTH_FACTOR = 0.05
RUNNER_NECK_GUARD_HEIGHT_FACTOR = 0.052
RUNNER_CHIN_STRAP_WIDTH_FACTOR = 0.01
RUNNER_CHIN_STRAP_DEPTH_FACTOR = 0.012
RUNNER_CHIN_STRAP_HEIGHT_FACTOR = 0.056
RUNNER_JERSEY_UNDERARM_GUSSET_WIDTH_FACTOR = 0.038
RUNNER_JERSEY_UNDERARM_GUSSET_DEPTH_FACTOR = 0.018
RUNNER_JERSEY_UNDERARM_GUSSET_HEIGHT_FACTOR = 0.104
RUNNER_GLOVE_LATERAL_OFFSET_FACTOR = 0.144
RUNNER_GLOVE_WIDTH_FACTOR = 0.04
RUNNER_GLOVE_DEPTH_FACTOR = 0.036
RUNNER_GLOVE_HEIGHT_FACTOR = 0.046
RUNNER_GLOVE_CUFF_WIDTH_FACTOR = 0.05
RUNNER_GLOVE_CUFF_DEPTH_FACTOR = 0.034
RUNNER_GLOVE_CUFF_HEIGHT_FACTOR = 0.02
RUNNER_GLOVE_THUMB_GUARD_WIDTH_FACTOR = 0.024
RUNNER_GLOVE_THUMB_GUARD_DEPTH_FACTOR = 0.024
RUNNER_GLOVE_THUMB_GUARD_HEIGHT_FACTOR = 0.032
RUNNER_GLOVE_KNUCKLE_RIDGE_WIDTH_FACTOR = 0.008
RUNNER_GLOVE_KNUCKLE_RIDGE_DEPTH_FACTOR = 0.036
RUNNER_GLOVE_KNUCKLE_RIDGE_HEIGHT_FACTOR = 0.008
RUNNER_GLOVE_PALM_GRIP_WIDTH_FACTOR = 0.026
RUNNER_GLOVE_PALM_GRIP_DEPTH_FACTOR = 0.012
RUNNER_GLOVE_PALM_GRIP_HEIGHT_FACTOR = 0.026
RUNNER_GLOVE_WRIST_TAPE_WIDTH_FACTOR = 0.054
RUNNER_GLOVE_WRIST_TAPE_DEPTH_FACTOR = 0.016
RUNNER_GLOVE_WRIST_TAPE_HEIGHT_FACTOR = 0.009
RUNNER_SHOE_CONTACT_TREAD_WIDTH_FACTOR = 0.09
RUNNER_SHOE_CONTACT_TREAD_DEPTH_FACTOR = 0.028
RUNNER_SHOE_CONTACT_TREAD_HEIGHT_FACTOR = 0.006
RUNNER_SHOE_LACE_BRIDGE_LENGTH_FACTOR = 0.086
RUNNER_SHOE_LACE_BRIDGE_DEPTH_FACTOR = 0.008
RUNNER_SHOE_LACE_BRIDGE_HEIGHT_FACTOR = 0.007
RUNNER_FOREARM_SLEEVE_LATERAL_MULTIPLIER = 1.3
RUNNER_FOREARM_SLEEVE_WIDTH_FACTOR = 0.078
RUNNER_FOREARM_SLEEVE_DEPTH_FACTOR = 0.054
RUNNER_FOREARM_SLEEVE_HEIGHT_FACTOR = 0.17
RUNNER_FOREARM_SLEEVE_VERTICAL_OFFSET_FACTOR = 0.05
RUNNER_UPPER_ARM_COMPRESSION_LATERAL_MULTIPLIER = 1.2
RUNNER_UPPER_ARM_COMPRESSION_WIDTH_FACTOR = 0.092
RUNNER_UPPER_ARM_COMPRESSION_DEPTH_FACTOR = 0.058
RUNNER_UPPER_ARM_COMPRESSION_HEIGHT_FACTOR = 0.145
RUNNER_UPPER_ARM_COMPRESSION_VERTICAL_OFFSET_FACTOR = 0.115
RUNNER_SKIN_ARM_LATERAL_MIN_FACTOR = 0.124
RUNNER_SKIN_ARM_WIDTH_CAP_FACTOR = 0.36
RUNNER_SKIN_ARM_OUTER_SHRINK_RATIO = 0.18
RUNNER_SKIN_ARM_VERTICAL_MIN_FACTOR = 0.4
RUNNER_SKIN_ARM_VERTICAL_MAX_FACTOR = 0.84
GLTF_MAX_VERTEX_JOINT_INFLUENCES = 4
LOCOMOTION_LEG_DRIVE_RETARGET_SCALE = {
    "jog-forward": 1.22,
    "sprint-forward": 1.32,
}
HIP_TWIST_RETARGET_SCALE = 0.25
WAIST_TWIST_RETARGET_SCALE = 0.5
SPINE1_TWIST_RETARGET_SCALE = 0.9
SPINE_TWIST_RETARGET_SCALE = 1.0
LOCOMOTION_TRUNK_COUNTER_ROTATION_RETARGET_SCALE = 0.076
LOCOMOTION_TRUNK_COUNTER_ROTATION_MAX_DEGREES = 7.2
LOCOMOTION_FORWARD_LEAN_BASE_BOOST = {
    "idle-ready": 2.0,
    "jog-forward": 4.2,
    "sprint-forward": 5.4,
}
LOCOMOTION_RETARGET_ACCELERATION_LIMITS = {
    "jog-forward": 8.2,
    "sprint-forward": 14.6,
}
WRIST_SHOT_RETARGET_ACCELERATION_LIMIT = 23
STICK_ACTION_RETARGET_ACCELERATION_LIMITS = {
    "stick-handle": 12.4,
    "forehand-pass": 27,
    "receive-pass": 24.8,
    "wrist-shot": WRIST_SHOT_RETARGET_ACCELERATION_LIMIT,
}
STICK_ACTION_MIN_TWO_HAND_CONTACT_FRAMES = {
    "stick-handle": 21,
    "forehand-pass": 20,
    "receive-pass": 20,
    "wrist-shot": 21,
}
STICK_ACTION_MIN_RETARGET_FOOT_GROUNDED_RATIO = {
    "stick-handle": 0.9,
    "forehand-pass": 0.94,
    "receive-pass": 0.86,
    "wrist-shot": 0.9,
}
STICK_ACTION_MAX_RETARGET_FOOT_PLANT_SLIDE_UNITS = 0.04
MIN_LOCOMOTION_RETARGET_FOOT_PLANT_BALANCE_RATIO = 0.6
MIN_LOCOMOTION_RETARGET_FOOT_PLANT_STABILITY_RATIO = 0.6
STICK_ACTION_RETARGET_CONTACT_SUPPORT_FRAME_INDICES = {
    "stick-handle": [2, 3, 9, 10, 11, 12, 13, 14, 20, 21, 22, 23],
    "forehand-pass": [4, 5, 6, 9, 14, 15, 17, 18, 21],
    "receive-pass": [2, 3, 19, 20, 21],
    "wrist-shot": [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
}
STICK_HANDLE_RETARGET_BEAT_FRAME_SCALES = {
    4: 1.04,
    5: 1.08,
    6: 1.22,
    7: 1.16,
    12: 0.78,
    13: 0.72,
    14: 0.78,
    18: 1.3,
    19: 1.35,
    20: 1.3,
    21: 0.72,
    22: 0.78,
    23: 1.2,
}
STICK_HANDLE_MIN_RETARGETED_BEAT_SPAN_RATIO = 0.4
STICK_HANDLE_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES = 4
RECEIVE_PASS_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES = 6
PASS_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES = 8
SHOT_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES = 8
RECEIVE_PASS_RETARGET_PLANTED_DRIVE_FRAMES = {
    1: (1, 38, -4),
    2: (1, 46, -6),
    3: (1, 38, -4),
    4: (1, 28, 4),
    5: (1, 24, -4),
    14: (-1, -4, 28),
    15: (-1, -6, 32),
    16: (-1, -6, 32),
    17: (-1, -4, 28),
    18: (-1, 16, 20),
    19: (-1, 15, 20),
    20: (-1, 14, 19),
    21: (-1, 12, 18),
    22: (-1, 11, 17),
    23: (-1, 11, 16),
}
WRIST_SHOT_RETARGET_LOWER_BODY_LOAD_FRAMES = {
}
STICK_ACTION_LEG_DRIVE_RETARGET_SCALE = {
    "stick-handle": 1.08,
    "forehand-pass": 1.12,
    "receive-pass": 1.08,
    "wrist-shot": 1.14,
}
STICK_ACTION_FOREARM_SOURCE_SCALE = 0.58
STICK_ACTION_HAND_SOURCE_SCALE = 0.3
MIN_RETARGETABLE_BVH_FRAMES = 4
MIN_ACTION_CLIP_BVH_FRAMES = 12
MIN_ACTION_CLIP_BVH_DURATION_SECONDS = 0.38
MIN_ACTION_CLIP_MAX_ROTATION_RANGE_DEGREES = 4
MIN_ACTION_CLIP_ACTIVE_ROTATION_CHANNELS = 3
ACTIVE_ROTATION_CHANNEL_RANGE_DEGREES = 3
STRIDE_PHASE_DEAD_ZONE_DEGREES = 3
STICK_ACTION_PHASE_DEAD_ZONE_DEGREES = 5
STICK_ACTION_TORSO_CHANNEL_START = 6
STICK_ACTION_TORSO_CHANNEL_END = 9
STICK_ACTION_ARM_CHANNEL_START = 12
STICK_ACTION_ARM_CHANNEL_END = 18
ATHLETIC_TORSO_LEAN_CHANNEL = 7
HIP_YAW_CHANNEL = 5
SHOULDER_YAW_CHANNEL = 8
LOCOMOTION_ARM_SWING_CHANNELS = [12, 15]
LEFT_ARM_SWING_CHANNEL = 12
RIGHT_ARM_SWING_CHANNEL = 15
READY_STANCE_LEFT_LEG_LOAD_CHANNEL = 19
READY_STANCE_RIGHT_LEG_LOAD_CHANNEL = 22
LEFT_LEG_DRIVE_CHANNEL = 19
RIGHT_LEG_DRIVE_CHANNEL = 22
FOOT_PLANT_ROOT_LOW_RATIO = 0.35
FOOT_PLANT_DRIVE_WINDOW_FRAMES = 1
STICK_ACTION_RELEASE_SUPPORT_WINDOW_FRAMES = 2
STICK_ACTION_TWO_HAND_ACTIVE_RATIO = 0.35
MIN_USABLE_RETARGET_FRAMES = 12


def root_vertical_retarget_scale_for_clip(clip_name):
    if clip_name in {"jog-forward", "sprint-forward"}:
        return LOCOMOTION_ROOT_VERTICAL_RETARGET_SCALE
    return ROOT_VERTICAL_RETARGET_SCALE


ACTION_QUALITY_PROFILES = {
    "idle-ready": {
        "name": "ready",
        "minimumFrameCount": 14,
        "minimumDurationSeconds": 0.45,
        "maximumFrameRotationDeltaDegrees": 10,
        "maximumFrameRotationAccelerationDegrees": 6,
        "minimumRootTravelUnits": 0,
        "minimumRootForwardTravelUnits": 0,
        "minimumRootForwardSpeedChangeUnits": 0,
        "minimumRootLateralShiftUnits": 0,
        "minimumRootVerticalBounceUnits": 0,
        "minimumReadyStanceLegLoadDegrees": 24,
        "minimumLegDriveRangeDegrees": 0,
        "minimumLocomotionStrideBalanceRatio": 0,
        "minimumLocomotionFootPlantDriveRatio": 0,
        "minimumAlternatingLegSeparationDegrees": 0,
        "minimumLocomotionArmSwingRangeDegrees": 0,
        "minimumLocomotionContralateralSyncRatio": 0,
        "minimumFootPlantContactFrames": 4,
        "minimumFootPlantSideCount": 2,
        "minimumFootPlantBalanceRatio": 0.5,
        "minimumFootPlantHoldFramesPerSide": 2,
        "maximumFootPlantRootDriftUnits": 1,
        "minimumTotalRotationRangeDegrees": 45,
        "minimumStridePhaseChanges": 0,
        "minimumStrideCycleSpanRatio": 0,
        "minimumStickActionArmRangeDegrees": 0,
        "minimumStickActionTwoHandBalanceRatio": 0,
        "minimumStickActionTwoHandSyncRatio": 0,
        "minimumStickActionTwoHandContactRatio": 0,
        "minimumStickActionPhaseChanges": 0,
        "minimumStickActionBeatSpanRatio": 0,
        "minimumStickActionReleasePeakRatio": 0,
        "maximumStickActionReleasePeakRatio": 1,
        "minimumStickActionSupportedReleaseRatio": 0,
        "minimumStickActionTorsoRangeDegrees": 0,
        "minimumHipShoulderSeparationDegrees": 0,
        "minimumStickActionLowerBodyLeadFrames": 0,
        "minimumStickActionRecoveryRatio": 0,
        "minimumAthleticTorsoLeanDegrees": 0,
        "maximumLoopClosureErrorDegrees": 999,
        "maximumLoopVerticalOffsetUnits": 999,
    },
    "jog-forward": {
        "name": "jog",
        "minimumFrameCount": 22,
        "minimumDurationSeconds": 0.72,
        "maximumFrameRotationDeltaDegrees": 18,
        "maximumFrameRotationAccelerationDegrees": 8,
        "minimumRootTravelUnits": 30,
        "minimumRootForwardTravelUnits": 30,
        "minimumRootForwardSpeedChangeUnits": 0.35,
        "minimumRootLateralShiftUnits": 24,
        "minimumRootVerticalBounceUnits": 0.3,
        "minimumReadyStanceLegLoadDegrees": 0,
        "minimumLegDriveRangeDegrees": 105,
        "minimumLocomotionStrideBalanceRatio": 0.72,
        "minimumLocomotionFootPlantDriveRatio": 0.55,
        "minimumAlternatingLegSeparationDegrees": 50,
        "minimumLocomotionArmSwingRangeDegrees": 80,
        "minimumLocomotionContralateralSyncRatio": 0.65,
        "minimumFootPlantContactFrames": 8,
        "minimumFootPlantSideCount": 2,
        "minimumFootPlantBalanceRatio": 0.6,
        "minimumFootPlantHoldFramesPerSide": 3,
        "maximumFootPlantRootDriftUnits": 10,
        "minimumTotalRotationRangeDegrees": 260,
        "minimumStridePhaseChanges": 2,
        "minimumStrideCycleSpanRatio": 0.5,
        "minimumStickActionArmRangeDegrees": 0,
        "minimumStickActionTwoHandBalanceRatio": 0,
        "minimumStickActionTwoHandSyncRatio": 0,
        "minimumStickActionTwoHandContactRatio": 0,
        "minimumStickActionPhaseChanges": 0,
        "minimumStickActionBeatSpanRatio": 0,
        "minimumStickActionReleasePeakRatio": 0,
        "maximumStickActionReleasePeakRatio": 1,
        "minimumStickActionSupportedReleaseRatio": 0,
        "minimumStickActionTorsoRangeDegrees": 0,
        "minimumHipShoulderSeparationDegrees": 8,
        "minimumStickActionLowerBodyLeadFrames": 0,
        "minimumStickActionRecoveryRatio": 0,
        "minimumAthleticTorsoLeanDegrees": 8,
        "maximumLoopClosureErrorDegrees": 16,
        "maximumLoopVerticalOffsetUnits": 0.75,
    },
    "sprint-forward": {
        "name": "sprint",
        "minimumFrameCount": 22,
        "minimumDurationSeconds": 0.72,
        "maximumFrameRotationDeltaDegrees": 24,
        "maximumFrameRotationAccelerationDegrees": 10,
        "minimumRootTravelUnits": 40,
        "minimumRootForwardTravelUnits": 40,
        "minimumRootForwardSpeedChangeUnits": 0.5,
        "minimumRootLateralShiftUnits": 28,
        "minimumRootVerticalBounceUnits": 0.5,
        "minimumReadyStanceLegLoadDegrees": 0,
        "minimumLegDriveRangeDegrees": 145,
        "minimumLocomotionStrideBalanceRatio": 0.72,
        "minimumLocomotionFootPlantDriveRatio": 0.55,
        "minimumAlternatingLegSeparationDegrees": 70,
        "minimumLocomotionArmSwingRangeDegrees": 105,
        "minimumLocomotionContralateralSyncRatio": 0.65,
        "minimumFootPlantContactFrames": 8,
        "minimumFootPlantSideCount": 2,
        "minimumFootPlantBalanceRatio": 0.6,
        "minimumFootPlantHoldFramesPerSide": 3,
        "maximumFootPlantRootDriftUnits": 12,
        "minimumTotalRotationRangeDegrees": 340,
        "minimumStridePhaseChanges": 2,
        "minimumStrideCycleSpanRatio": 0.5,
        "minimumStickActionArmRangeDegrees": 0,
        "minimumStickActionTwoHandBalanceRatio": 0,
        "minimumStickActionTwoHandSyncRatio": 0,
        "minimumStickActionTwoHandContactRatio": 0,
        "minimumStickActionPhaseChanges": 0,
        "minimumStickActionBeatSpanRatio": 0,
        "minimumStickActionReleasePeakRatio": 0,
        "maximumStickActionReleasePeakRatio": 1,
        "minimumStickActionSupportedReleaseRatio": 0,
        "minimumStickActionTorsoRangeDegrees": 0,
        "minimumHipShoulderSeparationDegrees": 8,
        "minimumStickActionLowerBodyLeadFrames": 0,
        "minimumStickActionRecoveryRatio": 0,
        "minimumAthleticTorsoLeanDegrees": 12,
        "maximumLoopClosureErrorDegrees": 16,
        "maximumLoopVerticalOffsetUnits": 0.75,
    },
    "stick-handle": {
        "name": "carry",
        "minimumFrameCount": 24,
        "minimumDurationSeconds": 0.8,
        "maximumFrameRotationDeltaDegrees": 18,
        "maximumFrameRotationAccelerationDegrees": 8,
        "minimumRootTravelUnits": 18,
        "minimumRootForwardTravelUnits": 18,
        "minimumRootForwardSpeedChangeUnits": 0.4,
        "minimumRootLateralShiftUnits": 4,
        "minimumRootVerticalBounceUnits": 0,
        "minimumReadyStanceLegLoadDegrees": 0,
        "minimumLegDriveRangeDegrees": 60,
        "minimumLocomotionStrideBalanceRatio": 0,
        "minimumLocomotionFootPlantDriveRatio": 0,
        "minimumAlternatingLegSeparationDegrees": 0,
        "minimumLocomotionArmSwingRangeDegrees": 0,
        "minimumLocomotionContralateralSyncRatio": 0,
        "minimumFootPlantContactFrames": 8,
        "minimumFootPlantSideCount": 2,
        "minimumFootPlantBalanceRatio": 0.5,
        "minimumFootPlantHoldFramesPerSide": 4,
        "maximumFootPlantRootDriftUnits": 8,
        "minimumTotalRotationRangeDegrees": 180,
        "minimumStridePhaseChanges": 0,
        "minimumStrideCycleSpanRatio": 0,
        "minimumStickActionArmRangeDegrees": 90,
        "minimumStickActionTwoHandBalanceRatio": 0.55,
        "minimumStickActionTwoHandSyncRatio": 0.65,
        "minimumStickActionTwoHandContactRatio": 0.35,
        "minimumStickActionPhaseChanges": 2,
        "minimumStickActionBeatSpanRatio": 0.45,
        "minimumStickActionReleasePeakRatio": 0.32,
        "maximumStickActionReleasePeakRatio": 0.78,
        "minimumStickActionSupportedReleaseRatio": 0.4,
        "minimumStickActionTorsoRangeDegrees": 18,
        "minimumHipShoulderSeparationDegrees": 8,
        "minimumStickActionLowerBodyLeadFrames": 4,
        "minimumStickActionRecoveryRatio": 0.65,
        "minimumAthleticTorsoLeanDegrees": 8,
        "maximumLoopClosureErrorDegrees": 999,
        "maximumLoopVerticalOffsetUnits": 999,
    },
    "forehand-pass": {
        "name": "pass",
        "minimumFrameCount": 24,
        "minimumDurationSeconds": 0.8,
        "maximumFrameRotationDeltaDegrees": 44,
        "maximumFrameRotationAccelerationDegrees": 20,
        "minimumRootTravelUnits": 5,
        "minimumRootForwardTravelUnits": 4,
        "minimumRootForwardSpeedChangeUnits": 0.12,
        "minimumRootLateralShiftUnits": 3,
        "minimumRootVerticalBounceUnits": 0,
        "minimumReadyStanceLegLoadDegrees": 0,
        "minimumLegDriveRangeDegrees": 28,
        "minimumLocomotionStrideBalanceRatio": 0,
        "minimumLocomotionFootPlantDriveRatio": 0,
        "minimumAlternatingLegSeparationDegrees": 0,
        "minimumLocomotionArmSwingRangeDegrees": 0,
        "minimumLocomotionContralateralSyncRatio": 0,
        "minimumFootPlantContactFrames": 8,
        "minimumFootPlantSideCount": 2,
        "minimumFootPlantBalanceRatio": 0.56,
        "minimumFootPlantHoldFramesPerSide": 3,
        "maximumFootPlantRootDriftUnits": 6,
        "minimumTotalRotationRangeDegrees": 150,
        "minimumStridePhaseChanges": 0,
        "minimumStrideCycleSpanRatio": 0,
        "minimumStickActionArmRangeDegrees": 100,
        "minimumStickActionTwoHandBalanceRatio": 0.55,
        "minimumStickActionTwoHandSyncRatio": 0.65,
        "minimumStickActionTwoHandContactRatio": 0.75,
        "minimumStickActionPhaseChanges": 2,
        "minimumStickActionBeatSpanRatio": 0.35,
        "minimumStickActionReleasePeakRatio": 0.35,
        "maximumStickActionReleasePeakRatio": 0.82,
        "minimumStickActionSupportedReleaseRatio": 0.4,
        "minimumStickActionTorsoRangeDegrees": 24,
        "minimumHipShoulderSeparationDegrees": 6,
        "minimumStickActionLowerBodyLeadFrames": 2,
        "minimumStickActionRecoveryRatio": 0.75,
        "minimumAthleticTorsoLeanDegrees": 8,
        "maximumLoopClosureErrorDegrees": 999,
        "maximumLoopVerticalOffsetUnits": 999,
    },
    "receive-pass": {
        "name": "receive",
        "minimumFrameCount": 24,
        "minimumDurationSeconds": 0.8,
        "maximumFrameRotationDeltaDegrees": 32,
        "maximumFrameRotationAccelerationDegrees": 16,
        "minimumRootTravelUnits": 6,
        "minimumRootForwardTravelUnits": 5,
        "minimumRootForwardSpeedChangeUnits": 0.15,
        "minimumRootLateralShiftUnits": 2.5,
        "minimumRootVerticalBounceUnits": 0,
        "minimumReadyStanceLegLoadDegrees": 0,
        "minimumLegDriveRangeDegrees": 26,
        "minimumLocomotionStrideBalanceRatio": 0,
        "minimumLocomotionFootPlantDriveRatio": 0.6,
        "minimumAlternatingLegSeparationDegrees": 0,
        "minimumLocomotionArmSwingRangeDegrees": 0,
        "minimumLocomotionContralateralSyncRatio": 0,
        "minimumFootPlantContactFrames": 8,
        "minimumFootPlantSideCount": 2,
        "minimumFootPlantBalanceRatio": 0.5,
        "minimumFootPlantHoldFramesPerSide": 3,
        "maximumFootPlantRootDriftUnits": 6,
        "minimumTotalRotationRangeDegrees": 110,
        "minimumStridePhaseChanges": 0,
        "minimumStrideCycleSpanRatio": 0,
        "minimumStickActionArmRangeDegrees": 90,
        "minimumStickActionTwoHandBalanceRatio": 0.55,
        "minimumStickActionTwoHandSyncRatio": 0.65,
        "minimumStickActionTwoHandContactRatio": 0.75,
        "minimumStickActionPhaseChanges": 2,
        "minimumStickActionBeatSpanRatio": 0.35,
        "minimumStickActionReleasePeakRatio": 0.35,
        "maximumStickActionReleasePeakRatio": 0.82,
        "minimumStickActionSupportedReleaseRatio": 0.4,
        "minimumStickActionTorsoRangeDegrees": 20,
        "minimumHipShoulderSeparationDegrees": 6,
        "minimumStickActionLowerBodyLeadFrames": 6,
        "minimumStickActionRecoveryRatio": 0.75,
        "minimumAthleticTorsoLeanDegrees": 10,
        "maximumLoopClosureErrorDegrees": 999,
        "maximumLoopVerticalOffsetUnits": 999,
    },
    "wrist-shot": {
        "name": "shot",
        "minimumFrameCount": 24,
        "minimumDurationSeconds": 0.8,
        "maximumFrameRotationDeltaDegrees": 50,
        "maximumFrameRotationAccelerationDegrees": 22,
        "minimumRootTravelUnits": 7,
        "minimumRootForwardTravelUnits": 6,
        "minimumRootForwardSpeedChangeUnits": 0.18,
        "minimumRootLateralShiftUnits": 3.5,
        "minimumRootVerticalBounceUnits": 0,
        "minimumReadyStanceLegLoadDegrees": 0,
        "minimumLegDriveRangeDegrees": 30,
        "minimumLocomotionStrideBalanceRatio": 0,
        "minimumLocomotionFootPlantDriveRatio": 0,
        "minimumAlternatingLegSeparationDegrees": 0,
        "minimumLocomotionArmSwingRangeDegrees": 0,
        "minimumLocomotionContralateralSyncRatio": 0,
        "minimumFootPlantContactFrames": 8,
        "minimumFootPlantSideCount": 2,
        "minimumFootPlantBalanceRatio": 0.56,
        "minimumFootPlantHoldFramesPerSide": 3,
        "maximumFootPlantRootDriftUnits": 7,
        "minimumTotalRotationRangeDegrees": 220,
        "minimumStridePhaseChanges": 0,
        "minimumStrideCycleSpanRatio": 0,
        "minimumStickActionArmRangeDegrees": 120,
        "minimumStickActionTwoHandBalanceRatio": 0.55,
        "minimumStickActionTwoHandSyncRatio": 0.65,
        "minimumStickActionTwoHandContactRatio": 0.75,
        "minimumStickActionPhaseChanges": 2,
        "minimumStickActionBeatSpanRatio": 0.35,
        "minimumStickActionReleasePeakRatio": 0.35,
        "maximumStickActionReleasePeakRatio": 0.82,
        "minimumStickActionSupportedReleaseRatio": 0.4,
        "minimumStickActionTorsoRangeDegrees": 32,
        "minimumHipShoulderSeparationDegrees": 7,
        "minimumStickActionLowerBodyLeadFrames": 2,
        "minimumStickActionRecoveryRatio": 0.75,
        "minimumAthleticTorsoLeanDegrees": 10,
        "maximumLoopClosureErrorDegrees": 999,
        "maximumLoopVerticalOffsetUnits": 999,
    },
}

GOALIE_REQUIRED_CLIPS = [
    "goalie-ready",
    "goalie-slide",
]

TARGETS = [
    {
        "key": "runnerHome",
        "exact": "goon-runner-home",
        "neutral": "goon-runner-production",
        "output": "goon-runner-home.glb",
        "profile": "runner",
        "required_clips": RUNNER_REQUIRED_CLIPS,
        "palette": {
            "jersey": (0.96, 0.98, 1.0, 1.0),
            "accent": (0.05, 0.28, 0.82, 1.0),
            "shorts": (0.03, 0.05, 0.09, 1.0),
        },
    },
    {
        "key": "runnerAway",
        "exact": "goon-runner-away",
        "neutral": "goon-runner-production",
        "output": "goon-runner-away.glb",
        "profile": "runner",
        "required_clips": RUNNER_REQUIRED_CLIPS,
        "palette": {
            "jersey": (0.86, 0.04, 0.07, 1.0),
            "accent": (0.98, 0.98, 1.0, 1.0),
            "shorts": (0.04, 0.05, 0.08, 1.0),
        },
    },
    {
        "key": "goalieHome",
        "exact": "goon-goalie-home",
        "neutral": "goon-goalie-production",
        "output": "goon-goalie-home.glb",
        "profile": "goalie",
        "required_clips": GOALIE_REQUIRED_CLIPS,
        "palette": {
            "jersey": (0.96, 0.98, 1.0, 1.0),
            "accent": (0.05, 0.28, 0.82, 1.0),
            "shorts": (0.03, 0.05, 0.09, 1.0),
        },
    },
    {
        "key": "goalieAway",
        "exact": "goon-goalie-away",
        "neutral": "goon-goalie-production",
        "output": "goon-goalie-away.glb",
        "profile": "goalie",
        "required_clips": GOALIE_REQUIRED_CLIPS,
        "palette": {
            "jersey": (0.86, 0.04, 0.07, 1.0),
            "accent": (0.98, 0.98, 1.0, 1.0),
            "shorts": (0.04, 0.05, 0.08, 1.0),
        },
    },
]

EXTENSIONS = [".fbx", ".glb", ".gltf"]

PART_KEYWORDS = {
    "jersey_uniform_top": ["jersey", "shirt", "uniform", "torso", "top"],
    "shorts": ["short", "shorts", "pants"],
    "shoe_footwear": ["shoe", "sneaker", "footwear", "trainer", "boot"],
    "helmet_cage_visor": ["helmet", "mask", "cage", "visor"],
    "glove_mitt": ["glove", "mitt", "blocker", "catcher"],
    "stick_shaft_blade": ["stick", "shaft", "blade"],
    "legpad_pad": ["pad", "legpad", "leg_pad"],
}

RUNNER_BONES = {
    "head": "CC_Base_Head",
    "spine": "CC_Base_Spine02",
    "waist": "CC_Base_Waist",
    "left_hand": "CC_Base_L_Hand",
    "right_hand": "CC_Base_R_Hand",
    "left_foot": "CC_Base_L_Foot",
    "right_foot": "CC_Base_R_Foot",
    "left_thigh": "CC_Base_L_Thigh",
    "right_thigh": "CC_Base_R_Thigh",
}

RUNNER_BONE_ALIASES = {
    "head": ["CC_Base_Head", "Head"],
    "spine1": ["CC_Base_Spine01", "Spine1"],
    "spine": ["CC_Base_Spine02", "Spine2", "Spine1"],
    "waist": ["CC_Base_Waist", "Hips", "Pelvis"],
    "hip": ["CC_Base_Hip", "Hips", "Pelvis"],
    "left_hand": ["CC_Base_L_Hand", "LeftHand"],
    "right_hand": ["CC_Base_R_Hand", "RightHand"],
    "left_foot": ["CC_Base_L_Foot", "LeftFoot"],
    "right_foot": ["CC_Base_R_Foot", "RightFoot"],
    "left_thigh": ["CC_Base_L_Thigh", "LeftUpLeg"],
    "right_thigh": ["CC_Base_R_Thigh", "RightUpLeg"],
    "left_calf": ["CC_Base_L_Calf", "LeftLeg"],
    "right_calf": ["CC_Base_R_Calf", "RightLeg"],
    "left_upperarm": ["CC_Base_L_Upperarm", "LeftArm"],
    "right_upperarm": ["CC_Base_R_Upperarm", "RightArm"],
    "left_forearm": ["CC_Base_L_Forearm", "LeftForeArm"],
    "right_forearm": ["CC_Base_R_Forearm", "RightForeArm"],
}

RUNNER_HIDDEN_DETAIL_MESHES = [
    "cc_base_eye",
    "std_cornea",
    "cornea",
    "eye_detail",
    "eyelash",
    "eyebrow",
    "nail",
    "tongue",
    "teeth",
    "tearline",
    "eyeocclusion",
    "eye_occlusion",
]

RUNNER_TARGET_HEIGHT_M = 1.85
RUNNER_MAX_HEIGHT_M = 2.45


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1 :]
    else:
        argv = []

    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--runners-only", action="store_true")
    return parser.parse_args(argv)


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    purge_orphan_data()


def purge_orphan_data():
    for data_collection in [
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.actions,
        bpy.data.armatures,
        bpy.data.images,
        bpy.data.textures,
    ]:
        for data_block in list(data_collection):
            if data_block.users == 0:
                data_collection.remove(data_block)


def find_source(source_dir, target):
    for stem in [target["exact"], target["neutral"]]:
        for extension in EXTENSIONS:
            candidate = source_dir / f"{stem}{extension}"
            if candidate.exists():
                return candidate
    return None


def import_source(source):
    suffix = source.suffix.lower()
    if suffix in [".glb", ".gltf"]:
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(source))
    else:
        raise RuntimeError(f"Unsupported source format: {source}")


def all_objects():
    return list(bpy.context.scene.objects)


def set_material_color(material, color):
    material.use_nodes = True
    strip_material_textures(material)
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = 0.78
        bsdf.inputs["Metallic"].default_value = 0.0
    material.diffuse_color = color


def strip_material_textures(material):
    if not material.use_nodes or not material.node_tree:
        return
    for node in list(material.node_tree.nodes):
        if node.type == "TEX_IMAGE":
            material.node_tree.nodes.remove(node)


def normalize_materials(target):
    palette = target["palette"]
    for material in bpy.data.materials:
        name = material.name.lower()
        if any(token in name for token in ["jersey", "shirt", "uniform", "torso", "top"]):
            material.name = "jersey_uniform_top"
            set_material_color(material, palette["jersey"])
        elif any(token in name for token in ["short", "pants"]):
            material.name = "shorts"
            set_material_color(material, palette["shorts"])
        elif any(token in name for token in ["stripe", "trim", "accent"]):
            material.name = "uniform_accent"
            set_material_color(material, palette["accent"])
        elif any(token in name for token in ["shoe", "sneaker", "footwear", "trainer"]):
            material.name = "shoe_footwear"
            set_material_color(material, (0.04, 0.05, 0.07, 1.0))
        elif any(token in name for token in ["stick", "shaft", "blade"]):
            material.name = "stick_shaft_blade"
            set_material_color(material, (0.02, 0.025, 0.03, 1.0))
        elif any(token in name for token in ["body", "skin", "cc_base"]):
            material.name = "skin_body"
            set_material_color(material, (0.72, 0.55, 0.43, 1.0))
        elif "eye" in name:
            material.name = "eye_detail"
            set_material_color(material, (0.045, 0.052, 0.065, 1.0))
        elif "hair" in name:
            material.name = "hair_detail"
            set_material_color(material, (0.035, 0.04, 0.052, 1.0))
        else:
            strip_material_textures(material)


def normalize_part_names():
    for obj in all_objects():
        text = " ".join([obj.name, *(slot.material.name for slot in obj.material_slots if slot.material)]).lower()
        for normalized_name, keywords in PART_KEYWORDS.items():
            if any(keyword in text for keyword in keywords):
                obj.name = f"{normalized_name}_{obj.name}"
                if obj.type == "MESH" and obj.data:
                    obj.data.name = f"{normalized_name}_{obj.data.name}"
                break


def normalize_armature_names(target):
    for obj in all_objects():
        if obj.type == "ARMATURE":
            obj.name = f"{target['key']}_Armature"
            obj.data.name = f"{target['key']}_Skeleton"


def find_armature():
    for obj in all_objects():
        if obj.type == "ARMATURE":
            return obj
    return None


def find_bone_name(armature, aliases):
    if not armature:
        return None
    bone_names = [bone.name for bone in armature.data.bones]
    for alias in aliases:
        for bone_name in bone_names:
            if bone_name == alias or bone_name.endswith(f":{alias}"):
                return bone_name
    return None


def resolve_runner_bones(armature):
    return {
        key: find_bone_name(armature, aliases) or RUNNER_BONES.get(key)
        for key, aliases in RUNNER_BONE_ALIASES.items()
    }


def scene_text():
    parts = []
    for obj in all_objects():
        parts.append(obj.name)
        if obj.type == "MESH" and obj.data:
            parts.append(obj.data.name)
        parts.extend(slot.material.name for slot in obj.material_slots if slot.material)
    parts.extend(material.name for material in bpy.data.materials)
    return " ".join(parts).lower()


def has_part(keywords):
    text = scene_text()
    return any(keyword in text for keyword in keywords)


def remove_nonproduction_helper_meshes():
    for obj in list(all_objects()):
        if obj.type != "MESH":
            continue
        has_material = any(slot.material for slot in obj.material_slots)
        name = obj.name.lower()
        max_dimension = max(obj.dimensions) if obj.dimensions else 0
        is_generic_helper = name.startswith("icosphere") or name.startswith("helper")
        if is_generic_helper and not has_material and max_dimension > 0.5:
            bpy.data.objects.remove(obj, do_unlink=True)


def remove_runner_hidden_detail_meshes():
    for obj in list(all_objects()):
        if obj.type != "MESH":
            continue
        name = obj.name.lower()
        if any(keyword in name for keyword in RUNNER_HIDDEN_DETAIL_MESHES):
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        hidden_material_slots = {
            index
            for index, slot in enumerate(obj.material_slots)
            if slot.material
            and any(keyword in slot.material.name.lower() for keyword in RUNNER_HIDDEN_DETAIL_MESHES)
        }
        if not hidden_material_slots:
            continue
        mesh = obj.data
        bm = bmesh.new()
        bm.from_mesh(mesh)
        hidden_faces = [face for face in bm.faces if face.material_index in hidden_material_slots]
        if hidden_faces:
            bmesh.ops.delete(bm, geom=hidden_faces, context="FACES")
            loose_vertices = [vertex for vertex in bm.verts if not vertex.link_faces]
            if loose_vertices:
                bmesh.ops.delete(bm, geom=loose_vertices, context="VERTS")
            bm.to_mesh(mesh)
            mesh.update()
        bm.free()
        if len(mesh.polygons) == 0:
            bpy.data.objects.remove(obj, do_unlink=True)


def assign_runner_skinned_arm_compression_faces(compression_material):
    bounds = get_scene_bounds()
    min_x, _min_y, min_z = bounds["min"]
    max_x, _max_y, _max_z = bounds["max"]
    height = max(bounds["height"], 1.0)
    center_x = (min_x + max_x) / 2
    lateral_min = height * RUNNER_SKIN_ARM_LATERAL_MIN_FACTOR
    min_arm_z = min_z + height * RUNNER_SKIN_ARM_VERTICAL_MIN_FACTOR
    max_arm_z = min_z + height * RUNNER_SKIN_ARM_VERTICAL_MAX_FACTOR
    faces_repainted = 0
    objects_repainted = []

    for obj in list(all_objects()):
        if obj.type != "MESH" or not obj.data:
            continue

        skin_slots = {
            index
            for index, material in enumerate(obj.data.materials)
            if material and "skin_body" in material.name.lower()
        }
        if not skin_slots:
            continue

        compression_index = None
        for index, material in enumerate(obj.data.materials):
            if material == compression_material:
                compression_index = index
                break
        if compression_index is None:
            obj.data.materials.append(compression_material)
            compression_index = len(obj.data.materials) - 1

        mesh = obj.data
        bm = bmesh.new()
        bm.from_mesh(mesh)
        changed = False
        object_faces_repainted = 0
        for face in bm.faces:
            if face.material_index not in skin_slots:
                continue
            center = obj.matrix_world @ face.calc_center_median()
            if min_arm_z <= center.z <= max_arm_z and abs(center.x - center_x) >= lateral_min:
                face.material_index = compression_index
                changed = True
                object_faces_repainted += 1
        if changed:
            bm.to_mesh(mesh)
            mesh.update()
            faces_repainted += object_faces_repainted
            objects_repainted.append(
                {
                    "object": obj.name,
                    "facesRepainted": object_faces_repainted,
                }
            )
        bm.free()

    return {
        "facesRepainted": faces_repainted,
        "objectCount": len(objects_repainted),
        "objects": objects_repainted,
        "lateralMinFactor": RUNNER_SKIN_ARM_LATERAL_MIN_FACTOR,
        "verticalMinFactor": RUNNER_SKIN_ARM_VERTICAL_MIN_FACTOR,
        "verticalMaxFactor": RUNNER_SKIN_ARM_VERTICAL_MAX_FACTOR,
    }


def compact_runner_skinned_arm_geometry():
    bounds = get_scene_bounds()
    min_x, _min_y, min_z = bounds["min"]
    max_x, _max_y, _max_z = bounds["max"]
    height = max(bounds["height"], 1.0)
    center_x = (min_x + max_x) / 2
    lateral_min = height * RUNNER_SKIN_ARM_LATERAL_MIN_FACTOR
    width_cap = height * RUNNER_SKIN_ARM_WIDTH_CAP_FACTOR
    min_arm_z = min_z + height * RUNNER_SKIN_ARM_VERTICAL_MIN_FACTOR
    max_arm_z = min_z + height * RUNNER_SKIN_ARM_VERTICAL_MAX_FACTOR
    vertices_compacted = 0
    objects_compacted = []

    for obj in list(all_objects()):
        if obj.type != "MESH" or not obj.data:
            continue
        has_skin_material = any(
            material and "skin_body" in material.name.lower()
            for material in obj.data.materials
        )
        if not has_skin_material:
            continue

        inverse_world = obj.matrix_world.inverted()
        object_vertices_compacted = 0
        for vertex in obj.data.vertices:
            world = obj.matrix_world @ vertex.co
            lateral = world.x - center_x
            abs_lateral = abs(lateral)
            if not (min_arm_z <= world.z <= max_arm_z and abs_lateral >= lateral_min):
                continue
            if abs_lateral <= width_cap:
                continue

            side = 1 if lateral >= 0 else -1
            compacted_lateral = width_cap + ((abs_lateral - width_cap) * RUNNER_SKIN_ARM_OUTER_SHRINK_RATIO)
            world.x = center_x + side * compacted_lateral
            vertex.co = inverse_world @ world
            vertices_compacted += 1
            object_vertices_compacted += 1

        if object_vertices_compacted:
            obj.data.update()
            objects_compacted.append(
                {
                    "object": obj.name,
                    "verticesCompacted": object_vertices_compacted,
                }
            )

    bpy.context.view_layer.update()
    return {
        "verticesCompacted": vertices_compacted,
        "objectCount": len(objects_compacted),
        "objects": objects_compacted,
        "lateralMinFactor": RUNNER_SKIN_ARM_LATERAL_MIN_FACTOR,
        "widthCapFactor": RUNNER_SKIN_ARM_WIDTH_CAP_FACTOR,
        "outerShrinkRatio": RUNNER_SKIN_ARM_OUTER_SHRINK_RATIO,
    }


def prune_runner_skin_weights_for_gltf():
    vertices_visited = 0
    vertices_pruned = 0
    weights_removed = 0
    weights_normalized = 0
    max_influences_before = 0
    max_influences_after = 0
    objects_pruned = []

    for obj in list(all_objects()):
        if obj.type != "MESH" or not obj.data or not obj.vertex_groups:
            continue

        object_vertices_visited = 0
        object_vertices_pruned = 0
        object_weights_removed = 0
        object_weights_normalized = 0
        object_max_before = 0
        object_max_after = 0

        for vertex in obj.data.vertices:
            vertex_group_weights = sorted(
                [
                    (group.group, group.weight)
                    for group in vertex.groups
                    if group.group < len(obj.vertex_groups) and group.weight > 0
                ],
                key=lambda item: item[1],
                reverse=True,
            )
            if not vertex_group_weights:
                continue

            object_vertices_visited += 1
            vertices_visited += 1
            before_count = len(vertex_group_weights)
            object_max_before = max(object_max_before, before_count)
            max_influences_before = max(max_influences_before, before_count)

            kept = vertex_group_weights[:GLTF_MAX_VERTEX_JOINT_INFLUENCES]
            removed = vertex_group_weights[GLTF_MAX_VERTEX_JOINT_INFLUENCES:]
            for group_index, _weight in removed:
                obj.vertex_groups[group_index].remove([vertex.index])

            if removed:
                vertices_pruned += 1
                object_vertices_pruned += 1
                weights_removed += len(removed)
                object_weights_removed += len(removed)

            total_weight = sum(weight for _group_index, weight in kept)
            if total_weight > 0:
                for group_index, weight in kept:
                    obj.vertex_groups[group_index].add(
                        [vertex.index],
                        weight / total_weight,
                        "REPLACE",
                    )
                    weights_normalized += 1
                    object_weights_normalized += 1

            after_count = min(before_count, GLTF_MAX_VERTEX_JOINT_INFLUENCES)
            object_max_after = max(object_max_after, after_count)
            max_influences_after = max(max_influences_after, after_count)

        if object_vertices_visited:
            obj.data.update()
            objects_pruned.append(
                {
                    "object": obj.name,
                    "verticesVisited": object_vertices_visited,
                    "verticesPruned": object_vertices_pruned,
                    "weightsRemoved": object_weights_removed,
                    "weightsNormalized": object_weights_normalized,
                    "maxInfluencesBefore": object_max_before,
                    "maxInfluencesAfter": object_max_after,
                }
            )

    return {
        "maxAllowedInfluences": GLTF_MAX_VERTEX_JOINT_INFLUENCES,
        "verticesVisited": vertices_visited,
        "verticesPruned": vertices_pruned,
        "weightsRemoved": weights_removed,
        "weightsNormalized": weights_normalized,
        "maxInfluencesBefore": max_influences_before,
        "maxInfluencesAfter": max_influences_after,
        "objectCount": len(objects_pruned),
        "objects": objects_pruned,
    }


def remove_shape_keys():
    removed = []
    previous_active = bpy.context.view_layer.objects.active
    previous_selection = list(bpy.context.selected_objects)
    bpy.ops.object.select_all(action="DESELECT")

    for obj in list(all_objects()):
        if obj.type != "MESH" or not obj.data or not obj.data.shape_keys:
            continue
        removed.append(
            {
                "object": obj.name,
                "count": len(obj.data.shape_keys.key_blocks),
            }
        )
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.shape_key_remove(all=True)
        obj.select_set(False)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in previous_selection:
        if obj.name in bpy.data.objects:
            obj.select_set(True)
    if previous_active and previous_active.name in bpy.data.objects:
        bpy.context.view_layer.objects.active = previous_active

    return removed


def get_scene_bounds():
    mesh_objects = [obj for obj in all_objects() if obj.type == "MESH"]
    if not mesh_objects:
        return {"min": (-0.5, -0.2, 0.0), "max": (0.5, 0.2, 1.8), "height": 1.8}
    mins = [float("inf"), float("inf"), float("inf")]
    maxs = [float("-inf"), float("-inf"), float("-inf")]
    for obj in mesh_objects:
        for corner in obj.bound_box:
            world = obj.matrix_world @ bpy.mathutils.Vector(corner) if hasattr(bpy, "mathutils") else None
            if world is None:
                import mathutils
                world = obj.matrix_world @ mathutils.Vector(corner)
            for axis in range(3):
                mins[axis] = min(mins[axis], world[axis])
                maxs[axis] = max(maxs[axis], world[axis])
    return {
        "min": tuple(mins),
        "max": tuple(maxs),
        "height": maxs[2] - mins[2],
        "width": maxs[0] - mins[0],
        "depth": maxs[1] - mins[1],
    }


def normalize_scene_height(target_height=RUNNER_TARGET_HEIGHT_M, max_height=RUNNER_MAX_HEIGHT_M):
    before = get_scene_bounds()
    height = before.get("height", 0)
    if height <= 0:
        return {"appliedScale": 1.0, "before": before, "after": before}

    applied_scale = 1.0
    if height > max_height:
        applied_scale = target_height / height
        for obj in all_objects():
            if obj.parent is None:
                obj.scale = (
                    obj.scale[0] * applied_scale,
                    obj.scale[1] * applied_scale,
                    obj.scale[2] * applied_scale,
                )
        bpy.context.view_layer.update()

    shifted = False
    after_scale = get_scene_bounds()
    if after_scale["min"][2] != 0:
        z_offset = -after_scale["min"][2]
        for obj in all_objects():
            if obj.parent is None:
                obj.location.z += z_offset
        shifted = True
        bpy.context.view_layer.update()

    after = get_scene_bounds()
    return {
        "appliedScale": applied_scale,
        "shiftedToFloor": shifted,
        "before": before,
        "after": after,
    }


def create_material(name, color, roughness=0.78, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    material.diffuse_color = color
    return material


def assign_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def parent_to_bone(obj, armature, bone_name):
    if not armature or bone_name not in armature.data.bones:
        return
    matrix_world = obj.matrix_world.copy()
    obj.parent = armature
    obj.parent_type = "BONE"
    obj.parent_bone = bone_name
    obj.matrix_world = matrix_world


def add_cube(name, location, scale, material, armature=None, bone_name=None):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    if armature and bone_name:
        parent_to_bone(obj, armature, bone_name)
    return obj


def add_flat_strip(name, location, scale, material, armature=None, bone_name=None):
    width, _, height = scale
    half_width = width / 2
    half_height = height / 2
    mesh = bpy.data.meshes.new(name)
    vertices = [
        (-half_width, 0, -half_height),
        (half_width, 0, -half_height),
        (half_width, 0, half_height),
        (-half_width, 0, half_height),
    ]
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    assign_material(obj, material)
    if armature and bone_name:
        parent_to_bone(obj, armature, bone_name)
    return obj


def add_horizontal_strip(name, location, scale, material, armature=None, bone_name=None):
    width, depth, _ = scale
    half_width = width / 2
    half_depth = depth / 2
    mesh = bpy.data.meshes.new(name)
    vertices = [
        (-half_width, -half_depth, 0),
        (half_width, -half_depth, 0),
        (half_width, half_depth, 0),
        (-half_width, half_depth, 0),
    ]
    mesh.from_pydata(vertices, [], [(0, 1, 2, 3)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    assign_material(obj, material)
    if armature and bone_name:
        parent_to_bone(obj, armature, bone_name)
    return obj


def add_rounded_box(name, location, scale, material, armature=None, bone_name=None, bevel=0.025, segments=2):
    obj = add_cube(name, location, scale, material, armature, bone_name)
    modifier = obj.modifiers.new(name=f"{name}_soft_edges", type="BEVEL")
    modifier.width = bevel
    modifier.segments = segments
    modifier.affect = "EDGES"
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    return obj


def add_uv_sphere(name, location, scale, material, armature=None, bone_name=None, segments=18, rings=9):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    assign_material(obj, material)
    if armature and bone_name:
        parent_to_bone(obj, armature, bone_name)
    return obj


def add_cylinder(name, location, radius, depth, material, armature=None, bone_name=None, vertices=32, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.name = name
    assign_material(obj, material)
    if armature and bone_name:
        parent_to_bone(obj, armature, bone_name)
    return obj


def build_runner_equipment(target):
    armature = find_armature()
    bones = resolve_runner_bones(armature)
    source_has_clothing = has_part(["jersey", "shirt", "uniform_top"])
    source_has_shorts = has_part(["short", "shorts"])
    source_has_footwear = has_part(["shoe", "sneaker", "footwear"])
    source_has_forearm_sleeves = has_part(["forearm_sleeve", "compression_sleeve_forearm"])
    source_has_upper_arm_compression = has_part(["upperarm_sleeve", "upper_arm_sleeve", "compression_sleeve_upperarm"])
    equipment_armature = None if source_has_clothing else armature
    skin_arm_geometry_report = compact_runner_skinned_arm_geometry()
    skin_weight_pruning_report = prune_runner_skin_weights_for_gltf()
    bounds = get_scene_bounds()
    min_x, min_y, min_z = bounds["min"]
    max_x, max_y, max_z = bounds["max"]
    height = max(bounds["height"], 1.0)
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    foot_z = min_z + height * 0.035

    jersey_mat = create_material("jersey_uniform_top", target["palette"]["jersey"], 0.82)
    accent_mat = create_material("uniform_accent", target["palette"]["accent"], 0.72)
    underarm_mat = create_material("jersey_underarm_gusset", (0.018, 0.022, 0.03, 1.0), 0.8)
    shorts_mat = create_material("shorts", target["palette"]["shorts"], 0.84)
    sock_mat = create_material("sock_shin_guard", (0.94, 0.96, 0.98, 1.0), 0.72)
    pad_mat = create_material("shoulder_elbow_pad", (0.025, 0.03, 0.04, 1.0), 0.68)
    strap_mat = create_material("equipment_strap", (0.006, 0.007, 0.01, 1.0), 0.62)
    compression_mat = create_material("compression_sleeve_skinned_arm", (0.025, 0.03, 0.04, 1.0), 0.74)
    shoe_mat = create_material("shoe_footwear", (0.035, 0.04, 0.055, 1.0), 0.78)
    glove_mat = create_material("glove_mitt", (0.025, 0.03, 0.04, 1.0), 0.72)
    glove_grip_mat = create_material("glove_grip_tape", (0.008, 0.009, 0.012, 1.0), 0.64)
    jersey_socket_bridge_mat = create_material("jersey_socket_bridge", (0.006, 0.008, 0.014, 1.0), 0.7)
    helmet_mat = create_material("helmet_cage_visor", target["palette"]["jersey"], 0.68)
    cage_mat = create_material("helmet_cage_visor_wire", (0.015, 0.018, 0.024, 1.0), 0.4, 0.3)
    neck_mat = create_material("neck_guard_collar", (0.01, 0.012, 0.018, 1.0), 0.66)
    shoe_tread_mat = create_material("shoe_footwear_contact_tread", (0.004, 0.005, 0.007, 1.0), 0.68)
    shoe_lace_mat = create_material("shoe_footwear_lace_bridge", target["palette"]["accent"], 0.72)
    skin_arm_compression_report = assign_runner_skinned_arm_compression_faces(compression_mat)
    neck_detail_objects = []
    shoulder_socket_detail_objects = []
    footwear_contact_detail_objects = []

    torso_z = min_z + height * 0.62
    shoulder_z = min_z + height * 0.74
    waist_z = min_z + height * 0.49
    hip_z = min_z + height * 0.42
    head_z = min_z + height * 0.91
    hand_z = min_z + height * 0.52
    knee_z = min_z + height * 0.33
    shin_z = min_z + height * 0.23

    if not source_has_clothing:
        add_rounded_box(
            "jersey_uniform_top_shell",
            (center_x, center_y, torso_z),
            (height * 0.34, height * 0.12, height * 0.34),
            jersey_mat,
            armature,
            bones["spine"],
            height * 0.018,
        )
        for side, x_offset, bone in [
            ("left", -height * RUNNER_JERSEY_SLEEVE_LATERAL_OFFSET_FACTOR, bones["left_upperarm"]),
            ("right", height * RUNNER_JERSEY_SLEEVE_LATERAL_OFFSET_FACTOR, bones["right_upperarm"]),
        ]:
            add_rounded_box(
                f"jersey_uniform_top_{side}_sleeve",
                (center_x + x_offset, center_y, shoulder_z - height * 0.055),
                (
                    height * RUNNER_JERSEY_SLEEVE_LENGTH_FACTOR,
                    height * RUNNER_JERSEY_SLEEVE_DEPTH_FACTOR,
                    height * RUNNER_JERSEY_SLEEVE_HEIGHT_FACTOR,
                ),
                jersey_mat,
                armature,
                bone,
                height * 0.012,
            )

    add_cube(
        "jersey_uniform_top_chest_stripe",
        (center_x, center_y - height * 0.064, torso_z + height * 0.018),
        (height * 0.39, height * 0.012, height * 0.035),
        accent_mat,
        equipment_armature,
        bones["spine"],
    )
    add_cube(
        "jersey_uniform_top_waist_band",
        (center_x, center_y - height * 0.064, waist_z),
        (height * 0.36, height * 0.012, height * 0.028),
        accent_mat,
        equipment_armature,
        bones["waist"],
    )
    add_rounded_box(
        "jersey_uniform_top_collar",
        (center_x, center_y - height * 0.062, shoulder_z + height * 0.014),
        (
            height * RUNNER_JERSEY_COLLAR_WIDTH_FACTOR,
            height * RUNNER_JERSEY_COLLAR_DEPTH_FACTOR,
            height * RUNNER_JERSEY_COLLAR_HEIGHT_FACTOR,
        ),
        accent_mat,
        armature,
        bones["spine"],
        height * 0.006,
    )
    add_rounded_box(
        "jersey_uniform_top_shoulder_yoke",
        (center_x, center_y - height * 0.066, shoulder_z - height * 0.032),
        (
            height * RUNNER_JERSEY_YOKE_WIDTH_FACTOR,
            height * RUNNER_JERSEY_YOKE_DEPTH_FACTOR,
            height * RUNNER_JERSEY_YOKE_HEIGHT_FACTOR,
        ),
        accent_mat,
        armature,
        bones["spine"],
        height * 0.006,
    )
    for side, x_offset, bone in [
        ("left", -height * RUNNER_JERSEY_SLEEVE_LATERAL_OFFSET_FACTOR, bones["left_upperarm"]),
        ("right", height * RUNNER_JERSEY_SLEEVE_LATERAL_OFFSET_FACTOR, bones["right_upperarm"]),
    ]:
        add_rounded_box(
            f"jersey_uniform_top_{side}_sleeve_cuff",
            (center_x + x_offset, center_y - height * 0.027, shoulder_z - height * 0.105),
            (
                height * RUNNER_JERSEY_SLEEVE_CUFF_WIDTH_FACTOR,
                height * RUNNER_JERSEY_SLEEVE_CUFF_DEPTH_FACTOR,
                height * RUNNER_JERSEY_SLEEVE_CUFF_HEIGHT_FACTOR,
            ),
            accent_mat,
            armature,
            bone,
            height * 0.005,
        )
        add_cube(
            f"jersey_uniform_top_{side}_sleeve_shoulder_stripe",
            (center_x + x_offset, center_y - height * 0.057, shoulder_z - height * 0.056),
            (
                height * RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_WIDTH_FACTOR,
                height * RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_DEPTH_FACTOR,
                height * RUNNER_JERSEY_SLEEVE_SHOULDER_STRIPE_HEIGHT_FACTOR,
            ),
            accent_mat,
            armature,
            bone,
        )
        add_flat_strip(
            f"jersey_uniform_top_{side}_shoulder_seam_tape",
            (
                center_x + x_offset * 0.92,
                center_y - height * 0.062,
                shoulder_z - height * 0.022,
            ),
            (
                height * RUNNER_JERSEY_SHOULDER_SEAM_TAPE_WIDTH_FACTOR,
                height * RUNNER_JERSEY_SHOULDER_SEAM_TAPE_DEPTH_FACTOR,
                height * RUNNER_JERSEY_SHOULDER_SEAM_TAPE_HEIGHT_FACTOR,
            ),
            accent_mat,
            armature,
            bone,
        )
        shoulder_socket_detail_objects.append(
            add_flat_strip(
                f"jersey_uniform_top_{side}_shoulder_socket_bridge",
                (
                    center_x + x_offset * 0.86,
                    center_y - height * (0.062 + RUNNER_SHOULDER_SOCKET_BRIDGE_DEPTH_FACTOR),
                    shoulder_z - height * 0.054,
                ),
                (
                    height * RUNNER_SHOULDER_SOCKET_BRIDGE_WIDTH_FACTOR,
                    height * RUNNER_SHOULDER_SOCKET_BRIDGE_DEPTH_FACTOR,
                    height * RUNNER_SHOULDER_SOCKET_BRIDGE_HEIGHT_FACTOR,
                ),
                jersey_socket_bridge_mat,
                armature,
                bone,
            )
        )
        add_rounded_box(
            f"jersey_uniform_top_{side}_underarm_gusset",
            (
                center_x + x_offset * 0.78,
                center_y - height * 0.04,
                shoulder_z - height * 0.072,
            ),
            (
                height * RUNNER_JERSEY_UNDERARM_GUSSET_WIDTH_FACTOR,
                height * RUNNER_JERSEY_UNDERARM_GUSSET_DEPTH_FACTOR,
                height * RUNNER_JERSEY_UNDERARM_GUSSET_HEIGHT_FACTOR,
            ),
            underarm_mat,
            armature,
            bone,
            height * 0.005,
            segments=1,
        )

    if not source_has_shorts:
        add_rounded_box(
            "shorts_shell",
            (center_x, center_y, hip_z),
            (height * 0.3, height * 0.12, height * 0.16),
            shorts_mat,
            armature,
            bones["waist"],
            height * 0.015,
        )

        for side, x_offset, bone in [
            ("left", -height * 0.065, bones["left_thigh"]),
            ("right", height * 0.065, bones["right_thigh"]),
        ]:
            add_rounded_box(
                f"shorts_{side}_leg",
                (center_x + x_offset, center_y, min_z + height * 0.34),
                (height * 0.09, height * 0.1, height * 0.2),
                shorts_mat,
                armature,
                bone,
                height * 0.012,
            )

    for side, x_offset, calf_bone, upperarm_bone, forearm_bone in [
        ("left", -height * 0.075, bones["left_calf"], bones["left_upperarm"], bones["left_forearm"]),
        ("right", height * 0.075, bones["right_calf"], bones["right_upperarm"], bones["right_forearm"]),
    ]:
        add_rounded_box(
            f"sock_shin_guard_{side}",
            (center_x + x_offset, center_y - height * 0.005, shin_z),
            (height * 0.095, height * 0.085, height * 0.28),
            sock_mat,
            armature,
            calf_bone,
            height * 0.01,
        )
        add_cube(
            f"sock_shin_guard_{side}_stripe",
            (center_x + x_offset, center_y - height * 0.05, knee_z),
            (height * 0.105, height * 0.012, height * 0.03),
            accent_mat,
            armature,
            calf_bone,
        )
        add_rounded_box(
            f"shoulder_elbow_pad_{side}_shoulder",
            (center_x + (x_offset * RUNNER_SHOULDER_PAD_LATERAL_MULTIPLIER), center_y - height * 0.004, shoulder_z),
            (
                height * RUNNER_SHOULDER_PAD_WIDTH_FACTOR,
                height * RUNNER_SHOULDER_PAD_DEPTH_FACTOR,
                height * RUNNER_SHOULDER_PAD_HEIGHT_FACTOR,
            ),
            pad_mat,
            armature,
            upperarm_bone,
            height * 0.012,
        )
        add_rounded_box(
            f"shoulder_elbow_pad_{side}_shoulder_cap_strap",
            (
                center_x + (x_offset * RUNNER_SHOULDER_PAD_LATERAL_MULTIPLIER),
                center_y - height * 0.048,
                shoulder_z + height * 0.018,
            ),
            (
                height * RUNNER_SHOULDER_PAD_CAP_STRAP_WIDTH_FACTOR,
                height * RUNNER_SHOULDER_PAD_CAP_STRAP_DEPTH_FACTOR,
                height * RUNNER_SHOULDER_PAD_CAP_STRAP_HEIGHT_FACTOR,
            ),
            strap_mat,
            armature,
            upperarm_bone,
            height * 0.004,
            segments=1,
        )
        if not source_has_upper_arm_compression:
            add_cube(
                f"compression_sleeve_upperarm_{side}",
                (
                    center_x + (x_offset * RUNNER_UPPER_ARM_COMPRESSION_LATERAL_MULTIPLIER),
                    center_y - height * 0.012,
                    shoulder_z - height * RUNNER_UPPER_ARM_COMPRESSION_VERTICAL_OFFSET_FACTOR,
                ),
                (
                    height * RUNNER_UPPER_ARM_COMPRESSION_WIDTH_FACTOR,
                    height * RUNNER_UPPER_ARM_COMPRESSION_DEPTH_FACTOR,
                    height * RUNNER_UPPER_ARM_COMPRESSION_HEIGHT_FACTOR,
                ),
                compression_mat,
                armature,
                upperarm_bone,
            )
        add_rounded_box(
            f"shoulder_elbow_pad_{side}_elbow",
            (center_x + (x_offset * RUNNER_ELBOW_PAD_LATERAL_MULTIPLIER), center_y - height * 0.01, hand_z + height * 0.08),
            (
                height * RUNNER_ELBOW_PAD_WIDTH_FACTOR,
                height * RUNNER_ELBOW_PAD_DEPTH_FACTOR,
                height * RUNNER_ELBOW_PAD_HEIGHT_FACTOR,
            ),
            pad_mat,
            armature,
            forearm_bone,
            height * 0.01,
        )
        add_rounded_box(
            f"shoulder_elbow_pad_{side}_elbow_upper_strap",
            (
                center_x + (x_offset * RUNNER_ELBOW_PAD_LATERAL_MULTIPLIER),
                center_y - height * 0.048,
                hand_z + height * 0.105,
            ),
            (
                height * RUNNER_ELBOW_PAD_STRAP_WIDTH_FACTOR,
                height * RUNNER_ELBOW_PAD_STRAP_DEPTH_FACTOR,
                height * RUNNER_ELBOW_PAD_STRAP_HEIGHT_FACTOR,
            ),
            strap_mat,
            armature,
            forearm_bone,
            height * 0.004,
            segments=1,
        )
        add_rounded_box(
            f"shoulder_elbow_pad_{side}_elbow_lower_strap",
            (
                center_x + (x_offset * RUNNER_ELBOW_PAD_LATERAL_MULTIPLIER),
                center_y - height * 0.048,
                hand_z + height * 0.055,
            ),
            (
                height * RUNNER_ELBOW_PAD_STRAP_WIDTH_FACTOR,
                height * RUNNER_ELBOW_PAD_STRAP_DEPTH_FACTOR,
                height * RUNNER_ELBOW_PAD_STRAP_HEIGHT_FACTOR,
            ),
            strap_mat,
            armature,
            forearm_bone,
            height * 0.004,
            segments=1,
        )
        add_cube(
            f"compression_sleeve_{side}_elbow_flex_band",
            (
                center_x + (x_offset * RUNNER_ELBOW_PAD_LATERAL_MULTIPLIER),
                center_y - height * 0.026,
                hand_z + height * 0.08,
            ),
            (
                height * RUNNER_ELBOW_FLEX_BAND_WIDTH_FACTOR,
                height * RUNNER_ELBOW_FLEX_BAND_DEPTH_FACTOR,
                height * RUNNER_ELBOW_FLEX_BAND_HEIGHT_FACTOR,
            ),
            compression_mat,
            armature,
            forearm_bone,
        )
        if not source_has_forearm_sleeves:
            add_rounded_box(
                f"compression_sleeve_forearm_{side}",
                (
                    center_x + (x_offset * RUNNER_FOREARM_SLEEVE_LATERAL_MULTIPLIER),
                    center_y - height * 0.014,
                    hand_z + height * RUNNER_FOREARM_SLEEVE_VERTICAL_OFFSET_FACTOR,
                ),
                (
                    height * RUNNER_FOREARM_SLEEVE_WIDTH_FACTOR,
                    height * RUNNER_FOREARM_SLEEVE_DEPTH_FACTOR,
                    height * RUNNER_FOREARM_SLEEVE_HEIGHT_FACTOR,
                ),
                compression_mat,
                armature,
                forearm_bone,
                height * 0.01,
            )

    if not source_has_footwear:
        for side, x_offset, bone in [
            ("left", -height * 0.065, bones["left_foot"]),
            ("right", height * 0.065, bones["right_foot"]),
        ]:
            add_cube(
                f"shoe_footwear_{side}",
                (center_x + x_offset, center_y - height * 0.025, foot_z),
                (height * 0.105, height * 0.235, height * 0.055),
                shoe_mat,
                armature,
                bone,
            )
            add_cube(
                f"shoe_footwear_{side}_sole",
                (center_x + x_offset, center_y - height * 0.03, foot_z - height * 0.026),
                (height * 0.112, height * 0.25, height * 0.016),
                accent_mat,
                armature,
                bone,
            )

    for side, x_offset, bone in [
        ("left", -height * 0.065, bones["left_foot"]),
        ("right", height * 0.065, bones["right_foot"]),
    ]:
        for tread_name, y_offset in [("toe", -0.116), ("heel", 0.052)]:
            footwear_contact_detail_objects.append(
                add_horizontal_strip(
                    f"shoe_footwear_{side}_contact_tread_{tread_name}",
                    (
                        center_x + x_offset,
                        center_y + height * y_offset,
                        min_z + height * 0.008,
                    ),
                    (
                        height * RUNNER_SHOE_CONTACT_TREAD_WIDTH_FACTOR,
                        height * RUNNER_SHOE_CONTACT_TREAD_DEPTH_FACTOR,
                        height * RUNNER_SHOE_CONTACT_TREAD_HEIGHT_FACTOR,
                    ),
                    shoe_tread_mat,
                    armature,
                    bone,
                )
            )
        footwear_contact_detail_objects.append(
            add_horizontal_strip(
                f"shoe_footwear_{side}_lace_bridge",
                (
                    center_x + x_offset,
                    center_y - height * 0.05,
                    foot_z + height * 0.042,
                ),
                (
                    height * RUNNER_SHOE_LACE_BRIDGE_LENGTH_FACTOR,
                    height * RUNNER_SHOE_LACE_BRIDGE_DEPTH_FACTOR,
                    height * RUNNER_SHOE_LACE_BRIDGE_HEIGHT_FACTOR,
                ),
                shoe_lace_mat,
                armature,
                bone,
            )
        )

    add_uv_sphere(
        "helmet_cage_visor_shell",
        (center_x, center_y, head_z),
        (height * 0.095, height * 0.082, height * 0.088),
        helmet_mat,
        equipment_armature,
        bones["head"],
        18,
        9,
    )
    neck_detail_objects.append(
        add_cube(
            "neck_guard_collar",
            (center_x, center_y - height * 0.018, head_z - height * 0.098),
            (
                height * RUNNER_NECK_GUARD_WIDTH_FACTOR,
                height * RUNNER_NECK_GUARD_DEPTH_FACTOR,
                height * RUNNER_NECK_GUARD_HEIGHT_FACTOR,
            ),
            neck_mat,
            armature,
            bones["head"],
        )
    )
    for side, side_sign in [("left", -1), ("right", 1)]:
        neck_detail_objects.append(
            add_flat_strip(
                f"helmet_cage_visor_chin_strap_{side}",
                (
                    center_x + side_sign * height * 0.034,
                    center_y - height * 0.088,
                    head_z - height * 0.064,
                ),
                (
                    height * RUNNER_CHIN_STRAP_WIDTH_FACTOR,
                    height * RUNNER_CHIN_STRAP_DEPTH_FACTOR,
                    height * RUNNER_CHIN_STRAP_HEIGHT_FACTOR,
                ),
                neck_mat,
                armature,
                bones["head"],
            )
        )
    for offset in [-0.04, 0, 0.04]:
        add_cube(
            f"helmet_cage_visor_bar_{offset}",
            (center_x + offset * height, center_y - height * 0.086, head_z - height * 0.012),
            (height * 0.008, height * 0.012, height * 0.12),
            cage_mat,
            equipment_armature,
            bones["head"],
        )
    add_cube(
        "helmet_cage_visor_crossbar",
        (center_x, center_y - height * 0.089, head_z - height * 0.012),
        (height * 0.16, height * 0.012, height * 0.009),
        cage_mat,
        equipment_armature,
        bones["head"],
    )

    for side, x_offset, bone in [
        ("left", -height * RUNNER_GLOVE_LATERAL_OFFSET_FACTOR, bones["left_hand"]),
        ("right", height * RUNNER_GLOVE_LATERAL_OFFSET_FACTOR, bones["right_hand"]),
    ]:
        side_sign = -1 if side == "left" else 1
        glove_center = (center_x + x_offset, center_y - height * 0.02, hand_z)
        add_uv_sphere(
            f"glove_mitt_{side}",
            glove_center,
            (
                height * RUNNER_GLOVE_WIDTH_FACTOR,
                height * RUNNER_GLOVE_DEPTH_FACTOR,
                height * RUNNER_GLOVE_HEIGHT_FACTOR,
            ),
            glove_mat,
            equipment_armature,
            bone,
            14,
            8,
        )
        add_rounded_box(
            f"glove_mitt_{side}_wrist_cuff",
            (center_x + x_offset, center_y - height * 0.014, hand_z - height * 0.044),
            (
                height * RUNNER_GLOVE_CUFF_WIDTH_FACTOR,
                height * RUNNER_GLOVE_CUFF_DEPTH_FACTOR,
                height * RUNNER_GLOVE_CUFF_HEIGHT_FACTOR,
            ),
            glove_mat,
            equipment_armature,
            bone,
            bevel=0.01,
            segments=2,
        )
        add_rounded_box(
            f"glove_mitt_{side}_palm_grip_pad",
            (center_x + x_offset, center_y - height * 0.058, hand_z - height * 0.004),
            (
                height * RUNNER_GLOVE_PALM_GRIP_WIDTH_FACTOR,
                height * RUNNER_GLOVE_PALM_GRIP_DEPTH_FACTOR,
                height * RUNNER_GLOVE_PALM_GRIP_HEIGHT_FACTOR,
            ),
            glove_grip_mat,
            equipment_armature,
            bone,
            bevel=0.004,
            segments=1,
        )
        add_rounded_box(
            f"glove_mitt_{side}_wrist_tape",
            (center_x + x_offset, center_y - height * 0.052, hand_z - height * 0.058),
            (
                height * RUNNER_GLOVE_WRIST_TAPE_WIDTH_FACTOR,
                height * RUNNER_GLOVE_WRIST_TAPE_DEPTH_FACTOR,
                height * RUNNER_GLOVE_WRIST_TAPE_HEIGHT_FACTOR,
            ),
            glove_grip_mat,
            equipment_armature,
            bone,
            bevel=0.003,
            segments=1,
        )
        add_uv_sphere(
            f"glove_mitt_{side}_thumb_guard",
            (
                center_x + x_offset + side_sign * height * 0.027,
                center_y - height * 0.044,
                hand_z - height * 0.002,
            ),
            (
                height * RUNNER_GLOVE_THUMB_GUARD_WIDTH_FACTOR,
                height * RUNNER_GLOVE_THUMB_GUARD_DEPTH_FACTOR,
                height * RUNNER_GLOVE_THUMB_GUARD_HEIGHT_FACTOR,
            ),
            glove_mat,
            equipment_armature,
            bone,
            10,
            6,
        )
        for ridge_index, ridge_offset in enumerate([-0.014, 0.014], start=1):
            add_rounded_box(
                f"glove_mitt_{side}_knuckle_ridge_{ridge_index}",
                (
                    center_x + x_offset + side_sign * height * ridge_offset,
                    center_y - height * 0.052,
                    hand_z + height * 0.034,
                ),
                (
                    height * RUNNER_GLOVE_KNUCKLE_RIDGE_WIDTH_FACTOR,
                    height * RUNNER_GLOVE_KNUCKLE_RIDGE_DEPTH_FACTOR,
                    height * RUNNER_GLOVE_KNUCKLE_RIDGE_HEIGHT_FACTOR,
                ),
                glove_mat,
                equipment_armature,
                bone,
                bevel=0.004,
                segments=1,
            )

    return {
        "sourceHasClothing": source_has_clothing,
        "sourceHasShorts": source_has_shorts,
        "sourceHasFootwear": source_has_footwear,
        "sourceHasForearmSleeves": source_has_forearm_sleeves,
        "sourceHasUpperArmCompression": source_has_upper_arm_compression,
        "skinArmCompression": skin_arm_compression_report,
        "skinArmGeometryCompaction": skin_arm_geometry_report,
        "skinWeightPruning": skin_weight_pruning_report,
        "neckConnectionDetail": {
            "meshCount": len(neck_detail_objects),
            "meshNames": [obj.name for obj in neck_detail_objects],
        },
        "shoulderSocketDetail": {
            "meshCount": len(shoulder_socket_detail_objects),
            "meshNames": [obj.name for obj in shoulder_socket_detail_objects],
            "bridgeWidthFactor": RUNNER_SHOULDER_SOCKET_BRIDGE_WIDTH_FACTOR,
            "bridgeDepthFactor": RUNNER_SHOULDER_SOCKET_BRIDGE_DEPTH_FACTOR,
            "bridgeHeightFactor": RUNNER_SHOULDER_SOCKET_BRIDGE_HEIGHT_FACTOR,
        },
        "footwearContactDetail": {
            "sourceHasFootwear": source_has_footwear,
            "meshCount": len(footwear_contact_detail_objects),
            "meshNames": [obj.name for obj in footwear_contact_detail_objects],
            "treadWidthFactor": RUNNER_SHOE_CONTACT_TREAD_WIDTH_FACTOR,
            "treadDepthFactor": RUNNER_SHOE_CONTACT_TREAD_DEPTH_FACTOR,
            "treadHeightFactor": RUNNER_SHOE_CONTACT_TREAD_HEIGHT_FACTOR,
            "laceBridgeLengthFactor": RUNNER_SHOE_LACE_BRIDGE_LENGTH_FACTOR,
        },
    }


def rotation_radians(degrees):
    return tuple(math.radians(value) for value in degrees)


def runner_visual_pose_rotation(key, degrees):
    if key in ["left_upperarm", "right_upperarm"]:
        x_value, y_value, z_value = degrees
        side = -1 if key == "left_upperarm" else 1
        return (
            x_value - RUNNER_UPPER_ARM_VISUAL_DROP_DEGREES,
            y_value - side * RUNNER_UPPER_ARM_VISUAL_TUCK_DEGREES,
            z_value,
        )
    return degrees


def reset_pose_bones(armature, bones):
    for bone_name in bones.values():
        if not bone_name or bone_name not in armature.pose.bones:
            continue
        pose_bone = armature.pose.bones[bone_name]
        pose_bone.rotation_mode = "XYZ"
        pose_bone.rotation_euler = (0.0, 0.0, 0.0)
        pose_bone.location = (0.0, 0.0, 0.0)
        pose_bone.scale = (1.0, 1.0, 1.0)


def set_pose_rotation(armature, bones, key, degrees):
    bone_name = bones.get(key)
    if not bone_name or bone_name not in armature.pose.bones:
        return
    pose_bone = armature.pose.bones[bone_name]
    pose_bone.rotation_mode = "XYZ"
    pose_bone.rotation_euler = rotation_radians(runner_visual_pose_rotation(key, degrees))


def keyframe_runner_pose(armature, bones, frame, rotations, hip_location=(0, 0, 0)):
    bpy.context.scene.frame_set(frame)
    reset_pose_bones(armature, bones)
    for key, degrees in rotations.items():
        set_pose_rotation(armature, bones, key, degrees)

    hip_name = bones.get("hip")
    if hip_name and hip_name in armature.pose.bones:
        armature.pose.bones[hip_name].location = hip_location

    for bone_name in bones.values():
        if not bone_name or bone_name not in armature.pose.bones:
            continue
        pose_bone = armature.pose.bones[bone_name]
        pose_bone.keyframe_insert("rotation_euler", frame=frame)
        pose_bone.keyframe_insert("location", frame=frame)


def clamp(value, lower, upper):
    return max(lower, min(upper, value))


def zxy_to_xyz(values):
    z_value, x_value, y_value = values
    return (x_value, y_value, z_value)


def round_metric(value):
    return round(value, 2)


def calculate_stride_cycle_metrics(frame_values):
    previous_sign = 0
    changes = 0
    change_frames = []

    for index, values in enumerate(frame_values):
        left_leg_x = values[19] if len(values) > 19 else 0
        right_leg_x = values[22] if len(values) > 22 else 0
        stride_difference = left_leg_x - right_leg_x
        current_sign = 0
        if abs(stride_difference) >= STRIDE_PHASE_DEAD_ZONE_DEGREES:
            current_sign = 1 if stride_difference > 0 else -1

        if current_sign == 0:
            continue
        if previous_sign != 0 and current_sign != previous_sign:
            changes += 1
            change_frames.append(index)
        previous_sign = current_sign

    denominator = max(1, len(frame_values) - 1)
    stride_cycle_span_ratio = (
        (change_frames[-1] - change_frames[0]) / denominator
        if len(change_frames) >= 2
        else 0
    )

    return {
        "stridePhaseChanges": changes,
        "strideCycleSpanRatio": round_metric(stride_cycle_span_ratio),
    }


def count_stride_phase_changes(frame_values):
    return calculate_stride_cycle_metrics(frame_values)["stridePhaseChanges"]


def calculate_stick_action_beat_metrics(frame_values):
    previous_trend = 0
    changes = 0
    beat_frames = []

    arm_sweep_values = [
        sum(
            value
            for value in values[STICK_ACTION_ARM_CHANNEL_START:STICK_ACTION_ARM_CHANNEL_END]
            if math.isfinite(value)
        )
        for values in frame_values
    ]

    for index in range(1, len(arm_sweep_values)):
        delta = arm_sweep_values[index] - arm_sweep_values[index - 1]
        current_trend = 0
        if abs(delta) >= STICK_ACTION_PHASE_DEAD_ZONE_DEGREES:
            current_trend = 1 if delta > 0 else -1

        if current_trend == 0:
            continue
        if previous_trend != 0 and current_trend != previous_trend:
            changes += 1
            beat_frames.append(index - 1)
        previous_trend = current_trend

    denominator = max(1, len(frame_values) - 1)
    beat_span_ratio = 0
    if len(beat_frames) >= 2:
        beat_span_ratio = (beat_frames[-1] - beat_frames[0]) / denominator

    return {
        "stickActionPhaseChanges": changes,
        "stickActionBeatSpanRatio": round_metric(beat_span_ratio),
    }


def count_stick_action_phase_changes(frame_values):
    return calculate_stick_action_beat_metrics(frame_values)["stickActionPhaseChanges"]


def calculate_stick_action_recovery_ratio(frame_values):
    if len(frame_values) < 2:
        return 0

    arm_action_values = calculate_stick_action_arm_distances(frame_values)
    peak_distance = max(arm_action_values, default=0)
    if peak_distance <= 0:
        return 0

    final_distance = arm_action_values[-1] if arm_action_values else 0
    recovery_ratio = (peak_distance - final_distance) / peak_distance
    return round_metric(max(0, min(1, recovery_ratio)))


def calculate_stick_action_arm_distances(frame_values):
    if not frame_values:
        return []

    arm_vectors = [
        values[STICK_ACTION_ARM_CHANNEL_START:STICK_ACTION_ARM_CHANNEL_END]
        for values in frame_values
    ]
    start_vector = arm_vectors[0] if arm_vectors else []

    def distance_from_start(vector):
        return math.sqrt(
            sum(
                ((vector[index] if index < len(vector) else 0) - start_value) ** 2
                for index, start_value in enumerate(start_vector)
            )
        )

    return [distance_from_start(vector) for vector in arm_vectors]


def calculate_stick_action_release_peak_ratio(frame_values):
    if len(frame_values) < 2:
        return 0

    arm_action_values = calculate_stick_action_arm_distances(frame_values)
    if max(arm_action_values, default=0) <= 0:
        return 0

    return round_metric(index_of_peak(arm_action_values) / max(1, len(frame_values) - 1))


def calculate_stick_action_supported_release_ratio(frame_values):
    if len(frame_values) < 2:
        return 0

    arm_action_values = calculate_stick_action_arm_distances(frame_values)
    if max(arm_action_values, default=0) <= 0:
        return 0

    root_heights = [
        values[1]
        for values in frame_values
        if len(values) > 1 and math.isfinite(values[1])
    ]
    if not root_heights:
        return 0

    min_root_height = min(root_heights)
    max_root_height = max(root_heights)
    low_root_threshold = min_root_height + ((max_root_height - min_root_height) * FOOT_PLANT_ROOT_LOW_RATIO)
    release_index = index_of_peak(arm_action_values)
    start_index = max(0, release_index - STICK_ACTION_RELEASE_SUPPORT_WINDOW_FRAMES)
    end_index = min(len(frame_values) - 1, release_index + STICK_ACTION_RELEASE_SUPPORT_WINDOW_FRAMES)
    supported_frames = 0
    total_frames = 0
    for frame_index in range(start_index, end_index + 1):
        total_frames += 1
        if foot_plant_contact_side(frame_values[frame_index], low_root_threshold) != 0:
            supported_frames += 1

    return round_metric(supported_frames / total_frames) if total_frames > 0 else 0


def index_of_peak(values):
    if not values:
        return 0
    return max(range(len(values)), key=lambda index: values[index])


def calculate_stick_action_lower_body_lead_frames(frame_values):
    if len(frame_values) < 2:
        return 0

    start_vector = frame_values[0][STICK_ACTION_ARM_CHANNEL_START:STICK_ACTION_ARM_CHANNEL_END]

    def arm_action_value(values):
        return math.sqrt(
            sum(
                ((values[STICK_ACTION_ARM_CHANNEL_START + index] if len(values) > STICK_ACTION_ARM_CHANNEL_START + index else 0) - start_value) ** 2
                for index, start_value in enumerate(start_vector)
            )
        )

    arm_action_values = [arm_action_value(values) for values in frame_values]
    lower_body_load_values = [
        abs(values[LEFT_LEG_DRIVE_CHANNEL] if len(values) > LEFT_LEG_DRIVE_CHANNEL else 0)
        + abs(values[RIGHT_LEG_DRIVE_CHANNEL] if len(values) > RIGHT_LEG_DRIVE_CHANNEL else 0)
        for values in frame_values
    ]

    return index_of_peak(arm_action_values) - index_of_peak(lower_body_load_values)


def calculate_correlation(left_values, right_values):
    count = min(len(left_values), len(right_values))
    if count < 2:
        return 0

    left_mean = sum(left_values[:count]) / count
    right_mean = sum(right_values[:count]) / count
    numerator = 0
    left_variance = 0
    right_variance = 0
    for index in range(count):
        left_delta = left_values[index] - left_mean
        right_delta = right_values[index] - right_mean
        numerator += left_delta * right_delta
        left_variance += left_delta * left_delta
        right_variance += right_delta * right_delta

    denominator = math.sqrt(left_variance * right_variance)
    return numerator / denominator if denominator > 0 else 0


def calculate_locomotion_contralateral_sync_ratio(frame_values):
    if len(frame_values) < 2:
        return 0

    left_arm = [values[LEFT_ARM_SWING_CHANNEL] if len(values) > LEFT_ARM_SWING_CHANNEL else 0 for values in frame_values]
    right_arm = [values[RIGHT_ARM_SWING_CHANNEL] if len(values) > RIGHT_ARM_SWING_CHANNEL else 0 for values in frame_values]
    left_leg = [values[LEFT_LEG_DRIVE_CHANNEL] if len(values) > LEFT_LEG_DRIVE_CHANNEL else 0 for values in frame_values]
    right_leg = [values[RIGHT_LEG_DRIVE_CHANNEL] if len(values) > RIGHT_LEG_DRIVE_CHANNEL else 0 for values in frame_values]
    left_arm_right_leg = calculate_correlation(left_arm, right_leg)
    right_arm_left_leg = calculate_correlation(right_arm, left_leg)

    return round_metric(max(0, (left_arm_right_leg + right_arm_left_leg) / 2))


def calculate_alternating_leg_separation(frame_values):
    separation_values = [
        abs(
            (values[LEFT_LEG_DRIVE_CHANNEL] if len(values) > LEFT_LEG_DRIVE_CHANNEL else 0)
            - (values[RIGHT_LEG_DRIVE_CHANNEL] if len(values) > RIGHT_LEG_DRIVE_CHANNEL else 0)
        )
        for values in frame_values
    ]
    return round_metric(max(separation_values)) if separation_values else 0


def calculate_locomotion_stride_balance_ratio(ranges):
    left_leg_range = ranges[LEFT_LEG_DRIVE_CHANNEL] if len(ranges) > LEFT_LEG_DRIVE_CHANNEL else 0
    right_leg_range = ranges[RIGHT_LEG_DRIVE_CHANNEL] if len(ranges) > RIGHT_LEG_DRIVE_CHANNEL else 0
    if left_leg_range <= 0 or right_leg_range <= 0:
        return 0

    return round_metric(min(left_leg_range, right_leg_range) / max(left_leg_range, right_leg_range))


def calculate_loop_closure_metrics(frame_values):
    first = frame_values[0] if frame_values else []
    last = frame_values[-1] if frame_values else []
    column_count = min(len(first), len(last))
    loop_closure_error = sum(
        abs((last[column_index] if column_index < len(last) else 0) - (first[column_index] if column_index < len(first) else 0))
        for column_index in range(3, column_count)
    )
    root_vertical_offset = abs((last[1] if len(last) > 1 else 0) - (first[1] if len(first) > 1 else 0))

    return {
        "locomotionLoopClosureErrorDegrees": round_metric(loop_closure_error),
        "rootVerticalLoopOffsetUnits": round_metric(root_vertical_offset),
    }


def calculate_root_forward_speed_change_units(frame_values):
    if len(frame_values) < 3:
        return 0

    forward_speeds = []
    for index in range(1, len(frame_values)):
        current_forward = frame_values[index][2] if len(frame_values[index]) > 2 else 0
        previous_forward = frame_values[index - 1][2] if len(frame_values[index - 1]) > 2 else 0
        forward_speeds.append(current_forward - previous_forward)

    return round_metric(max(forward_speeds) - min(forward_speeds)) if forward_speeds else 0


def calculate_max_frame_rotation_delta_degrees(frame_values):
    max_delta = 0
    for index in range(1, len(frame_values)):
        previous_values = frame_values[index - 1]
        current_values = frame_values[index]
        column_count = min(len(previous_values), len(current_values))
        for column_index in range(3, column_count):
            max_delta = max(max_delta, abs(current_values[column_index] - previous_values[column_index]))
    return round_metric(max_delta)


def calculate_max_frame_rotation_acceleration_degrees(frame_values):
    if len(frame_values) < 3:
        return 0

    frame_deltas = []
    for index in range(1, len(frame_values)):
        previous_values = frame_values[index - 1]
        current_values = frame_values[index]
        column_count = min(len(previous_values), len(current_values))
        deltas = {}
        for column_index in range(3, column_count):
            deltas[column_index] = current_values[column_index] - previous_values[column_index]
        frame_deltas.append(deltas)

    max_acceleration = 0
    for index in range(1, len(frame_deltas)):
        previous_deltas = frame_deltas[index - 1]
        current_deltas = frame_deltas[index]
        for column_index, current_delta in current_deltas.items():
            previous_delta = previous_deltas.get(column_index, 0)
            max_acceleration = max(max_acceleration, abs(current_delta - previous_delta))

    return round_metric(max_acceleration)


def foot_plant_contact_side(values, low_root_threshold):
    if len(values) <= 22 or not math.isfinite(values[1]) or values[1] > low_root_threshold:
        return 0

    stride_difference = values[19] - values[22]
    if abs(stride_difference) < STRIDE_PHASE_DEAD_ZONE_DEGREES:
        return 0

    return 1 if stride_difference > 0 else -1


def calculate_foot_plant_metrics(frame_values):
    root_heights = [
        values[1]
        for values in frame_values
        if len(values) > 1 and math.isfinite(values[1])
    ]
    if not root_heights:
        return {
            "footPlantContactFrameCount": 0,
            "footPlantSideCount": 0,
            "footPlantBalanceRatio": 0,
            "footPlantMinSideHoldFrames": 0,
            "maxFootPlantRootDriftUnits": 0,
        }

    min_root_height = min(root_heights)
    max_root_height = max(root_heights)
    low_root_threshold = min_root_height + ((max_root_height - min_root_height) * FOOT_PLANT_ROOT_LOW_RATIO)
    contact_sides = set()
    contact_counts = {}
    longest_hold_by_side = {}
    active_contact = None
    contact_frames = 0
    max_foot_plant_root_drift = 0

    for values in frame_values:
        side = foot_plant_contact_side(values, low_root_threshold)
        if side == 0:
            active_contact = None
            continue
        contact_frames += 1
        contact_sides.add(side)
        contact_counts[side] = contact_counts.get(side, 0) + 1
        root_x = values[0] if len(values) > 0 else 0
        root_z = values[2] if len(values) > 2 else 0
        if math.isfinite(root_x) and math.isfinite(root_z):
            if active_contact is None or active_contact["side"] != side:
                active_contact = {"side": side, "startX": root_x, "startZ": root_z, "frameCount": 0}
            active_contact["frameCount"] += 1
            longest_hold_by_side[side] = max(
                longest_hold_by_side.get(side, 0),
                active_contact["frameCount"],
            )
            max_foot_plant_root_drift = max(
                max_foot_plant_root_drift,
                math.hypot(root_x - active_contact["startX"], root_z - active_contact["startZ"]),
            )

    side_counts = [
        count
        for side, count in contact_counts.items()
        if side != 0
    ]
    foot_plant_balance_ratio = (
        round_metric(min(side_counts) / max(side_counts))
        if len(side_counts) >= 2 and max(side_counts) > 0
        else 0
    )
    side_hold_counts = [
        longest_hold_by_side.get(side, 0)
        for side in contact_sides
        if side != 0
    ]
    foot_plant_min_side_hold_frames = min(side_hold_counts) if side_hold_counts else 0

    return {
        "footPlantContactFrameCount": contact_frames,
        "footPlantSideCount": len(contact_sides),
        "footPlantBalanceRatio": foot_plant_balance_ratio,
        "footPlantMinSideHoldFrames": foot_plant_min_side_hold_frames,
        "maxFootPlantRootDriftUnits": round_metric(max_foot_plant_root_drift),
    }


def calculate_locomotion_foot_plant_drive_ratio(frame_values):
    root_heights = [
        values[1]
        for values in frame_values
        if len(values) > 1 and math.isfinite(values[1])
    ]
    if len(frame_values) < 2 or not root_heights:
        return 0

    min_root_height = min(root_heights)
    max_root_height = max(root_heights)
    low_root_threshold = min_root_height + ((max_root_height - min_root_height) * FOOT_PLANT_ROOT_LOW_RATIO)
    total_forward_drive = 0
    planted_forward_drive = 0

    for index in range(1, len(frame_values)):
        current_forward = frame_values[index][2] if len(frame_values[index]) > 2 else 0
        previous_forward = frame_values[index - 1][2] if len(frame_values[index - 1]) > 2 else 0
        forward_drive = max(0, current_forward - previous_forward)
        if forward_drive <= 0:
            continue

        total_forward_drive += forward_drive
        has_nearby_plant = False
        for contact_index in range(
            index - FOOT_PLANT_DRIVE_WINDOW_FRAMES,
            index + FOOT_PLANT_DRIVE_WINDOW_FRAMES + 1,
        ):
            if 0 <= contact_index < len(frame_values):
                has_nearby_plant = (
                    has_nearby_plant
                    or foot_plant_contact_side(frame_values[contact_index], low_root_threshold) != 0
                )
        if has_nearby_plant:
            planted_forward_drive += forward_drive

    return (
        round_metric(planted_forward_drive / total_forward_drive)
        if total_forward_drive > 0
        else 0
    )


def calculate_ready_stance_leg_load(frame_values):
    frame_loads = []
    for values in frame_values:
        left_leg_load = abs(values[READY_STANCE_LEFT_LEG_LOAD_CHANNEL]) if len(values) > READY_STANCE_LEFT_LEG_LOAD_CHANNEL else 0
        right_leg_load = abs(values[READY_STANCE_RIGHT_LEG_LOAD_CHANNEL]) if len(values) > READY_STANCE_RIGHT_LEG_LOAD_CHANNEL else 0
        frame_load = left_leg_load + right_leg_load
        if math.isfinite(frame_load):
            frame_loads.append(frame_load)

    if not frame_loads:
        return 0

    return round_metric(sum(frame_loads) / len(frame_loads))


def calculate_athletic_torso_lean(frame_values):
    lean_values = [
        abs(values[ATHLETIC_TORSO_LEAN_CHANNEL])
        for values in frame_values
        if len(values) > ATHLETIC_TORSO_LEAN_CHANNEL
    ]
    if not lean_values:
        return 0

    return round_metric(sum(lean_values) / len(lean_values))


def calculate_hip_shoulder_separation(frame_values):
    separation_values = [
        values[SHOULDER_YAW_CHANNEL] - values[HIP_YAW_CHANNEL]
        for values in frame_values
        if len(values) > SHOULDER_YAW_CHANNEL and len(values) > HIP_YAW_CHANNEL
    ]
    if not separation_values:
        return 0

    return round_metric(max(separation_values) - min(separation_values))


def calculate_stick_action_two_hand_balance_ratio(ranges):
    left_range = sum(ranges[STICK_ACTION_ARM_CHANNEL_START:STICK_ACTION_ARM_CHANNEL_START + 3])
    right_range = sum(ranges[STICK_ACTION_ARM_CHANNEL_START + 3:STICK_ACTION_ARM_CHANNEL_END])
    if left_range <= 0 or right_range <= 0:
        return 0

    return round_metric(min(left_range, right_range) / max(left_range, right_range))


def calculate_arm_action_distances(frame_values, start_index, end_index):
    if not frame_values:
        return []

    start_vector = frame_values[0][start_index:end_index]
    distances = []
    for values in frame_values:
        distance = math.sqrt(
            sum(
                ((values[start_index + index] if len(values) > start_index + index else 0) - start_value) ** 2
                for index, start_value in enumerate(start_vector)
            )
        )
        distances.append(distance)
    return distances


def calculate_stick_action_two_hand_sync_ratio(frame_values):
    if len(frame_values) < 2:
        return 0

    left_distances = calculate_arm_action_distances(
        frame_values,
        STICK_ACTION_ARM_CHANNEL_START,
        STICK_ACTION_ARM_CHANNEL_START + 3,
    )
    right_distances = calculate_arm_action_distances(
        frame_values,
        STICK_ACTION_ARM_CHANNEL_START + 3,
        STICK_ACTION_ARM_CHANNEL_END,
    )
    left_peak = max(left_distances) if left_distances else 0
    right_peak = max(right_distances) if right_distances else 0
    if left_peak <= 0 or right_peak <= 0:
        return 0

    either_hand_active_frames = 0
    both_hands_active_frames = 0
    for index in range(len(frame_values)):
        left_active = left_distances[index] >= left_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        right_active = right_distances[index] >= right_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        if left_active or right_active:
            either_hand_active_frames += 1
        if left_active and right_active:
            both_hands_active_frames += 1

    return (
        round_metric(both_hands_active_frames / either_hand_active_frames)
        if either_hand_active_frames > 0
        else 0
    )


def calculate_stick_action_two_hand_contact_ratio(frame_values):
    if len(frame_values) < 2:
        return 0

    left_distances = calculate_arm_action_distances(
        frame_values,
        STICK_ACTION_ARM_CHANNEL_START,
        STICK_ACTION_ARM_CHANNEL_START + 3,
    )
    right_distances = calculate_arm_action_distances(
        frame_values,
        STICK_ACTION_ARM_CHANNEL_START + 3,
        STICK_ACTION_ARM_CHANNEL_END,
    )
    left_peak = max(left_distances) if left_distances else 0
    right_peak = max(right_distances) if right_distances else 0
    if left_peak <= 0 or right_peak <= 0:
        return 0

    both_hands_active_frames = 0
    for index in range(len(frame_values)):
        left_active = left_distances[index] >= left_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        right_active = right_distances[index] >= right_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        if left_active and right_active:
            both_hands_active_frames += 1

    return round_metric(both_hands_active_frames / len(frame_values))


def calculate_bvh_motion_metrics(frame_values):
    if not frame_values:
        return {
            "maxRotationRangeDegrees": 0,
            "activeRotationChannelCount": 0,
            "maxFrameRotationDeltaDegrees": 999,
            "maxFrameRotationAccelerationDegrees": 999,
            "rootTravelUnits": 0,
            "rootForwardTravelUnits": 0,
            "rootForwardSpeedChangeUnits": 0,
            "rootLateralShiftUnits": 0,
            "rootVerticalBounceUnits": 0,
            "readyStanceLegLoadDegrees": 0,
            "legDriveRangeDegrees": 0,
            "locomotionStrideBalanceRatio": 0,
            "locomotionFootPlantDriveRatio": 0,
            "alternatingLegSeparationDegrees": 0,
            "locomotionArmSwingRangeDegrees": 0,
            "locomotionContralateralSyncRatio": 0,
            "footPlantContactFrameCount": 0,
            "footPlantSideCount": 0,
            "footPlantBalanceRatio": 0,
            "footPlantMinSideHoldFrames": 0,
            "totalRotationRangeDegrees": 0,
            "stridePhaseChanges": 0,
            "strideCycleSpanRatio": 0,
            "stickActionArmRangeDegrees": 0,
            "stickActionTwoHandBalanceRatio": 0,
            "stickActionTwoHandSyncRatio": 0,
            "stickActionTwoHandContactRatio": 0,
            "stickActionPhaseChanges": 0,
            "stickActionBeatSpanRatio": 0,
            "stickActionReleasePeakRatio": 0,
            "stickActionSupportedReleaseRatio": 0,
            "stickActionTorsoRangeDegrees": 0,
            "hipShoulderSeparationDegrees": 0,
            "stickActionRecoveryRatio": 0,
            "athleticTorsoLeanDegrees": 0,
            "locomotionLoopClosureErrorDegrees": 999,
            "rootVerticalLoopOffsetUnits": 999,
        }

    column_count = max(len(values) for values in frame_values)
    ranges = []
    for column_index in range(column_count):
        column_values = [
            values[column_index]
            for values in frame_values
            if column_index < len(values)
        ]
        ranges.append(max(column_values) - min(column_values) if column_values else 0)

    rotation_ranges = ranges[3:]
    max_rotation_range = max(rotation_ranges) if rotation_ranges else 0
    active_rotation_channels = len([
        range_value
        for range_value in rotation_ranges
        if range_value >= ACTIVE_ROTATION_CHANNEL_RANGE_DEGREES
    ])
    max_frame_rotation_delta = calculate_max_frame_rotation_delta_degrees(frame_values)
    max_frame_rotation_acceleration = calculate_max_frame_rotation_acceleration_degrees(frame_values)
    root_travel = math.hypot(ranges[0] if len(ranges) > 0 else 0, ranges[2] if len(ranges) > 2 else 0)
    root_lateral_shift = ranges[0] if len(ranges) > 0 else 0
    root_forward_travel = ranges[2] if len(ranges) > 2 else 0
    root_forward_speed_change = calculate_root_forward_speed_change_units(frame_values)
    root_vertical_bounce = ranges[1] if len(ranges) > 1 else 0
    ready_stance_leg_load = calculate_ready_stance_leg_load(frame_values)
    leg_drive_range = (ranges[19] if len(ranges) > 19 else 0) + (ranges[22] if len(ranges) > 22 else 0)
    locomotion_stride_balance_ratio = calculate_locomotion_stride_balance_ratio(ranges)
    locomotion_foot_plant_drive_ratio = calculate_locomotion_foot_plant_drive_ratio(frame_values)
    alternating_leg_separation = calculate_alternating_leg_separation(frame_values)
    locomotion_arm_swing_range = sum(
        ranges[channel_index] if len(ranges) > channel_index else 0
        for channel_index in LOCOMOTION_ARM_SWING_CHANNELS
    )
    locomotion_contralateral_sync_ratio = calculate_locomotion_contralateral_sync_ratio(frame_values)
    foot_plant_metrics = calculate_foot_plant_metrics(frame_values)
    total_rotation_range = sum(rotation_ranges)
    stride_cycle_metrics = calculate_stride_cycle_metrics(frame_values)
    stick_action_arm_range = sum(ranges[STICK_ACTION_ARM_CHANNEL_START:STICK_ACTION_ARM_CHANNEL_END])
    stick_action_two_hand_balance_ratio = calculate_stick_action_two_hand_balance_ratio(ranges)
    stick_action_two_hand_sync_ratio = calculate_stick_action_two_hand_sync_ratio(frame_values)
    stick_action_two_hand_contact_ratio = calculate_stick_action_two_hand_contact_ratio(frame_values)
    stick_action_torso_range = sum(ranges[STICK_ACTION_TORSO_CHANNEL_START:STICK_ACTION_TORSO_CHANNEL_END])
    hip_shoulder_separation = calculate_hip_shoulder_separation(frame_values)
    stick_action_beat_metrics = calculate_stick_action_beat_metrics(frame_values)
    stick_action_release_peak_ratio = calculate_stick_action_release_peak_ratio(frame_values)
    stick_action_supported_release_ratio = calculate_stick_action_supported_release_ratio(frame_values)
    stick_action_recovery_ratio = calculate_stick_action_recovery_ratio(frame_values)
    stick_action_lower_body_lead_frames = calculate_stick_action_lower_body_lead_frames(frame_values)
    athletic_torso_lean = calculate_athletic_torso_lean(frame_values)
    loop_closure_metrics = calculate_loop_closure_metrics(frame_values)

    return {
        "maxRotationRangeDegrees": round_metric(max_rotation_range),
        "activeRotationChannelCount": active_rotation_channels,
        "maxFrameRotationDeltaDegrees": max_frame_rotation_delta,
        "maxFrameRotationAccelerationDegrees": max_frame_rotation_acceleration,
        "rootTravelUnits": round_metric(root_travel),
        "rootForwardTravelUnits": round_metric(root_forward_travel),
        "rootForwardSpeedChangeUnits": root_forward_speed_change,
        "rootLateralShiftUnits": round_metric(root_lateral_shift),
        "rootVerticalBounceUnits": round_metric(root_vertical_bounce),
        "readyStanceLegLoadDegrees": ready_stance_leg_load,
        "legDriveRangeDegrees": round_metric(leg_drive_range),
        "locomotionStrideBalanceRatio": locomotion_stride_balance_ratio,
        "locomotionFootPlantDriveRatio": locomotion_foot_plant_drive_ratio,
        "alternatingLegSeparationDegrees": alternating_leg_separation,
        "locomotionArmSwingRangeDegrees": round_metric(locomotion_arm_swing_range),
        "locomotionContralateralSyncRatio": locomotion_contralateral_sync_ratio,
        **foot_plant_metrics,
        "totalRotationRangeDegrees": round_metric(total_rotation_range),
        **stride_cycle_metrics,
        "stickActionArmRangeDegrees": round_metric(stick_action_arm_range),
        "stickActionTwoHandBalanceRatio": stick_action_two_hand_balance_ratio,
        "stickActionTwoHandSyncRatio": stick_action_two_hand_sync_ratio,
        "stickActionTwoHandContactRatio": stick_action_two_hand_contact_ratio,
        **stick_action_beat_metrics,
        "stickActionReleasePeakRatio": stick_action_release_peak_ratio,
        "stickActionSupportedReleaseRatio": stick_action_supported_release_ratio,
        "stickActionTorsoRangeDegrees": round_metric(stick_action_torso_range),
        "hipShoulderSeparationDegrees": hip_shoulder_separation,
        "stickActionLowerBodyLeadFrames": stick_action_lower_body_lead_frames,
        "stickActionRecoveryRatio": stick_action_recovery_ratio,
        "athleticTorsoLeanDegrees": athletic_torso_lean,
        **loop_closure_metrics,
    }


def quality_profile_for_clip(clip_name):
    return ACTION_QUALITY_PROFILES.get(
        clip_name,
        {
            "name": "generic",
            "minimumFrameCount": MIN_ACTION_CLIP_BVH_FRAMES,
            "minimumDurationSeconds": MIN_ACTION_CLIP_BVH_DURATION_SECONDS,
            "maximumFrameRotationDeltaDegrees": 999,
            "maximumFrameRotationAccelerationDegrees": 999,
            "minimumRootTravelUnits": 0,
            "minimumRootForwardTravelUnits": 0,
            "minimumRootForwardSpeedChangeUnits": 0,
            "minimumRootLateralShiftUnits": 0,
            "minimumRootVerticalBounceUnits": 0,
            "minimumReadyStanceLegLoadDegrees": 0,
            "minimumLegDriveRangeDegrees": 0,
            "minimumLocomotionStrideBalanceRatio": 0,
            "minimumLocomotionFootPlantDriveRatio": 0,
            "minimumAlternatingLegSeparationDegrees": 0,
            "minimumLocomotionArmSwingRangeDegrees": 0,
            "minimumLocomotionContralateralSyncRatio": 0,
            "minimumFootPlantContactFrames": 0,
            "minimumFootPlantSideCount": 0,
            "minimumFootPlantBalanceRatio": 0,
            "minimumFootPlantHoldFramesPerSide": 0,
            "maximumFootPlantRootDriftUnits": 999,
            "minimumTotalRotationRangeDegrees": 0,
            "minimumStridePhaseChanges": 0,
            "minimumStrideCycleSpanRatio": 0,
            "minimumStickActionArmRangeDegrees": 0,
            "minimumStickActionTwoHandBalanceRatio": 0,
            "minimumStickActionTwoHandSyncRatio": 0,
            "minimumStickActionTwoHandContactRatio": 0,
            "minimumStickActionPhaseChanges": 0,
            "minimumStickActionBeatSpanRatio": 0,
            "minimumStickActionReleasePeakRatio": 0,
            "maximumStickActionReleasePeakRatio": 1,
            "minimumStickActionSupportedReleaseRatio": 0,
            "minimumStickActionTorsoRangeDegrees": 0,
            "minimumHipShoulderSeparationDegrees": 0,
            "minimumStickActionLowerBodyLeadFrames": 0,
            "minimumStickActionRecoveryRatio": 0,
            "minimumAthleticTorsoLeanDegrees": 0,
            "maximumLoopClosureErrorDegrees": 999,
            "maximumLoopVerticalOffsetUnits": 999,
        },
    )


def validate_action_quality(source_path, clip_name, frame_count, duration_seconds, motion_metrics):
    quality_profile = quality_profile_for_clip(clip_name)
    if frame_count < quality_profile["minimumFrameCount"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} frame floor for retargeting: {source_path}"
        )
    if duration_seconds < quality_profile["minimumDurationSeconds"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} duration floor for retargeting: {source_path}"
        )
    if motion_metrics["maxFrameRotationDeltaDegrees"] > quality_profile["maximumFrameRotationDeltaDegrees"]:
        raise RuntimeError(
            f"BVH action clip above {quality_profile['name']} smooth frame-delta floor for retargeting: {source_path}"
        )
    if (
        motion_metrics["maxFrameRotationAccelerationDegrees"]
        > quality_profile["maximumFrameRotationAccelerationDegrees"]
    ):
        raise RuntimeError(
            f"BVH action clip above {quality_profile['name']} smooth frame-acceleration floor for retargeting: {source_path}"
        )
    if motion_metrics["rootTravelUnits"] < quality_profile["minimumRootTravelUnits"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} root-travel floor for retargeting: {source_path}"
        )
    if motion_metrics["rootForwardTravelUnits"] < quality_profile["minimumRootForwardTravelUnits"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} forward root-travel floor for retargeting: {source_path}"
        )
    if motion_metrics["rootForwardSpeedChangeUnits"] < quality_profile["minimumRootForwardSpeedChangeUnits"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} forward acceleration floor for retargeting: {source_path}"
        )
    if motion_metrics["rootLateralShiftUnits"] < quality_profile["minimumRootLateralShiftUnits"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} lateral weight-shift floor for retargeting: {source_path}"
        )
    if motion_metrics["rootVerticalBounceUnits"] < quality_profile["minimumRootVerticalBounceUnits"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} vertical root-bounce floor for retargeting: {source_path}"
        )
    if motion_metrics["readyStanceLegLoadDegrees"] < quality_profile["minimumReadyStanceLegLoadDegrees"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} athletic ready-stance load floor for retargeting: {source_path}"
        )
    if motion_metrics["legDriveRangeDegrees"] < quality_profile["minimumLegDriveRangeDegrees"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} leg-drive floor for retargeting: {source_path}"
        )
    if motion_metrics["locomotionStrideBalanceRatio"] < quality_profile["minimumLocomotionStrideBalanceRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} stride-balance floor for retargeting: {source_path}"
        )
    if motion_metrics["alternatingLegSeparationDegrees"] < quality_profile["minimumAlternatingLegSeparationDegrees"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} alternating leg-separation floor for retargeting: {source_path}"
        )
    if motion_metrics["locomotionArmSwingRangeDegrees"] < quality_profile["minimumLocomotionArmSwingRangeDegrees"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} locomotion arm-swing floor for retargeting: {source_path}"
        )
    if motion_metrics["locomotionContralateralSyncRatio"] < quality_profile["minimumLocomotionContralateralSyncRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} contralateral arm-leg sync floor for retargeting: {source_path}"
        )
    if motion_metrics["locomotionFootPlantDriveRatio"] < quality_profile["minimumLocomotionFootPlantDriveRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} planted forward-drive floor for retargeting: {source_path}"
        )
    if motion_metrics["footPlantContactFrameCount"] < quality_profile["minimumFootPlantContactFrames"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} foot-plant contact floor for retargeting: {source_path}"
        )
    if motion_metrics["footPlantSideCount"] < quality_profile["minimumFootPlantSideCount"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} alternating foot-plant floor for retargeting: {source_path}"
        )
    if motion_metrics["footPlantBalanceRatio"] < quality_profile["minimumFootPlantBalanceRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} balanced foot-plant floor for retargeting: {source_path}"
        )
    if motion_metrics["footPlantMinSideHoldFrames"] < quality_profile["minimumFootPlantHoldFramesPerSide"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} sustained foot-plant hold floor for retargeting: {source_path}"
        )
    if motion_metrics["maxFootPlantRootDriftUnits"] > quality_profile["maximumFootPlantRootDriftUnits"]:
        raise RuntimeError(
            f"BVH action clip above {quality_profile['name']} planted-contact drift ceiling for retargeting: {source_path}"
        )
    if motion_metrics["totalRotationRangeDegrees"] < quality_profile["minimumTotalRotationRangeDegrees"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} full-body rotation floor for retargeting: {source_path}"
        )
    if motion_metrics["stridePhaseChanges"] < quality_profile["minimumStridePhaseChanges"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} stride-cycle floor for retargeting: {source_path}"
        )
    if motion_metrics["strideCycleSpanRatio"] < quality_profile["minimumStrideCycleSpanRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} stride-cycle span floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionArmRangeDegrees"] < quality_profile["minimumStickActionArmRangeDegrees"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} stick-action arm-travel floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionTwoHandBalanceRatio"] < quality_profile["minimumStickActionTwoHandBalanceRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} two-hand stick-action balance floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionTwoHandSyncRatio"] < quality_profile["minimumStickActionTwoHandSyncRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} two-hand stick-action sync floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionTwoHandContactRatio"] < quality_profile["minimumStickActionTwoHandContactRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} two-hand contact-window floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionPhaseChanges"] < quality_profile["minimumStickActionPhaseChanges"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} stick-action phase floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionBeatSpanRatio"] < quality_profile["minimumStickActionBeatSpanRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} stick-action beat-span floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionReleasePeakRatio"] < quality_profile["minimumStickActionReleasePeakRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} stick-action release-peak timing floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionReleasePeakRatio"] > quality_profile["maximumStickActionReleasePeakRatio"]:
        raise RuntimeError(
            f"BVH action clip above {quality_profile['name']} stick-action release-peak timing ceiling for retargeting: {source_path}"
        )
    if motion_metrics["stickActionSupportedReleaseRatio"] < quality_profile["minimumStickActionSupportedReleaseRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} supported release/catch floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionTorsoRangeDegrees"] < quality_profile["minimumStickActionTorsoRangeDegrees"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} stick-action torso-follow-through floor for retargeting: {source_path}"
        )
    if motion_metrics["hipShoulderSeparationDegrees"] < quality_profile["minimumHipShoulderSeparationDegrees"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} hip-shoulder separation floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionLowerBodyLeadFrames"] < quality_profile["minimumStickActionLowerBodyLeadFrames"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} lower-body lead floor for retargeting: {source_path}"
        )
    if motion_metrics["stickActionRecoveryRatio"] < quality_profile["minimumStickActionRecoveryRatio"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} stick-action recovery floor for retargeting: {source_path}"
        )
    if motion_metrics["athleticTorsoLeanDegrees"] < quality_profile["minimumAthleticTorsoLeanDegrees"]:
        raise RuntimeError(
            f"BVH action clip below {quality_profile['name']} athletic torso-lean floor for retargeting: {source_path}"
        )
    if motion_metrics["locomotionLoopClosureErrorDegrees"] > quality_profile["maximumLoopClosureErrorDegrees"]:
        raise RuntimeError(
            f"BVH action clip above {quality_profile['name']} loop-closure floor for retargeting: {source_path}"
        )
    if motion_metrics["rootVerticalLoopOffsetUnits"] > quality_profile["maximumLoopVerticalOffsetUnits"]:
        raise RuntimeError(
            f"BVH action clip above {quality_profile['name']} vertical loop-seam floor for retargeting: {source_path}"
        )
    return quality_profile


def parse_internal_bvh_motion(source_path, clip_name):
    lines = Path(source_path).read_text(encoding="utf-8").splitlines()
    try:
        motion_index = lines.index("MOTION")
    except ValueError as error:
        raise RuntimeError(f"BVH source missing MOTION block: {source_path}") from error

    frame_count = int(lines[motion_index + 1].split(":", 1)[1].strip())
    frame_time = float(lines[motion_index + 2].split(":", 1)[1].strip())
    frame_lines = [line.strip() for line in lines[motion_index + 3 :] if line.strip()]
    if len(frame_lines) != frame_count:
        raise RuntimeError(f"BVH source frame count mismatch: {source_path}")
    if frame_count < MIN_RETARGETABLE_BVH_FRAMES or frame_time <= 0:
        raise RuntimeError(f"BVH source too short for retargeting: {source_path}")
    if frame_count < MIN_ACTION_CLIP_BVH_FRAMES or frame_count * frame_time < MIN_ACTION_CLIP_BVH_DURATION_SECONDS:
        raise RuntimeError(f"BVH action clip too short for retargeting: {source_path}")

    frames = []
    raw_frame_values = []
    for index, line in enumerate(frame_lines):
        values = [float(value) for value in line.split()]
        if len(values) < 24:
            raise RuntimeError(f"BVH source frame has too few channels: {source_path}")
        raw_frame_values.append(values)
        frames.append(
            {
                "frame": index + 1,
                "root": values[0:6],
                "chest": values[6:9],
                "head": values[9:12],
                "left_arm": values[12:15],
                "right_arm": values[15:18],
                "left_leg": values[18:21],
                "right_leg": values[21:24],
            }
        )

    duration_seconds = round(frame_count * frame_time, 3)
    motion_metrics = calculate_bvh_motion_metrics(raw_frame_values)
    if (
        motion_metrics["maxRotationRangeDegrees"] < MIN_ACTION_CLIP_MAX_ROTATION_RANGE_DEGREES
        or motion_metrics["activeRotationChannelCount"] < MIN_ACTION_CLIP_ACTIVE_ROTATION_CHANNELS
    ):
        raise RuntimeError(f"BVH action clip too static for retargeting: {source_path}")
    quality_profile = validate_action_quality(source_path, clip_name, frame_count, duration_seconds, motion_metrics)

    return {
        "frameCount": frame_count,
        "frameTime": frame_time,
        "durationSeconds": duration_seconds,
        "motionMetrics": motion_metrics,
        "qualityProfile": quality_profile,
        "frames": frames,
    }


def find_source_rights_evidence(source_path):
    source_path = Path(source_path)
    candidates = [
        source_path.with_name(f"{source_path.stem}{suffix}")
        for suffix in SOURCE_RIGHTS_EVIDENCE_SUFFIXES
    ] + [
        source_path.with_name(file_name)
        for file_name in SOURCE_RIGHTS_EVIDENCE_FILES
    ]
    for candidate in candidates:
        if candidate.exists():
            return str(candidate.relative_to(PROJECT_ROOT))
    return None


def parse_source_rights_metadata(source_path):
    metadata = dict(DEFAULT_SOURCE_METADATA)
    relative_evidence_path = find_source_rights_evidence(source_path)
    if relative_evidence_path is None:
        return metadata

    evidence_path = PROJECT_ROOT / relative_evidence_path
    try:
        lines = evidence_path.read_text(encoding="utf-8").splitlines()
        metadata_pattern = re.compile(r"\s*(source quality|source provider|capture method|usage rights)\s*:\s*(.*?)\s*$", re.I)
        for index, line in enumerate(lines):
            match = metadata_pattern.match(line)
            if not match:
                continue
            key = match.group(1).lower()
            continuation = []
            for next_line in lines[index + 1:]:
                stripped = next_line.strip()
                if not stripped or metadata_pattern.match(next_line):
                    break
                continuation.append(stripped)
            value = " ".join([match.group(2).strip(), *continuation]).strip()
            if key == "source quality":
                metadata["sourceQuality"] = value
            elif key == "source provider":
                metadata["sourceProvider"] = value
            elif key == "capture method":
                metadata["captureMethod"] = value
            elif key == "usage rights":
                metadata["usageRights"] = value
    except OSError:
        return metadata

    return metadata


def motion_source_type_for_metadata(metadata):
    if metadata.get("sourceQuality") in FINAL_GRADE_SOURCE_QUALITIES:
        return "final-grade-bvh-action-clip"
    return "internal-bvh-retarget-seed"


def max_stick_action_upper_arm_lift(clip_name):
    return (
        MAX_COMPACT_STICK_ACTION_UPPER_ARM_LIFT_DEGREES
        if clip_name in COMPACT_STICK_ACTION_CLIPS
        else MAX_STICK_ACTION_UPPER_ARM_LIFT_DEGREES
    )


def max_stick_action_upper_arm_lateral(clip_name):
    return (
        MAX_COMPACT_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES
        if clip_name in COMPACT_STICK_ACTION_CLIPS
        else MAX_STICK_ACTION_UPPER_ARM_LATERAL_DEGREES
    )


def max_stick_action_upper_arm_swing(clip_name):
    return (
        MAX_COMPACT_STICK_ACTION_UPPER_ARM_SWING_DEGREES
        if clip_name in COMPACT_STICK_ACTION_CLIPS
        else MAX_STICK_ACTION_UPPER_ARM_SWING_DEGREES
    )


def max_stick_action_upper_arm_exposure(clip_name):
    return (
        MAX_COMPACT_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES
        if clip_name in COMPACT_STICK_ACTION_CLIPS
        else MAX_STICK_ACTION_UPPER_ARM_EXPOSURE_DEGREES
    )


def clamp_stick_action_upper_arm_exposure(rotation, clip_name=None):
    x_value, y_value, z_value = rotation
    lift = max(0, x_value)
    lateral = abs(y_value)
    exposure = math.sqrt(lift * lift + lateral * lateral)
    max_exposure = max_stick_action_upper_arm_exposure(clip_name)
    if exposure <= max_exposure or exposure == 0:
        return rotation

    scale = max_exposure / exposure
    constrained_x = lift * scale if x_value > 0 else x_value
    return (constrained_x, y_value * scale, z_value)


def clamp_normal_upper_arm_exposure(rotation):
    x_value, y_value, z_value = rotation
    lift = max(0, x_value)
    lateral = abs(y_value)
    exposure = math.sqrt(lift * lift + lateral * lateral)
    if exposure <= MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES or exposure == 0:
        return rotation

    scale = MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES / exposure
    constrained_x = (
        clamp(lift * scale, MIN_NORMAL_UPPER_ARM_DROP_DEGREES, MAX_NORMAL_UPPER_ARM_LIFT_DEGREES)
        if x_value > 0
        else x_value
    )
    remaining_lateral = math.sqrt(max(0, MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES ** 2 - max(0, constrained_x) ** 2))
    return (constrained_x, clamp(y_value * scale, -remaining_lateral, remaining_lateral), z_value)


def derive_forearm_rotation(upper_arm, side, clip_name):
    stick_work = 1 if clip_name in STICK_ACTION_CLIPS else 0
    if stick_work:
        source_scale = STICK_ACTION_FOREARM_SOURCE_SCALE
        y_scale = 0.3
        z_scale = 0.48
        x_value = 18 + abs(upper_arm[0]) * source_scale
        x_bounds = (14, MAX_STICK_ACTION_FOREARM_LIFT_DEGREES)
    else:
        source_scale = NORMAL_FOREARM_LIFT_SOURCE_SCALE
        y_scale = 0.18
        z_scale = 0.26
        x_value = NORMAL_FOREARM_LIFT_BASE_DEGREES + abs(upper_arm[0]) * source_scale
        x_bounds = (8, MAX_NORMAL_FOREARM_LIFT_DEGREES)
    y_value = side * (6 + stick_work * 4) + upper_arm[1] * y_scale
    z_value = -upper_arm[2] * z_scale + side * stick_work * 10
    return (clamp(x_value, x_bounds[0], x_bounds[1]), clamp(y_value, -22, 22), clamp(z_value, -42, 42))


def derive_hand_rotation(upper_arm, side, clip_name):
    stick_work = 1 if clip_name in STICK_ACTION_CLIPS else 0
    source_scale = STICK_ACTION_HAND_SOURCE_SCALE if stick_work else NORMAL_HAND_LIFT_SOURCE_SCALE
    y_scale = 0.14 if stick_work else 0.08
    z_scale = 0.28 if clip_name == "forehand-pass" else (0.24 if stick_work else 0.1)
    base_lift = 6 if stick_work else NORMAL_HAND_LIFT_BASE_DEGREES
    max_lift = MAX_STICK_ACTION_HAND_LIFT_DEGREES if stick_work else MAX_NORMAL_HAND_LIFT_DEGREES
    return (
        clamp(base_lift + abs(upper_arm[0]) * source_scale + stick_work * 6, 2, max_lift),
        clamp(side * (6 + stick_work * 6) + upper_arm[1] * y_scale, -18, 18),
        clamp(side * stick_work * 10 + upper_arm[2] * z_scale, -24, 24),
    )


FOREHAND_PASS_TWO_HAND_RELEASE_POSES = {
    3: ((16, -6, -7), (16, 6, 7)),
    4: ((18, -8, -10), (18, 8, 10)),
    5: ((20, -9, -13), (20, 9, 13)),
    6: ((22, -10, -15), (22, 10, 15)),
    7: ((21, -9, -12), (21, 9, 12)),
    8: ((19, -8, -8), (19, 8, 8)),
    9: ((18, -6, -5), (18, 6, 5)),
    17: ((23, -10, -13), (22, 9, 12)),
    18: ((34, -17, -32), (34, 17, 30)),
    19: ((29, -13, -18), (29, 12, 16)),
    20: ((21, -8, -7), (21, 8, 7)),
    21: ((18, -6, -4), (18, 6, 4)),
}
FOREHAND_PASS_RETARGET_BEAT_FRAME_SCALES = {
    2: 0.68,
    4: 1.08,
    6: 0.74,
    8: 1.02,
    10: 0.78,
    12: 1.06,
    14: 0.82,
    16: 1.1,
    18: 0.86,
    20: 1.04,
    22: 0.7,
}
FOREHAND_PASS_MIN_RETARGETED_BEAT_SPAN_RATIO = 0.7
FOREHAND_PASS_RETARGET_HAND_BEAT_POSES = {
    2: ((16.5, -8, -10), (16.5, 8, 10)),
}
RECEIVE_PASS_TWO_HAND_CATCH_FRAMES = {19, 20}
WRIST_SHOT_TWO_HAND_RELEASE_FRAMES = {11, 17, 18}


def reinforce_forehand_pass_two_hand_window(clip_name, frame_number, rotations):
    if clip_name != "forehand-pass" or frame_number not in FOREHAND_PASS_TWO_HAND_RELEASE_POSES:
        return rotations

    left_pose, right_pose = FOREHAND_PASS_TWO_HAND_RELEASE_POSES[frame_number]
    left_upperarm = clamp_stick_action_upper_arm_exposure(left_pose, clip_name)
    right_upperarm = clamp_stick_action_upper_arm_exposure(right_pose, clip_name)
    reinforced = dict(rotations)
    reinforced.update(
        {
            "left_upperarm": left_upperarm,
            "right_upperarm": right_upperarm,
            "left_forearm": derive_forearm_rotation(left_upperarm, -1, clip_name),
            "right_forearm": derive_forearm_rotation(right_upperarm, 1, clip_name),
            "left_hand": derive_hand_rotation(left_upperarm, -1, clip_name),
            "right_hand": derive_hand_rotation(right_upperarm, 1, clip_name),
        }
    )
    return reinforced


def reinforce_receive_pass_two_hand_window(clip_name, frame_number, rotations):
    if clip_name != "receive-pass" or frame_number not in RECEIVE_PASS_TWO_HAND_CATCH_FRAMES:
        return rotations

    left_upperarm = clamp_stick_action_upper_arm_exposure((30, -12, -16), clip_name)
    right_upperarm = clamp_stick_action_upper_arm_exposure((30, 12, 16), clip_name)
    reinforced = dict(rotations)
    reinforced.update(
        {
            "left_upperarm": left_upperarm,
            "right_upperarm": right_upperarm,
            "left_forearm": derive_forearm_rotation(left_upperarm, -1, clip_name),
            "right_forearm": derive_forearm_rotation(right_upperarm, 1, clip_name),
            "left_hand": derive_hand_rotation(left_upperarm, -1, clip_name),
            "right_hand": derive_hand_rotation(right_upperarm, 1, clip_name),
        }
    )
    return reinforced


def reinforce_wrist_shot_two_hand_window(clip_name, frame_number, rotations):
    if clip_name != "wrist-shot" or frame_number not in WRIST_SHOT_TWO_HAND_RELEASE_FRAMES:
        return rotations

    left_upperarm = clamp_stick_action_upper_arm_exposure((28, -12, -18), clip_name)
    right_upperarm = clamp_stick_action_upper_arm_exposure((28, 12, 18), clip_name)
    reinforced = dict(rotations)
    reinforced.update(
        {
            "left_upperarm": left_upperarm,
            "right_upperarm": right_upperarm,
            "left_forearm": derive_forearm_rotation(left_upperarm, -1, clip_name),
            "right_forearm": derive_forearm_rotation(right_upperarm, 1, clip_name),
            "left_hand": derive_hand_rotation(left_upperarm, -1, clip_name),
            "right_hand": derive_hand_rotation(right_upperarm, 1, clip_name),
        }
    )
    return reinforced


def derive_calf_rotation(thigh, side, sprint=False):
    bend = 18 + abs(thigh[0]) * (1.1 if sprint else 0.85)
    return (clamp(bend, 14, 52), 0, clamp(thigh[2] * 0.18 + side * 1.5, -8, 8))


def derive_foot_rotation(thigh, side):
    pitch = -6 + thigh[0] * FOOT_PLANT_ANKLE_DRIVE_RETARGET_SCALE
    return (
        clamp(pitch, -22, 22),
        clamp(side * 3 + thigh[1] * 0.12, -8, 8),
        clamp(thigh[2] * 0.16, -8, 8),
    )


def thigh_pitch_limits_for_clip(clip_name):
    if clip_name == "sprint-forward":
        return -44, 52
    return -42, 48


def retarget_forward_lean(source_pitch, scale, base_lean, minimum, maximum):
    return clamp(-abs(source_pitch) * scale - base_lean, minimum, maximum)


def locomotion_forward_lean_base(clip_name, base_lean):
    return base_lean + LOCOMOTION_FORWARD_LEAN_BASE_BOOST.get(clip_name, 0)


def calculate_locomotion_counter_rotation_drive(clip_name, left_arm, right_arm, left_leg, right_leg):
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0

    stride_drive = (left_leg[0] - right_leg[0]) * LOCOMOTION_TRUNK_COUNTER_ROTATION_RETARGET_SCALE
    arm_drive = (right_arm[2] - left_arm[2]) * LOCOMOTION_TRUNK_COUNTER_ROTATION_RETARGET_SCALE * 0.6
    return clamp(
        stride_drive + arm_drive,
        -LOCOMOTION_TRUNK_COUNTER_ROTATION_MAX_DEGREES,
        LOCOMOTION_TRUNK_COUNTER_ROTATION_MAX_DEGREES,
    )


def smooth_rotation_frames_by_acceleration(rotation_frames, acceleration_limit):
    if not acceleration_limit or len(rotation_frames) < 3:
        return rotation_frames

    smoothed = [
        {bone_key: tuple(rotation) for bone_key, rotation in rotations.items()}
        for rotations in rotation_frames
    ]

    for _ in range(2):
        for frame_index in range(1, len(smoothed) - 1):
            bone_keys = sorted(
                set(smoothed[frame_index - 1])
                | set(smoothed[frame_index])
                | set(smoothed[frame_index + 1])
            )
            for bone_key in bone_keys:
                previous = smoothed[frame_index - 1].get(bone_key, (0, 0, 0))
                current = smoothed[frame_index].get(bone_key, (0, 0, 0))
                following = smoothed[frame_index + 1].get(bone_key, (0, 0, 0))
                adjusted = list(current)
                for axis in range(3):
                    acceleration = following[axis] - (2 * current[axis]) + previous[axis]
                    if abs(acceleration) <= acceleration_limit:
                        continue
                    target = (previous[axis] + following[axis] - math.copysign(acceleration_limit, acceleration)) / 2
                    adjusted[axis] = target
                smoothed[frame_index][bone_key] = tuple(adjusted)

    return smoothed


def smooth_locomotion_rotation_frames(clip_name, rotation_frames):
    return smooth_rotation_frames_by_acceleration(
        rotation_frames,
        LOCOMOTION_RETARGET_ACCELERATION_LIMITS.get(clip_name),
    )


def smooth_stick_action_rotation_frames(clip_name, rotation_frames):
    return smooth_rotation_frames_by_acceleration(
        rotation_frames,
        STICK_ACTION_RETARGET_ACCELERATION_LIMITS.get(clip_name),
    )


def clamp_retargeted_stick_bone_rotation(bone_key, rotation, clip_name):
    if bone_key.endswith("_upperarm"):
        return clamp_stick_action_upper_arm_exposure(
            (
                clamp(rotation[0], -18, max_stick_action_upper_arm_lift(clip_name)),
                clamp(rotation[1], -max_stick_action_upper_arm_lateral(clip_name), max_stick_action_upper_arm_lateral(clip_name)),
                clamp(rotation[2], -max_stick_action_upper_arm_swing(clip_name), max_stick_action_upper_arm_swing(clip_name)),
            ),
            clip_name,
        )
    if bone_key.endswith("_forearm"):
        return (
            clamp(rotation[0], 14, MAX_STICK_ACTION_FOREARM_LIFT_DEGREES),
            clamp(rotation[1], -22, 22),
            clamp(rotation[2], -42, 42),
        )
    if bone_key.endswith("_hand"):
        return (
            clamp(rotation[0], 2, MAX_STICK_ACTION_HAND_LIFT_DEGREES),
            clamp(rotation[1], -18, 18),
            clamp(rotation[2], -24, 24),
        )
    return rotation


def clamp_retargeted_stick_action_frames(clip_name, rotation_frames):
    if clip_name not in STICK_ACTION_CLIPS:
        return rotation_frames

    clamped_frames = []
    for rotations in rotation_frames:
        clamped_frames.append(
            {
                bone_key: clamp_retargeted_stick_bone_rotation(bone_key, rotation, clip_name)
                for bone_key, rotation in rotations.items()
            }
        )
    return clamped_frames


def nudge_retargeted_stick_side_from_start(rotation_frames, frame_index, side_prefix, clip_name, amount=1.25):
    if frame_index <= 0 or frame_index >= len(rotation_frames):
        return rotation_frames

    adjusted_frames = [
        {bone_key: tuple(rotation) for bone_key, rotation in rotations.items()}
        for rotations in rotation_frames
    ]
    start_rotations = adjusted_frames[0]
    adjusted_frame = dict(adjusted_frames[frame_index])
    for bone_name in ["upperarm", "forearm", "hand"]:
        bone_key = f"{side_prefix}_{bone_name}"
        rotation = list(adjusted_frame.get(bone_key, (0, 0, 0)))
        start_rotation = start_rotations.get(bone_key, (0, 0, 0))
        for axis in [1, 2]:
            direction = 1 if rotation[axis] >= start_rotation[axis] else -1
            rotation[axis] += direction * amount
        adjusted_frame[bone_key] = clamp_retargeted_stick_bone_rotation(bone_key, tuple(rotation), clip_name)
    adjusted_frames[frame_index] = adjusted_frame
    return adjusted_frames


def scale_retargeted_stick_frame_from_start(rotation_frames, frame_index, clip_name, scale):
    if frame_index <= 0 or frame_index >= len(rotation_frames):
        return rotation_frames

    adjusted_frames = [
        {bone_key: tuple(rotation) for bone_key, rotation in rotations.items()}
        for rotations in rotation_frames
    ]
    start_rotations = adjusted_frames[0]
    adjusted_frame = dict(adjusted_frames[frame_index])
    for side_prefix in ["left", "right"]:
        for bone_name in ["upperarm", "forearm", "hand"]:
            bone_key = f"{side_prefix}_{bone_name}"
            rotation = adjusted_frame.get(bone_key, (0, 0, 0))
            start_rotation = start_rotations.get(bone_key, (0, 0, 0))
            scaled_rotation = tuple(
                start_rotation[axis] + (rotation[axis] - start_rotation[axis]) * scale
                for axis in range(3)
            )
            adjusted_frame[bone_key] = clamp_retargeted_stick_bone_rotation(
                bone_key,
                scaled_rotation,
                clip_name,
            )
    adjusted_frames[frame_index] = adjusted_frame
    return adjusted_frames


def reinforce_stick_handle_retargeted_beat_sequence(clip_name, rotation_frames):
    if clip_name != "stick-handle":
        return rotation_frames

    quality_profile = ACTION_QUALITY_PROFILES["stick-handle"]
    minimum_phase_changes = minimum_retargeted_stick_action_phase_changes(clip_name, quality_profile)
    minimum_beat_span_ratio = minimum_retargeted_stick_action_beat_span_ratio(clip_name, quality_profile)
    beat_metrics = calculate_retargeted_stick_action_beat_metrics(rotation_frames)
    if (
        beat_metrics["retargetedStickActionPhaseChanges"] >= minimum_phase_changes
        and beat_metrics["retargetedStickActionBeatSpanRatio"] >= minimum_beat_span_ratio
    ):
        return rotation_frames

    reinforced_frames = rotation_frames
    for frame_index, scale in STICK_HANDLE_RETARGET_BEAT_FRAME_SCALES.items():
        reinforced_frames = scale_retargeted_stick_frame_from_start(
            reinforced_frames,
            frame_index,
            clip_name,
            scale,
        )
    return reinforced_frames


def reinforce_forehand_pass_retargeted_beat_sequence(clip_name, rotation_frames):
    if clip_name != "forehand-pass":
        return rotation_frames

    quality_profile = ACTION_QUALITY_PROFILES["forehand-pass"]
    minimum_phase_changes = minimum_retargeted_stick_action_phase_changes(clip_name, quality_profile)
    minimum_beat_span_ratio = max(
        FOREHAND_PASS_MIN_RETARGETED_BEAT_SPAN_RATIO,
        minimum_retargeted_stick_action_beat_span_ratio(clip_name, quality_profile),
    )
    beat_metrics = calculate_retargeted_stick_action_beat_metrics(rotation_frames)
    if (
        beat_metrics["retargetedStickActionPhaseChanges"] >= minimum_phase_changes
        and beat_metrics["retargetedStickActionBeatSpanRatio"] >= minimum_beat_span_ratio
    ):
        return rotation_frames

    reinforced_frames = rotation_frames
    for frame_index, scale in FOREHAND_PASS_RETARGET_BEAT_FRAME_SCALES.items():
        reinforced_frames = scale_retargeted_stick_frame_from_start(
            reinforced_frames,
            frame_index,
            clip_name,
            scale,
        )
    return reinforced_frames


def reinforce_forehand_pass_retargeted_hand_beat_sequence(clip_name, rotation_frames):
    if clip_name != "forehand-pass":
        return rotation_frames

    quality_profile = ACTION_QUALITY_PROFILES["forehand-pass"]
    minimum_phase_changes = minimum_retargeted_stick_action_phase_changes(clip_name, quality_profile)
    minimum_beat_span_ratio = max(
        0.75,
        FOREHAND_PASS_MIN_RETARGETED_BEAT_SPAN_RATIO,
        minimum_retargeted_stick_action_beat_span_ratio(clip_name, quality_profile),
    )
    beat_metrics = calculate_retargeted_stick_action_beat_metrics(rotation_frames)
    if (
        beat_metrics["retargetedStickActionPhaseChanges"] >= minimum_phase_changes
        and beat_metrics["retargetedStickActionBeatSpanRatio"] >= minimum_beat_span_ratio
    ):
        return rotation_frames

    reinforced_frames = [
        {bone_key: tuple(rotation) for bone_key, rotation in rotations.items()}
        for rotations in rotation_frames
    ]
    for frame_index, (left_pose, right_pose) in FOREHAND_PASS_RETARGET_HAND_BEAT_POSES.items():
        if frame_index <= 0 or frame_index >= len(reinforced_frames):
            continue

        frame = dict(reinforced_frames[frame_index])
        frame["left_forearm"] = clamp_retargeted_stick_bone_rotation(
            "left_forearm",
            left_pose,
            clip_name,
        )
        frame["right_forearm"] = clamp_retargeted_stick_bone_rotation(
            "right_forearm",
            right_pose,
            clip_name,
        )
        frame["left_hand"] = clamp_retargeted_stick_bone_rotation(
            "left_hand",
            (5, -6, -10),
            clip_name,
        )
        frame["right_hand"] = clamp_retargeted_stick_bone_rotation(
            "right_hand",
            (5, 6, 10),
            clip_name,
        )
        reinforced_frames[frame_index] = frame

    return reinforced_frames


def reinforce_stick_handle_retargeted_lower_body_lead(clip_name, rotation_frames, hip_locations):
    if clip_name != "stick-handle" or len(rotation_frames) < 6:
        return rotation_frames, hip_locations

    current_lead = calculate_retargeted_stick_action_lower_body_lead_frames(rotation_frames)
    if current_lead >= STICK_HANDLE_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES:
        return rotation_frames, hip_locations

    stick_action_values = calculate_retargeted_stick_action_distances(rotation_frames)
    if not stick_action_values or max(stick_action_values) <= 0:
        return rotation_frames, hip_locations

    stick_peak_index = index_of_peak(stick_action_values)
    lead_peak_index = max(1, stick_peak_index - STICK_HANDLE_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES)
    drive_shape = {
        -2: (24, -18),
        -1: (34, -26),
        0: (42, -34),
        1: (38, -30),
        2: (32, -24),
        3: (26, -20),
    }

    reinforced_frames = [
        {bone_key: tuple(rotation) for bone_key, rotation in rotations.items()}
        for rotations in rotation_frames
    ]
    reinforced_hips = [tuple(location) for location in hip_locations]
    hip_verticals = [
        location[2]
        for location in reinforced_hips
        if len(location) >= 3 and math.isfinite(location[2])
    ]
    grounded_hip_z = min(hip_verticals) if hip_verticals else None

    for offset, (left_pitch, right_pitch) in drive_shape.items():
        frame_index = lead_peak_index + offset
        if frame_index < 0 or frame_index >= len(reinforced_frames):
            continue

        frame = dict(reinforced_frames[frame_index])
        left_thigh = list(frame.get("left_thigh", (0, 0, 0)))
        right_thigh = list(frame.get("right_thigh", (0, 0, 0)))
        left_thigh[0] = clamp(left_pitch, -42, 48)
        right_thigh[0] = clamp(right_pitch, -42, 48)
        frame["left_thigh"] = tuple(left_thigh)
        frame["right_thigh"] = tuple(right_thigh)
        frame["left_calf"] = (
            clamp(18 + abs(left_thigh[0]) * 0.85, 14, 52),
            frame.get("left_calf", (0, 0, 0))[1],
            frame.get("left_calf", (0, 0, 0))[2],
        )
        frame["right_calf"] = (
            clamp(18 + abs(right_thigh[0]) * 0.85, 14, 52),
            frame.get("right_calf", (0, 0, 0))[1],
            frame.get("right_calf", (0, 0, 0))[2],
        )
        frame["left_foot"] = derive_foot_rotation(tuple(left_thigh), -1)
        frame["right_foot"] = derive_foot_rotation(tuple(right_thigh), 1)
        reinforced_frames[frame_index] = frame

        if grounded_hip_z is not None and frame_index < len(reinforced_hips):
            hip_location = list(reinforced_hips[frame_index])
            if len(hip_location) >= 3:
                hip_location[2] = grounded_hip_z
                reinforced_hips[frame_index] = tuple(hip_location)

    return reinforced_frames, reinforced_hips


def reinforce_stick_action_retargeted_contact_window(clip_name, rotation_frames):
    minimum_contact_frames = STICK_ACTION_MIN_TWO_HAND_CONTACT_FRAMES.get(clip_name, 0)
    if minimum_contact_frames <= 0 or len(rotation_frames) < minimum_contact_frames:
        return rotation_frames

    reinforced_frames = rotation_frames
    for frame_index in STICK_ACTION_RETARGET_CONTACT_SUPPORT_FRAME_INDICES.get(clip_name, []):
        contact_indices = calculate_retargeted_stick_action_two_hand_contact_frame_indices(reinforced_frames)
        if len(contact_indices) >= minimum_contact_frames:
            break
        if frame_index in contact_indices or frame_index >= len(reinforced_frames):
            continue

        left_distances = retargeted_stick_action_side_distances(reinforced_frames, "left")
        right_distances = retargeted_stick_action_side_distances(reinforced_frames, "right")
        left_peak = max(left_distances) if left_distances else 0
        right_peak = max(right_distances) if right_distances else 0
        if left_peak <= 0 or right_peak <= 0:
            continue

        left_active = left_distances[frame_index] >= left_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        right_active = right_distances[frame_index] >= right_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        if left_active and right_active:
            continue

        underactive_sides = []
        if not left_active:
            underactive_sides.append("left")
        if not right_active:
            underactive_sides.append("right")
        for _ in range(6):
            for underactive_side in underactive_sides:
                reinforced_frames = nudge_retargeted_stick_side_from_start(
                    reinforced_frames,
                    frame_index,
                    underactive_side,
                    clip_name,
                )
            contact_indices = calculate_retargeted_stick_action_two_hand_contact_frame_indices(reinforced_frames)
            if len(contact_indices) >= minimum_contact_frames:
                break
    return reinforced_frames


def reinforce_receive_pass_retargeted_planted_drive(clip_name, rotation_frames, hip_locations):
    if clip_name != "receive-pass" or not rotation_frames or not hip_locations:
        return rotation_frames, hip_locations

    hip_verticals = [
        location[2]
        for location in hip_locations
        if len(location) >= 3 and math.isfinite(location[2])
    ]
    if not hip_verticals:
        return rotation_frames, hip_locations

    grounded_hip_z = min(hip_verticals)
    reinforced_frames = [
        {bone_key: tuple(rotation) for bone_key, rotation in rotations.items()}
        for rotations in rotation_frames
    ]
    reinforced_hips = [tuple(location) for location in hip_locations]

    for frame_index, (_, left_x, right_x) in RECEIVE_PASS_RETARGET_PLANTED_DRIVE_FRAMES.items():
        if frame_index >= len(reinforced_frames) or frame_index >= len(reinforced_hips):
            continue
        frame = dict(reinforced_frames[frame_index])
        left_thigh = list(frame.get("left_thigh", (0, 0, 0)))
        right_thigh = list(frame.get("right_thigh", (0, 0, 0)))
        left_thigh[0] = clamp(left_x, -42, 48)
        right_thigh[0] = clamp(right_x, -42, 48)
        frame["left_thigh"] = tuple(left_thigh)
        frame["right_thigh"] = tuple(right_thigh)
        reinforced_frames[frame_index] = frame

        hip_location = list(reinforced_hips[frame_index])
        if len(hip_location) >= 3:
            hip_location[2] = grounded_hip_z
            reinforced_hips[frame_index] = tuple(hip_location)

    return reinforced_frames, reinforced_hips


def reinforce_forehand_pass_retargeted_lower_body_lead(clip_name, rotation_frames, hip_locations):
    if clip_name != "forehand-pass" or len(rotation_frames) < PASS_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES + 2:
        return rotation_frames, hip_locations

    current_lead = calculate_retargeted_stick_action_lower_body_lead_frames(rotation_frames)
    if current_lead >= PASS_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES:
        return rotation_frames, hip_locations

    stick_action_values = calculate_retargeted_stick_action_distances(rotation_frames)
    if not stick_action_values or max(stick_action_values) <= 0:
        return rotation_frames, hip_locations

    stick_peak_index = index_of_peak(stick_action_values)
    lead_peak_index = max(1, stick_peak_index - PASS_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES - 6)
    drive_shape = {
        -3: (-28, 22),
        -2: (-24, 18),
        -1: (34, -26),
        0: (48, -38),
        1: (36, -28),
        2: (-30, 24),
        3: (-24, 18),
        5: (26, -20),
        6: (-24, 18),
        7: (24, -18),
        8: (-22, 17),
        9: (22, -17),
        10: (-20, 16),
        11: (20, -16),
        12: (-20, 16),
        13: (20, -16),
        14: (-18, 15),
        15: (18, -15),
        16: (-18, 15),
        17: (18, -15),
        18: (-16, 14),
    }

    reinforced_frames = [
        {bone_key: tuple(rotation) for bone_key, rotation in rotations.items()}
        for rotations in rotation_frames
    ]
    reinforced_hips = [tuple(location) for location in hip_locations]
    hip_verticals = [
        location[2]
        for location in reinforced_hips
        if len(location) >= 3 and math.isfinite(location[2])
    ]
    grounded_hip_z = min(hip_verticals) if hip_verticals else None

    for offset, (left_pitch, right_pitch) in drive_shape.items():
        frame_index = lead_peak_index + offset
        if frame_index < 0 or frame_index >= len(reinforced_frames):
            continue

        frame = dict(reinforced_frames[frame_index])
        left_thigh = list(frame.get("left_thigh", (0, 0, 0)))
        right_thigh = list(frame.get("right_thigh", (0, 0, 0)))
        left_thigh[0] = clamp(left_pitch, -42, 48)
        right_thigh[0] = clamp(right_pitch, -42, 48)
        frame["left_thigh"] = tuple(left_thigh)
        frame["right_thigh"] = tuple(right_thigh)
        frame["left_calf"] = (
            clamp(17 + abs(left_thigh[0]) * 0.78, 14, 52),
            frame.get("left_calf", (0, 0, 0))[1],
            frame.get("left_calf", (0, 0, 0))[2],
        )
        frame["right_calf"] = (
            clamp(17 + abs(right_thigh[0]) * 0.78, 14, 52),
            frame.get("right_calf", (0, 0, 0))[1],
            frame.get("right_calf", (0, 0, 0))[2],
        )
        frame["left_foot"] = derive_foot_rotation(tuple(left_thigh), -1)
        frame["right_foot"] = derive_foot_rotation(tuple(right_thigh), 1)
        reinforced_frames[frame_index] = frame

        if grounded_hip_z is not None and frame_index < len(reinforced_hips):
            hip_location = list(reinforced_hips[frame_index])
            if len(hip_location) >= 3:
                hip_location[2] = grounded_hip_z
                reinforced_hips[frame_index] = tuple(hip_location)

    return reinforced_frames, reinforced_hips


def reinforce_wrist_shot_retargeted_lower_body_lead(clip_name, rotation_frames, hip_locations):
    if clip_name != "wrist-shot" or len(rotation_frames) < SHOT_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES + 2:
        return rotation_frames, hip_locations

    current_lead = calculate_retargeted_stick_action_lower_body_lead_frames(rotation_frames)
    if current_lead >= SHOT_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES:
        return rotation_frames, hip_locations

    stick_action_values = calculate_retargeted_stick_action_distances(rotation_frames)
    if not stick_action_values or max(stick_action_values) <= 0:
        return rotation_frames, hip_locations

    stick_peak_index = index_of_peak(stick_action_values)
    lead_peak_index = max(1, stick_peak_index - SHOT_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES)
    desired_stick_peak_index = min(
        len(rotation_frames) - 2,
        stick_peak_index + (SHOT_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES - current_lead),
    )
    reinforced_frames = rotation_frames
    if desired_stick_peak_index > stick_peak_index:
        for frame_index, scale in [
            (stick_peak_index, 0.92),
            (desired_stick_peak_index, 1.12),
            (desired_stick_peak_index + 1, 1.06),
        ]:
            reinforced_frames = scale_retargeted_stick_frame_from_start(
                reinforced_frames,
                frame_index,
                clip_name,
                scale,
            )

    reinforced_frames = [
        {bone_key: tuple(rotation) for bone_key, rotation in rotations.items()}
        for rotations in reinforced_frames
    ]
    reinforced_hips = [tuple(location) for location in hip_locations]

    for offset, (left_pitch, right_pitch) in WRIST_SHOT_RETARGET_LOWER_BODY_LOAD_FRAMES.items():
        frame_index = lead_peak_index + offset
        if frame_index < 0 or frame_index >= len(reinforced_frames):
            continue

        frame = dict(reinforced_frames[frame_index])
        left_thigh = list(frame.get("left_thigh", (0, 0, 0)))
        right_thigh = list(frame.get("right_thigh", (0, 0, 0)))
        left_thigh[0] = clamp(left_pitch, -42, 48)
        right_thigh[0] = clamp(right_pitch, -42, 48)
        frame["left_thigh"] = tuple(left_thigh)
        frame["right_thigh"] = tuple(right_thigh)
        frame["left_calf"] = (
            clamp(16 + abs(left_thigh[0]) * 0.72, 14, 52),
            frame.get("left_calf", (0, 0, 0))[1],
            frame.get("left_calf", (0, 0, 0))[2],
        )
        frame["right_calf"] = (
            clamp(16 + abs(right_thigh[0]) * 0.72, 14, 52),
            frame.get("right_calf", (0, 0, 0))[1],
            frame.get("right_calf", (0, 0, 0))[2],
        )
        frame["left_foot"] = derive_foot_rotation(tuple(left_thigh), -1)
        frame["right_foot"] = derive_foot_rotation(tuple(right_thigh), 1)
        reinforced_frames[frame_index] = frame

    return reinforced_frames, reinforced_hips


def rotations_from_bvh_frame(clip_name, bvh_frame, root_y_base, root_x_base):
    root_rotation = zxy_to_xyz(bvh_frame["root"][3:6])
    chest = zxy_to_xyz(bvh_frame["chest"])
    head = zxy_to_xyz(bvh_frame["head"])
    left_arm = zxy_to_xyz(bvh_frame["left_arm"])
    right_arm = zxy_to_xyz(bvh_frame["right_arm"])
    left_leg = zxy_to_xyz(bvh_frame["left_leg"])
    right_leg = zxy_to_xyz(bvh_frame["right_leg"])
    sprint = clip_name == "sprint-forward"
    stick_action_upper_arm_max = (
        max_stick_action_upper_arm_lift(clip_name)
        if clip_name in STICK_ACTION_CLIPS
        else 62
    )
    stick_action_upper_arm_swing_max = (
        max_stick_action_upper_arm_swing(clip_name)
        if clip_name in STICK_ACTION_CLIPS
        else 72
    )
    stick_action_upper_arm_lateral_max = (
        max_stick_action_upper_arm_lateral(clip_name)
        if clip_name in STICK_ACTION_CLIPS
        else 36
    )
    leg_drive_scale = LOCOMOTION_LEG_DRIVE_RETARGET_SCALE.get(
        clip_name,
        STICK_ACTION_LEG_DRIVE_RETARGET_SCALE.get(clip_name, 1),
    )
    thigh_pitch_min, thigh_pitch_max = thigh_pitch_limits_for_clip(clip_name)
    locomotion_counter_rotation = calculate_locomotion_counter_rotation_drive(
        clip_name,
        left_arm,
        right_arm,
        left_leg,
        right_leg,
    )
    left_upper_arm_rotation = (
        clamp(left_arm[0], -18, stick_action_upper_arm_max),
        clamp(left_arm[1], -stick_action_upper_arm_lateral_max, stick_action_upper_arm_lateral_max),
        clamp(left_arm[2], -stick_action_upper_arm_swing_max, stick_action_upper_arm_swing_max),
    )
    right_upper_arm_rotation = (
        clamp(right_arm[0], -18, stick_action_upper_arm_max),
        clamp(right_arm[1], -stick_action_upper_arm_lateral_max, stick_action_upper_arm_lateral_max),
        clamp(right_arm[2], -stick_action_upper_arm_swing_max, stick_action_upper_arm_swing_max),
    )
    if clip_name in STICK_ACTION_CLIPS:
        left_upper_arm_rotation = clamp_stick_action_upper_arm_exposure(left_upper_arm_rotation, clip_name)
        right_upper_arm_rotation = clamp_stick_action_upper_arm_exposure(right_upper_arm_rotation, clip_name)

    rotations = {
        "hip": (clamp(root_rotation[0] * 0.35 - 5, -18, 10), clamp(root_rotation[1], -10, 10), clamp(root_rotation[2] * HIP_TWIST_RETARGET_SCALE - locomotion_counter_rotation * 0.35, -10, 10)),
        "waist": (retarget_forward_lean(chest[0], 0.42, locomotion_forward_lean_base(clip_name, 3.5), -16, 10), clamp(chest[1] * 0.35, -12, 12), clamp(chest[2] * WAIST_TWIST_RETARGET_SCALE + locomotion_counter_rotation * 0.35, -16, 16)),
        "spine1": (retarget_forward_lean(chest[0], 0.58, locomotion_forward_lean_base(clip_name, 3.8), -18, 14), clamp(chest[1] * 0.7, -16, 16), clamp(chest[2] * SPINE1_TWIST_RETARGET_SCALE + locomotion_counter_rotation * 0.55, -20, 20)),
        "spine": (retarget_forward_lean(chest[0], 0.52, locomotion_forward_lean_base(clip_name, 3.4), -18, 14), clamp(chest[1] * 0.72, -18, 18), clamp(chest[2] * SPINE_TWIST_RETARGET_SCALE + locomotion_counter_rotation * 0.75, -22, 22)),
        "head": (clamp(head[0] * 0.65 - 2, -18, 18), clamp(head[1] * 0.65, -18, 18), clamp(head[2] * 0.65, -20, 20)),
        "left_upperarm": left_upper_arm_rotation,
        "right_upperarm": right_upper_arm_rotation,
        "left_forearm": derive_forearm_rotation(left_arm, -1, clip_name),
        "right_forearm": derive_forearm_rotation(right_arm, 1, clip_name),
        "left_hand": derive_hand_rotation(left_arm, -1, clip_name),
        "right_hand": derive_hand_rotation(right_arm, 1, clip_name),
        "left_thigh": (clamp(left_leg[0] * leg_drive_scale, thigh_pitch_min, thigh_pitch_max), clamp(left_leg[1] * 0.45, -12, 12), clamp(left_leg[2] * 0.45, -12, 12)),
        "right_thigh": (clamp(right_leg[0] * leg_drive_scale, thigh_pitch_min, thigh_pitch_max), clamp(right_leg[1] * 0.45, -12, 12), clamp(right_leg[2] * 0.45, -12, 12)),
        "left_calf": derive_calf_rotation(left_leg, -1, sprint),
        "right_calf": derive_calf_rotation(right_leg, 1, sprint),
        "left_foot": derive_foot_rotation(left_leg, -1),
        "right_foot": derive_foot_rotation(right_leg, 1),
    }

    if clip_name in NORMAL_RUNNER_MOVEMENT_CLIPS:
        for arm_key in ["left_upperarm", "right_upperarm"]:
            x_value, y_value, z_value = rotations[arm_key]
            rotations[arm_key] = clamp_normal_upper_arm_exposure(
                (
                    clamp(
                        NORMAL_UPPER_ARM_DROP_DEGREES + x_value * NORMAL_UPPER_ARM_LIFT_SOURCE_SCALE,
                        MIN_NORMAL_UPPER_ARM_DROP_DEGREES,
                        MAX_NORMAL_UPPER_ARM_LIFT_DEGREES,
                    ),
                    clamp(y_value, -MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES, MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES),
                    clamp(
                        z_value * LOCOMOTION_ARM_SWING_RETARGET_SCALE,
                        -MAX_NORMAL_UPPER_ARM_SWING_DEGREES,
                        MAX_NORMAL_UPPER_ARM_SWING_DEGREES,
                    ),
                )
            )

    rotations = reinforce_forehand_pass_two_hand_window(clip_name, bvh_frame["frame"], rotations)
    rotations = reinforce_receive_pass_two_hand_window(clip_name, bvh_frame["frame"], rotations)
    rotations = reinforce_wrist_shot_two_hand_window(clip_name, bvh_frame["frame"], rotations)

    root_lateral_scale = (
        STICK_ACTION_ROOT_LATERAL_RETARGET_SCALE
        if clip_name in STICK_ACTION_LEG_DRIVE_RETARGET_SCALE
        else ROOT_LATERAL_RETARGET_SCALE
    )
    hip_location = (
        (bvh_frame["root"][0] - root_x_base) * root_lateral_scale,
        0,
        (bvh_frame["root"][1] - root_y_base) * root_vertical_retarget_scale_for_clip(clip_name),
    )

    return rotations, hip_location


def upper_arm_lift_for_frame(rotations):
    return max(
        abs(rotations.get("left_upperarm", (0, 0, 0))[0]),
        abs(rotations.get("right_upperarm", (0, 0, 0))[0]),
    )


def upper_arm_swing_for_frame(rotations):
    return max(
        abs(rotations.get("left_upperarm", (0, 0, 0))[2]),
        abs(rotations.get("right_upperarm", (0, 0, 0))[2]),
    )


def upper_arm_lateral_for_frame(rotations):
    return max(
        abs(rotations.get("left_upperarm", (0, 0, 0))[1]),
        abs(rotations.get("right_upperarm", (0, 0, 0))[1]),
    )


def upper_arm_exposure_for_frame(rotations):
    exposures = []
    for arm_key in ["left_upperarm", "right_upperarm"]:
        x_value, y_value, _ = rotations.get(arm_key, (0, 0, 0))
        lift = max(0, x_value)
        lateral = abs(y_value)
        exposures.append(math.sqrt(lift * lift + lateral * lateral))
    return max(exposures) if exposures else 0


def upper_arm_drop_for_frame(rotations):
    return min(
        rotations.get("left_upperarm", (0, 0, 0))[0],
        rotations.get("right_upperarm", (0, 0, 0))[0],
    )


def normal_forearm_lift_for_frame(rotations):
    return max(
        abs(rotations.get("left_forearm", (0, 0, 0))[0]),
        abs(rotations.get("right_forearm", (0, 0, 0))[0]),
    )


def normal_hand_lift_for_frame(rotations):
    return max(
        abs(rotations.get("left_hand", (0, 0, 0))[0]),
        abs(rotations.get("right_hand", (0, 0, 0))[0]),
    )


def calculate_retargeted_stick_hand_range(rotation_frames):
    total_range = 0
    for bone_key in ["left_hand", "right_hand"]:
        for axis in range(3):
            values = [
                rotations[bone_key][axis]
                for rotations in rotation_frames
                if bone_key in rotations and len(rotations[bone_key]) > axis
            ]
            if values:
                total_range += max(values) - min(values)
    return round_metric(total_range)


def calculate_retargeted_stick_action_upper_arm_lift(rotation_frames):
    if not rotation_frames:
        return 0
    return round_metric(max(upper_arm_lift_for_frame(rotations) for rotations in rotation_frames))


def calculate_retargeted_stick_action_upper_arm_swing(rotation_frames):
    if not rotation_frames:
        return 0
    return round_metric(max(upper_arm_swing_for_frame(rotations) for rotations in rotation_frames))


def calculate_retargeted_stick_action_upper_arm_lateral(rotation_frames):
    if not rotation_frames:
        return 0
    return round_metric(max(upper_arm_lateral_for_frame(rotations) for rotations in rotation_frames))


def calculate_retargeted_stick_action_upper_arm_exposure(rotation_frames):
    if not rotation_frames:
        return 0
    return round_metric(max(upper_arm_exposure_for_frame(rotations) for rotations in rotation_frames))


def calculate_retargeted_stick_action_forearm_lift(rotation_frames):
    if not rotation_frames:
        return 0
    return round_metric(max(normal_forearm_lift_for_frame(rotations) for rotations in rotation_frames))


def calculate_retargeted_stick_action_hand_lift(rotation_frames):
    if not rotation_frames:
        return 0
    return round_metric(max(normal_hand_lift_for_frame(rotations) for rotations in rotation_frames))


def calculate_retargeted_frame_motion_smoothness(rotation_frames):
    if len(rotation_frames) < 2:
        return {
            "retargetedMaxFrameRotationDeltaDegrees": 0,
            "retargetedMaxFrameRotationAccelerationDegrees": 0,
        }

    frame_deltas = []
    max_delta = 0
    for index in range(1, len(rotation_frames)):
        previous_rotations = rotation_frames[index - 1]
        current_rotations = rotation_frames[index]
        deltas = {}
        for bone_key in sorted(set(previous_rotations) | set(current_rotations)):
            previous = previous_rotations.get(bone_key, (0, 0, 0))
            current = current_rotations.get(bone_key, (0, 0, 0))
            for axis in range(3):
                delta = current[axis] - previous[axis]
                deltas[(bone_key, axis)] = delta
                max_delta = max(max_delta, abs(delta))
        frame_deltas.append(deltas)

    max_acceleration = 0
    for index in range(1, len(frame_deltas)):
        previous_deltas = frame_deltas[index - 1]
        current_deltas = frame_deltas[index]
        for delta_key in sorted(set(previous_deltas) | set(current_deltas)):
            acceleration = current_deltas.get(delta_key, 0) - previous_deltas.get(delta_key, 0)
            max_acceleration = max(max_acceleration, abs(acceleration))

    return {
        "retargetedMaxFrameRotationDeltaDegrees": round_metric(max_delta),
        "retargetedMaxFrameRotationAccelerationDegrees": round_metric(max_acceleration),
    }


def calculate_retargeted_loop_closure_metrics(rotation_frames, hip_locations):
    first_rotations = rotation_frames[0] if rotation_frames else {}
    last_rotations = rotation_frames[-1] if rotation_frames else {}
    loop_closure_error = 0
    for bone_key in sorted(set(first_rotations) | set(last_rotations)):
        first = first_rotations.get(bone_key, (0, 0, 0))
        last = last_rotations.get(bone_key, (0, 0, 0))
        for axis in range(3):
            loop_closure_error += abs((last[axis] if len(last) > axis else 0) - (first[axis] if len(first) > axis else 0))

    first_location = hip_locations[0] if hip_locations else (0, 0, 0)
    last_location = hip_locations[-1] if hip_locations else (0, 0, 0)
    first_vertical = first_location[2] if len(first_location) > 2 else 0
    last_vertical = last_location[2] if len(last_location) > 2 else 0

    return {
        "retargetedLocomotionLoopClosureErrorDegrees": round_metric(loop_closure_error),
        "retargetedRootVerticalLoopOffsetUnits": round_metric(abs(last_vertical - first_vertical)),
    }


def retargeted_stick_action_side_ranges(rotation_frames):
    side_ranges = []
    for side_prefix in ["left", "right"]:
        side_range = 0
        for bone_name in ["upperarm", "forearm", "hand"]:
            bone_key = f"{side_prefix}_{bone_name}"
            for axis in range(3):
                values = [
                    rotations[bone_key][axis]
                    for rotations in rotation_frames
                    if bone_key in rotations and len(rotations[bone_key]) > axis
                ]
                if values:
                    side_range += max(values) - min(values)
        side_ranges.append(side_range)
    return side_ranges


def calculate_retargeted_stick_action_two_hand_balance_ratio(rotation_frames):
    side_ranges = retargeted_stick_action_side_ranges(rotation_frames)
    if len(side_ranges) < 2 or min(side_ranges) <= 0:
        return 0
    return round_metric(min(side_ranges) / max(side_ranges))


def retargeted_stick_action_side_distances(rotation_frames, side_prefix):
    side_bones = [f"{side_prefix}_upperarm", f"{side_prefix}_forearm", f"{side_prefix}_hand"]
    start_vector = []
    for bone_key in side_bones:
        start_vector.extend(rotation_frames[0].get(bone_key, (0, 0, 0)))

    distances = []
    for rotations in rotation_frames:
        vector = []
        for bone_key in side_bones:
            vector.extend(rotations.get(bone_key, (0, 0, 0)))
        distance = math.sqrt(
            sum(
                (value - start_vector[index]) ** 2
                for index, value in enumerate(vector)
            )
        )
        distances.append(distance)
    return distances


def calculate_retargeted_stick_action_two_hand_sync_ratio(rotation_frames):
    if len(rotation_frames) < 2:
        return 0

    left_distances = retargeted_stick_action_side_distances(rotation_frames, "left")
    right_distances = retargeted_stick_action_side_distances(rotation_frames, "right")
    left_peak = max(left_distances) if left_distances else 0
    right_peak = max(right_distances) if right_distances else 0
    if left_peak <= 0 or right_peak <= 0:
        return 0

    either_hand_active_frames = 0
    both_hands_active_frames = 0
    for index in range(len(rotation_frames)):
        left_active = left_distances[index] >= left_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        right_active = right_distances[index] >= right_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        if left_active or right_active:
            either_hand_active_frames += 1
        if left_active and right_active:
            both_hands_active_frames += 1

    return (
        round_metric(both_hands_active_frames / either_hand_active_frames)
        if either_hand_active_frames > 0
        else 0
    )


def calculate_retargeted_stick_action_two_hand_contact_ratio(rotation_frames):
    if len(rotation_frames) < 2:
        return 0

    left_distances = retargeted_stick_action_side_distances(rotation_frames, "left")
    right_distances = retargeted_stick_action_side_distances(rotation_frames, "right")
    left_peak = max(left_distances) if left_distances else 0
    right_peak = max(right_distances) if right_distances else 0
    if left_peak <= 0 or right_peak <= 0:
        return 0

    both_hands_active_frames = 0
    for index in range(len(rotation_frames)):
        left_active = left_distances[index] >= left_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        right_active = right_distances[index] >= right_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        if left_active and right_active:
            both_hands_active_frames += 1

    return round_metric(both_hands_active_frames / len(rotation_frames))


def calculate_retargeted_stick_action_two_hand_contact_frame_indices(rotation_frames):
    if len(rotation_frames) < 2:
        return []

    left_distances = retargeted_stick_action_side_distances(rotation_frames, "left")
    right_distances = retargeted_stick_action_side_distances(rotation_frames, "right")
    left_peak = max(left_distances) if left_distances else 0
    right_peak = max(right_distances) if right_distances else 0
    if left_peak <= 0 or right_peak <= 0:
        return []

    indices = []
    for index in range(len(rotation_frames)):
        left_active = left_distances[index] >= left_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        right_active = right_distances[index] >= right_peak * STICK_ACTION_TWO_HAND_ACTIVE_RATIO
        if left_active and right_active:
            indices.append(index)

    return indices


def calculate_retargeted_stick_action_distances(rotation_frames):
    if not rotation_frames:
        return []

    stick_bones = [
        "left_upperarm",
        "left_forearm",
        "left_hand",
        "right_upperarm",
        "right_forearm",
        "right_hand",
    ]
    start_vector = []
    for bone_key in stick_bones:
        start_vector.extend(rotation_frames[0].get(bone_key, (0, 0, 0)))

    distances = []
    for rotations in rotation_frames:
        vector = []
        for bone_key in stick_bones:
            vector.extend(rotations.get(bone_key, (0, 0, 0)))
        distances.append(
            math.sqrt(
                sum(
                    (value - start_vector[index]) ** 2
                    for index, value in enumerate(vector)
                )
            )
        )
    return distances


def calculate_retargeted_stick_action_sweep_values(rotation_frames):
    stick_bones = [
        "left_upperarm",
        "left_forearm",
        "left_hand",
        "right_upperarm",
        "right_forearm",
        "right_hand",
    ]
    sweep_values = []
    for rotations in rotation_frames:
        sweep = 0
        for bone_key in stick_bones:
            rotation = rotations.get(bone_key, (0, 0, 0))
            sweep += sum(value for value in rotation if math.isfinite(value))
        sweep_values.append(sweep)
    return sweep_values


def calculate_retargeted_stick_action_recovery_ratio(rotation_frames):
    if len(rotation_frames) < 2:
        return 0

    stick_action_values = calculate_retargeted_stick_action_distances(rotation_frames)
    peak_distance = max(stick_action_values) if stick_action_values else 0
    if peak_distance <= 0:
        return 0

    final_distance = stick_action_values[-1]
    recovery_ratio = (peak_distance - final_distance) / peak_distance
    return round_metric(max(0, min(1, recovery_ratio)))


def calculate_retargeted_stick_action_beat_metrics(rotation_frames):
    if len(rotation_frames) < 3:
        return {
            "retargetedStickActionPhaseChanges": 0,
            "retargetedStickActionBeatSpanRatio": 0,
        }

    def metrics_for_values(stick_action_values):
        previous_trend = 0
        changes = 0
        beat_frames = []

        for index in range(1, len(stick_action_values)):
            delta = stick_action_values[index] - stick_action_values[index - 1]
            current_trend = math.copysign(1, delta) if abs(delta) >= STICK_ACTION_PHASE_DEAD_ZONE_DEGREES else 0
            if current_trend == 0:
                continue
            if previous_trend != 0 and current_trend != previous_trend:
                changes += 1
                beat_frames.append(index - 1)
            previous_trend = current_trend

        denominator = max(1, len(stick_action_values) - 1)
        beat_span_ratio = (
            (beat_frames[-1] - beat_frames[0]) / denominator
            if len(beat_frames) >= 2
            else 0
        )
        return {
            "retargetedStickActionPhaseChanges": changes,
            "retargetedStickActionBeatSpanRatio": round_metric(beat_span_ratio),
            "retargetedStickActionBeatFrameIndices": beat_frames,
        }

    sweep_metrics = metrics_for_values(calculate_retargeted_stick_action_sweep_values(rotation_frames))
    distance_metrics = metrics_for_values(calculate_retargeted_stick_action_distances(rotation_frames))
    if (
        distance_metrics["retargetedStickActionPhaseChanges"] > sweep_metrics["retargetedStickActionPhaseChanges"]
        or (
            distance_metrics["retargetedStickActionPhaseChanges"] == sweep_metrics["retargetedStickActionPhaseChanges"]
            and distance_metrics["retargetedStickActionBeatSpanRatio"] > sweep_metrics["retargetedStickActionBeatSpanRatio"]
        )
    ):
        return distance_metrics
    return sweep_metrics


def calculate_retargeted_stick_action_release_peak_ratio(rotation_frames):
    if len(rotation_frames) < 2:
        return 0

    stick_action_values = calculate_retargeted_stick_action_distances(rotation_frames)
    if not stick_action_values or max(stick_action_values) <= 0:
        return 0

    return round_metric(index_of_peak(stick_action_values) / max(1, len(stick_action_values) - 1))


def calculate_retargeted_stick_action_supported_release_ratio(rotation_frames, hip_locations):
    if len(rotation_frames) < 2 or not hip_locations:
        return 0

    stick_action_values = calculate_retargeted_stick_action_distances(rotation_frames)
    if not stick_action_values or max(stick_action_values) <= 0:
        return 0

    hip_verticals = [
        location[2]
        for location in hip_locations
        if len(location) >= 3 and math.isfinite(location[2])
    ]
    if not hip_verticals:
        return 0

    min_hip_vertical = min(hip_verticals)
    max_hip_vertical = max(hip_verticals)
    low_hip_threshold = min_hip_vertical + ((max_hip_vertical - min_hip_vertical) * FOOT_PLANT_ROOT_LOW_RATIO)
    release_index = index_of_peak(stick_action_values)
    start_index = max(0, release_index - STICK_ACTION_RELEASE_SUPPORT_WINDOW_FRAMES)
    end_index = min(
        min(len(rotation_frames), len(hip_locations)) - 1,
        release_index + STICK_ACTION_RELEASE_SUPPORT_WINDOW_FRAMES,
    )
    supported_frames = 0
    total_frames = 0
    for frame_index in range(start_index, end_index + 1):
        total_frames += 1
        if retargeted_foot_plant_contact_side(
            rotation_frames[frame_index],
            hip_locations[frame_index],
            low_hip_threshold,
        ) != 0:
            supported_frames += 1

    return round_metric(supported_frames / total_frames) if total_frames > 0 else 0


def calculate_retargeted_stick_action_lower_body_lead_frames(rotation_frames):
    if len(rotation_frames) < 2:
        return 0

    stick_action_values = calculate_retargeted_stick_action_distances(rotation_frames)
    lower_body_load_values = [
        abs(rotations.get("left_thigh", (0, 0, 0))[0])
        + abs(rotations.get("right_thigh", (0, 0, 0))[0])
        for rotations in rotation_frames
    ]

    return index_of_peak(stick_action_values) - index_of_peak(lower_body_load_values)


def calculate_retargeted_leg_drive_range(rotation_frames):
    total_range = 0
    for bone_key in ["left_thigh", "right_thigh", "left_calf", "right_calf", "left_foot", "right_foot"]:
        values = [
            rotations[bone_key][0]
            for rotations in rotation_frames
            if bone_key in rotations and len(rotations[bone_key]) > 0
        ]
        if values:
            total_range += max(values) - min(values)
    return round_metric(total_range)


def calculate_retargeted_ready_stance_leg_load(rotation_frames):
    leg_load_values = []
    for rotations in rotation_frames:
        left_thigh = rotations.get("left_thigh", (0, 0, 0))
        right_thigh = rotations.get("right_thigh", (0, 0, 0))
        leg_load_values.append(abs(left_thigh[0]) + abs(right_thigh[0]))
    return round_metric(max(leg_load_values)) if leg_load_values else 0


def calculate_retargeted_locomotion_stride_balance_ratio(rotation_frames):
    side_ranges = []
    for side_prefix in ["left", "right"]:
        side_range = 0
        for bone_name in ["thigh", "calf", "foot"]:
            bone_key = f"{side_prefix}_{bone_name}"
            values = [
                rotations[bone_key][0]
                for rotations in rotation_frames
                if bone_key in rotations and len(rotations[bone_key]) > 0
            ]
            if values:
                side_range += max(values) - min(values)
        side_ranges.append(side_range)

    if len(side_ranges) < 2 or min(side_ranges) <= 0:
        return 0

    return round_metric(min(side_ranges) / max(side_ranges))


def calculate_retargeted_locomotion_arm_swing_range(rotation_frames):
    total_range = 0
    for bone_key in ["left_upperarm", "right_upperarm"]:
        values = [
            rotations[bone_key][2]
            for rotations in rotation_frames
            if bone_key in rotations and len(rotations[bone_key]) > 2
        ]
        if values:
            total_range += max(values) - min(values)
    return round_metric(total_range)


def calculate_retargeted_locomotion_contralateral_sync_ratio(rotation_frames):
    if len(rotation_frames) < 2:
        return 0

    left_arm = [
        rotations.get("left_upperarm", (0, 0, 0))[2]
        for rotations in rotation_frames
    ]
    right_arm = [
        rotations.get("right_upperarm", (0, 0, 0))[2]
        for rotations in rotation_frames
    ]
    left_leg = [
        rotations.get("left_thigh", (0, 0, 0))[0]
        for rotations in rotation_frames
    ]
    right_leg = [
        rotations.get("right_thigh", (0, 0, 0))[0]
        for rotations in rotation_frames
    ]
    left_arm_right_leg = abs(calculate_correlation(left_arm, right_leg))
    right_arm_left_leg = abs(calculate_correlation(right_arm, left_leg))

    return round_metric((left_arm_right_leg + right_arm_left_leg) / 2)


def calculate_retargeted_torso_follow_through_range(rotation_frames):
    total_range = 0
    for bone_key in ["waist", "spine1", "spine"]:
        for axis in range(3):
            values = [
                rotations[bone_key][axis]
                for rotations in rotation_frames
                if bone_key in rotations and len(rotations[bone_key]) > axis
            ]
            if values:
                total_range += max(values) - min(values)
    return round_metric(total_range)


def calculate_retargeted_hip_shoulder_separation(rotation_frames):
    separation_values = []
    for rotations in rotation_frames:
        hip = rotations.get("hip")
        spine = rotations.get("spine")
        if hip and spine and len(hip) > 2 and len(spine) > 2:
            separation_values.append(spine[2] - hip[2])
    if not separation_values:
        return 0
    return round_metric(max(separation_values) - min(separation_values))


def calculate_retargeted_athletic_torso_lean(rotation_frames):
    lean_values = []
    for rotations in rotation_frames:
        frame_lean = 0
        lean_bone_count = 0
        for bone_key in ["waist", "spine1", "spine"]:
            rotation = rotations.get(bone_key)
            if rotation and len(rotation) > 0:
                frame_lean += abs(rotation[0])
                lean_bone_count += 1
        if lean_bone_count > 0:
            lean_values.append(frame_lean / lean_bone_count)
    if not lean_values:
        return 0
    return round_metric(sum(lean_values) / len(lean_values))


def retargeted_foot_plant_contact_side(rotations, hip_location, low_hip_threshold):
    if (
        not hip_location
        or len(hip_location) < 3
        or not math.isfinite(hip_location[2])
        or hip_location[2] > low_hip_threshold
    ):
        return 0

    left_thigh = rotations.get("left_thigh", (0, 0, 0))
    right_thigh = rotations.get("right_thigh", (0, 0, 0))
    stride_difference = left_thigh[0] - right_thigh[0]
    if abs(stride_difference) < STRIDE_PHASE_DEAD_ZONE_DEGREES * 1.4:
        return 0
    return 1 if stride_difference > 0 else -1


def calculate_retargeted_ready_stance_foot_plant_metrics(rotation_frames, hip_locations):
    empty_metrics = {
        "retargetedFootPlantContactFrameCount": 0,
        "retargetedFootPlantSideCount": 0,
        "retargetedFootPlantBalanceRatio": 0,
        "retargetedFootPlantMinSideHoldFrames": 0,
        "retargetedFootPlantStabilityRatio": 0,
        "retargetedFootPlantMaxSlideUnits": 0,
        "retargetedFootPlantStrideCoverageRatio": 0,
        "retargetedFootPlantGroundedRatio": 0,
    }
    if not rotation_frames or not hip_locations:
        return empty_metrics

    hip_verticals = [
        location[2]
        for location in hip_locations
        if len(location) >= 3 and math.isfinite(location[2])
    ]
    if not hip_verticals:
        return empty_metrics

    min_hip_vertical = min(hip_verticals)
    max_hip_vertical = max(hip_verticals)
    low_hip_threshold = min_hip_vertical + ((max_hip_vertical - min_hip_vertical) * FOOT_PLANT_ROOT_LOW_RATIO)
    contact_frames = 0
    low_hip_frame_count = 0
    active_hold = 0
    longest_hold = 0
    active_contact = None
    max_lateral_drift = 0

    for rotations, hip_location in zip(rotation_frames, hip_locations):
        has_low_hip = (
            hip_location
            and len(hip_location) >= 3
            and math.isfinite(hip_location[2])
            and hip_location[2] <= low_hip_threshold
        )
        if has_low_hip:
            low_hip_frame_count += 1

        left_load = abs(rotations.get("left_thigh", (0, 0, 0))[0])
        right_load = abs(rotations.get("right_thigh", (0, 0, 0))[0])
        two_foot_loaded = min(left_load, right_load) >= STRIDE_PHASE_DEAD_ZONE_DEGREES * 1.4
        if not has_low_hip or not two_foot_loaded:
            active_hold = 0
            active_contact = None
            continue

        contact_frames += 1
        active_hold += 1
        longest_hold = max(longest_hold, active_hold)
        lateral = hip_location[0] if len(hip_location) > 0 and math.isfinite(hip_location[0]) else 0
        if active_contact is None:
            active_contact = lateral
        max_lateral_drift = max(max_lateral_drift, abs(lateral - active_contact))

    if contact_frames <= 0:
        return empty_metrics

    contact_ratio = min(1, contact_frames / max(1, len(rotation_frames) * 0.2))
    hold_ratio = min(1, longest_hold / 2)
    drift_ratio = max(0, 1 - (max_lateral_drift / 0.08))
    grounded_ratio = contact_frames / low_hip_frame_count if low_hip_frame_count > 0 else 0
    stability_ratio = min(contact_ratio, hold_ratio, drift_ratio, grounded_ratio)

    return {
        "retargetedFootPlantContactFrameCount": contact_frames,
        "retargetedFootPlantSideCount": 2,
        "retargetedFootPlantBalanceRatio": 1,
        "retargetedFootPlantMinSideHoldFrames": longest_hold,
        "retargetedFootPlantStabilityRatio": round_metric(stability_ratio),
        "retargetedFootPlantMaxSlideUnits": round_metric(max_lateral_drift),
        "retargetedFootPlantStrideCoverageRatio": 0,
        "retargetedFootPlantGroundedRatio": round_metric(grounded_ratio),
    }


def calculate_retargeted_foot_plant_metrics(rotation_frames, hip_locations, clip_name=None):
    if clip_name == "idle-ready":
        return calculate_retargeted_ready_stance_foot_plant_metrics(rotation_frames, hip_locations)

    if not rotation_frames or not hip_locations:
        return {
            "retargetedFootPlantContactFrameCount": 0,
            "retargetedFootPlantSideCount": 0,
            "retargetedFootPlantBalanceRatio": 0,
            "retargetedFootPlantMinSideHoldFrames": 0,
            "retargetedFootPlantStabilityRatio": 0,
            "retargetedFootPlantMaxSlideUnits": 0,
            "retargetedFootPlantStrideCoverageRatio": 0,
            "retargetedFootPlantGroundedRatio": 0,
        }

    hip_verticals = [
        location[2]
        for location in hip_locations
        if len(location) >= 3 and math.isfinite(location[2])
    ]
    if not hip_verticals:
        return {
            "retargetedFootPlantContactFrameCount": 0,
            "retargetedFootPlantSideCount": 0,
            "retargetedFootPlantBalanceRatio": 0,
            "retargetedFootPlantMinSideHoldFrames": 0,
            "retargetedFootPlantStabilityRatio": 0,
            "retargetedFootPlantMaxSlideUnits": 0,
            "retargetedFootPlantStrideCoverageRatio": 0,
            "retargetedFootPlantGroundedRatio": 0,
        }

    min_hip_vertical = min(hip_verticals)
    max_hip_vertical = max(hip_verticals)
    low_hip_threshold = min_hip_vertical + ((max_hip_vertical - min_hip_vertical) * FOOT_PLANT_ROOT_LOW_RATIO)
    contact_sides = set()
    contact_counts = {}
    stride_phase_indices_by_side = {}
    covered_stride_phase_indices = set()
    longest_hold_by_side = {}
    contact_frames = 0
    low_hip_frame_count = 0
    active_contact = None
    max_contact_drift = 0

    active_stride_side = 0
    active_stride_phase_index = -1
    for frame_index, rotations in enumerate(rotation_frames):
        left_thigh = rotations.get("left_thigh", (0, 0, 0))
        right_thigh = rotations.get("right_thigh", (0, 0, 0))
        stride_difference = left_thigh[0] - right_thigh[0]
        if abs(stride_difference) < STRIDE_PHASE_DEAD_ZONE_DEGREES * 1.4:
            continue
        stride_side = 1 if stride_difference > 0 else -1
        if stride_side != active_stride_side:
            active_stride_side = stride_side
            active_stride_phase_index += 1
        stride_phase_indices_by_side[frame_index] = (stride_side, active_stride_phase_index)

    for frame_index, (rotations, hip_location) in enumerate(zip(rotation_frames, hip_locations)):
        if (
            hip_location
            and len(hip_location) >= 3
            and math.isfinite(hip_location[2])
            and hip_location[2] <= low_hip_threshold
        ):
            low_hip_frame_count += 1
        side = retargeted_foot_plant_contact_side(rotations, hip_location, low_hip_threshold)
        if side == 0:
            active_contact = None
            continue

        contact_frames += 1
        contact_sides.add(side)
        contact_counts[side] = contact_counts.get(side, 0) + 1
        stride_phase = stride_phase_indices_by_side.get(frame_index)
        if stride_phase and stride_phase[0] == side:
            covered_stride_phase_indices.add(stride_phase[1])
        lateral = hip_location[0] if len(hip_location) > 0 and math.isfinite(hip_location[0]) else 0
        vertical = hip_location[2] if len(hip_location) > 2 and math.isfinite(hip_location[2]) else 0
        if not active_contact or active_contact["side"] != side:
            active_contact = {
                "side": side,
                "startLateral": lateral,
                "startVertical": vertical,
                "frameCount": 0,
            }
        active_contact["frameCount"] += 1
        longest_hold_by_side[side] = max(
            longest_hold_by_side.get(side, 0),
            active_contact["frameCount"],
        )
        max_contact_drift = max(
            max_contact_drift,
            math.hypot(
                lateral - active_contact["startLateral"],
                vertical - active_contact["startVertical"],
            ),
        )

    side_counts = [contact_counts.get(side, 0) for side in contact_sides if side != 0]
    side_holds = [longest_hold_by_side.get(side, 0) for side in contact_sides if side != 0]
    balance_ratio = min(side_counts) / max(side_counts) if len(side_counts) >= 2 and max(side_counts) > 0 else 0
    min_side_hold_frames = min(side_holds) if side_holds else 0
    stability_ratio = 0
    if len(contact_sides) >= 2:
        contact_ratio = min(1, contact_frames / max(1, len(rotation_frames) * 0.25))
        hold_ratio = min(1, min_side_hold_frames / 3)
        drift_ratio = max(0, 1 - (max_contact_drift / 0.08))
        stability_ratio = min(contact_ratio, balance_ratio, hold_ratio, drift_ratio)
    stride_phase_count = max(0, active_stride_phase_index + 1)
    stride_coverage_ratio = (
        len(covered_stride_phase_indices) / stride_phase_count
        if stride_phase_count > 0
        else 0
    )
    grounded_ratio = contact_frames / low_hip_frame_count if low_hip_frame_count > 0 else 0

    return {
        "retargetedFootPlantContactFrameCount": contact_frames,
        "retargetedFootPlantSideCount": len(contact_sides),
        "retargetedFootPlantBalanceRatio": round_metric(balance_ratio),
        "retargetedFootPlantMinSideHoldFrames": min_side_hold_frames,
        "retargetedFootPlantStabilityRatio": round_metric(stability_ratio),
        "retargetedFootPlantMaxSlideUnits": round_metric(max_contact_drift),
        "retargetedFootPlantStrideCoverageRatio": round_metric(stride_coverage_ratio),
        "retargetedFootPlantGroundedRatio": round_metric(grounded_ratio),
    }


def calculate_retargeted_locomotion_foot_plant_drive_ratio(rotation_frames, hip_locations):
    if len(rotation_frames) < 2 or not hip_locations:
        return 0

    hip_verticals = [
        location[2]
        for location in hip_locations
        if len(location) >= 3 and math.isfinite(location[2])
    ]
    if not hip_verticals:
        return 0

    min_hip_vertical = min(hip_verticals)
    max_hip_vertical = max(hip_verticals)
    low_hip_threshold = min_hip_vertical + ((max_hip_vertical - min_hip_vertical) * FOOT_PLANT_ROOT_LOW_RATIO)
    total_leg_drive = 0
    planted_leg_drive = 0

    for index in range(1, len(rotation_frames)):
        current = rotation_frames[index]
        previous = rotation_frames[index - 1]
        current_drive = abs(current.get("left_thigh", (0, 0, 0))[0] - current.get("right_thigh", (0, 0, 0))[0])
        previous_drive = abs(previous.get("left_thigh", (0, 0, 0))[0] - previous.get("right_thigh", (0, 0, 0))[0])
        leg_drive_delta = abs(current_drive - previous_drive)
        if leg_drive_delta <= 0:
            continue

        total_leg_drive += leg_drive_delta
        has_nearby_plant = False
        for contact_index in range(
            index - FOOT_PLANT_DRIVE_WINDOW_FRAMES,
            index + FOOT_PLANT_DRIVE_WINDOW_FRAMES + 1,
        ):
            if 0 <= contact_index < min(len(rotation_frames), len(hip_locations)):
                has_nearby_plant = (
                    has_nearby_plant
                    or retargeted_foot_plant_contact_side(
                        rotation_frames[contact_index],
                        hip_locations[contact_index],
                        low_hip_threshold,
                    ) != 0
                )
        if has_nearby_plant:
            planted_leg_drive += leg_drive_delta

    return round_metric(planted_leg_drive / total_leg_drive) if total_leg_drive > 0 else 0


def calculate_retargeted_foot_plant_stability_ratio(rotation_frames, hip_locations):
    return calculate_retargeted_foot_plant_metrics(
        rotation_frames,
        hip_locations,
    )["retargetedFootPlantStabilityRatio"]


def minimum_retargeted_leg_drive_range(clip_name, quality_profile):
    source_minimum = quality_profile["minimumLegDriveRangeDegrees"]
    if source_minimum <= 0:
        return 0
    retarget_scale = LOCOMOTION_LEG_DRIVE_RETARGET_SCALE.get(
        clip_name,
        STICK_ACTION_LEG_DRIVE_RETARGET_SCALE.get(clip_name, 1),
    )
    return round_metric(source_minimum * retarget_scale * 0.55)


def minimum_retargeted_ready_stance_leg_load(clip_name, quality_profile):
    if clip_name != "idle-ready":
        return 0
    source_minimum = quality_profile["minimumReadyStanceLegLoadDegrees"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.55)


def minimum_retargeted_locomotion_stride_balance_ratio(clip_name, quality_profile):
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    source_minimum = quality_profile["minimumLocomotionStrideBalanceRatio"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.9)


def minimum_retargeted_locomotion_arm_swing_range(clip_name, quality_profile):
    if clip_name not in NORMAL_RUNNER_MOVEMENT_CLIPS:
        return 0
    source_minimum = quality_profile["minimumLocomotionArmSwingRangeDegrees"]
    if source_minimum <= 0:
        return 0
    compact_envelope_max = MAX_NORMAL_UPPER_ARM_SWING_DEGREES * 4
    return round_metric(min(
        source_minimum * LOCOMOTION_ARM_SWING_RETARGET_SCALE * 0.75,
        compact_envelope_max,
    ))


def minimum_retargeted_stick_action_two_hand_balance_ratio(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 0
    source_minimum = quality_profile["minimumStickActionTwoHandBalanceRatio"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.75)


def minimum_retargeted_stick_action_two_hand_sync_ratio(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 0
    source_minimum = quality_profile["minimumStickActionTwoHandSyncRatio"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.75)


def minimum_retargeted_stick_action_two_hand_contact_ratio(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 0
    if clip_name in {"forehand-pass", "receive-pass", "wrist-shot"}:
        return 0.75
    source_minimum = quality_profile["minimumStickActionTwoHandContactRatio"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.75)


def minimum_retargeted_stick_action_lower_body_lead_frames(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 0
    if clip_name == "forehand-pass":
        return PASS_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES
    if clip_name == "receive-pass":
        return RECEIVE_PASS_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES
    if clip_name == "wrist-shot":
        return SHOT_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES
    if clip_name == "stick-handle":
        return STICK_HANDLE_MIN_RETARGET_LOWER_BODY_LEAD_FRAMES
    source_minimum = quality_profile["minimumStickActionLowerBodyLeadFrames"]
    if source_minimum <= 0:
        return 0
    return max(1, round(source_minimum * 0.5))


def minimum_retargeted_stick_action_recovery_ratio(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 0
    source_minimum = quality_profile["minimumStickActionRecoveryRatio"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.75)


def minimum_retargeted_stick_action_phase_changes(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 0
    source_minimum = quality_profile["minimumStickActionPhaseChanges"]
    if source_minimum <= 0:
        return 0
    return max(1, round(source_minimum * 0.75))


def minimum_retargeted_stick_action_beat_span_ratio(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 0
    source_minimum = quality_profile["minimumStickActionBeatSpanRatio"]
    if source_minimum <= 0:
        return 0
    retarget_floor = round_metric(source_minimum * 0.65)
    if clip_name == "stick-handle":
        return max(retarget_floor, STICK_HANDLE_MIN_RETARGETED_BEAT_SPAN_RATIO)
    return retarget_floor


def minimum_retargeted_stick_action_release_peak_ratio(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 0
    source_minimum = quality_profile["minimumStickActionReleasePeakRatio"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.8)


def maximum_retargeted_stick_action_release_peak_ratio(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 1
    return round_metric(min(1, quality_profile["maximumStickActionReleasePeakRatio"] + 0.08))


def minimum_retargeted_stick_action_supported_release_ratio(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 0
    source_minimum = quality_profile["minimumStickActionSupportedReleaseRatio"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.8)


def maximum_retargeted_stick_action_upper_arm_lift(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 999
    return max_stick_action_upper_arm_lift(clip_name)


def maximum_retargeted_stick_action_upper_arm_swing(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 999
    return max_stick_action_upper_arm_swing(clip_name)


def maximum_retargeted_stick_action_upper_arm_lateral(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 999
    return max_stick_action_upper_arm_lateral(clip_name)


def maximum_retargeted_stick_action_upper_arm_exposure(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 999
    return max_stick_action_upper_arm_exposure(clip_name)


def maximum_retargeted_stick_action_forearm_lift(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 999
    return MAX_STICK_ACTION_FOREARM_LIFT_DEGREES


def maximum_retargeted_stick_action_hand_lift(clip_name, quality_profile):
    if clip_name not in STICK_ACTION_CLIPS:
        return 999
    return MAX_STICK_ACTION_HAND_LIFT_DEGREES


def maximum_retargeted_frame_rotation_delta(clip_name, quality_profile):
    multiplier = 1.45 if clip_name in STICK_ACTION_CLIPS else 1.35
    return round_metric(max(
        quality_profile["maximumFrameRotationDeltaDegrees"] + 2,
        quality_profile["maximumFrameRotationDeltaDegrees"] * multiplier,
    ))


def maximum_retargeted_frame_rotation_acceleration(clip_name, quality_profile):
    if clip_name in STICK_ACTION_RETARGET_ACCELERATION_LIMITS:
        return STICK_ACTION_RETARGET_ACCELERATION_LIMITS[clip_name]
    if clip_name in LOCOMOTION_RETARGET_ACCELERATION_LIMITS:
        return LOCOMOTION_RETARGET_ACCELERATION_LIMITS[clip_name]

    multiplier = 2.4 if clip_name in NORMAL_RUNNER_MOVEMENT_CLIPS else 1.55
    return round_metric(max(
        quality_profile["maximumFrameRotationAccelerationDegrees"] + 4,
        quality_profile["maximumFrameRotationAccelerationDegrees"] * multiplier,
    ))


def maximum_retargeted_loop_closure_error(clip_name, quality_profile):
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 999
    return quality_profile["maximumLoopClosureErrorDegrees"]


def maximum_retargeted_loop_vertical_offset(clip_name, quality_profile):
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 999
    return round_metric(
        quality_profile["maximumLoopVerticalOffsetUnits"] * root_vertical_retarget_scale_for_clip(clip_name)
    )


def maximum_retargeted_foot_plant_slide_units(clip_name, quality_profile):
    if clip_name in STICK_ACTION_CLIPS:
        return STICK_ACTION_MAX_RETARGET_FOOT_PLANT_SLIDE_UNITS
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 999
    return round_metric(max(
        0.04,
        quality_profile["maximumFootPlantRootDriftUnits"] * ROOT_LATERAL_RETARGET_SCALE * 2.2,
    ))


def minimum_retargeted_locomotion_contralateral_sync_ratio(clip_name, quality_profile):
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    source_minimum = quality_profile["minimumLocomotionContralateralSyncRatio"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.75)


def minimum_retargeted_torso_follow_through_range(quality_profile):
    source_minimum = quality_profile["minimumStickActionTorsoRangeDegrees"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.75)


def minimum_retargeted_hip_shoulder_separation(quality_profile):
    source_minimum = quality_profile["minimumHipShoulderSeparationDegrees"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 1.0)


def minimum_retargeted_athletic_torso_lean(clip_name, quality_profile):
    if clip_name == "idle-ready":
        return 9.5
    source_minimum = quality_profile["minimumAthleticTorsoLeanDegrees"]
    if source_minimum <= 0:
        return 0
    return round_metric(source_minimum * 0.65)


def minimum_retargeted_foot_plant_stability_ratio(clip_name, quality_profile):
    if clip_name == "idle-ready":
        return 0.8
    if clip_name in STICK_ACTION_CLIPS:
        return quality_profile["minimumFootPlantBalanceRatio"]
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    return round_metric(max(
        MIN_LOCOMOTION_RETARGET_FOOT_PLANT_STABILITY_RATIO,
        quality_profile["minimumFootPlantBalanceRatio"] * 0.9,
    ))


def minimum_retargeted_foot_plant_stride_coverage_ratio(clip_name, quality_profile):
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    if quality_profile["minimumStridePhaseChanges"] <= 0:
        return 0
    return 0.75


def minimum_retargeted_foot_plant_grounded_ratio(clip_name, quality_profile):
    if clip_name == "idle-ready":
        return 0.8
    if clip_name in STICK_ACTION_CLIPS:
        return STICK_ACTION_MIN_RETARGET_FOOT_GROUNDED_RATIO[clip_name]
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    if quality_profile["minimumFootPlantContactFrames"] <= 0:
        return 0
    return 0.75


def minimum_retargeted_locomotion_foot_plant_drive_ratio(clip_name, quality_profile):
    if clip_name == "receive-pass":
        return round_metric(max(0.6, quality_profile["minimumLocomotionFootPlantDriveRatio"]))
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    source_minimum = quality_profile["minimumLocomotionFootPlantDriveRatio"]
    if source_minimum <= 0:
        return 0
    return round_metric(max(0.7, source_minimum * 1.2))


def minimum_retargeted_foot_plant_contact_frames(clip_name, quality_profile):
    if clip_name == "idle-ready":
        return quality_profile["minimumFootPlantContactFrames"]
    if clip_name in STICK_ACTION_CLIPS:
        return quality_profile["minimumFootPlantContactFrames"]
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    return max(4, round(quality_profile["minimumFootPlantContactFrames"] * 0.65))


def minimum_retargeted_foot_plant_side_count(clip_name, quality_profile):
    if clip_name == "idle-ready":
        return quality_profile["minimumFootPlantSideCount"]
    if clip_name in STICK_ACTION_CLIPS:
        return quality_profile["minimumFootPlantSideCount"]
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    return quality_profile["minimumFootPlantSideCount"]


def minimum_retargeted_foot_plant_balance_ratio(clip_name, quality_profile):
    if clip_name == "idle-ready":
        return max(0.8, quality_profile["minimumFootPlantBalanceRatio"])
    if clip_name in STICK_ACTION_CLIPS:
        return quality_profile["minimumFootPlantBalanceRatio"]
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    return round_metric(max(
        MIN_LOCOMOTION_RETARGET_FOOT_PLANT_BALANCE_RATIO,
        quality_profile["minimumFootPlantBalanceRatio"] * 0.9,
    ))


def minimum_retargeted_foot_plant_hold_frames(clip_name, quality_profile):
    if clip_name == "idle-ready":
        return quality_profile["minimumFootPlantHoldFramesPerSide"]
    if clip_name in STICK_ACTION_CLIPS:
        return quality_profile["minimumFootPlantHoldFramesPerSide"]
    if clip_name not in {"jog-forward", "sprint-forward"}:
        return 0
    return max(2, math.floor(quality_profile["minimumFootPlantHoldFramesPerSide"] * 0.75))


def retarget_runner_required_clips():
    armature = find_armature()
    if not armature:
        return {
            "retargetedClips": [],
            "missingMotionSources": [],
            "invalidMotionSources": ["missing-runner-armature"],
            "normalMotionPosture": {
                "status": "blocked",
                "maxUpperArmLiftDegrees": None,
                "maxUpperArmLateralDegrees": None,
                "clipPostures": [],
            },
        }

    bones = resolve_runner_bones(armature)
    bpy.context.scene.render.fps = 30
    retargeted = []
    missing_sources = []
    invalid_sources = []
    max_normal_upper_arm_lift = 0
    max_normal_upper_arm_swing = 0
    max_normal_upper_arm_lateral = 0
    max_normal_upper_arm_exposure = 0
    max_normal_forearm_lift = 0
    max_normal_hand_lift = 0
    min_normal_upper_arm_drop = float("inf")
    normal_clip_postures = {}

    for clip_name in RUNNER_REQUIRED_CLIPS:
        source_file = RUNNER_CLIP_MOTION_SOURCES[clip_name]
        source_path = RUNNER_MOTION_SOURCE_DIR / source_file
        if not source_path.exists():
            missing_sources.append(str(source_path.relative_to(PROJECT_ROOT)))
            continue

        if clip_name in bpy.data.actions:
            bpy.data.actions.remove(bpy.data.actions[clip_name])

        try:
            source_motion = parse_internal_bvh_motion(source_path, clip_name)
        except RuntimeError as error:
            invalid_sources.append(str(error))
            continue
        source_rights_path = find_source_rights_evidence(source_path)
        source_metadata = parse_source_rights_metadata(source_path)

        action = bpy.data.actions.new(clip_name)
        action.use_fake_user = True
        armature.animation_data_create()
        armature.animation_data.action = action
        root_y_base = source_motion["frames"][0]["root"][1]
        root_x_base = source_motion["frames"][0]["root"][0]
        retargeted_rotation_frames = []
        retargeted_hip_locations = []

        for bvh_frame in source_motion["frames"]:
            rotations, hip_location = rotations_from_bvh_frame(clip_name, bvh_frame, root_y_base, root_x_base)
            retargeted_rotation_frames.append(rotations)
            retargeted_hip_locations.append(hip_location)

        retargeted_rotation_frames = smooth_locomotion_rotation_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = smooth_stick_action_rotation_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = reinforce_stick_action_retargeted_contact_window(
            clip_name,
            retargeted_rotation_frames,
        )
        retargeted_rotation_frames, retargeted_hip_locations = reinforce_receive_pass_retargeted_planted_drive(
            clip_name,
            retargeted_rotation_frames,
            retargeted_hip_locations,
        )
        retargeted_rotation_frames = clamp_retargeted_stick_action_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = smooth_stick_action_rotation_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = clamp_retargeted_stick_action_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = reinforce_stick_action_retargeted_contact_window(
            clip_name,
            retargeted_rotation_frames,
        )
        retargeted_rotation_frames = smooth_stick_action_rotation_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = clamp_retargeted_stick_action_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = reinforce_stick_handle_retargeted_beat_sequence(
            clip_name,
            retargeted_rotation_frames,
        )
        retargeted_rotation_frames = reinforce_forehand_pass_retargeted_beat_sequence(
            clip_name,
            retargeted_rotation_frames,
        )
        retargeted_rotation_frames, retargeted_hip_locations = reinforce_stick_handle_retargeted_lower_body_lead(
            clip_name,
            retargeted_rotation_frames,
            retargeted_hip_locations,
        )
        retargeted_rotation_frames, retargeted_hip_locations = reinforce_forehand_pass_retargeted_lower_body_lead(
            clip_name,
            retargeted_rotation_frames,
            retargeted_hip_locations,
        )
        retargeted_rotation_frames = smooth_stick_action_rotation_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = clamp_retargeted_stick_action_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = reinforce_stick_action_retargeted_contact_window(
            clip_name,
            retargeted_rotation_frames,
            )
        retargeted_rotation_frames = clamp_retargeted_stick_action_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames, retargeted_hip_locations = reinforce_wrist_shot_retargeted_lower_body_lead(
            clip_name,
            retargeted_rotation_frames,
            retargeted_hip_locations,
        )
        retargeted_rotation_frames = smooth_stick_action_rotation_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = clamp_retargeted_stick_action_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = reinforce_stick_action_retargeted_contact_window(
            clip_name,
            retargeted_rotation_frames,
        )
        retargeted_rotation_frames = clamp_retargeted_stick_action_frames(clip_name, retargeted_rotation_frames)
        retargeted_rotation_frames = reinforce_forehand_pass_retargeted_hand_beat_sequence(
            clip_name,
            retargeted_rotation_frames,
        )
        retargeted_rotation_frames = clamp_retargeted_stick_action_frames(clip_name, retargeted_rotation_frames)

        last_rotations = None
        last_hip_location = None
        for bvh_frame, rotations, hip_location in zip(
            source_motion["frames"],
            retargeted_rotation_frames,
            retargeted_hip_locations,
        ):
            if clip_name in NORMAL_RUNNER_MOVEMENT_CLIPS:
                clip_posture = normal_clip_postures.setdefault(
                    clip_name,
                    {
                        "clipName": clip_name,
                        "maxUpperArmLiftDegrees": 0,
                        "maxAllowedUpperArmLiftDegrees": MAX_NORMAL_UPPER_ARM_LIFT_DEGREES,
                        "maxUpperArmSwingDegrees": 0,
                        "maxAllowedUpperArmSwingDegrees": MAX_NORMAL_UPPER_ARM_SWING_DEGREES,
                        "maxUpperArmLateralDegrees": 0,
                        "maxAllowedUpperArmLateralDegrees": MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES,
                        "maxUpperArmExposureDegrees": 0,
                        "maxAllowedUpperArmExposureDegrees": MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES,
                        "maxForearmLiftDegrees": 0,
                        "maxAllowedForearmLiftDegrees": MAX_NORMAL_FOREARM_LIFT_DEGREES,
                        "maxHandLiftDegrees": 0,
                        "maxAllowedHandLiftDegrees": MAX_NORMAL_HAND_LIFT_DEGREES,
                        "minUpperArmDropDegrees": float("inf"),
                        "minRequiredUpperArmDropDegrees": MIN_NORMAL_UPPER_ARM_DROP_DEGREES,
                    },
                )
                upper_arm_lift = upper_arm_lift_for_frame(rotations)
                upper_arm_swing = upper_arm_swing_for_frame(rotations)
                upper_arm_lateral = upper_arm_lateral_for_frame(rotations)
                upper_arm_exposure = upper_arm_exposure_for_frame(rotations)
                forearm_lift = normal_forearm_lift_for_frame(rotations)
                hand_lift = normal_hand_lift_for_frame(rotations)
                upper_arm_drop = upper_arm_drop_for_frame(rotations)
                clip_posture["maxUpperArmLiftDegrees"] = max(
                    clip_posture["maxUpperArmLiftDegrees"],
                    upper_arm_lift,
                )
                clip_posture["maxUpperArmSwingDegrees"] = max(
                    clip_posture["maxUpperArmSwingDegrees"],
                    upper_arm_swing,
                )
                clip_posture["maxUpperArmLateralDegrees"] = max(
                    clip_posture["maxUpperArmLateralDegrees"],
                    upper_arm_lateral,
                )
                clip_posture["maxUpperArmExposureDegrees"] = max(
                    clip_posture["maxUpperArmExposureDegrees"],
                    upper_arm_exposure,
                )
                clip_posture["maxForearmLiftDegrees"] = max(
                    clip_posture["maxForearmLiftDegrees"],
                    forearm_lift,
                )
                clip_posture["maxHandLiftDegrees"] = max(
                    clip_posture["maxHandLiftDegrees"],
                    hand_lift,
                )
                clip_posture["minUpperArmDropDegrees"] = min(
                    clip_posture["minUpperArmDropDegrees"],
                    upper_arm_drop,
                )
                max_normal_upper_arm_lift = max(max_normal_upper_arm_lift, upper_arm_lift)
                max_normal_upper_arm_swing = max(max_normal_upper_arm_swing, upper_arm_swing)
                max_normal_upper_arm_lateral = max(max_normal_upper_arm_lateral, upper_arm_lateral)
                max_normal_upper_arm_exposure = max(max_normal_upper_arm_exposure, upper_arm_exposure)
                max_normal_forearm_lift = max(max_normal_forearm_lift, forearm_lift)
                max_normal_hand_lift = max(max_normal_hand_lift, hand_lift)
                min_normal_upper_arm_drop = min(min_normal_upper_arm_drop, upper_arm_drop)
            keyframe_runner_pose(armature, bones, bvh_frame["frame"], rotations, hip_location)
            last_rotations = rotations
            last_hip_location = hip_location

        retargeted_frame_count = max(source_motion["frameCount"], MIN_USABLE_RETARGET_FRAMES)
        if source_motion["frameCount"] < MIN_USABLE_RETARGET_FRAMES and last_rotations:
            keyframe_runner_pose(armature, bones, retargeted_frame_count, last_rotations, last_hip_location)

        action.frame_range = (1, retargeted_frame_count)
        retargeted_stick_action_beat_metrics = calculate_retargeted_stick_action_beat_metrics(
            retargeted_rotation_frames
        )
        retargeted_frame_smoothness = calculate_retargeted_frame_motion_smoothness(
            retargeted_rotation_frames
        )
        retargeted_loop_closure_metrics = calculate_retargeted_loop_closure_metrics(
            retargeted_rotation_frames,
            retargeted_hip_locations,
        )
        retargeted_foot_plant_metrics = calculate_retargeted_foot_plant_metrics(
            retargeted_rotation_frames,
            retargeted_hip_locations,
            clip_name,
        )
        retargeted_two_hand_contact_frame_indices = calculate_retargeted_stick_action_two_hand_contact_frame_indices(
            retargeted_rotation_frames
        )
        retargeted.append(
            {
                "clipName": clip_name,
                "source": str(source_path.relative_to(PROJECT_ROOT)),
                "sourceRightsPath": source_rights_path,
                "sourceProvider": source_metadata["sourceProvider"],
                "captureMethod": source_metadata["captureMethod"],
                "usageRights": source_metadata["usageRights"],
                "sourceFrameCount": source_motion["frameCount"],
                "retargetedFrameCount": retargeted_frame_count,
                "sourceDurationSeconds": source_motion["durationSeconds"],
                "retargetedDurationSeconds": round(retargeted_frame_count / bpy.context.scene.render.fps, 3),
                "sourceType": motion_source_type_for_metadata(source_metadata),
                "sourceQuality": source_metadata["sourceQuality"],
                "sourceMotionMetrics": source_motion["motionMetrics"],
                "retargetedRootVerticalBounceUnits": round_metric(
                    source_motion["motionMetrics"]["rootVerticalBounceUnits"]
                    * root_vertical_retarget_scale_for_clip(clip_name)
                ),
                "retargetedMaxFrameRotationDeltaDegrees": retargeted_frame_smoothness[
                    "retargetedMaxFrameRotationDeltaDegrees"
                ],
                "retargetedMaxFrameRotationAccelerationDegrees": retargeted_frame_smoothness[
                    "retargetedMaxFrameRotationAccelerationDegrees"
                ],
                "retargetedLocomotionLoopClosureErrorDegrees": retargeted_loop_closure_metrics[
                    "retargetedLocomotionLoopClosureErrorDegrees"
                ],
                "retargetedRootVerticalLoopOffsetUnits": retargeted_loop_closure_metrics[
                    "retargetedRootVerticalLoopOffsetUnits"
                ],
                "retargetedStickHandRangeDegrees": calculate_retargeted_stick_hand_range(retargeted_rotation_frames),
                "retargetedStickActionTwoHandBalanceRatio": calculate_retargeted_stick_action_two_hand_balance_ratio(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionTwoHandSyncRatio": calculate_retargeted_stick_action_two_hand_sync_ratio(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionTwoHandContactRatio": calculate_retargeted_stick_action_two_hand_contact_ratio(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionTwoHandContactFrameCount": len(retargeted_two_hand_contact_frame_indices),
                "retargetedStickActionTwoHandContactFrameIndices": retargeted_two_hand_contact_frame_indices,
                "retargetedStickActionLowerBodyLeadFrames": calculate_retargeted_stick_action_lower_body_lead_frames(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionRecoveryRatio": calculate_retargeted_stick_action_recovery_ratio(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionPhaseChanges": retargeted_stick_action_beat_metrics[
                    "retargetedStickActionPhaseChanges"
                ],
                "retargetedStickActionBeatSpanRatio": retargeted_stick_action_beat_metrics[
                    "retargetedStickActionBeatSpanRatio"
                ],
                "retargetedStickActionBeatFrameIndices": retargeted_stick_action_beat_metrics[
                    "retargetedStickActionBeatFrameIndices"
                ],
                "retargetedStickActionDistanceValues": [
                    round_metric(value)
                    for value in calculate_retargeted_stick_action_distances(retargeted_rotation_frames)
                ],
                "retargetedStickActionReleasePeakRatio": calculate_retargeted_stick_action_release_peak_ratio(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionSupportedReleaseRatio": calculate_retargeted_stick_action_supported_release_ratio(
                    retargeted_rotation_frames,
                    retargeted_hip_locations,
                ),
                "retargetedStickActionUpperArmLiftDegrees": calculate_retargeted_stick_action_upper_arm_lift(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionUpperArmSwingDegrees": calculate_retargeted_stick_action_upper_arm_swing(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionUpperArmLateralDegrees": calculate_retargeted_stick_action_upper_arm_lateral(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionUpperArmExposureDegrees": calculate_retargeted_stick_action_upper_arm_exposure(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionForearmLiftDegrees": calculate_retargeted_stick_action_forearm_lift(
                    retargeted_rotation_frames
                ),
                "retargetedStickActionHandLiftDegrees": calculate_retargeted_stick_action_hand_lift(
                    retargeted_rotation_frames
                ),
                "retargetedLegDriveRangeDegrees": calculate_retargeted_leg_drive_range(retargeted_rotation_frames),
                "retargetedReadyStanceLegLoadDegrees": calculate_retargeted_ready_stance_leg_load(
                    retargeted_rotation_frames
                ),
                "retargetedLocomotionStrideBalanceRatio": calculate_retargeted_locomotion_stride_balance_ratio(
                    retargeted_rotation_frames
                ),
                "retargetedLocomotionFootPlantDriveRatio": calculate_retargeted_locomotion_foot_plant_drive_ratio(
                    retargeted_rotation_frames,
                    retargeted_hip_locations,
                ),
                "retargetedFootPlantContactFrameCount": retargeted_foot_plant_metrics[
                    "retargetedFootPlantContactFrameCount"
                ],
                "retargetedFootPlantSideCount": retargeted_foot_plant_metrics["retargetedFootPlantSideCount"],
                "retargetedFootPlantBalanceRatio": retargeted_foot_plant_metrics[
                    "retargetedFootPlantBalanceRatio"
                ],
                "retargetedFootPlantMinSideHoldFrames": retargeted_foot_plant_metrics[
                    "retargetedFootPlantMinSideHoldFrames"
                ],
                "retargetedFootPlantStabilityRatio": retargeted_foot_plant_metrics[
                    "retargetedFootPlantStabilityRatio"
                ],
                "retargetedFootPlantMaxSlideUnits": retargeted_foot_plant_metrics[
                    "retargetedFootPlantMaxSlideUnits"
                ],
                "retargetedFootPlantStrideCoverageRatio": retargeted_foot_plant_metrics[
                    "retargetedFootPlantStrideCoverageRatio"
                ],
                "retargetedFootPlantGroundedRatio": retargeted_foot_plant_metrics[
                    "retargetedFootPlantGroundedRatio"
                ],
                "retargetedLocomotionArmSwingRangeDegrees": calculate_retargeted_locomotion_arm_swing_range(
                    retargeted_rotation_frames
                ),
                "retargetedLocomotionContralateralSyncRatio": calculate_retargeted_locomotion_contralateral_sync_ratio(
                    retargeted_rotation_frames
                ),
                "retargetedTorsoFollowThroughDegrees": calculate_retargeted_torso_follow_through_range(
                    retargeted_rotation_frames
                ),
                "retargetedHipShoulderSeparationDegrees": calculate_retargeted_hip_shoulder_separation(
                    retargeted_rotation_frames
                ),
                "retargetedAthleticTorsoLeanDegrees": calculate_retargeted_athletic_torso_lean(
                    retargeted_rotation_frames
                ),
                "qualityProfile": source_motion["qualityProfile"]["name"],
                "minimumActionClipFrames": MIN_ACTION_CLIP_BVH_FRAMES,
                "minimumActionClipDurationSeconds": MIN_ACTION_CLIP_BVH_DURATION_SECONDS,
                "minimumMaxRotationRangeDegrees": MIN_ACTION_CLIP_MAX_ROTATION_RANGE_DEGREES,
                "minimumActiveRotationChannelCount": MIN_ACTION_CLIP_ACTIVE_ROTATION_CHANNELS,
                "maximumFrameRotationDeltaDegrees": source_motion["qualityProfile"]["maximumFrameRotationDeltaDegrees"],
                "maximumFrameRotationAccelerationDegrees": source_motion["qualityProfile"]["maximumFrameRotationAccelerationDegrees"],
                "maximumRetargetedFrameRotationDeltaDegrees": maximum_retargeted_frame_rotation_delta(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedFrameRotationAccelerationDegrees": maximum_retargeted_frame_rotation_acceleration(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedLoopClosureErrorDegrees": maximum_retargeted_loop_closure_error(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedLoopVerticalOffsetUnits": maximum_retargeted_loop_vertical_offset(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedFootPlantMaxSlideUnits": maximum_retargeted_foot_plant_slide_units(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRootTravelUnits": source_motion["qualityProfile"]["minimumRootTravelUnits"],
                "minimumRootForwardTravelUnits": source_motion["qualityProfile"]["minimumRootForwardTravelUnits"],
                "minimumRootForwardSpeedChangeUnits": source_motion["qualityProfile"]["minimumRootForwardSpeedChangeUnits"],
                "minimumRootLateralShiftUnits": source_motion["qualityProfile"]["minimumRootLateralShiftUnits"],
                "minimumRootVerticalBounceUnits": source_motion["qualityProfile"]["minimumRootVerticalBounceUnits"],
                "minimumRetargetedRootVerticalBounceUnits": round_metric(
                    source_motion["qualityProfile"]["minimumRootVerticalBounceUnits"]
                    * root_vertical_retarget_scale_for_clip(clip_name)
                ),
                "minimumRetargetedStickHandRangeDegrees": round_metric(
                    source_motion["qualityProfile"]["minimumStickActionArmRangeDegrees"]
                    * STICK_ACTION_HAND_SOURCE_SCALE
                    * 0.45
                ),
                "minimumRetargetedStickActionTwoHandBalanceRatio": minimum_retargeted_stick_action_two_hand_balance_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedStickActionTwoHandSyncRatio": minimum_retargeted_stick_action_two_hand_sync_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedStickActionTwoHandContactRatio": minimum_retargeted_stick_action_two_hand_contact_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedStickActionTwoHandContactFrameCount": STICK_ACTION_MIN_TWO_HAND_CONTACT_FRAMES.get(
                    clip_name,
                    0,
                ),
                "minimumRetargetedStickActionLowerBodyLeadFrames": minimum_retargeted_stick_action_lower_body_lead_frames(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedStickActionRecoveryRatio": minimum_retargeted_stick_action_recovery_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedStickActionPhaseChanges": minimum_retargeted_stick_action_phase_changes(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedStickActionBeatSpanRatio": minimum_retargeted_stick_action_beat_span_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedStickActionReleasePeakRatio": minimum_retargeted_stick_action_release_peak_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedStickActionReleasePeakRatio": maximum_retargeted_stick_action_release_peak_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedStickActionSupportedReleaseRatio": minimum_retargeted_stick_action_supported_release_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedStickActionUpperArmLiftDegrees": maximum_retargeted_stick_action_upper_arm_lift(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedStickActionUpperArmSwingDegrees": maximum_retargeted_stick_action_upper_arm_swing(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedStickActionUpperArmLateralDegrees": maximum_retargeted_stick_action_upper_arm_lateral(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedStickActionUpperArmExposureDegrees": maximum_retargeted_stick_action_upper_arm_exposure(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedStickActionForearmLiftDegrees": maximum_retargeted_stick_action_forearm_lift(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "maximumRetargetedStickActionHandLiftDegrees": maximum_retargeted_stick_action_hand_lift(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedLegDriveRangeDegrees": minimum_retargeted_leg_drive_range(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedReadyStanceLegLoadDegrees": minimum_retargeted_ready_stance_leg_load(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedLocomotionStrideBalanceRatio": minimum_retargeted_locomotion_stride_balance_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedLocomotionFootPlantDriveRatio": minimum_retargeted_locomotion_foot_plant_drive_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedFootPlantContactFrames": minimum_retargeted_foot_plant_contact_frames(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedFootPlantSideCount": minimum_retargeted_foot_plant_side_count(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedFootPlantBalanceRatio": minimum_retargeted_foot_plant_balance_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedFootPlantHoldFramesPerSide": minimum_retargeted_foot_plant_hold_frames(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedFootPlantStabilityRatio": minimum_retargeted_foot_plant_stability_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedFootPlantStrideCoverageRatio": minimum_retargeted_foot_plant_stride_coverage_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedFootPlantGroundedRatio": minimum_retargeted_foot_plant_grounded_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedLocomotionArmSwingRangeDegrees": minimum_retargeted_locomotion_arm_swing_range(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedLocomotionContralateralSyncRatio": minimum_retargeted_locomotion_contralateral_sync_ratio(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedTorsoFollowThroughDegrees": minimum_retargeted_torso_follow_through_range(
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedHipShoulderSeparationDegrees": minimum_retargeted_hip_shoulder_separation(
                    source_motion["qualityProfile"],
                ),
                "minimumRetargetedAthleticTorsoLeanDegrees": minimum_retargeted_athletic_torso_lean(
                    clip_name,
                    source_motion["qualityProfile"],
                ),
                "minimumReadyStanceLegLoadDegrees": source_motion["qualityProfile"]["minimumReadyStanceLegLoadDegrees"],
                "minimumLegDriveRangeDegrees": source_motion["qualityProfile"]["minimumLegDriveRangeDegrees"],
                "minimumLocomotionStrideBalanceRatio": source_motion["qualityProfile"]["minimumLocomotionStrideBalanceRatio"],
                "minimumLocomotionFootPlantDriveRatio": source_motion["qualityProfile"]["minimumLocomotionFootPlantDriveRatio"],
                "minimumAlternatingLegSeparationDegrees": source_motion["qualityProfile"]["minimumAlternatingLegSeparationDegrees"],
                "minimumLocomotionArmSwingRangeDegrees": source_motion["qualityProfile"]["minimumLocomotionArmSwingRangeDegrees"],
                "minimumLocomotionContralateralSyncRatio": source_motion["qualityProfile"]["minimumLocomotionContralateralSyncRatio"],
                "minimumFootPlantContactFrames": source_motion["qualityProfile"]["minimumFootPlantContactFrames"],
                "minimumFootPlantSideCount": source_motion["qualityProfile"]["minimumFootPlantSideCount"],
                "minimumFootPlantBalanceRatio": source_motion["qualityProfile"]["minimumFootPlantBalanceRatio"],
                "minimumFootPlantHoldFramesPerSide": source_motion["qualityProfile"]["minimumFootPlantHoldFramesPerSide"],
                "maximumFootPlantRootDriftUnits": source_motion["qualityProfile"]["maximumFootPlantRootDriftUnits"],
                "minimumTotalRotationRangeDegrees": source_motion["qualityProfile"]["minimumTotalRotationRangeDegrees"],
                "minimumStridePhaseChanges": source_motion["qualityProfile"]["minimumStridePhaseChanges"],
                "minimumStrideCycleSpanRatio": source_motion["qualityProfile"]["minimumStrideCycleSpanRatio"],
                "minimumStickActionArmRangeDegrees": source_motion["qualityProfile"]["minimumStickActionArmRangeDegrees"],
                "minimumStickActionTwoHandBalanceRatio": source_motion["qualityProfile"]["minimumStickActionTwoHandBalanceRatio"],
                "minimumStickActionTwoHandSyncRatio": source_motion["qualityProfile"]["minimumStickActionTwoHandSyncRatio"],
                "minimumStickActionTwoHandContactRatio": source_motion["qualityProfile"]["minimumStickActionTwoHandContactRatio"],
                "minimumStickActionPhaseChanges": source_motion["qualityProfile"]["minimumStickActionPhaseChanges"],
                "minimumStickActionBeatSpanRatio": source_motion["qualityProfile"]["minimumStickActionBeatSpanRatio"],
                "minimumStickActionReleasePeakRatio": source_motion["qualityProfile"]["minimumStickActionReleasePeakRatio"],
                "maximumStickActionReleasePeakRatio": source_motion["qualityProfile"]["maximumStickActionReleasePeakRatio"],
                "minimumStickActionSupportedReleaseRatio": source_motion["qualityProfile"]["minimumStickActionSupportedReleaseRatio"],
                "minimumStickActionTorsoRangeDegrees": source_motion["qualityProfile"]["minimumStickActionTorsoRangeDegrees"],
                "minimumHipShoulderSeparationDegrees": source_motion["qualityProfile"]["minimumHipShoulderSeparationDegrees"],
                "minimumStickActionLowerBodyLeadFrames": source_motion["qualityProfile"]["minimumStickActionLowerBodyLeadFrames"],
                "minimumStickActionRecoveryRatio": source_motion["qualityProfile"]["minimumStickActionRecoveryRatio"],
                "minimumAthleticTorsoLeanDegrees": source_motion["qualityProfile"]["minimumAthleticTorsoLeanDegrees"],
                "maximumLoopClosureErrorDegrees": source_motion["qualityProfile"]["maximumLoopClosureErrorDegrees"],
                "maximumLoopVerticalOffsetUnits": source_motion["qualityProfile"]["maximumLoopVerticalOffsetUnits"],
            }
        )

    reset_pose_bones(armature, bones)
    clip_postures = []
    for clip_name in sorted(normal_clip_postures):
        clip_posture = normal_clip_postures[clip_name]
        clip_lift = round(clip_posture["maxUpperArmLiftDegrees"], 3)
        clip_swing = round(clip_posture["maxUpperArmSwingDegrees"], 3)
        clip_lateral = round(clip_posture["maxUpperArmLateralDegrees"], 3)
        clip_exposure = round(clip_posture["maxUpperArmExposureDegrees"], 3)
        clip_forearm_lift = round(clip_posture["maxForearmLiftDegrees"], 3)
        clip_hand_lift = round(clip_posture["maxHandLiftDegrees"], 3)
        clip_drop = round(clip_posture["minUpperArmDropDegrees"], 3)
        clip_postures.append(
            {
                "clipName": clip_name,
                "status": (
                    "passed"
                    if (
                        clip_lift <= MAX_NORMAL_UPPER_ARM_LIFT_DEGREES
                        and clip_swing <= MAX_NORMAL_UPPER_ARM_SWING_DEGREES
                        and clip_lateral <= MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES
                        and clip_exposure <= MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES
                        and clip_forearm_lift <= MAX_NORMAL_FOREARM_LIFT_DEGREES
                        and clip_hand_lift <= MAX_NORMAL_HAND_LIFT_DEGREES
                        and clip_drop >= MIN_NORMAL_UPPER_ARM_DROP_DEGREES
                    )
                    else "blocked"
                ),
                "maxUpperArmLiftDegrees": clip_lift,
                "maxAllowedUpperArmLiftDegrees": MAX_NORMAL_UPPER_ARM_LIFT_DEGREES,
                "maxUpperArmSwingDegrees": clip_swing,
                "maxAllowedUpperArmSwingDegrees": MAX_NORMAL_UPPER_ARM_SWING_DEGREES,
                "maxUpperArmLateralDegrees": clip_lateral,
                "maxAllowedUpperArmLateralDegrees": MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES,
                "maxUpperArmExposureDegrees": clip_exposure,
                "maxAllowedUpperArmExposureDegrees": MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES,
                "maxForearmLiftDegrees": clip_forearm_lift,
                "maxAllowedForearmLiftDegrees": MAX_NORMAL_FOREARM_LIFT_DEGREES,
                "maxHandLiftDegrees": clip_hand_lift,
                "maxAllowedHandLiftDegrees": MAX_NORMAL_HAND_LIFT_DEGREES,
                "minUpperArmDropDegrees": clip_drop,
                "minRequiredUpperArmDropDegrees": MIN_NORMAL_UPPER_ARM_DROP_DEGREES,
            }
        )

    if min_normal_upper_arm_drop == float("inf"):
        min_normal_upper_arm_drop = 0

    posture_status = (
        "passed"
        if (
            not missing_sources
            and not invalid_sources
            and max_normal_upper_arm_lift <= MAX_NORMAL_UPPER_ARM_LIFT_DEGREES
            and max_normal_upper_arm_swing <= MAX_NORMAL_UPPER_ARM_SWING_DEGREES
            and max_normal_upper_arm_lateral <= MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES
            and max_normal_upper_arm_exposure <= MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES
            and max_normal_forearm_lift <= MAX_NORMAL_FOREARM_LIFT_DEGREES
            and max_normal_hand_lift <= MAX_NORMAL_HAND_LIFT_DEGREES
            and min_normal_upper_arm_drop >= MIN_NORMAL_UPPER_ARM_DROP_DEGREES
            and all(clip_posture["status"] == "passed" for clip_posture in clip_postures)
        )
        else "blocked"
    )
    return {
        "retargetedClips": retargeted,
        "missingMotionSources": missing_sources,
        "invalidMotionSources": invalid_sources,
        "normalMotionPosture": {
            "status": posture_status,
            "maxUpperArmLiftDegrees": round(max_normal_upper_arm_lift, 3),
            "maxAllowedUpperArmLiftDegrees": MAX_NORMAL_UPPER_ARM_LIFT_DEGREES,
            "maxUpperArmSwingDegrees": round(max_normal_upper_arm_swing, 3),
            "maxAllowedUpperArmSwingDegrees": MAX_NORMAL_UPPER_ARM_SWING_DEGREES,
            "maxUpperArmLateralDegrees": round(max_normal_upper_arm_lateral, 3),
            "maxAllowedUpperArmLateralDegrees": MAX_NORMAL_UPPER_ARM_LATERAL_DEGREES,
            "maxUpperArmExposureDegrees": round(max_normal_upper_arm_exposure, 3),
            "maxAllowedUpperArmExposureDegrees": MAX_NORMAL_UPPER_ARM_EXPOSURE_DEGREES,
            "maxForearmLiftDegrees": round(max_normal_forearm_lift, 3),
            "maxAllowedForearmLiftDegrees": MAX_NORMAL_FOREARM_LIFT_DEGREES,
            "maxHandLiftDegrees": round(max_normal_hand_lift, 3),
            "maxAllowedHandLiftDegrees": MAX_NORMAL_HAND_LIFT_DEGREES,
            "minUpperArmDropDegrees": round(min_normal_upper_arm_drop, 3),
            "minRequiredUpperArmDropDegrees": MIN_NORMAL_UPPER_ARM_DROP_DEGREES,
            "visualUpperArmRestDropDegrees": RUNNER_UPPER_ARM_VISUAL_DROP_DEGREES,
            "visualUpperArmTuckDegrees": RUNNER_UPPER_ARM_VISUAL_TUCK_DEGREES,
            "normalMovementClips": sorted(NORMAL_RUNNER_MOVEMENT_CLIPS),
            "clipPostures": clip_postures,
        },
    }


def current_clip_names():
    names = []
    for action in bpy.data.actions:
        if action.name:
            names.append(action.name)
    return sorted(set(names))


def missing_clips(required):
    clips = set(current_clip_names())
    return [clip for clip in required if clip not in clips]


def prune_unneeded_actions(required):
    required_set = set(required)
    removed = []
    for action in list(bpy.data.actions):
        if action.name in required_set:
            continue
        removed.append(action.name)
        bpy.data.actions.remove(action)
    return removed


def export_glb(output_path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_materials="EXPORT",
    )


def normalize_target(source, output_path, target):
    clear_scene()
    import_source(source)
    remove_nonproduction_helper_meshes()
    normalize_materials(target)
    normalize_part_names()
    normalize_armature_names(target)
    scale_report = {"appliedScale": 1.0, "before": get_scene_bounds(), "after": get_scene_bounds()}
    retarget_report = {
        "retargetedClips": [],
        "missingMotionSources": [],
        "invalidMotionSources": [],
        "normalMotionPosture": None,
    }
    equipment_report = None
    shape_keys_removed = []
    if target["profile"] == "runner":
        remove_runner_hidden_detail_meshes()
        shape_keys_removed = remove_shape_keys()
        equipment_report = build_runner_equipment(target)
        scale_report = normalize_scene_height()
        retarget_report = retarget_runner_required_clips()
        removed_clips = prune_unneeded_actions(target["required_clips"])
    else:
        removed_clips = []
    missing = missing_clips(target["required_clips"])
    animation_blockers = (
        missing
        + retarget_report["missingMotionSources"]
        + retarget_report["invalidMotionSources"]
    )
    purge_orphan_data()
    export_glb(output_path)
    return {
        "key": target["key"],
        "source": str(source),
        "output": str(output_path),
        "profile": target["profile"],
        "clips": current_clip_names(),
        "motionSourceClips": retarget_report["retargetedClips"],
        "missingMotionSources": retarget_report["missingMotionSources"],
        "invalidMotionSources": retarget_report["invalidMotionSources"],
        "normalMotionPosture": retarget_report["normalMotionPosture"],
        "removedClips": removed_clips,
        "equipmentReport": equipment_report,
        "shapeKeysRemoved": shape_keys_removed,
        "missingClips": missing,
        "scaleReport": scale_report,
        "status": "needs-animation-work" if animation_blockers else "normalized",
    }


def main():
    args = parse_args()
    source_dir = Path(args.source_dir)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    report = []
    missing_sources = []

    targets = [target for target in TARGETS if not args.runners_only or target["profile"] == "runner"]

    for target in targets:
        source = find_source(source_dir, target)
        if not source:
            missing_sources.append(
                {
                    "key": target["key"],
                    "accepted": [
                        f"{target['exact']}{extension}" for extension in EXTENSIONS
                    ]
                    + [
                        f"{target['neutral']}{extension}" for extension in EXTENSIONS
                    ],
                }
            )
            continue

        output_path = output_dir / target["output"]
        report.append(normalize_target(source, output_path, target))

    report_path = output_dir / "blender-normalize-report.json"
    report_path.write_text(
        json.dumps(
            {
                "status": "missing-sources" if missing_sources else "processed",
                "missingSources": missing_sources,
                "targets": report,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    print("GOON_BLENDER_NORMALIZE " + str(report_path))
    if missing_sources:
        print(json.dumps({"missingSources": missing_sources}, indent=2))
        raise SystemExit(1)


if __name__ == "__main__":
    main()
