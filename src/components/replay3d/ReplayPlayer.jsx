import { Text, useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PLAYER_RIG_ASSETS } from '../../replay3d/assets/playerRigManifest';
import { applyProductionUniformMaterials, hideProductionRigParts } from '../../replay3d/assets/playerRigMaterials';
import { getAvailableProductionRigUrls, getPlayerRigAsset } from '../../replay3d/assets/playerRigSelection';
import { getJerseyNumber, getUniformIdentityColors } from '../../replay3d/assets/uniformIdentity';
import { rinkToWorld } from '../../replay3d/coords';
import { REPLAY_COLORS, TEAM_COLORS } from './replayStyles';

const BRIDGE_MODEL_URL = PLAYER_RIG_ASSETS.temporaryRunner.url;
const BRIDGE_ANIMATION_URL = PLAYER_RIG_ASSETS.temporaryRunner.url;
export const ATHLETE_SCALE = 1.62;
export const PRODUCTION_RUNNER_GROUND_Y = 0.026;
const GOALIE_SCALE = 1.03;
export const HIDDEN_PRODUCTION_RUNNER_PARTS = ['stick', 'stickBlade', 'pad'];
export const HIDDEN_CLOSE_PRODUCTION_RUNNER_PARTS = [
  ...HIDDEN_PRODUCTION_RUNNER_PARTS,
  'compressionSleeve',
  'jerseySleeve',
  'glove',
];
const HIDDEN_PRODUCTION_GOALIE_PARTS = ['stick', 'stickBlade'];
export const PLAYER_SHADOW_PROFILE = {
  field: {
    enabled: false,
    radius: 0,
    opacity: 0,
    scale: [1, 1, 1],
  },
  goalie: {
    enabled: false,
    radius: 0,
    opacity: 0,
    scale: [1, 1, 1],
  },
};
export const PLAYER_VERTICAL_MOTION_PROFILE = {
  worldHeight: 0,
  fieldBobAmplitude: 0,
  goalieBobAmplitude: 0,
};
export const PLAYER_GROUNDING_PROFILE = {
  field: {
    enabled: false,
    floorY: 0.026,
    lateral: 0.25,
    strideDepth: 0.15,
    soles: [
      { side: -1, scale: [0.15, 0.008, 0.31], opacity: 0.86 },
      { side: 1, scale: [0.15, 0.008, 0.31], opacity: 0.86 },
    ],
  },
  goalie: {
    enabled: false,
    floorY: 0.026,
    lateral: 0.38,
    strideDepth: 0,
    soles: [
      { side: -1, scale: [0.22, 0.01, 0.42], opacity: 0.86 },
      { side: 1, scale: [0.22, 0.01, 0.42], opacity: 0.86 },
    ],
  },
};
export const RUNTIME_UNIFORM_TEXT_PROFILE = {
  enabled: false,
};
export function shouldRenderClosePlayerDetail(cameraId = 'broadcast') {
  return cameraId === 'bench' || cameraId === 'player';
}
export function shouldRenderRunnerStickBodySleeves(showCloseDetail = false, rigAsset = {}) {
  return resolveRunnerStickBodySleeveMode(showCloseDetail, rigAsset) !== 'hidden';
}
export function resolveRunnerStickBodySleeveMode(showCloseDetail = false, rigAsset = {}) {
  if (!showCloseDetail) return 'hidden';
  if (rigAsset.requiresPoseCorrection === false || rigAsset.isFinalGradeMotion === true) {
    return 'contact-only';
  }
  return 'full';
}
export function getHiddenProductionRunnerParts(showCloseDetail = false, rigAsset = {}) {
  if (!showCloseDetail) return HIDDEN_PRODUCTION_RUNNER_PARTS;
  if (rigAsset.requiresPoseCorrection === false || rigAsset.isFinalGradeMotion === true) {
    return HIDDEN_PRODUCTION_RUNNER_PARTS;
  }
  return HIDDEN_CLOSE_PRODUCTION_RUNNER_PARTS;
}
export const STICK_CONTACT_PROFILE = {
  runner: {
    gripHeight: 0.68,
    shaftLength: 1.74,
    handGripMarkers: 2,
    bladeWidth: 0.54,
    maxVisualHandGap: 0.06,
    gripShaftClearance: 0.09,
    mount: {
      restLateral: 0.14,
      activeLateral: 0.17,
      restDepth: 0.195,
      activeDepth: 0.188,
    },
    bodyReach: {
      maxRestLateral: 0.28,
      maxRestDepth: 0.31,
      maxActiveLateral: 0.4,
      maxActiveDepth: 0.42,
      minActiveGripHeight: 0.64,
    },
    contactPads: [
      { name: 'topHand', shaftY: 0.42, radius: 0.064, lateral: -0.03, wristX: -0.12, roll: 0.22 },
      { name: 'bottomHand', shaftY: 0.17, radius: 0.066, lateral: 0.03, wristX: 0.12, roll: -0.2 },
    ],
    gripWraps: [
      { padName: 'topHand', length: 0.18, radius: 0.036, thumbLength: 0.11, thumbOffsetX: -0.05, thumbOffsetY: 0.018, roll: 0.68 },
      { padName: 'bottomHand', length: 0.18, radius: 0.038, thumbLength: 0.11, thumbOffsetX: 0.052, thumbOffsetY: -0.016, roll: -0.64 },
    ],
    gripCollars: [
      { padName: 'topHand', radius: 0.07, tubeRadius: 0.014, zOffset: 0.016, roll: 0.28, opacity: 0.95 },
      { padName: 'bottomHand', radius: 0.072, tubeRadius: 0.015, zOffset: 0.018, roll: -0.24, opacity: 0.96 },
    ],
    gripFingerRidges: [
      { padName: 'topHand', count: 3, spacing: 0.023, length: 0.112, radius: 0.009, zOffset: 0.064, roll: 0.18, opacity: 0.9 },
      { padName: 'bottomHand', count: 3, spacing: 0.024, length: 0.116, radius: 0.0095, zOffset: 0.066, roll: -0.16, opacity: 0.92 },
    ],
    gripPalmGuards: [
      { padName: 'topHand', length: 0.16, radius: 0.022, offsetX: -0.012, offsetY: 0.004, zOffset: 0.088, roll: 0.54, opacity: 0.96 },
      { padName: 'bottomHand', length: 0.165, radius: 0.023, offsetX: 0.014, offsetY: -0.003, zOffset: 0.09, roll: -0.52, opacity: 0.96 },
    ],
    gloveWristStraps: [
      { padName: 'topHand', length: 0.168, radius: 0.018, offsetX: -0.088, offsetY: -0.04, zOffset: 0.052, roll: 0.58, opacity: 0.92 },
      { padName: 'bottomHand', length: 0.172, radius: 0.019, offsetX: 0.09, offsetY: -0.038, zOffset: 0.054, roll: -0.56, opacity: 0.92 },
    ],
    closedGripShells: [
      { padName: 'topHand', scale: [0.108, 0.078, 0.052], offset: [-0.014, 0.003, 0.086], roll: 0.32, opacity: 0.96 },
      { padName: 'bottomHand', scale: [0.112, 0.08, 0.055], offset: [0.014, -0.002, 0.088], roll: -0.3, opacity: 0.96 },
    ],
    gripHeelBridges: [
      { padName: 'topHand', length: 0.152, radius: 0.017, offsetX: -0.028, offsetY: -0.014, zOffset: 0.076, roll: 0.46, opacity: 0.91 },
      { padName: 'bottomHand', length: 0.158, radius: 0.018, offsetX: 0.03, offsetY: -0.012, zOffset: 0.078, roll: -0.44, opacity: 0.92 },
    ],
    gripShaftChannels: [
      { padName: 'topHand', length: 0.27, radius: 0.044, zOffset: 0.064, opacity: 0.96 },
      { padName: 'bottomHand', length: 0.28, radius: 0.046, zOffset: 0.066, opacity: 0.97 },
    ],
    gripShaftSeats: [
      { padName: 'topHand', scale: [0.084, 0.022, 0.048], offsetX: -0.004, offsetY: 0.002, zOffset: 0.044, roll: 0.22, opacity: 0.7 },
      { padName: 'bottomHand', scale: [0.088, 0.023, 0.05], offsetX: 0.005, offsetY: -0.002, zOffset: 0.046, roll: -0.2, opacity: 0.72 },
    ],
    gripContactMasks: [
      { padName: 'topHand', scale: [0.096, 0.056, 0.04], zOffset: 0.058, offsetX: -0.004, offsetY: 0.002, roll: 0.18, opacity: 0.94 },
      { padName: 'bottomHand', scale: [0.102, 0.06, 0.042], zOffset: 0.06, offsetX: 0.005, offsetY: -0.002, roll: -0.18, opacity: 0.95 },
    ],
    gripKnucklePads: [
      { padName: 'topHand', count: 4, spacing: 0.031, length: 0.112, radius: 0.018, zOffset: 0.128, roll: 0.18, opacity: 0.94 },
      { padName: 'bottomHand', count: 4, spacing: 0.032, length: 0.118, radius: 0.019, zOffset: 0.13, roll: -0.18, opacity: 0.95 },
    ],
    gripThumbHooks: [
      { padName: 'topHand', length: 0.148, radius: 0.013, offsetX: -0.054, offsetY: 0.012, zOffset: 0.118, roll: 0.64, opacity: 0.94 },
      { padName: 'bottomHand', length: 0.152, radius: 0.014, offsetX: 0.056, offsetY: -0.01, zOffset: 0.12, roll: -0.62, opacity: 0.95 },
    ],
    gripPalmSeams: [
      { padName: 'topHand', count: 2, spacing: 0.031, length: 0.096, radius: 0.006, zOffset: 0.142, roll: 0.24, opacity: 0.82 },
      { padName: 'bottomHand', count: 2, spacing: 0.032, length: 0.1, radius: 0.0065, zOffset: 0.144, roll: -0.22, opacity: 0.84 },
    ],
    gripKeeperStraps: [
      {
        padName: 'topHand',
        count: 2,
        spacing: 0.04,
        length: 0.128,
        radius: 0.0085,
        offsetX: -0.018,
        offsetY: 0.006,
        zOffset: 0.112,
        roll: 0.98,
        opacity: 0.9,
      },
      {
        padName: 'bottomHand',
        count: 2,
        spacing: 0.042,
        length: 0.132,
        radius: 0.009,
        offsetX: 0.018,
        offsetY: -0.005,
        zOffset: 0.114,
        roll: -0.96,
        opacity: 0.91,
      },
    ],
    bladePocketRails: [
      {
        name: 'heel',
        length: 0.16,
        radius: 0.014,
        position: [-0.025, -0.82, 0.086],
        rotation: [0, 0.36, 0.12],
        color: 'stick',
        opacity: 0.9,
      },
      {
        name: 'toe',
        length: 0.17,
        radius: 0.014,
        position: [0.49, -0.9, 0.1],
        rotation: [0, 0.38, Math.PI / 2 + 0.42],
        color: 'stick',
        opacity: 0.92,
      },
      {
        name: 'ballPocket',
        length: 0.25,
        radius: 0.012,
        position: [0.22, -0.955, 0.11],
        rotation: [0, 0.34, Math.PI / 2 - 0.08],
        color: 'tape',
        opacity: 0.88,
      },
    ],
    bladeContactGuides: [
      {
        name: 'ballSeat',
        length: 0.2,
        radius: 0.011,
        position: [0.22, -0.94, 0.13],
        rotation: [0, 0.42, Math.PI / 2 - 0.08],
        color: 'tape',
        idleOpacity: 0.12,
        activeOpacity: 0.76,
      },
      {
        name: 'toeCup',
        length: 0.15,
        radius: 0.01,
        position: [0.31, -0.91, 0.128],
        rotation: [0, 0.44, Math.PI / 2 + 0.34],
        color: 'stick',
        idleOpacity: 0.1,
        activeOpacity: 0.66,
      },
    ],
    shaftButtEnd: {
      shaftY: 0.89,
      radius: 0.032,
      length: 0.13,
      depth: 0,
      opacity: 0.96,
    },
    handleTapeBands: [
      { shaftY: 0.52, radius: 0.022, length: 0.064, opacity: 0.9 },
      { shaftY: 0.68, radius: 0.023, length: 0.066, opacity: 0.92 },
      { shaftY: 0.84, radius: 0.024, length: 0.068, opacity: 0.93 },
    ],
    stickSideForearmLocks: [
      { padName: 'topHand', fromT: 0.58, toT: 0.94, radius: 0.024, offsetLateral: 0.018, offsetHeight: -0.006, offsetDepth: 0.024, opacity: 0.9 },
      { padName: 'bottomHand', fromT: 0.58, toT: 0.94, radius: 0.025, offsetLateral: 0.02, offsetHeight: -0.004, offsetDepth: 0.026, opacity: 0.91 },
    ],
    gripWristWebs: [
      { padName: 'topHand', fromT: 0.74, toT: 0.98, radius: 0.052, offsetLateral: 0.014, offsetHeight: -0.004, offsetDepth: 0.038, opacity: 0.93 },
      { padName: 'bottomHand', fromT: 0.74, toT: 0.98, radius: 0.054, offsetLateral: 0.016, offsetHeight: -0.003, offsetDepth: 0.04, opacity: 0.94 },
    ],
    forearmBridges: [
      { padName: 'topHand', length: 0.28, radius: 0.032, bodyAnchorX: -0.18, bodyAnchorY: -0.07, bodyAnchorZ: -0.006, roll: 0.52 },
      { padName: 'bottomHand', length: 0.3, radius: 0.034, bodyAnchorX: 0.2, bodyAnchorY: -0.065, bodyAnchorZ: -0.004, roll: -0.48 },
    ],
    upperArmBridges: [
      { padName: 'topHand', length: 0.42, radius: 0.025, bodyAnchorX: -0.32, bodyAnchorY: -0.18, bodyAnchorZ: -0.018, roll: 0.42 },
      { padName: 'bottomHand', length: 0.44, radius: 0.027, bodyAnchorX: 0.34, bodyAnchorY: -0.16, bodyAnchorZ: -0.016, roll: -0.4 },
    ],
    bodyStickSleeves: [
      {
        padName: 'topHand',
        bodyAnchor: [-0.3, 1.22, 0.28],
        handAnchor: [-0.1, 0.9, 0.34],
        length: 0.46,
        radius: 0.032,
        opacity: 0.74,
      },
      {
        padName: 'bottomHand',
        bodyAnchor: [0.32, 1.16, 0.28],
        handAnchor: [0.14, 0.83, 0.34],
        length: 0.48,
        radius: 0.033,
        opacity: 0.75,
      },
    ],
    torsoStickAnchors: [
      {
        padName: 'topHand',
        chestAnchor: [-0.12, 1.27, 0.34],
        sleeveRootOffset: [0.012, 0.004, 0.028],
        radius: 0.034,
        opacity: 0.88,
      },
      {
        padName: 'bottomHand',
        chestAnchor: [0.13, 1.22, 0.34],
        sleeveRootOffset: [-0.012, 0.004, 0.028],
        radius: 0.035,
        opacity: 0.89,
      },
    ],
    torsoArmOverlapPanels: [
      {
        padName: 'topHand',
        fromOffset: [-0.02, -0.018, 0.024],
        toT: 0.28,
        radius: 0.048,
        offsetLateral: -0.014,
        offsetHeight: -0.008,
        offsetDepth: 0.058,
        opacity: 0.46,
      },
      {
        padName: 'bottomHand',
        fromOffset: [0.02, -0.018, 0.026],
        toT: 0.3,
        radius: 0.05,
        offsetLateral: 0.014,
        offsetHeight: -0.008,
        offsetDepth: 0.06,
        opacity: 0.47,
      },
    ],
    bodyShoulderCaps: [
      {
        side: -1,
        position: [-0.35, 1.24, 0.36],
        rotation: [0.42, 0.04, 0.2],
        length: 0.24,
        radius: 0.042,
        opacity: 0.7,
      },
      {
        side: 1,
        position: [0.35, 1.2, 0.36],
        rotation: [0.4, -0.04, -0.2],
        length: 0.24,
        radius: 0.043,
        opacity: 0.7,
      },
    ],
    bodyElbowCaps: [
      {
        side: -1,
        position: [-0.38, 1.02, 0.38],
        rotation: [0.96, 0.02, 0.24],
        length: 0.2,
        radius: 0.034,
        opacity: 0.68,
      },
      {
        side: 1,
        position: [0.38, 1.0, 0.38],
        rotation: [0.96, -0.02, -0.24],
        length: 0.2,
        radius: 0.0345,
        opacity: 0.68,
      },
    ],
    articulatedStickArms: [
      {
        padName: 'topHand',
        shoulder: [-0.32, 1.24, 0.34],
        elbowBias: [-0.11, -0.06, 0.085],
        upperArmRadius: 0.032,
        forearmRadius: 0.028,
        opacity: 0.72,
      },
      {
        padName: 'bottomHand',
        shoulder: [0.34, 1.19, 0.34],
        elbowBias: [0.1, -0.07, 0.085],
        upperArmRadius: 0.033,
        forearmRadius: 0.029,
        opacity: 0.73,
      },
    ],
    stickArmJointCaps: [
      { padName: 'topHand', elbowRadius: 0.033, wristRadius: 0.035, wristOffset: [-0.012, -0.002, 0.026], opacity: 0.72 },
      { padName: 'bottomHand', elbowRadius: 0.034, wristRadius: 0.036, wristOffset: [0.014, -0.002, 0.028], opacity: 0.73 },
    ],
    stickArmYokePanels: [
      { padName: 'topHand', fromT: 0.16, toT: 0.72, radius: 0.04, offsetLateral: -0.018, offsetHeight: -0.004, offsetDepth: 0.036, opacity: 0.48 },
      { padName: 'bottomHand', fromT: 0.16, toT: 0.72, radius: 0.041, offsetLateral: 0.018, offsetHeight: -0.004, offsetDepth: 0.038, opacity: 0.49 },
    ],
    stickArmSilhouettePanels: [
      { padName: 'topHand', fromT: 0.02, toT: 1, radius: 0.056, offsetLateral: -0.012, offsetHeight: -0.006, offsetDepth: 0.05, opacity: 0.36 },
      { padName: 'bottomHand', fromT: 0.02, toT: 1, radius: 0.058, offsetLateral: 0.012, offsetHeight: -0.006, offsetDepth: 0.052, opacity: 0.37 },
    ],
    stickArmStripeBands: [
      {
        padName: 'topHand',
        bands: [
          { fromT: 0.28, toT: 0.36, radius: 0.046, offsetLateral: -0.016, offsetDepth: 0.06, opacity: 0.48 },
          { fromT: 0.64, toT: 0.72, radius: 0.044, offsetLateral: -0.012, offsetDepth: 0.066, opacity: 0.46 },
        ],
      },
      {
        padName: 'bottomHand',
        bands: [
          { fromT: 0.28, toT: 0.36, radius: 0.047, offsetLateral: 0.016, offsetDepth: 0.062, opacity: 0.49 },
          { fromT: 0.64, toT: 0.72, radius: 0.045, offsetLateral: 0.012, offsetDepth: 0.068, opacity: 0.47 },
        ],
      },
    ],
    gripWristGaskets: [
      { padName: 'topHand', scale: [0.102, 0.062, 0.06], offset: [-0.012, -0.006, 0.034], roll: 0.2, opacity: 0.93 },
      { padName: 'bottomHand', scale: [0.104, 0.064, 0.062], offset: [0.014, -0.006, 0.036], roll: -0.2, opacity: 0.94 },
    ],
    gripPinchPads: [
      { padName: 'topHand', scale: [0.082, 0.048, 0.062], offset: [-0.012, -0.002, 0.046], roll: 0.34, opacity: 0.93 },
      { padName: 'bottomHand', scale: [0.086, 0.05, 0.064], offset: [0.014, -0.002, 0.048], roll: -0.32, opacity: 0.94 },
    ],
    gripCompressionPockets: [
      { padName: 'topHand', scale: [0.084, 0.038, 0.034], offset: [-0.006, 0.002, 0.044], roll: 0.28, opacity: 0.78 },
      { padName: 'bottomHand', scale: [0.088, 0.04, 0.036], offset: [0.007, -0.002, 0.046], roll: -0.26, opacity: 0.8 },
    ],
    gripContactSeams: [
      { padName: 'topHand', halfSpan: 0.066, radius: 0.012, zOffset: 0.044, skew: -0.18, opacity: 0.92 },
      { padName: 'bottomHand', halfSpan: 0.069, radius: 0.013, zOffset: 0.046, skew: 0.18, opacity: 0.93 },
    ],
  },
};
export const CLOSE_CAMERA_UNIFORM_DETAIL_PROFILE = {
  chestAccent: { length: 0.52, radius: 0.012, opacity: 0.68 },
  waistAccent: { length: 0.34, radius: 0.01, opacity: 0.62 },
  shoulderAccent: { length: 0.14, radius: 0.008, opacity: 0.54 },
  helmetStripe: { length: 0.22, radius: 0.009, opacity: 0.78 },
};
export const CONTROLLED_STICK_GEAR_PROFILE = {
  palm: '#111827',
  palmHighlight: '#334155',
  homeAccent: '#1d4ed8',
  awayAccent: '#ef4444',
  homeSleeve: '#f8fafc',
  awaySleeve: '#dc2626',
};
export const RUNNER_CLOSE_GEAR_PROFILE = {
  shoes: [
    {
      side: -1,
      basePosition: [-0.19, 0.255, 0.19],
      strideDepth: 0.055,
      upperScale: [0.13, 0.05, 0.19],
      toeScale: [0.114, 0.038, 0.086],
      heelScale: [0.102, 0.034, 0.06],
      laceCount: 3,
      laceRadius: 0.006,
      opacity: 0.94,
    },
    {
      side: 1,
      basePosition: [0.19, 0.255, 0.19],
      strideDepth: 0.055,
      upperScale: [0.13, 0.05, 0.19],
      toeScale: [0.114, 0.038, 0.086],
      heelScale: [0.102, 0.034, 0.06],
      laceCount: 3,
      laceRadius: 0.006,
      opacity: 0.94,
    },
  ],
  shinGuards: [
    {
      side: -1,
      basePosition: [-0.18, 0.58, 0.13],
      scale: [0.082, 0.17, 0.052],
      strideDepth: 0.048,
      strapLength: 0.135,
      strapRadius: 0.006,
      opacity: 0.86,
    },
    {
      side: 1,
      basePosition: [0.18, 0.58, 0.13],
      scale: [0.082, 0.17, 0.052],
      strideDepth: 0.048,
      strapLength: 0.135,
      strapRadius: 0.006,
      opacity: 0.86,
    },
  ],
  kneeCaps: [
    {
      side: -1,
      basePosition: [-0.18, 0.78, 0.105],
      scale: [0.086, 0.05, 0.052],
      strideDepth: 0.038,
      opacity: 0.86,
    },
    {
      side: 1,
      basePosition: [0.18, 0.78, 0.105],
      scale: [0.086, 0.05, 0.052],
      strideDepth: 0.038,
      opacity: 0.86,
    },
  ],
  headGear: {
    earGuards: [
      { side: -1, position: [-0.16, 1.62, 0.315], scale: [0.034, 0.052, 0.018], rotation: [0.08, 0.18, -0.18], opacity: 0.76 },
      { side: 1, position: [0.16, 1.62, 0.315], scale: [0.034, 0.052, 0.018], rotation: [0.08, -0.18, 0.18], opacity: 0.76 },
    ],
    cageBars: [
      { position: [0, 1.615, 0.455], length: 0.29, radius: 0.006, rotation: [0, 0, Math.PI / 2], opacity: 0.78 },
      { position: [0, 1.565, 0.462], length: 0.25, radius: 0.0055, rotation: [0, 0, Math.PI / 2], opacity: 0.74 },
      { position: [-0.075, 1.59, 0.466], length: 0.125, radius: 0.005, rotation: [0, 0, 0], opacity: 0.72 },
      { position: [0.075, 1.59, 0.466], length: 0.125, radius: 0.005, rotation: [0, 0, 0], opacity: 0.72 },
    ],
    chinStrap: { position: [0, 1.505, 0.388], length: 0.205, radius: 0.007, rotation: [0.04, 0, Math.PI / 2], opacity: 0.76 },
  },
};
const poseEuler = new THREE.Euler();
const poseQuat = new THREE.Quaternion();
const SEGMENT_UP = new THREE.Vector3(0, 1, 0);
const RIG_BONES = [
  'Hips',
  'Spine',
  'Spine1',
  'Spine2',
  'Neck',
  'Head',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'LeftUpLeg',
  'LeftLeg',
  'LeftFoot',
  'LeftToeBase',
  'RightUpLeg',
  'RightLeg',
  'RightFoot',
  'RightToeBase',
];
function Box({ args, position, rotation, color, roughness = 0.52, opacity = 1 }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={roughness} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function Capsule({ args, position, rotation, color, roughness = 0.5, opacity = 1 }) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <capsuleGeometry args={args} />
      <meshStandardMaterial color={color} roughness={roughness} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function RoundedBand({ length, radius, position, rotation = [0, 0, Math.PI / 2], color, roughness = 0.4, opacity = 0.86 }) {
  return (
    <Capsule
      args={[radius, Math.max(0.01, length - radius * 2), 6, 14]}
      position={position}
      rotation={rotation}
      color={color}
      roughness={roughness}
      opacity={opacity}
    />
  );
}

function GripCollar({ radius, tubeRadius, position, roll = 0, color, roughness = 0.36, opacity = 0.88 }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, roll]} castShadow receiveShadow>
      <torusGeometry args={[radius, tubeRadius, 8, 22]} />
      <meshStandardMaterial color={color} roughness={roughness} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function Ellipsoid({ scale, position, rotation = [0, 0, 0], color, roughness = 0.38, opacity = 1 }) {
  return (
    <mesh position={position} rotation={rotation} scale={scale} castShadow receiveShadow>
      <sphereGeometry args={[1, 18, 12]} />
      <meshStandardMaterial color={color} roughness={roughness} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function FloorSoleCue({ scale, position, rotation, color, accent, opacity }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh scale={scale}>
        <sphereGeometry args={[1, 16, 8]} />
        <meshStandardMaterial color={color} roughness={0.58} transparent={opacity < 1} opacity={opacity} />
      </mesh>
      <mesh position={[0, 0.006, scale[2] * 0.42]} scale={[scale[0] * 0.74, scale[1] * 1.2, scale[2] * 0.18]}>
        <sphereGeometry args={[1, 12, 6]} />
        <meshStandardMaterial color={accent} roughness={0.5} transparent opacity={0.82} />
      </mesh>
    </group>
  );
}

function PlayerGroundingCues({ player, stride }) {
  const profile = player.role === 'G'
    ? PLAYER_GROUNDING_PROFILE.goalie
    : PLAYER_GROUNDING_PROFILE.field;
  if (!profile.enabled) return null;

  const colors = getUniformIdentityColors(player);
  const soleColor = player.team === 'us' ? '#0f172a' : '#111827';

  return (
    <group>
      {profile.soles.map((sole) => {
        const depth = (profile.strideDepth ?? 0) * stride * -sole.side;
        return (
          <FloorSoleCue
            key={`floor-sole-${sole.side}`}
            scale={sole.scale}
            position={[sole.side * profile.lateral, profile.floorY, depth]}
            rotation={[0, sole.side * 0.08, sole.side * -0.04]}
            color={soleColor}
            accent={colors.accent}
            opacity={sole.opacity}
          />
        );
      })}
    </group>
  );
}

function SegmentCapsule({ from, to, radius, color, roughness = 0.52, opacity = 1 }) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const length = Math.max(0.01, direction.length());
  const position = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(SEGMENT_UP, direction.normalize());

  return (
    <mesh position={position} quaternion={quaternion} castShadow receiveShadow>
      <capsuleGeometry args={[radius, Math.max(0.01, length - radius * 2), 8, 14]} />
      <meshStandardMaterial color={color} roughness={roughness} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function interpolatePoint(from, to, t) {
  return [
    from[0] * (1 - t) + to[0] * t,
    from[1] * (1 - t) + to[1] * t,
    from[2] * (1 - t) + to[2] * t,
  ];
}

function pointDistance(from, to) {
  return Math.hypot(
    from[0] - to[0],
    from[1] - to[1],
    from[2] - to[2],
  );
}

function tintModel(root, team, uniform) {
  const jersey = uniform.jersey ?? TEAM_COLORS[team];
  const stripe = uniform.stripe ?? '#ffffff';
  const shorts = uniform.shorts ?? '#111827';

  root.traverse((object) => {
    if (!object.isMesh && !object.isSkinnedMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
    object.frustumCulled = false;
    const name = `${object.name} ${object.material?.name ?? ''}`.toLowerCase();
    const material = object.material?.clone?.() ?? new THREE.MeshStandardMaterial();
    material.roughness = 0.58;
    material.metalness = 0.03;

    if (name.includes('visor')) {
      material.color = new THREE.Color('#111827');
      material.metalness = 0.08;
      material.roughness = 0.22;
    } else if (name.includes('vanguard')) {
      material.color = new THREE.Color(jersey);
      material.map = null;
      material.metalness = 0.02;
      material.roughness = 0.5;
    } else if (name.includes('shirt')) {
      material.color = new THREE.Color(jersey);
      material.map = null;
      material.metalness = 0.02;
      material.roughness = 0.5;
    } else if (name.includes('short')) {
      material.color = new THREE.Color(shorts);
      material.map = null;
    } else if (name.includes('sock')) {
      material.color = new THREE.Color(stripe);
      material.map = null;
    } else if (name.includes('shoe')) {
      material.color = new THREE.Color('#111827');
      material.map = null;
    } else if (name.includes('hair')) {
      material.color = new THREE.Color('#111827');
      material.roughness = 0.68;
    }

    object.material = material;
  });
}

const CC_BONE_NAME_MAP = {
  CC_Base_Hip: 'Hips',
  CC_Base_Waist: 'Spine',
  CC_Base_Spine01: 'Spine1',
  CC_Base_Spine02: 'Spine2',
  CC_Base_NeckTwist01: 'Neck',
  CC_Base_Head: 'Head',
  CC_Base_L_Upperarm: 'LeftArm',
  CC_Base_L_Forearm: 'LeftForeArm',
  CC_Base_L_Hand: 'LeftHand',
  CC_Base_R_Upperarm: 'RightArm',
  CC_Base_R_Forearm: 'RightForeArm',
  CC_Base_R_Hand: 'RightHand',
  CC_Base_L_Thigh: 'LeftUpLeg',
  CC_Base_L_Calf: 'LeftLeg',
  CC_Base_L_Foot: 'LeftFoot',
  CC_Base_L_ToeBase: 'LeftToeBase',
  CC_Base_R_Thigh: 'RightUpLeg',
  CC_Base_R_Calf: 'RightLeg',
  CC_Base_R_Foot: 'RightFoot',
  CC_Base_R_ToeBase: 'RightToeBase',
};

function normalizedRigBoneName(name) {
  const shortName = name.split(':').at(-1).replace(/^mixamorig\d*/, '');
  return CC_BONE_NAME_MAP[shortName] ?? shortName;
}

function collectRig(root) {
  const rig = {
    bones: {},
    base: {},
  };

  root.traverse((object) => {
    if (!object.name) return;
    const shortName = normalizedRigBoneName(object.name);
    if (!RIG_BONES.includes(shortName)) return;
    rig.bones[shortName] = object;
    rig.base[shortName] = object.quaternion.clone();
  });

  return rig;
}

function findMixamoPrefix(root) {
  let prefix = 'mixamorig';
  root.traverse((object) => {
    if (!object.name || !object.name.endsWith('Hips')) return;
    prefix = object.name.slice(0, -4);
  });
  return prefix;
}

function retargetAnimationClips(clips, targetRoot, sourcePrefixValue = PLAYER_RIG_ASSETS.detailedRunner.sourcePrefix) {
  const targetPrefix = findMixamoPrefix(targetRoot);
  const sourcePrefix = sourcePrefixValue;
  return clips.map((clip) => {
    const next = clip.clone();
    next.tracks = next.tracks.map((track) => {
      const clonedTrack = track.clone();
      clonedTrack.name = clonedTrack.name.replace(sourcePrefix, targetPrefix);
      return clonedTrack;
    });
    return next;
  });
}

function setBoneOffset(rig, name, x = 0, y = 0, z = 0) {
  const bone = rig.bones[name];
  const base = rig.base[name];
  if (!bone || !base) return;
  poseEuler.set(x, y, z, 'XYZ');
  poseQuat.setFromEuler(poseEuler);
  bone.quaternion.copy(base).multiply(poseQuat);
}

function setBoneScale(rig, name, scale) {
  const bone = rig.bones[name];
  if (!bone) return;
  bone.scale.setScalar(scale);
}

function actionAmount(player, action) {
  return player.action === action ? (player.actionIntensity ?? 1) : 0;
}

export function resolveControlledStickGearColors(team = 'us', uniform = {}) {
  const isHome = team === 'us';
  const profile = CONTROLLED_STICK_GEAR_PROFILE;
  const accent = isHome ? (uniform?.stripe ?? profile.homeAccent) : profile.awayAccent;

  return {
    tape: accent,
    glove: profile.palm,
    gloveHighlight: profile.palmHighlight,
    cuff: accent,
    sleeve: uniform?.jersey ?? (isHome ? profile.homeSleeve : profile.awaySleeve),
  };
}

export function resolveRunnerStickMount({ action = 'idle-ready', intensity = 0, stride = 0 } = {}) {
  const runnerStick = STICK_CONTACT_PROFILE.runner;
  const pass = action === 'forehand-pass' ? intensity : 0;
  const receive = action === 'receive-pass' ? intensity : 0;
  const handle = action === 'stick-handle' ? intensity : 0;
  const handleSweep = Math.sin(stride * 3.2) * handle;
  const stickWork = Math.max(pass, receive, handle);

  return {
    pass,
    receive,
    handle,
    handleSweep,
    stickWork,
    lateral: THREE.MathUtils.lerp(runnerStick.mount.restLateral, runnerStick.mount.activeLateral, stickWork),
    height: runnerStick.gripHeight - pass * 0.08 - handle * 0.03,
    depth: THREE.MathUtils.lerp(runnerStick.mount.restDepth, runnerStick.mount.activeDepth, stickWork),
  };
}

function resolveRunnerStickBodyCoupling({
  action = 'idle-ready',
  intensity = 0,
  speedMps = 0,
  stride = 0,
} = {}) {
  const mount = resolveRunnerStickMount({ action, intensity, stride });
  if (!mount.stickWork || speedMps <= 0) {
    return { lateralTuck: 0, depthTuck: 0, heightLift: 0 };
  }

  const upperBody = resolveRunnerUpperBodyStickPose({ action, intensity, speedMps, stride });
  const handSpread = Math.abs((upperBody.LeftHand?.z ?? 0) - (upperBody.RightHand?.z ?? 0));
  const shoulderTurn = Math.abs((upperBody.LeftShoulder?.z ?? 0) - (upperBody.RightShoulder?.z ?? 0));
  const chestTurn = Math.abs(upperBody.Spine2?.y ?? 0) + shoulderTurn * 0.35;
  const drive = mount.stickWork * THREE.MathUtils.clamp(speedMps / 3.4, 0, 1);

  return {
    lateralTuck: THREE.MathUtils.clamp((0.014 + handSpread * 0.018 + chestTurn * 0.045) * drive, 0, 0.034),
    depthTuck: THREE.MathUtils.clamp((0.028 + handSpread * 0.018 + chestTurn * 0.056) * drive, 0, 0.062),
    heightLift: THREE.MathUtils.clamp((0.004 + chestTurn * 0.018) * drive, 0, 0.012),
  };
}

export function resolveRunnerStickPose({ action = 'idle-ready', intensity = 0, speedMps = 0, stride = 0 } = {}) {
  const mount = resolveRunnerStickMount({ action, intensity, stride });
  const { pass, receive, handleSweep } = mount;
  const bodyCoupling = resolveRunnerStickBodyCoupling({ action, intensity, speedMps, stride });

  return {
    ...mount,
    bodyCoupling,
    position: [
      mount.lateral + pass * 0.033 + receive * 0.04 + handleSweep * 0.01 - bodyCoupling.lateralTuck,
      mount.height + bodyCoupling.heightLift,
      mount.depth + pass * 0.108 + receive * 0.05 - bodyCoupling.depthTuck,
    ],
    rotation: [
      0.82 - pass * 0.34 - receive * 0.08,
      -0.1 + handleSweep * 0.18,
      -0.42 + stride * 0.08 - pass * 0.12 + receive * 0.16 + handleSweep * 0.3,
    ],
  };
}

export function resolveRunnerStickContactPads({ action = 'idle-ready', intensity = 0, stride = 0 } = {}) {
  const mount = resolveRunnerStickMount({ action, intensity, stride });
  const { pass, receive, handleSweep } = mount;

  return STICK_CONTACT_PROFILE.runner.contactPads.map((pad) => {
    const side = pad.name === 'topHand' ? -1 : 1;
    const slide = pad.name === 'topHand'
      ? pass * 0.035 - receive * 0.018
      : -pass * 0.045 + receive * 0.028;

    return {
      ...pad,
      depth: 0.034 + mount.stickWork * 0.018 + pass * 0.006 + receive * 0.004,
      shaftY: pad.shaftY + slide + handleSweep * side * -0.014,
      lateral: pad.lateral + side * (pass * 0.012 - receive * 0.009) + handleSweep * side * -0.008,
      wristX: pad.wristX + side * (pass * 0.02 - receive * 0.01),
      roll: pad.roll + side * (-pass * 0.22 + receive * 0.11) + handleSweep * side * -0.05,
    };
  });
}

export function resolveRunnerVisibleStickShaftSegments({ action = 'idle-ready', intensity = 0, stride = 0 } = {}) {
  const runnerStick = STICK_CONTACT_PROFILE.runner;
  const halfLength = runnerStick.shaftLength / 2;
  const gripClearance = runnerStick.gripShaftClearance;
  const gripGaps = resolveRunnerStickContactPads({ action, intensity, stride })
    .map((pad) => ({
      start: Math.max(-halfLength, pad.shaftY - gripClearance),
      end: Math.min(halfLength, pad.shaftY + gripClearance),
    }))
    .sort((a, b) => a.start - b.start);
  const mergedGaps = [];

  for (const gap of gripGaps) {
    const previous = mergedGaps[mergedGaps.length - 1];
    if (!previous || gap.start > previous.end) {
      mergedGaps.push({ ...gap });
    } else {
      previous.end = Math.max(previous.end, gap.end);
    }
  }

  const segments = [];
  let cursor = -halfLength;
  for (const gap of mergedGaps) {
    if (gap.start > cursor) {
      segments.push({ start: cursor, end: gap.start });
    }
    cursor = Math.max(cursor, gap.end);
  }
  if (cursor < halfLength) {
    segments.push({ start: cursor, end: halfLength });
  }

  return segments
    .map((segment) => ({
      centerY: (segment.start + segment.end) / 2,
      length: segment.end - segment.start,
      gripClearance,
    }))
    .filter((segment) => segment.length >= 0.045);
}

export function resolveRunnerStickGripSeats({ action = 'idle-ready', intensity = 0, stride = 0 } = {}) {
  const padsByName = new Map(
    resolveRunnerStickContactPads({ action, intensity, stride }).map((pad) => [pad.name, pad]),
  );

  return STICK_CONTACT_PROFILE.runner.gripShaftSeats.map((seat) => {
    const pad = padsByName.get(seat.padName);
    return {
      ...seat,
      position: [
        pad.lateral + seat.offsetX,
        pad.shaftY + seat.offsetY,
        (pad.depth ?? 0.034) + seat.zOffset,
      ],
      roll: pad.roll + seat.roll,
    };
  });
}

export function resolveRunnerBladeContactGuides({ action = 'idle-ready', intensity = 0, stride = 0 } = {}) {
  const mount = resolveRunnerStickMount({ action, intensity, stride });
  const active = THREE.MathUtils.clamp(mount.stickWork, 0, 1);
  const contactDrive = Math.max(active, mount.pass * 0.92, mount.receive * 0.86, mount.handle * 0.72);

  return STICK_CONTACT_PROFILE.runner.bladeContactGuides.map((guide) => ({
    ...guide,
    position: [
      guide.position[0] + mount.handleSweep * 0.025 + mount.pass * 0.038 - mount.receive * 0.018,
      guide.position[1] + mount.pass * 0.035 - mount.receive * 0.012,
      guide.position[2] + active * 0.016 + mount.receive * 0.012,
    ],
    rotation: [
      guide.rotation[0],
      guide.rotation[1] + mount.pass * 0.05 + mount.receive * 0.025,
      guide.rotation[2] + mount.handleSweep * 0.08 + mount.pass * 0.04 - mount.receive * 0.03,
    ],
    opacity: THREE.MathUtils.lerp(guide.idleOpacity, guide.activeOpacity, contactDrive),
    contactDrive,
  }));
}

export function resolveRunnerStickContactTargets({ action = 'idle-ready', intensity = 0, speedMps = 0, stride = 0 } = {}) {
  const pose = resolveRunnerStickPose({ action, intensity, speedMps, stride });
  const rotation = new THREE.Euler(...pose.rotation, 'XYZ');
  const origin = new THREE.Vector3(...pose.position);

  return Object.fromEntries(resolveRunnerStickContactPads({ action, intensity, stride }).map((pad) => {
    const target = new THREE.Vector3(pad.lateral, pad.shaftY, pad.depth ?? 0.034)
      .applyEuler(rotation)
      .add(origin);
    return [pad.name, target.toArray()];
  }));
}

export function resolveRunnerStickArmSegments({ action = 'idle-ready', intensity = 0, speedMps = 0, stride = 0 } = {}) {
  const runnerStick = STICK_CONTACT_PROFILE.runner;
  const mount = resolveRunnerStickMount({ action, intensity, stride });
  const upperBody = resolveRunnerUpperBodyStickPose({ action, intensity, speedMps, stride });
  const contactTargets = resolveRunnerStickContactTargets({ action, intensity, speedMps, stride });

  return runnerStick.articulatedStickArms.map((arm) => {
    const side = arm.padName === 'topHand' ? -1 : 1;
    const prefix = arm.padName === 'topHand' ? 'Left' : 'Right';
    const shoulderPose = upperBody[`${prefix}Shoulder`] ?? {};
    const handPose = upperBody[`${prefix}Hand`] ?? {};
    const postureDrive = mount.stickWork * THREE.MathUtils.clamp(speedMps / 3.4, 0, 1);
    const shoulderDepth = (
      0.018
      + Math.abs(shoulderPose.z ?? 0) * 0.1
      + Math.abs(handPose.z ?? 0) * 0.02
    ) * postureDrive;
    const shoulder = [
      arm.shoulder[0] + (shoulderPose.y ?? 0) * 0.1 + side * mount.handleSweep * 0.006,
      arm.shoulder[1] - postureDrive * 0.018 - mount.pass * 0.012,
      arm.shoulder[2] + shoulderDepth,
    ];
    const hand = contactTargets[arm.padName];
    const midpoint = interpolatePoint(shoulder, hand, 0.54);
    const elbow = [
      midpoint[0] + arm.elbowBias[0] * (1 + mount.stickWork * 0.18),
      midpoint[1] + arm.elbowBias[1] - mount.pass * 0.035 + mount.receive * 0.018,
      midpoint[2] + arm.elbowBias[2] * (1 + mount.stickWork * 0.2),
    ];

    return {
      padName: arm.padName,
      shoulder,
      elbow,
      hand,
      upperLength: pointDistance(shoulder, elbow),
      forearmLength: pointDistance(elbow, hand),
      upperArmRadius: arm.upperArmRadius,
      forearmRadius: arm.forearmRadius,
      opacity: arm.opacity,
    };
  });
}

function resolveStickSidePoseDriver(upperBody, padName, mount) {
  if (!mount.stickWork) {
    return { lateral: 0, drop: 0, depth: 0 };
  }

  const side = padName === 'topHand' ? -1 : 1;
  const prefix = padName === 'topHand' ? 'Left' : 'Right';
  const shoulder = upperBody[`${prefix}Shoulder`];
  const arm = upperBody[`${prefix}Arm`];
  const forearm = upperBody[`${prefix}ForeArm`];
  const hand = upperBody[`${prefix}Hand`];
  const depthSignal = Math.abs(shoulder?.z ?? 0) * 0.16
    + Math.abs(forearm?.z ?? 0) * 0.1
    + Math.abs(hand?.z ?? 0) * 0.08;
  const lateralSignal = Math.abs(arm?.y ?? 0) * 0.05 + Math.abs(hand?.y ?? 0) * 0.035;
  const dropSignal = Math.abs((arm?.x ?? 1) - 1) * 0.035 + Math.abs((forearm?.x ?? 0.8) - 0.8) * 0.018;

  return {
    lateral: side * THREE.MathUtils.clamp(lateralSignal, 0.006, 0.028) * mount.stickWork,
    drop: THREE.MathUtils.clamp(dropSignal, 0.006, 0.028) * mount.stickWork,
    depth: THREE.MathUtils.clamp(depthSignal, 0.045, 0.078) * mount.stickWork,
  };
}

export function resolveRunnerCloseContactRig({
  action = 'idle-ready',
  intensity = 0,
  speedMps = 0,
  stride = 0,
} = {}) {
  const runnerStick = STICK_CONTACT_PROFILE.runner;
  const mount = resolveRunnerStickMount({ action, intensity, stride });
  const upperBody = resolveRunnerUpperBodyStickPose({ action, intensity, speedMps, stride });
  const contactTargets = resolveRunnerStickContactTargets({ action, intensity, speedMps, stride });
  const armSegmentsByPad = new Map(
    resolveRunnerStickArmSegments({ action, intensity, speedMps, stride }).map((segment) => [segment.padName, segment]),
  );
  const shellsByPad = new Map(runnerStick.closedGripShells.map((shell) => [shell.padName, shell]));
  const locksByPad = new Map(runnerStick.stickSideForearmLocks.map((lock) => [lock.padName, lock]));
  const websByPad = new Map(runnerStick.gripWristWebs.map((web) => [web.padName, web]));
  const gasketsByPad = new Map(runnerStick.gripWristGaskets.map((gasket) => [gasket.padName, gasket]));
  const pinchPadsByPad = new Map(runnerStick.gripPinchPads.map((pinch) => [pinch.padName, pinch]));
  const compressionPocketsByPad = new Map((runnerStick.gripCompressionPockets ?? []).map((pocket) => [pocket.padName, pocket]));
  const gripSeamsByPad = new Map((runnerStick.gripContactSeams ?? []).map((seam) => [seam.padName, seam]));
  const contactPadsByPad = new Map(
    resolveRunnerStickContactPads({ action, intensity, stride }).map((pad) => [pad.name, pad]),
  );
  const torsoAnchorsByPad = new Map((runnerStick.torsoStickAnchors ?? []).map((anchor) => [anchor.padName, anchor]));
  const torsoOverlapPanelsByPad = new Map((runnerStick.torsoArmOverlapPanels ?? []).map((panel) => [panel.padName, panel]));
  const yokePanelsByPad = new Map((runnerStick.stickArmYokePanels ?? []).map((panel) => [panel.padName, panel]));
  const silhouettePanelsByPad = new Map((runnerStick.stickArmSilhouettePanels ?? []).map((panel) => [panel.padName, panel]));
  const stripeBandsByPad = new Map((runnerStick.stickArmStripeBands ?? []).map((stripe) => [stripe.padName, stripe]));
  const forearmBridgesByPad = new Map((runnerStick.forearmBridges ?? []).map((bridge) => [bridge.padName, bridge]));
  const upperArmBridgesByPad = new Map((runnerStick.upperArmBridges ?? []).map((bridge) => [bridge.padName, bridge]));
  const shoulderCapsBySide = new Map((runnerStick.bodyShoulderCaps ?? []).map((cap) => [cap.side, cap]));

  return {
    inlineStickBodyBridgeCount: 0,
    handAssemblies: runnerStick.bodyStickSleeves.map((sleeve) => {
      const side = sleeve.padName === 'topHand' ? -1 : 1;
      const reach = mount.stickWork;
      const poseDriver = resolveStickSidePoseDriver(upperBody, sleeve.padName, mount);
      const arm = armSegmentsByPad.get(sleeve.padName);
      const from = [
        sleeve.bodyAnchor[0] + side * reach * 0.018 + poseDriver.lateral,
        sleeve.bodyAnchor[1] - mount.pass * 0.045 - poseDriver.drop,
        sleeve.bodyAnchor[2] + reach * 0.028 + poseDriver.depth,
      ];
      const handTarget = contactTargets[sleeve.padName] ?? sleeve.handAnchor;
      const lock = locksByPad.get(sleeve.padName);
      const lockFromBase = lock ? interpolatePoint(from, handTarget, lock.fromT) : interpolatePoint(from, handTarget, 0.62);
      const lockToBase = lock ? interpolatePoint(from, handTarget, lock.toT) : handTarget;
      const lateralOffset = lock ? side * lock.offsetLateral : 0;
      const forearmLock = {
        from: [
          lockFromBase[0] + lateralOffset,
          lockFromBase[1] + (lock?.offsetHeight ?? 0),
          lockFromBase[2] + (lock?.offsetDepth ?? 0),
        ],
        to: [
          lockToBase[0] + lateralOffset * 0.2,
          lockToBase[1] + (lock?.offsetHeight ?? 0),
          lockToBase[2] + (lock?.offsetDepth ?? 0),
        ],
        radius: lock?.radius ?? sleeve.radius * 0.52,
        opacity: lock?.opacity ?? 0.84,
      };
      const web = websByPad.get(sleeve.padName);
      const webFromBase = web ? interpolatePoint(from, handTarget, web.fromT) : interpolatePoint(from, handTarget, 0.74);
      const webToBase = web ? interpolatePoint(from, handTarget, web.toT) : handTarget;
      const webLateralOffset = web ? side * web.offsetLateral : 0;
      const gripWristWeb = {
        from: [
          webFromBase[0] + webLateralOffset,
          webFromBase[1] + (web?.offsetHeight ?? 0),
          webFromBase[2] + (web?.offsetDepth ?? 0),
        ],
        to: [
          webToBase[0] + webLateralOffset * 0.18,
          webToBase[1] + (web?.offsetHeight ?? 0),
          webToBase[2] + (web?.offsetDepth ?? 0),
        ],
        radius: web?.radius ?? sleeve.radius * 1.08,
        opacity: web?.opacity ?? 0.9,
      };
      const shell = shellsByPad.get(sleeve.padName);
      const gasket = gasketsByPad.get(sleeve.padName);
      const wristGasket = gasket ? {
        position: [
          handTarget[0] + gasket.offset[0],
          handTarget[1] + gasket.offset[1],
          handTarget[2] + gasket.offset[2],
        ],
        scale: gasket.scale,
        roll: gasket.roll,
        opacity: gasket.opacity,
      } : null;
      const pinchPad = pinchPadsByPad.get(sleeve.padName);
      const gripPinchPad = pinchPad ? {
        position: [
          handTarget[0] + pinchPad.offset[0],
          handTarget[1] + pinchPad.offset[1],
          handTarget[2] + pinchPad.offset[2],
        ],
        scale: pinchPad.scale,
        roll: pinchPad.roll,
        opacity: pinchPad.opacity,
      } : null;
      const compressionPocket = compressionPocketsByPad.get(sleeve.padName);
      const gripCompressionPocket = compressionPocket ? {
        position: [
          handTarget[0] + compressionPocket.offset[0],
          handTarget[1] + compressionPocket.offset[1],
          handTarget[2] + compressionPocket.offset[2],
        ],
        scale: compressionPocket.scale,
        roll: compressionPocket.roll,
        opacity: compressionPocket.opacity,
      } : null;
      const seamProfile = gripSeamsByPad.get(sleeve.padName);
      const contactPad = contactPadsByPad.get(sleeve.padName);
      const seamAngle = (contactPad?.roll ?? 0) * 0.22 + (seamProfile?.skew ?? 0);
      const seamSpanX = seamProfile ? Math.cos(seamAngle) * seamProfile.halfSpan : 0;
      const seamSpanY = seamProfile ? Math.sin(seamAngle) * seamProfile.halfSpan * 0.42 : 0;
      const gripContactSeam = seamProfile ? {
        from: [
          handTarget[0] - seamSpanX,
          handTarget[1] - seamSpanY,
          handTarget[2] + seamProfile.zOffset,
        ],
        to: [
          handTarget[0] + seamSpanX,
          handTarget[1] + seamSpanY,
          handTarget[2] + seamProfile.zOffset,
        ],
        radius: seamProfile.radius,
        opacity: seamProfile.opacity,
      } : null;
      const torsoAnchorProfile = torsoAnchorsByPad.get(sleeve.padName);
      const torsoAnchor = torsoAnchorProfile ? {
        from: [
          torsoAnchorProfile.chestAnchor[0] + side * reach * 0.012 + poseDriver.lateral * 0.42,
          torsoAnchorProfile.chestAnchor[1] - mount.pass * 0.018 - poseDriver.drop * 0.48,
          torsoAnchorProfile.chestAnchor[2] + reach * 0.018 + poseDriver.depth * 0.52,
        ],
        to: [
          from[0] + torsoAnchorProfile.sleeveRootOffset[0],
          from[1] + torsoAnchorProfile.sleeveRootOffset[1],
          from[2] + torsoAnchorProfile.sleeveRootOffset[2],
        ],
        radius: torsoAnchorProfile.radius,
        opacity: torsoAnchorProfile.opacity,
      } : null;
      const torsoOverlapProfile = arm && torsoAnchor && torsoOverlapPanelsByPad.get(sleeve.padName);
      const torsoOverlapToBase = torsoOverlapProfile ? interpolatePoint(arm.shoulder, arm.elbow, torsoOverlapProfile.toT) : null;
      const torsoArmOverlap = torsoOverlapProfile ? {
        from: [
          torsoAnchor.from[0] + torsoOverlapProfile.fromOffset[0],
          torsoAnchor.from[1] + torsoOverlapProfile.fromOffset[1],
          torsoAnchor.from[2] + torsoOverlapProfile.fromOffset[2],
        ],
        to: [
          torsoOverlapToBase[0] + torsoOverlapProfile.offsetLateral,
          torsoOverlapToBase[1] + torsoOverlapProfile.offsetHeight,
          torsoOverlapToBase[2] + torsoOverlapProfile.offsetDepth + poseDriver.depth * 0.14,
        ],
        radius: torsoOverlapProfile.radius,
        opacity: torsoOverlapProfile.opacity,
      } : null;
      const shoulderCapProfile = arm && shoulderCapsBySide.get(side);
      const shoulderCap = shoulderCapProfile ? {
        position: [
          arm.shoulder[0] + side * 0.012 + poseDriver.lateral * 0.34,
          arm.shoulder[1] + 0.012 - poseDriver.drop * 0.42,
          arm.shoulder[2] + 0.038 + poseDriver.depth * 0.12,
        ],
        rotation: [
          shoulderCapProfile.rotation[0] - mount.pass * 0.045 + mount.receive * 0.026,
          shoulderCapProfile.rotation[1],
          shoulderCapProfile.rotation[2] + side * mount.handleSweep * 0.07,
        ],
        length: shoulderCapProfile.length,
        radius: shoulderCapProfile.radius,
        opacity: shoulderCapProfile.opacity,
      } : null;
      const yokeProfile = yokePanelsByPad.get(sleeve.padName);
      const armYokeFromBase = arm && yokeProfile ? interpolatePoint(arm.shoulder, arm.elbow, yokeProfile.fromT) : null;
      const armYokeToBase = arm && yokeProfile ? interpolatePoint(arm.shoulder, arm.elbow, yokeProfile.toT) : null;
      const armYoke = arm && yokeProfile ? {
        from: [
          armYokeFromBase[0] + yokeProfile.offsetLateral,
          armYokeFromBase[1] + yokeProfile.offsetHeight,
          armYokeFromBase[2] + yokeProfile.offsetDepth + poseDriver.depth * 0.18,
        ],
        to: [
          armYokeToBase[0] + yokeProfile.offsetLateral * 0.38,
          armYokeToBase[1] + yokeProfile.offsetHeight,
          armYokeToBase[2] + yokeProfile.offsetDepth + poseDriver.depth * 0.18,
        ],
        radius: yokeProfile.radius,
        opacity: yokeProfile.opacity,
      } : null;
      const silhouetteProfile = silhouettePanelsByPad.get(sleeve.padName);
      const armSilhouetteFromBase = arm && silhouetteProfile ? interpolatePoint(arm.shoulder, arm.hand, silhouetteProfile.fromT) : null;
      const armSilhouetteToBase = arm && silhouetteProfile ? interpolatePoint(arm.shoulder, arm.hand, silhouetteProfile.toT) : null;
      const armSilhouette = arm && silhouetteProfile ? {
        from: [
          armSilhouetteFromBase[0] + silhouetteProfile.offsetLateral,
          armSilhouetteFromBase[1] + silhouetteProfile.offsetHeight,
          armSilhouetteFromBase[2] + silhouetteProfile.offsetDepth + poseDriver.depth * 0.18,
        ],
        to: [
          armSilhouetteToBase[0] + silhouetteProfile.offsetLateral * 0.18,
          armSilhouetteToBase[1] + silhouetteProfile.offsetHeight * 0.35,
          armSilhouetteToBase[2] + silhouetteProfile.offsetDepth + poseDriver.depth * 0.12,
        ],
        radius: silhouetteProfile.radius,
        opacity: silhouetteProfile.opacity,
      } : null;
      const stripeProfile = arm && armSilhouette && stripeBandsByPad.get(sleeve.padName);
      const armStripeBands = stripeProfile ? stripeProfile.bands.map((band, index) => {
        const fromBase = interpolatePoint(arm.shoulder, arm.hand, band.fromT);
        const toBase = interpolatePoint(arm.shoulder, arm.hand, band.toT);
        return {
          name: `${stripeProfile.padName}-${index}`,
          from: [
            fromBase[0] + (band.offsetLateral ?? 0),
            fromBase[1] + (band.offsetHeight ?? 0),
            fromBase[2] + (band.offsetDepth ?? 0) + poseDriver.depth * 0.16,
          ],
          to: [
            toBase[0] + (band.offsetLateral ?? 0) * 0.62,
            toBase[1] + (band.offsetHeight ?? 0),
            toBase[2] + (band.offsetDepth ?? 0) + poseDriver.depth * 0.14,
          ],
          radius: band.radius,
          opacity: band.opacity,
        };
      }) : [];
      const forearmBridgeProfile = forearmBridgesByPad.get(sleeve.padName);
      const forearmBridgeFromBase = arm && forearmBridgeProfile ? interpolatePoint(arm.elbow, arm.hand, 0.44) : null;
      const forearmBridge = arm && forearmBridgeProfile ? {
        from: [
          forearmBridgeFromBase[0] + side * 0.012,
          forearmBridgeFromBase[1] - mount.pass * 0.01,
          forearmBridgeFromBase[2] + Math.abs(forearmBridgeProfile.bodyAnchorZ) + 0.05 + poseDriver.depth * 0.16,
        ],
        to: [
          handTarget[0] + side * 0.012,
          handTarget[1] - 0.006,
          handTarget[2] + 0.036,
        ],
        radius: forearmBridgeProfile.radius,
        opacity: 0.86,
      } : null;
      const upperArmBridgeProfile = upperArmBridgesByPad.get(sleeve.padName);
      const upperArmBridgeFromBase = arm && upperArmBridgeProfile ? interpolatePoint(arm.shoulder, arm.elbow, 0.18) : null;
      const upperArmBridgeToBase = arm && upperArmBridgeProfile ? interpolatePoint(arm.shoulder, arm.elbow, 0.76) : null;
      const upperArmBridge = arm && upperArmBridgeProfile ? {
        from: [
          upperArmBridgeFromBase[0] + side * 0.01,
          upperArmBridgeFromBase[1] - mount.pass * 0.012,
          upperArmBridgeFromBase[2] + Math.abs(upperArmBridgeProfile.bodyAnchorZ) + 0.04 + poseDriver.depth * 0.14,
        ],
        to: [
          upperArmBridgeToBase[0] + side * 0.01,
          upperArmBridgeToBase[1] - mount.pass * 0.012,
          upperArmBridgeToBase[2] + Math.abs(upperArmBridgeProfile.bodyAnchorZ) + 0.05 + poseDriver.depth * 0.14,
        ],
        radius: upperArmBridgeProfile.radius,
        opacity: 0.82,
      } : null;

      return {
        padName: sleeve.padName,
        side,
        handTarget,
        arm,
        bodySleeve: {
          from,
          to: handTarget,
          radius: sleeve.radius,
          opacity: sleeve.opacity,
        },
        cuffSleeve: {
          from: [
            from[0] * 0.72 + handTarget[0] * 0.28,
            from[1] * 0.72 + handTarget[1] * 0.28,
            from[2] * 0.72 + handTarget[2] * 0.28,
          ],
          to: handTarget,
          radius: sleeve.radius * 0.58,
          opacity: 0.78,
        },
        forearmLock,
        gripWristWeb,
        torsoAnchor,
        torsoArmOverlap,
        shoulderCap,
        armSilhouette,
        armYoke,
        armStripeBands,
        forearmBridge,
        upperArmBridge,
        poseDriver,
        wristGasket,
        gripPinchPad,
        gripCompressionPocket,
        gripContactSeam,
        gripShellOffset: shell?.offset ?? [0, 0, 0],
      };
    }),
  };
}

export function resolveRunnerUpperBodyStickPose({ action = 'idle-ready', intensity = 0, speedMps = 0, stride = 0 } = {}) {
  const speed = Math.min(1.2, speedMps / 4);
  const drive = stride * speed;
  const counter = -drive;
  const pass = action === 'forehand-pass' ? intensity : 0;
  const receive = action === 'receive-pass' ? intensity : 0;
  const handle = action === 'stick-handle' ? intensity : 0;
  const handleSweep = Math.sin(stride * 3.2) * handle;
  const stickWork = Math.max(pass, receive, handle);
  const armDrop = 0.76 - pass * 0.12 + receive * 0.04 - handle * 0.025;
  const elbowSet = 0.58 - pass * 0.12 - handle * 0.04;
  const forearmClamp = stickWork * 0.065;
  const handClamp = stickWork * 0.16 + handle * 0.022;
  const armClamp = stickWork * 0.08;
  const chestTurn = stickWork * 0.045 + pass * 0.035 + receive * 0.018 + handleSweep * 0.014;
  const headTrack = stickWork * 0.072 + pass * 0.038 + receive * 0.018 + handleSweep * 0.02;
  const shoulderClose = stickWork * 0.052 + pass * 0.034 + receive * 0.014;
  const wristSweep = handleSweep * 0.048;
  const wristRoll = handleSweep * 0.018;

  return {
    Hips: { x: -0.04 - speed * 0.03 - stickWork * 0.03, y: pass * 0.03, z: drive * 0.025 + pass * 0.06 },
    Spine: { x: -0.1 - speed * 0.08 - stickWork * 0.08, y: receive * -0.05 + chestTurn * 0.42, z: counter * 0.025 + pass * 0.08 },
    Spine1: { x: -0.08 - stickWork * 0.05, y: receive * -0.04 + chestTurn * 0.68, z: drive * 0.018 + pass * 0.06 },
    Spine2: { x: -0.06 - receive * 0.04, y: handleSweep * 0.025 + chestTurn, z: counter * 0.018 + pass * 0.04 },
    Neck: { x: 0.08 - stickWork * 0.018, y: headTrack * 0.76, z: handleSweep * 0.018 - pass * 0.012 },
    Head: { x: 0.045 - stickWork * 0.018, y: headTrack, z: handleSweep * 0.026 - pass * 0.018 },
    LeftShoulder: { x: 0.74 - stickWork * 0.018, y: -0.04 - chestTurn * 0.16, z: -0.052 - shoulderClose * 0.42 },
    RightShoulder: { x: 0.74 - stickWork * 0.018, y: 0.04 + chestTurn * 0.16, z: 0.052 + shoulderClose * 0.42 },
    LeftArm: {
      x: armDrop + drive * 0.08 - pass * 0.18 + handleSweep * 0.05 - armClamp * 0.42,
      y: -0.12 - receive * 0.2 - stickWork * 0.035,
      z: -0.24 - pass * 0.24 + armClamp,
    },
    RightArm: {
      x: armDrop - drive * 0.06 - pass * 0.34 - receive * 0.12 - handleSweep * 0.05 - armClamp * 0.5,
      y: 0.12 + receive * 0.18 + stickWork * 0.035,
      z: 0.24 + pass * 0.38 - armClamp,
    },
    LeftForeArm: {
      x: elbowSet - pass * 0.26 - stickWork * 0.045,
      y: -0.08 - receive * 0.1 - handle * 0.032,
      z: 0.24 + pass * 0.24 + handleSweep * 0.08 + forearmClamp,
    },
    RightForeArm: {
      x: elbowSet - pass * 0.3 - receive * 0.1 - stickWork * 0.045,
      y: 0.08 + receive * 0.1 + handle * 0.032,
      z: -0.24 - pass * 0.36 - handleSweep * 0.08 - forearmClamp,
    },
    LeftHand: {
      x: 0.12 - pass * 0.08 - stickWork * 0.025,
      y: 0.18 + receive * 0.06 + handle * 0.032 + wristRoll,
      z: 0.06 + pass * 0.18 + handClamp + wristSweep,
    },
    RightHand: {
      x: 0.12 - pass * 0.12 - stickWork * 0.025,
      y: -0.18 - receive * 0.06 - handle * 0.032 - wristRoll,
      z: -0.06 - pass * 0.22 - handClamp - wristSweep,
    },
  };
}

function applyRunnerPose(rig, player, stride) {
  const speed = Math.min(1.2, player.speedMps / 4);
  const drive = stride * speed;
  const counter = -drive;
  const upperBody = resolveRunnerUpperBodyStickPose({
    action: player.action,
    intensity: player.actionIntensity ?? 1,
    speedMps: player.speedMps,
    stride,
  });

  for (const [boneName, offset] of Object.entries(upperBody)) {
    setBoneOffset(rig, boneName, offset.x, offset.y, offset.z);
  }
  setBoneScale(rig, 'LeftShoulder', 0.18);
  setBoneScale(rig, 'RightShoulder', 0.18);

  setBoneOffset(rig, 'LeftUpLeg', 0.34 + drive * 0.62, 0.05, -0.05);
  setBoneOffset(rig, 'RightUpLeg', 0.34 + counter * 0.62, -0.05, 0.05);
  setBoneOffset(rig, 'LeftLeg', 0.22 + Math.max(0, -drive) * 0.72, 0, 0);
  setBoneOffset(rig, 'RightLeg', 0.22 + Math.max(0, drive) * 0.72, 0, 0);
  setBoneOffset(rig, 'LeftFoot', -0.22 - Math.max(0, drive) * 0.26, 0.03, 0);
  setBoneOffset(rig, 'RightFoot', -0.22 - Math.max(0, -drive) * 0.26, -0.03, 0);
  setBoneOffset(rig, 'LeftToeBase', 0.12 + Math.max(0, drive) * 0.18, 0, 0);
  setBoneOffset(rig, 'RightToeBase', 0.12 + Math.max(0, -drive) * 0.18, 0, 0);
}

function applyGoaliePose(rig) {
  setBoneOffset(rig, 'Hips', -0.16, 0, 0);
  setBoneOffset(rig, 'Spine', -0.18, 0, 0);
  setBoneOffset(rig, 'Spine1', -0.14, 0, 0);
  setBoneOffset(rig, 'Neck', 0.14, 0, 0);

  setBoneOffset(rig, 'LeftShoulder', 0.88, -0.08, -0.12);
  setBoneOffset(rig, 'RightShoulder', 0.88, 0.08, 0.12);
  setBoneOffset(rig, 'LeftArm', 1.02, -0.12, -0.52);
  setBoneOffset(rig, 'RightArm', 1.02, 0.12, 0.52);
  setBoneOffset(rig, 'LeftForeArm', 0.82, -0.08, 0.22);
  setBoneOffset(rig, 'RightForeArm', 0.82, 0.08, -0.22);
  setBoneScale(rig, 'LeftShoulder', 0.22);
  setBoneScale(rig, 'RightShoulder', 0.22);

  setBoneOffset(rig, 'LeftUpLeg', 0.72, 0.16, -0.18);
  setBoneOffset(rig, 'RightUpLeg', 0.72, -0.16, 0.18);
  setBoneOffset(rig, 'LeftLeg', 0.82, 0.04, 0.06);
  setBoneOffset(rig, 'RightLeg', 0.82, -0.04, -0.06);
  setBoneOffset(rig, 'LeftFoot', -0.32, 0.12, -0.1);
  setBoneOffset(rig, 'RightFoot', -0.32, -0.12, 0.1);
}

function Stick({ stride = 0, goalie = false, team = 'us', uniform, action = 'idle-ready', intensity = 0, speedMps = 0 }) {
  const gear = resolveControlledStickGearColors(team, uniform);
  const { tape, glove, gloveHighlight, cuff } = gear;
  const runnerStick = STICK_CONTACT_PROFILE.runner;
  const stickPose = resolveRunnerStickPose({ action, intensity, speedMps, stride });
  const { pass } = stickPose;
  const contactPads = resolveRunnerStickContactPads({ action, intensity, stride });
  const visibleShaftSegments = resolveRunnerVisibleStickShaftSegments({ action, intensity, stride });
  const gripShaftSeats = resolveRunnerStickGripSeats({ action, intensity, stride });
  const bladeContactGuides = resolveRunnerBladeContactGuides({ action, intensity, stride });
  const padsByName = new Map(contactPads.map((pad) => [pad.name, pad]));
  const padDepth = (pad) => pad.depth ?? 0.034;

  if (goalie) {
    return (
      <group position={[0.58, 0.56, 0.36]} rotation={[1.05, -0.12, -0.54]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.018, 0.018, 1.6, 12]} />
          <meshStandardMaterial color={REPLAY_COLORS.stick} roughness={0.44} />
        </mesh>
        <Box args={[0.5, 0.03, 0.1]} position={[0.2, -0.86, 0.08]} rotation={[0, 0.25, 0]} color="#111827" />
        <Box args={[0.18, 0.035, 0.11]} position={[0.43, -0.83, 0.08]} rotation={[0, 0.25, 0]} color={tape} roughness={0.36} />
      </group>
    );
  }

  return (
    <group position={stickPose.position} rotation={stickPose.rotation}>
      {visibleShaftSegments.map((segment) => (
        <mesh key={`shaft-${segment.centerY}`} position={[0, segment.centerY, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, segment.length, 12]} />
          <meshStandardMaterial color={REPLAY_COLORS.stick} roughness={0.44} />
        </mesh>
      ))}
      {[0.18, 0.42].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <cylinderGeometry args={[0.024, 0.024, 0.08, 12]} />
          <meshStandardMaterial color={tape} roughness={0.34} />
        </mesh>
      ))}
      {runnerStick.handleTapeBands.map((band) => (
        <Capsule
          key={`handle-tape-${band.shaftY}`}
          args={[band.radius, band.length, 6, 12]}
          position={[0, band.shaftY, band.depth ?? 0]}
          rotation={[0, 0, 0]}
          color={tape}
          roughness={0.34}
          opacity={band.opacity}
        />
      ))}
      <RoundedBand
        length={runnerStick.shaftButtEnd.length}
        radius={runnerStick.shaftButtEnd.radius}
        position={[0, runnerStick.shaftButtEnd.shaftY, runnerStick.shaftButtEnd.depth ?? 0]}
        rotation={[0, 0, Math.PI / 2]}
        color={tape}
        roughness={0.34}
        opacity={runnerStick.shaftButtEnd.opacity}
      />
      {contactPads.map((pad) => (
        <group key={pad.name} position={[pad.lateral, pad.shaftY, padDepth(pad)]}>
          <Capsule
            args={[pad.radius, 0.16, 8, 14]}
            position={[0, 0, 0]}
            rotation={[Math.PI / 2, 0, pad.roll]}
            color={glove}
            roughness={0.38}
          />
          <Capsule
            args={[0.028, 0.16, 6, 12]}
            position={[pad.wristX, -0.035, 0.024]}
            rotation={[Math.PI / 2, 0, pad.roll * 2.6]}
            color={cuff}
            roughness={0.48}
          />
        </group>
      ))}
      {runnerStick.gripWraps.map((wrap) => {
        const pad = padsByName.get(wrap.padName);
        if (!pad) return null;

        return (
          <group key={wrap.padName} position={[pad.lateral, pad.shaftY, 0.07]}>
            <Capsule
              args={[wrap.radius, wrap.length, 8, 14]}
              position={[0, 0, 0]}
              rotation={[Math.PI / 2, 0, pad.roll + wrap.roll * 0.16]}
              color={glove}
              roughness={0.34}
            />
            <Capsule
              args={[wrap.radius * 0.62, wrap.thumbLength, 6, 12]}
              position={[wrap.thumbOffsetX, wrap.thumbOffsetY, 0.022]}
              rotation={[Math.PI / 2, 0, wrap.roll]}
              color={glove}
              roughness={0.36}
            />
          </group>
        );
      })}
      {runnerStick.gripCollars.map((collar) => {
        const pad = padsByName.get(collar.padName);
        if (!pad) return null;

        return (
          <GripCollar
            key={collar.padName}
            radius={collar.radius}
            tubeRadius={collar.tubeRadius}
            position={[0, pad.shaftY, padDepth(pad) + collar.zOffset]}
            roll={pad.roll + collar.roll}
            color={glove}
            opacity={collar.opacity}
          />
        );
      })}
      {runnerStick.gripFingerRidges.map((ridgeSet) => {
        const pad = padsByName.get(ridgeSet.padName);
        if (!pad) return null;
        const center = (ridgeSet.count - 1) / 2;

        return Array.from({ length: ridgeSet.count }, (_, index) => {
          const offset = (index - center) * ridgeSet.spacing;

          return (
            <Capsule
              key={`${ridgeSet.padName}-${index}`}
              args={[ridgeSet.radius, ridgeSet.length, 6, 10]}
              position={[pad.lateral + offset, pad.shaftY + offset * 0.2, padDepth(pad) + ridgeSet.zOffset]}
              rotation={[Math.PI / 2, 0, pad.roll + ridgeSet.roll + offset * 2.2]}
              color={gloveHighlight}
              roughness={0.34}
              opacity={ridgeSet.opacity}
            />
          );
        });
      })}
      {runnerStick.gripPalmGuards.map((guard) => {
        const pad = padsByName.get(guard.padName);
        if (!pad) return null;

        return (
          <Capsule
            key={`palm-${guard.padName}`}
            args={[guard.radius, guard.length, 6, 12]}
            position={[pad.lateral + guard.offsetX, pad.shaftY + guard.offsetY, padDepth(pad) + guard.zOffset]}
            rotation={[Math.PI / 2, 0, pad.roll + guard.roll]}
            color={gloveHighlight}
            roughness={0.34}
            opacity={guard.opacity}
          />
        );
      })}
      {runnerStick.gloveWristStraps.map((strap) => {
        const pad = padsByName.get(strap.padName);
        if (!pad) return null;

        return (
          <Capsule
            key={`wrist-strap-${strap.padName}`}
            args={[strap.radius, strap.length, 6, 12]}
            position={[pad.lateral + strap.offsetX, pad.shaftY + strap.offsetY, padDepth(pad) + strap.zOffset]}
            rotation={[Math.PI / 2, 0, pad.roll + strap.roll]}
            color={cuff}
            roughness={0.42}
            opacity={strap.opacity}
          />
        );
      })}
      {runnerStick.closedGripShells.map((shell) => {
        const pad = padsByName.get(shell.padName);
        if (!pad) return null;

        return (
          <Ellipsoid
            key={`closed-grip-${shell.padName}`}
            scale={shell.scale}
            position={[
              pad.lateral + shell.offset[0],
              pad.shaftY + shell.offset[1],
              padDepth(pad) + shell.offset[2],
            ]}
            rotation={[Math.PI / 2, 0, pad.roll + shell.roll]}
            color={glove}
            roughness={0.36}
            opacity={shell.opacity}
          />
        );
      })}
      {runnerStick.gripHeelBridges.map((bridge) => {
        const pad = padsByName.get(bridge.padName);
        if (!pad) return null;

        return (
          <Capsule
            key={`grip-heel-${bridge.padName}`}
            args={[bridge.radius, bridge.length, 6, 12]}
            position={[
              pad.lateral + bridge.offsetX,
              pad.shaftY + bridge.offsetY,
              padDepth(pad) + bridge.zOffset,
            ]}
            rotation={[Math.PI / 2, 0, pad.roll + bridge.roll]}
            color={glove}
            roughness={0.36}
            opacity={bridge.opacity}
          />
        );
      })}
      {runnerStick.gripShaftChannels.map((channel) => {
        const pad = padsByName.get(channel.padName);
        if (!pad) return null;

        return (
          <Capsule
            key={`shaft-channel-${channel.padName}`}
            args={[channel.radius, channel.length, 8, 14]}
            position={[pad.lateral, pad.shaftY, padDepth(pad) + channel.zOffset]}
            rotation={[0, 0, pad.roll * 0.32]}
            color={glove}
            roughness={0.34}
            opacity={channel.opacity}
          />
        );
      })}
      {gripShaftSeats.map((seat) => (
        <Ellipsoid
          key={`shaft-seat-${seat.padName}`}
          scale={seat.scale}
          position={seat.position}
          rotation={[Math.PI / 2, 0, seat.roll]}
          color="#020617"
          roughness={0.42}
          opacity={seat.opacity}
        />
      ))}
      {runnerStick.gripContactMasks.map((mask) => {
        const pad = padsByName.get(mask.padName);
        if (!pad) return null;

        return (
          <Ellipsoid
            key={`contact-mask-${mask.padName}`}
            scale={mask.scale}
            position={[
              pad.lateral + (mask.offsetX ?? 0),
              pad.shaftY + (mask.offsetY ?? 0),
              padDepth(pad) + mask.zOffset,
            ]}
            rotation={[Math.PI / 2, 0, pad.roll + (mask.roll ?? 0)]}
            color={glove}
            roughness={0.34}
            opacity={mask.opacity}
          />
        );
      })}
      {runnerStick.gripKnucklePads.map((knuckles) => {
        const pad = padsByName.get(knuckles.padName);
        if (!pad) return null;
        const center = (knuckles.count - 1) / 2;

        return Array.from({ length: knuckles.count }, (_, index) => {
          const offset = (index - center) * knuckles.spacing;

          return (
            <Capsule
              key={`knuckle-${knuckles.padName}-${index}`}
              args={[knuckles.radius, knuckles.length, 6, 10]}
              position={[pad.lateral + offset, pad.shaftY + offset * 0.18, padDepth(pad) + knuckles.zOffset]}
              rotation={[Math.PI / 2, 0, pad.roll + knuckles.roll + offset * 1.8]}
              color={gloveHighlight}
              roughness={0.33}
              opacity={knuckles.opacity}
            />
          );
        });
      })}
      {runnerStick.gripThumbHooks.map((hook) => {
        const pad = padsByName.get(hook.padName);
        if (!pad) return null;

        return (
          <Capsule
            key={`thumb-hook-${hook.padName}`}
            args={[hook.radius, hook.length, 6, 12]}
            position={[pad.lateral + hook.offsetX, pad.shaftY + hook.offsetY, padDepth(pad) + hook.zOffset]}
            rotation={[Math.PI / 2, 0, pad.roll + hook.roll]}
            color={gloveHighlight}
            roughness={0.34}
            opacity={hook.opacity}
          />
        );
      })}
      {runnerStick.gripPalmSeams.map((seam) => {
        const pad = padsByName.get(seam.padName);
        if (!pad) return null;
        const center = (seam.count - 1) / 2;

        return Array.from({ length: seam.count }, (_, index) => {
          const offset = (index - center) * seam.spacing;

          return (
            <Capsule
              key={`palm-seam-${seam.padName}-${index}`}
              args={[seam.radius, seam.length, 6, 10]}
              position={[pad.lateral + offset, pad.shaftY + offset * 0.16, padDepth(pad) + seam.zOffset]}
              rotation={[Math.PI / 2, 0, pad.roll + seam.roll + offset * 1.9]}
              color={cuff}
              roughness={0.38}
              opacity={seam.opacity}
            />
          );
        });
      })}
      {runnerStick.gripKeeperStraps.map((strap) => {
        const pad = padsByName.get(strap.padName);
        if (!pad) return null;
        const center = (strap.count - 1) / 2;

        return Array.from({ length: strap.count }, (_, index) => {
          const offset = (index - center) * strap.spacing;

          return (
            <Capsule
              key={`keeper-strap-${strap.padName}-${index}`}
              args={[strap.radius, strap.length, 6, 10]}
              position={[
                pad.lateral + strap.offsetX + offset * 0.24,
                pad.shaftY + strap.offsetY + offset * 0.12,
                padDepth(pad) + strap.zOffset + Math.abs(offset) * 0.2,
              ]}
              rotation={[Math.PI / 2, 0, pad.roll + strap.roll + offset * 1.7]}
              color={cuff}
              roughness={0.36}
              opacity={strap.opacity}
            />
          );
        });
      })}
      <RoundedBand
        length={runnerStick.bladeWidth}
        radius={0.018}
        position={[0.2 + pass * 0.05, -0.91, 0.08]}
        rotation={[0, 0.35 + pass * 0.12, Math.PI / 2]}
        color="#111827"
        roughness={0.4}
        opacity={0.98}
      />
      <RoundedBand
        length={0.16}
        radius={0.018}
        position={[0.43 + pass * 0.05, -0.87, 0.08]}
        rotation={[0, 0.35 + pass * 0.12, Math.PI / 2]}
        color={tape}
        roughness={0.34}
        opacity={0.98}
      />
      {runnerStick.bladePocketRails.map((rail) => (
        <RoundedBand
          key={`blade-pocket-${rail.name}`}
          length={rail.length}
          radius={rail.radius}
          position={[
            rail.position[0] + pass * 0.05,
            rail.position[1] + pass * 0.02,
            rail.position[2],
          ]}
          rotation={[
            rail.rotation[0],
            rail.rotation[1] + pass * 0.08,
            rail.rotation[2] + pass * 0.05,
          ]}
          color={rail.color === 'tape' ? tape : REPLAY_COLORS.stick}
          roughness={rail.color === 'tape' ? 0.34 : 0.4}
          opacity={rail.opacity}
        />
      ))}
      {bladeContactGuides.map((guide) => (
        <RoundedBand
          key={`blade-contact-${guide.name}`}
          length={guide.length}
          radius={guide.radius}
          position={guide.position}
          rotation={guide.rotation}
          color={guide.color === 'tape' ? tape : REPLAY_COLORS.stick}
          roughness={guide.color === 'tape' ? 0.32 : 0.38}
          opacity={guide.opacity}
        />
      ))}
    </group>
  );
}

function RunnerStickBodySleeves({ stride = 0, team = 'us', uniform, action = 'idle-ready', intensity = 0, speedMps = 0, mode = 'full' }) {
  const runnerStick = STICK_CONTACT_PROFILE.runner;
  const mount = resolveRunnerStickMount({ action, intensity, stride });
  const closeContactRig = resolveRunnerCloseContactRig({ action, intensity, speedMps, stride });
  const showFullBridge = mode === 'full';
  const armSegments = closeContactRig.handAssemblies.map((assembly) => assembly.arm).filter(Boolean);
  const jointCapsByPad = new Map(runnerStick.stickArmJointCaps.map((cap) => [cap.padName, cap]));
  const gear = resolveControlledStickGearColors(team, uniform);
  const sleeveColor = gear.sleeve;
  const cuffColor = gear.cuff;
  const gloveColor = gear.glove;
  const gloveHighlight = gear.gloveHighlight;

  return (
    <group>
      {showFullBridge && armSegments.map((segment) => (
        <group key={`articulated-arm-${segment.padName}`}>
          {(() => {
            const cap = jointCapsByPad.get(segment.padName);
            if (!cap) return null;
            const side = segment.padName === 'topHand' ? -1 : 1;
            const wristPosition = [
              segment.hand[0] + side * Math.abs(cap.wristOffset[0]),
              segment.hand[1] + cap.wristOffset[1],
              segment.hand[2] + cap.wristOffset[2],
            ];

            return (
              <>
                <Ellipsoid
                  scale={[cap.elbowRadius * 1.08, cap.elbowRadius, cap.elbowRadius * 0.88]}
                  position={segment.elbow}
                  rotation={[0.1, 0, side * 0.18]}
                  color={cuffColor}
                  roughness={0.44}
                  opacity={cap.opacity}
                />
                <Ellipsoid
                  scale={[cap.wristRadius * 1.12, cap.wristRadius * 0.92, cap.wristRadius]}
                  position={wristPosition}
                  rotation={[0.12, 0, side * -0.24]}
                  color={gloveColor}
                  roughness={0.36}
                  opacity={cap.opacity}
                />
              </>
            );
          })()}
          <SegmentCapsule
            from={segment.shoulder}
            to={segment.elbow}
            radius={segment.upperArmRadius}
            color={sleeveColor}
            roughness={0.56}
            opacity={segment.opacity}
          />
          <SegmentCapsule
            from={segment.elbow}
            to={segment.hand}
            radius={segment.forearmRadius}
            color={sleeveColor}
            roughness={0.54}
            opacity={segment.opacity}
          />
          <SegmentCapsule
            from={interpolatePoint(segment.elbow, segment.hand, 0.62)}
            to={segment.hand}
            radius={segment.forearmRadius * 0.74}
            color={cuffColor}
            roughness={0.44}
            opacity={0.84}
          />
        </group>
      ))}
      {showFullBridge && closeContactRig.handAssemblies.map((assembly) => {
        const cap = assembly.shoulderCap;
        if (!cap) return null;

        return (
          <group key={`shoulder-cap-${assembly.padName}`}>
            <Capsule
              args={[cap.radius, cap.length, 8, 14]}
              position={cap.position}
              rotation={cap.rotation}
              color={sleeveColor}
              roughness={0.54}
              opacity={cap.opacity}
            />
            <Capsule
              args={[cap.radius * 0.45, cap.length * 0.72, 6, 12]}
              position={[cap.position[0] + assembly.side * 0.015, cap.position[1] - 0.012, cap.position[2] + 0.035]}
              rotation={cap.rotation}
              color={cuffColor}
              roughness={0.46}
              opacity={0.82}
            />
          </group>
        );
      })}
      {showFullBridge && runnerStick.bodyElbowCaps.map((cap) => {
        const reach = mount.stickWork;
        const side = cap.side;
        const position = [
          cap.position[0] + side * reach * 0.025,
          cap.position[1] - mount.pass * 0.04 - mount.receive * 0.018,
          cap.position[2] + reach * 0.035,
        ];
        const rotation = [
          cap.rotation[0] - mount.pass * 0.08 + mount.receive * 0.04,
          cap.rotation[1],
          cap.rotation[2] + side * mount.handleSweep * 0.04,
        ];

        return (
          <Capsule
            key={cap.side}
            args={[cap.radius, cap.length, 8, 14]}
            position={position}
            rotation={rotation}
            color={gloveColor}
            roughness={0.42}
            opacity={cap.opacity}
          />
        );
      })}
      {closeContactRig.handAssemblies.map((assembly) => {
        return (
          <group key={assembly.padName}>
            {showFullBridge && assembly.armSilhouette && (
              <SegmentCapsule
                from={assembly.armSilhouette.from}
                to={assembly.armSilhouette.to}
                radius={assembly.armSilhouette.radius}
                color={sleeveColor}
                roughness={0.58}
                opacity={assembly.armSilhouette.opacity}
              />
            )}
            {showFullBridge && assembly.armStripeBands.map((band) => (
              <SegmentCapsule
                key={`arm-stripe-${band.name}`}
                from={band.from}
                to={band.to}
                radius={band.radius}
                color={cuffColor}
                roughness={0.44}
                opacity={band.opacity}
              />
            ))}
            {showFullBridge && assembly.armYoke && (
              <SegmentCapsule
                from={assembly.armYoke.from}
                to={assembly.armYoke.to}
                radius={assembly.armYoke.radius}
                color={sleeveColor}
                roughness={0.55}
                opacity={assembly.armYoke.opacity}
              />
            )}
            {showFullBridge && assembly.upperArmBridge && (
              <SegmentCapsule
                from={assembly.upperArmBridge.from}
                to={assembly.upperArmBridge.to}
                radius={assembly.upperArmBridge.radius}
                color={sleeveColor}
                roughness={0.54}
                opacity={assembly.upperArmBridge.opacity}
              />
            )}
            {showFullBridge && assembly.torsoAnchor && (
              <SegmentCapsule
                from={assembly.torsoAnchor.from}
                to={assembly.torsoAnchor.to}
                radius={assembly.torsoAnchor.radius}
                color={sleeveColor}
                roughness={0.58}
                opacity={assembly.torsoAnchor.opacity}
              />
            )}
            {showFullBridge && assembly.torsoArmOverlap && (
              <SegmentCapsule
                from={assembly.torsoArmOverlap.from}
                to={assembly.torsoArmOverlap.to}
                radius={assembly.torsoArmOverlap.radius}
                color={sleeveColor}
                roughness={0.58}
                opacity={assembly.torsoArmOverlap.opacity}
              />
            )}
            {showFullBridge && (
              <>
                <SegmentCapsule
                  from={assembly.bodySleeve.from}
                  to={assembly.bodySleeve.to}
                  radius={assembly.bodySleeve.radius}
                  color={sleeveColor}
                  roughness={0.56}
                  opacity={assembly.bodySleeve.opacity}
                />
                <SegmentCapsule
                  from={assembly.cuffSleeve.from}
                  to={assembly.cuffSleeve.to}
                  radius={assembly.cuffSleeve.radius}
                  color={cuffColor}
                  roughness={0.48}
                  opacity={assembly.cuffSleeve.opacity}
                />
              </>
            )}
            <SegmentCapsule
              from={assembly.forearmLock.from}
              to={assembly.forearmLock.to}
              radius={assembly.forearmLock.radius}
              color={gloveColor}
              roughness={0.38}
              opacity={assembly.forearmLock.opacity}
            />
            {assembly.forearmBridge && (
              <SegmentCapsule
                from={assembly.forearmBridge.from}
                to={assembly.forearmBridge.to}
                radius={assembly.forearmBridge.radius}
                color={cuffColor}
                roughness={0.42}
                opacity={assembly.forearmBridge.opacity}
              />
            )}
            <SegmentCapsule
              from={assembly.gripWristWeb.from}
              to={assembly.gripWristWeb.to}
              radius={assembly.gripWristWeb.radius}
              color={gloveColor}
              roughness={0.36}
              opacity={assembly.gripWristWeb.opacity}
            />
            {assembly.wristGasket && (
              <Ellipsoid
                scale={assembly.wristGasket.scale}
                position={assembly.wristGasket.position}
                rotation={[Math.PI / 2, 0, assembly.side * 0.2 + assembly.wristGasket.roll]}
                color={cuffColor}
                roughness={0.38}
                opacity={assembly.wristGasket.opacity}
              />
            )}
            {assembly.gripPinchPad && (
              <Ellipsoid
                scale={assembly.gripPinchPad.scale}
                position={assembly.gripPinchPad.position}
                rotation={[Math.PI / 2, 0, assembly.side * 0.34 + assembly.gripPinchPad.roll]}
                color={gloveColor}
                roughness={0.34}
                opacity={assembly.gripPinchPad.opacity}
              />
            )}
            {assembly.gripCompressionPocket && (
              <Ellipsoid
                scale={assembly.gripCompressionPocket.scale}
                position={assembly.gripCompressionPocket.position}
                rotation={[Math.PI / 2, 0, assembly.side * 0.26 + assembly.gripCompressionPocket.roll]}
                color="#020617"
                roughness={0.44}
                opacity={assembly.gripCompressionPocket.opacity}
              />
            )}
            {assembly.gripContactSeam && (
              <SegmentCapsule
                from={assembly.gripContactSeam.from}
                to={assembly.gripContactSeam.to}
                radius={assembly.gripContactSeam.radius}
                color={gloveHighlight}
                roughness={0.34}
                opacity={assembly.gripContactSeam.opacity}
              />
            )}
            <Capsule
              args={[assembly.bodySleeve.radius * 1.28, 0.13, 8, 14]}
              position={assembly.handTarget}
              rotation={[Math.PI / 2, 0, assembly.side * 0.28]}
              color={gloveColor}
              roughness={0.38}
              opacity={0.92}
            />
          </group>
        );
      })}
    </group>
  );
}

function JerseyNumber({ player, color = '#0f172a' }) {
  const number = getJerseyNumber(player);

  if (!RUNTIME_UNIFORM_TEXT_PROFILE.enabled) return null;

  return (
    <Text
      position={[0, 1.23, 0.36]}
      rotation={[0, 0, 0]}
      fontSize={0.22}
      color={color}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.006}
      outlineColor="#f8fafc"
      outlineOpacity={0.35}
    >
      {number}
    </Text>
  );
}

function ProductionUniformDetails({ player }) {
  const colors = getUniformIdentityColors(player);
  const number = getJerseyNumber(player);
  const detail = CLOSE_CAMERA_UNIFORM_DETAIL_PROFILE;
  const showText = RUNTIME_UNIFORM_TEXT_PROFILE.enabled;

  return (
    <group>
      <RoundedBand length={detail.chestAccent.length} radius={detail.chestAccent.radius} position={[0, 1.18, 0.39]} color={colors.accent} opacity={detail.chestAccent.opacity} />
      <RoundedBand length={detail.waistAccent.length} radius={detail.waistAccent.radius} position={[0, 0.97, 0.38]} color={colors.accent} opacity={detail.waistAccent.opacity} />
      <RoundedBand length={detail.shoulderAccent.length} radius={detail.shoulderAccent.radius} position={[-0.35, 1.24, 0.34]} rotation={[0, 0, Math.PI / 2 + 0.1]} color={colors.accent} opacity={detail.shoulderAccent.opacity} />
      <RoundedBand length={detail.shoulderAccent.length} radius={detail.shoulderAccent.radius} position={[0.35, 1.24, 0.34]} rotation={[0, 0, Math.PI / 2 - 0.1]} color={colors.accent} opacity={detail.shoulderAccent.opacity} />
      <RoundedBand length={detail.helmetStripe.length} radius={detail.helmetStripe.radius} position={[0, 1.7, 0.18]} color={colors.helmetStripe} roughness={0.32} opacity={detail.helmetStripe.opacity} />
      {showText && (
        <>
          <Text
            position={[0, 1.29, 0.425]}
            rotation={[0, 0, 0]}
            fontSize={0.18}
            color={colors.number}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.007}
            outlineColor={colors.outline}
          >
            {number}
          </Text>
          <Text
            position={[0, 1.08, 0.425]}
            rotation={[0, 0, 0]}
            fontSize={0.12}
            color={colors.crest}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.006}
            outlineColor={colors.outline}
          >
            GS
          </Text>
          <Text
            position={[0, 1.22, -0.32]}
            rotation={[0, Math.PI, 0]}
            fontSize={0.24}
            color={colors.number}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.009}
            outlineColor={colors.outline}
          >
            {number}
          </Text>
        </>
      )}
    </group>
  );
}

function RunnerCloseFootGear({ player, stride }) {
  const colors = getUniformIdentityColors(player);
  const soleColor = player.team === 'us' ? '#020617' : '#111827';
  const guardColor = player.team === 'us' ? '#e2e8f0' : '#fee2e2';

  return (
    <group>
      {RUNNER_CLOSE_GEAR_PROFILE.shinGuards.map((guard) => {
        const strideOffset = stride * guard.strideDepth * -guard.side;
        const base = [
          guard.basePosition[0],
          guard.basePosition[1],
          guard.basePosition[2] + strideOffset,
        ];
        const rotation = [0.12 + stride * 0.035 * -guard.side, 0, guard.side * -0.055];

        return (
          <group key={`shin-${guard.side}`}>
            <Ellipsoid
              scale={guard.scale}
              position={base}
              rotation={rotation}
              color={guardColor}
              roughness={0.54}
              opacity={guard.opacity}
            />
            <RoundedBand
              length={guard.strapLength}
              radius={guard.strapRadius}
              position={[base[0], base[1] + 0.035, base[2] + 0.048]}
              rotation={[0, 0, Math.PI / 2 + guard.side * 0.08]}
              color={colors.accent}
              roughness={0.42}
              opacity={0.78}
            />
            <RoundedBand
              length={guard.strapLength * 0.9}
              radius={guard.strapRadius}
              position={[base[0], base[1] - 0.05, base[2] + 0.045]}
              rotation={[0, 0, Math.PI / 2 - guard.side * 0.04]}
              color="#0f172a"
              roughness={0.44}
              opacity={0.64}
            />
          </group>
        );
      })}
      {RUNNER_CLOSE_GEAR_PROFILE.kneeCaps.map((cap) => {
        const strideOffset = stride * cap.strideDepth * -cap.side;
        const base = [
          cap.basePosition[0],
          cap.basePosition[1],
          cap.basePosition[2] + strideOffset,
        ];

        return (
          <Ellipsoid
            key={`knee-${cap.side}`}
            scale={cap.scale}
            position={base}
            rotation={[0.16 + stride * 0.025 * -cap.side, 0, cap.side * -0.08]}
            color={guardColor}
            roughness={0.5}
            opacity={cap.opacity}
          />
        );
      })}
      {RUNNER_CLOSE_GEAR_PROFILE.shoes.map((shoe) => {
        const strideOffset = stride * shoe.strideDepth * -shoe.side;
        const base = [
          shoe.basePosition[0],
          shoe.basePosition[1],
          shoe.basePosition[2] + strideOffset,
        ];
        const rotation = [0.08 + stride * 0.035 * -shoe.side, 0, shoe.side * -0.07];
        const laceCenter = (shoe.laceCount - 1) / 2;

        return (
          <group key={shoe.side}>
            <Ellipsoid
              scale={shoe.upperScale}
              position={base}
              rotation={rotation}
              color={soleColor}
              roughness={0.42}
              opacity={shoe.opacity}
            />
            <Ellipsoid
              scale={shoe.toeScale}
              position={[base[0], base[1] + 0.004, base[2] + 0.105]}
              rotation={rotation}
              color="#0f172a"
              roughness={0.38}
              opacity={0.94}
            />
            <Ellipsoid
              scale={shoe.heelScale}
              position={[base[0], base[1] + 0.003, base[2] - 0.1]}
              rotation={rotation}
              color="#020617"
              roughness={0.46}
              opacity={0.88}
            />
            {Array.from({ length: shoe.laceCount }, (_, index) => {
              const offset = (index - laceCenter) * 0.038;

              return (
                <RoundedBand
                  key={`${shoe.side}-lace-${index}`}
                  length={0.108}
                  radius={shoe.laceRadius}
                  position={[base[0], base[1] + 0.039, base[2] + 0.012 + offset]}
                  rotation={[0, 0, Math.PI / 2 + shoe.side * 0.06]}
                  color={colors.accent}
                  roughness={0.36}
                  opacity={0.76}
                />
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

function RunnerCloseHeadGear({ player }) {
  const colors = getUniformIdentityColors(player);
  const headGear = RUNNER_CLOSE_GEAR_PROFILE.headGear;
  const cageColor = player.team === 'us' ? '#0f172a' : '#111827';

  return (
    <group>
      {headGear.earGuards.map((guard) => (
        <Ellipsoid
          key={`ear-guard-${guard.side}`}
          scale={guard.scale}
          position={guard.position}
          rotation={guard.rotation}
          color={cageColor}
          roughness={0.32}
          opacity={guard.opacity}
        />
      ))}
      {headGear.cageBars.map((bar, index) => (
        <RoundedBand
          key={`cage-${index}`}
          length={bar.length}
          radius={bar.radius}
          position={bar.position}
          rotation={bar.rotation}
          color={cageColor}
          roughness={0.34}
          opacity={bar.opacity}
        />
      ))}
      <RoundedBand
        length={headGear.chinStrap.length}
        radius={headGear.chinStrap.radius}
        position={headGear.chinStrap.position}
        rotation={headGear.chinStrap.rotation}
        color={colors.accent}
        roughness={0.42}
        opacity={headGear.chinStrap.opacity}
      />
    </group>
  );
}

function RunnerShell({ player, stride, minimal }) {
  const uniform = player.uniform ?? {};
  const jersey = uniform.jersey ?? TEAM_COLORS[player.team];
  const stripe = uniform.stripe ?? '#ffffff';
  const shorts = uniform.shorts ?? '#111827';
  const sockColor = player.team === 'us' ? '#f8fafc' : '#fee2e2';

  if (minimal) {
    return (
      <>
        <Box args={[0.62, 0.055, 0.026]} position={[0, 1.18, 0.34]} color={stripe} roughness={0.38} opacity={0.92} />
        <Box args={[0.4, 0.04, 0.022]} position={[0, 0.96, 0.35]} color={stripe} roughness={0.42} opacity={0.82} />
        <Box args={[0.22, 0.038, 0.022]} position={[-0.34, 1.24, 0.31]} rotation={[0, 0, 0.08]} color={stripe} roughness={0.4} opacity={0.86} />
        <Box args={[0.22, 0.038, 0.022]} position={[0.34, 1.24, 0.31]} rotation={[0, 0, -0.08]} color={stripe} roughness={0.4} opacity={0.86} />
      </>
    );
  }

  return (
    <>
      <Capsule args={[0.16, 0.48, 10, 18]} position={[0, 1.08, 0.04]} rotation={[0.08, 0, 0]} color={jersey} roughness={0.5} />
      <Capsule args={[0.06, 0.5, 8, 14]} position={[0, 1.28, 0.04]} rotation={[0, 0, Math.PI / 2]} color={jersey} roughness={0.48} />
      <Capsule args={[0.15, 0.2, 8, 14]} position={[0, 0.78, 0.04]} rotation={[0, 0, Math.PI / 2]} color={shorts} roughness={0.54} />
      <Capsule
        args={[0.045, 0.34, 8, 12]}
        position={[-0.18, 0.52, 0.06 + stride * 0.055]}
        rotation={[0.08 + stride * 0.08, 0, 0.08]}
        color={sockColor}
        roughness={0.48}
      />
      <Capsule
        args={[0.045, 0.34, 8, 12]}
        position={[0.18, 0.52, 0.06 - stride * 0.055]}
        rotation={[0.08 - stride * 0.08, 0, -0.08]}
        color={sockColor}
        roughness={0.48}
      />
      <Box args={[0.15, 0.05, 0.24]} position={[-0.18, 0.2, 0.13 + stride * 0.05]} rotation={[0.08, 0, 0.08]} color="#111827" roughness={0.42} />
      <Box args={[0.15, 0.05, 0.24]} position={[0.18, 0.2, 0.13 - stride * 0.05]} rotation={[0.08, 0, -0.08]} color="#111827" roughness={0.42} />
      <Box args={[0.46, 0.045, 0.018]} position={[0, 1.17, 0.32]} color={stripe} roughness={0.36} opacity={0.9} />
    </>
  );
}

function RunnerHelmet({ helmet, stripe }) {
  return (
    <>
      <mesh position={[0, 1.7, 0.035]} castShadow>
        <sphereGeometry args={[0.185, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.68]} />
        <meshStandardMaterial color={helmet} roughness={0.28} metalness={0.05} />
      </mesh>
      <Box args={[0.31, 0.032, 0.042]} position={[0, 1.7, 0.15]} color={stripe} roughness={0.32} />
      <Box args={[0.29, 0.018, 0.025]} position={[0, 1.62, 0.225]} color="#111827" roughness={0.22} />
      <Box args={[0.23, 0.014, 0.024]} position={[-0.1, 1.58, 0.23]} rotation={[0, 0, 0.22]} color="#111827" roughness={0.22} />
      <Box args={[0.23, 0.014, 0.024]} position={[0.1, 1.58, 0.23]} rotation={[0, 0, -0.22]} color="#111827" roughness={0.22} />
    </>
  );
}

function RunnerEquipment({ player, stride, minimal = false, speedMps = 0 }) {
  const uniform = player.uniform ?? {};
  const helmet = uniform.helmet ?? uniform.jersey ?? TEAM_COLORS[player.team];
  const stripe = uniform.stripe ?? '#ffffff';
  const jersey = uniform.jersey ?? TEAM_COLORS[player.team];
  const gloveColor = resolveControlledStickGearColors(player.team, player.uniform).glove;
  const pass = actionAmount(player, 'forehand-pass');
  const receive = actionAmount(player, 'receive-pass');
  const handle = actionAmount(player, 'stick-handle');
  const handleSweep = Math.sin((player.time ?? 0) * 12.5) * handle;

  return (
    <group>
      <RunnerShell player={player} stride={stride} minimal={minimal} />
      <Capsule
        args={[0.04, 0.24, 8, 12]}
        position={[-0.28 - receive * 0.05, 1.1 - pass * 0.08, 0.16 + pass * 0.09]}
        rotation={[0.5 + stride * 0.08 - pass * 0.18, 0, 0.18 - pass * 0.1 + handleSweep * 0.06]}
        color={jersey}
      />
      <Capsule
        args={[0.04, 0.24, 8, 12]}
        position={[0.28 + receive * 0.05, 1.08 - pass * 0.1 - receive * 0.05, 0.14 + pass * 0.12 + receive * 0.05]}
        rotation={[0.48 - stride * 0.06 - pass * 0.26, 0, -0.18 + pass * 0.12 - handleSweep * 0.06]}
        color={jersey}
      />
      <Capsule
        args={[0.035, 0.22, 8, 12]}
        position={[-0.32 - receive * 0.05, 0.89 - pass * 0.1, 0.24 + pass * 0.16 + receive * 0.04]}
        rotation={[0.84 - pass * 0.28, 0.08, -0.08 - pass * 0.15 + handleSweep * 0.1]}
        color={jersey}
      />
      <Capsule
        args={[0.035, 0.22, 8, 12]}
        position={[0.32 + receive * 0.06, 0.88 - pass * 0.13 - receive * 0.03, 0.2 + pass * 0.22 + receive * 0.08]}
        rotation={[0.76 - pass * 0.38 - receive * 0.08, -0.08, 0.08 + pass * 0.18 - handleSweep * 0.1]}
        color={uniform.jersey ?? TEAM_COLORS[player.team]}
      />
      <RunnerHelmet helmet={helmet} stripe={stripe} />
      <JerseyNumber player={player} color={player.team === 'us' ? '#1d4ed8' : '#fee2e2'} />
      <Capsule
        args={[0.048, 0.12, 8, 12]}
        position={[-0.4 - receive * 0.06, 0.82 - pass * 0.12, 0.24 + pass * 0.2 + receive * 0.05]}
        rotation={[Math.PI / 2 + 0.18 - pass * 0.18, 0.04, 0.18 - pass * 0.18 + handleSweep * 0.08]}
        color={gloveColor}
        roughness={0.38}
      />
      <Capsule
        args={[0.024, 0.1, 6, 12]}
        position={[-0.34 - receive * 0.06, 0.8 - pass * 0.12, 0.24 + pass * 0.19 + receive * 0.05]}
        rotation={[Math.PI / 2 + 0.1 - pass * 0.12, 0.03, 0.28 - pass * 0.12 + handleSweep * 0.06]}
        color={stripe}
        roughness={0.46}
      />
      <Capsule
        args={[0.05, 0.12, 8, 12]}
        position={[0.4 + receive * 0.08, 0.82 - pass * 0.16 - receive * 0.05, 0.2 + pass * 0.26 + receive * 0.09]}
        rotation={[Math.PI / 2 + 0.16 - pass * 0.24 - receive * 0.08, -0.04, -0.18 + pass * 0.2 - handleSweep * 0.08]}
        color={gloveColor}
        roughness={0.38}
      />
      <Capsule
        args={[0.025, 0.1, 6, 12]}
        position={[0.34 + receive * 0.08, 0.8 - pass * 0.15 - receive * 0.05, 0.2 + pass * 0.25 + receive * 0.09]}
        rotation={[Math.PI / 2 + 0.08 - pass * 0.16 - receive * 0.08, -0.03, -0.28 + pass * 0.12 - handleSweep * 0.06]}
        color={stripe}
        roughness={0.46}
      />
      <Stick
        stride={stride}
        team={player.team}
        uniform={player.uniform}
        action={player.action}
        intensity={player.actionIntensity ?? 0}
        speedMps={speedMps}
      />
    </group>
  );
}

function GoalieEquipment({ player }) {
  const uniform = player.uniform ?? {};
  const helmet = uniform.helmet ?? TEAM_COLORS[player.team];
  const jersey = uniform.jersey ?? TEAM_COLORS[player.team];
  const stripe = uniform.stripe ?? '#ffffff';

  return (
    <group>
      <mesh position={[0, 1.66, 0.06]} castShadow>
        <sphereGeometry args={[0.24, 32, 20]} />
        <meshStandardMaterial color={helmet} roughness={0.32} metalness={0.04} />
      </mesh>
      <Box args={[0.38, 0.045, 0.05]} position={[0, 1.68, 0.2]} color={stripe} roughness={0.32} />
      <Box args={[0.34, 0.05, 0.04]} position={[0, 1.63, 0.29]} color="#111827" roughness={0.26} />
      <Box args={[0.62, 0.12, 0.035]} position={[0, 1.18, 0.34]} color={stripe} roughness={0.34} />
      <JerseyNumber player={player} color={player.team === 'us' ? '#1d4ed8' : '#fee2e2'} />
      <Box args={[0.26, 0.72, 0.36]} position={[-0.32, 0.32, 0.18]} rotation={[0.1, 0, 0.08]} color="#f8fafc" roughness={0.52} />
      <Box args={[0.26, 0.72, 0.36]} position={[0.32, 0.32, 0.18]} rotation={[0.1, 0, -0.08]} color="#f8fafc" roughness={0.52} />
      <Box args={[0.32, 0.66, 0.24]} position={[-0.62, 0.94, 0.12]} rotation={[0.08, 0, -0.44]} color="#f8fafc" roughness={0.54} />
      <Box args={[0.32, 0.66, 0.24]} position={[0.62, 0.94, 0.12]} rotation={[0.08, 0, 0.44]} color="#f8fafc" roughness={0.54} />
      <Box args={[0.22, 0.2, 0.3]} position={[-0.8, 0.62, 0.32]} color="#111827" roughness={0.46} />
      <Box args={[0.3, 0.22, 0.24]} position={[0.82, 0.68, 0.34]} color="#111827" roughness={0.46} />
      <Box args={[0.24, 0.16, 0.18]} position={[-0.34, 1.13, 0.18]} rotation={[0.1, 0, -0.18]} color={jersey} roughness={0.5} />
      <Box args={[0.24, 0.16, 0.18]} position={[0.34, 1.13, 0.18]} rotation={[0.1, 0, 0.18]} color={jersey} roughness={0.5} />
      <Capsule args={[0.06, 0.32, 8, 12]} position={[-0.42, 0.95, 0.28]} rotation={[0.72, 0, -0.32]} color={jersey} />
      <Capsule args={[0.06, 0.32, 8, 12]} position={[0.42, 0.96, 0.26]} rotation={[0.72, 0, 0.32]} color={jersey} />
      <Stick goalie team={player.team} />
    </group>
  );
}

function productionClipForAction(player) {
  if (player.role === 'G') {
    return player.action === 'goalie-slide' ? 'goalie-slide' : 'goalie-ready';
  }

  if (player.action === 'sprint-forward') return 'sprint-forward';
  if (player.action === 'jog-forward') return 'jog-forward';
  if (player.action === 'stick-handle') return 'stick-handle';
  if (player.action === 'forehand-pass') return 'forehand-pass';
  if (player.action === 'receive-pass') return 'receive-pass';
  if (player.action === 'wrist-shot') return 'wrist-shot';
  return 'idle-ready';
}

function chooseAction(actions, preferred, role) {
  const fallbackNames = role === 'G'
    ? [preferred, 'goalie-ready', 'idle-ready']
    : [preferred, 'jog-forward', 'idle-ready'];

  for (const name of fallbackNames) {
    if (actions[name]) return actions[name];
  }

  return Object.values(actions).find(Boolean);
}

function bridgeClipForAction(player) {
  if (player.role === 'G') return 'Idle';
  if (player.action === 'idle-ready') return 'Idle';
  if (player.action === 'sprint-forward') return 'Run';
  if (player.action === 'jog-forward') return player.actionIntensity > 0.62 ? 'Run' : 'Walk';
  if (player.action === 'stick-handle') return player.speedMps > 2.6 ? 'Run' : 'Walk';
  if (player.action === 'forehand-pass' || player.action === 'receive-pass') return player.speedMps > 3 ? 'Run' : 'Walk';
  return player.speedMps > 1 ? 'Walk' : 'Idle';
}

function chooseBridgeAction(actions, clipName) {
  const fallbackNames = clipName === 'Run'
    ? ['Run', 'Walk', 'Idle']
    : (clipName === 'Walk' ? ['Walk', 'Run', 'Idle'] : ['Idle', 'Walk', 'Run']);

  for (const name of fallbackNames) {
    if (actions[name]) return actions[name];
  }

  return Object.values(actions).find(Boolean);
}

function deterministicPhase(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return hash / 997;
}

function shouldPhaseProductionAction(actionName) {
  return actionName === 'idle-ready'
    || actionName === 'jog-forward'
    || actionName === 'sprint-forward'
    || actionName === 'stick-handle';
}

const STICK_ACTION_PRODUCTION_RUNNER_ACTIONS = new Set([
  'stick-handle',
  'forehand-pass',
  'receive-pass',
  'wrist-shot',
]);

const STABILIZED_PRODUCTION_RUNNER_ACTIONS = new Set([
  'idle-ready',
  'jog-forward',
  'sprint-forward',
  ...STICK_ACTION_PRODUCTION_RUNNER_ACTIONS,
]);

export function shouldApplyProductionRunnerPoseLayer(player = {}, rigAsset = {}) {
  if (player.role === 'G') return false;
  if (
    rigAsset.requiresPoseCorrection === false
    || rigAsset.isFinalGradeMotion === true
    || rigAsset.retargetMotionQuality === 'final-grade-motion'
  ) return false;
  return STABILIZED_PRODUCTION_RUNNER_ACTIONS.has(player.action ?? 'idle-ready');
}

function ProductionAthleteBody({ player, rigAsset, stride, showCloseDetail = false }) {
  const rootRef = useRef(null);
  const previousAction = useRef(null);
  const { scene, animations } = useGLTF(rigAsset.url);
  const materialPlayer = useMemo(() => ({
    team: player.team,
    role: player.role,
    uniform: {
      helmet: player.uniform?.helmet,
      jersey: player.uniform?.jersey,
      shorts: player.uniform?.shorts,
      stripe: player.uniform?.stripe,
    },
  }), [
    player.team,
    player.role,
    player.uniform?.helmet,
    player.uniform?.jersey,
    player.uniform?.shorts,
    player.uniform?.stripe,
  ]);
  const clone = useMemo(() => {
    const next = skeletonClone(scene);
    applyProductionUniformMaterials(next, materialPlayer);
    hideProductionRigParts(
      next,
      materialPlayer.role === 'G'
        ? HIDDEN_PRODUCTION_GOALIE_PARTS
        : getHiddenProductionRunnerParts(showCloseDetail, rigAsset),
    );
    return next;
  }, [scene, materialPlayer, showCloseDetail, rigAsset]);
  const { actions, mixer } = useAnimations(animations, clone);
  const rig = useMemo(() => collectRig(clone), [clone]);
  const activeClip = productionClipForAction(player);
  const isGoalie = player.role === 'G';
  const playerPhase = useMemo(() => deterministicPhase(player.id), [player.id]);
  const closeStickBridgeMode = resolveRunnerStickBodySleeveMode(showCloseDetail, rigAsset);

  useEffect(() => {
    const action = chooseAction(actions, activeClip, player.role);
    if (!action) return undefined;

    if (previousAction.current && previousAction.current !== action) {
      previousAction.current.fadeOut(0.14);
    }

    action.reset().fadeIn(0.14).play();
    if (shouldPhaseProductionAction(activeClip)) {
      const duration = action.getClip().duration || 1;
      action.time = (duration * playerPhase) % duration;
    }
    previousAction.current = action;
    return undefined;
  }, [actions, activeClip, player.role, playerPhase]);

  useEffect(() => () => {
    Object.values(actions).forEach((action) => action?.stop());
  }, [actions]);

  useFrame((_, delta) => {
    if (mixer) {
      const animationSpeed = isGoalie ? 0.85 : THREE.MathUtils.clamp(player.speedMps / 2.7, 0.72, 1.9);
      mixer.update(delta * animationSpeed);
    }

    if (shouldApplyProductionRunnerPoseLayer(player, rigAsset, { showCloseDetail })) {
      applyRunnerPose(rig, player, stride);
    }

    if (rootRef.current) {
      rootRef.current.rotation.x = isGoalie ? -0.04 : -0.06 - Math.min(0.08, player.speedMps * 0.012);
      rootRef.current.rotation.y = Math.PI;
      rootRef.current.rotation.z = isGoalie ? 0 : stride * 0.018;
    }
  });

  return (
    <group
      ref={rootRef}
      scale={(rigAsset.scale ?? 1) * (isGoalie ? GOALIE_SCALE : ATHLETE_SCALE)}
      position={[0, isGoalie ? 1.1 : PRODUCTION_RUNNER_GROUND_Y, 0]}
      rotation={[0, Math.PI, 0]}
    >
      <primitive object={clone} />
      {!isGoalie && <ProductionUniformDetails player={player} />}
      {!isGoalie && showCloseDetail && <RunnerCloseHeadGear player={player} />}
      {!isGoalie && closeStickBridgeMode !== 'hidden' && (
        <RunnerStickBodySleeves
          stride={stride}
          team={player.team}
          uniform={player.uniform}
          action={player.action}
          intensity={player.actionIntensity ?? 0}
          speedMps={player.speedMps}
          mode={closeStickBridgeMode}
        />
      )}
      {!isGoalie && (
        <Stick
          stride={stride}
          team={player.team}
          uniform={player.uniform}
          action={player.action}
          intensity={player.actionIntensity ?? 0}
          speedMps={player.speedMps}
        />
      )}
    </group>
  );
}

function BridgeAthleteBody({ player, stride, rigAsset }) {
  const rootRef = useRef(null);
  const previousAction = useRef(null);
  const { scene } = useGLTF(rigAsset.url);
  const { animations: sourceAnimations } = useGLTF(rigAsset.animationSource);
  const uniform = player.uniform ?? {};
  const uniformTint = useMemo(() => ({
    helmet: uniform.helmet,
    jersey: uniform.jersey,
    shorts: uniform.shorts,
    stripe: uniform.stripe,
  }), [uniform.helmet, uniform.jersey, uniform.shorts, uniform.stripe]);
  const playerTeam = player.team;
  const clone = useMemo(() => {
    const next = skeletonClone(scene);
    tintModel(next, playerTeam, uniformTint);
    return next;
  }, [scene, playerTeam, uniformTint]);
  const rig = useMemo(() => collectRig(clone), [clone]);
  const isGoalie = player.role === 'G';
  const animations = useMemo(() => retargetAnimationClips(sourceAnimations, clone, rigAsset.sourcePrefix), [sourceAnimations, clone, rigAsset.sourcePrefix]);
  const { actions, mixer } = useAnimations(animations, clone);
  const activeClip = bridgeClipForAction(player);
  const playerPhase = useMemo(() => deterministicPhase(player.id), [player.id]);

  useEffect(() => {
    const action = chooseBridgeAction(actions, activeClip);
    if (!action) return undefined;

    if (previousAction.current && previousAction.current !== action) {
      previousAction.current.fadeOut(0.18);
    }

    action.reset();
    const duration = action.getClip().duration || 1;
    action.time = (duration * playerPhase) % duration;
    action.fadeIn(0.18).play();
    previousAction.current = action;
    return undefined;
  }, [actions, activeClip, playerPhase]);

  useEffect(() => () => {
    Object.values(actions).forEach((action) => action?.stop());
  }, [actions]);

  useFrame((state, delta) => {
    if (mixer) {
      const idleSpeed = activeClip === 'Idle' ? 0.82 : 1;
      const animationSpeed = isGoalie
        ? 0.55
        : THREE.MathUtils.clamp(player.speedMps / 2.7, 0.75, 1.85) * idleSpeed;
      mixer.update(delta * animationSpeed);
    }

    if (isGoalie) {
      applyGoaliePose(rig);
    } else {
      applyRunnerPose(rig, player, stride);
    }

    if (rootRef.current) {
      rootRef.current.rotation.x = isGoalie ? -0.04 : -0.06 - Math.min(0.08, player.speedMps * 0.012);
      rootRef.current.rotation.y = Math.PI;
      rootRef.current.rotation.z = isGoalie ? 0 : stride * 0.018;
    }
  });

  return (
    <group
      ref={rootRef}
      scale={isGoalie ? GOALIE_SCALE : ATHLETE_SCALE}
      position={[0, rigAsset.positionY ?? (isGoalie ? 1.1 : 1.04), 0]}
      rotation={[0, Math.PI, 0]}
    >
      <primitive object={clone} />
      {rigAsset.overlay !== 'none' && (
        isGoalie ? <GoalieEquipment player={player} /> : (
          <RunnerEquipment
            player={player}
            stride={stride}
            minimal={rigAsset.overlay === 'minimalRunner'}
            speedMps={player.speedMps}
          />
        )
      )}
    </group>
  );
}

function RealAthleteBody({ player, stride, showCloseDetail = false }) {
  const rigAsset = getPlayerRigAsset(player);

  if (rigAsset.mode === 'production') {
    return (
      <ProductionAthleteBody
        player={player}
        rigAsset={rigAsset}
        stride={stride}
        showCloseDetail={showCloseDetail}
      />
    );
  }

  return <BridgeAthleteBody player={player} stride={stride} rigAsset={rigAsset} />;
}

export default function ReplayPlayer({ player, showLabel, cameraId = 'broadcast' }) {
  const groupRef = useRef(null);
  const target = useMemo(() => new THREE.Vector3(), []);
  const world = rinkToWorld({ ...player.position, height: PLAYER_VERTICAL_MOTION_PROFILE.worldHeight });
  const stridePower = Math.min(1.25, player.speedMps / 4);
  const stride = Math.sin((player.time ?? 0) * 9.5) * stridePower;
  const showCloseDetail = shouldRenderClosePlayerDetail(cameraId);

  useFrame(() => {
    if (!groupRef.current) return;
    target.set(world.x, world.y, world.z);
    groupRef.current.position.lerp(target, 0.34);
    groupRef.current.rotation.y = player.facing ?? 0;
  });

  return (
    <group ref={groupRef} position={[world.x, world.y, world.z]}>
      <PlayerGroundingCues player={player} stride={stride} />
      <RealAthleteBody player={player} stride={stride} showCloseDetail={showCloseDetail} />
      {showLabel && (
        <Text
          position={[0, 1.95, 0]}
          fontSize={0.25}
          color="#f8fafc"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.022}
          outlineColor="#020617"
        >
          {player.label}
        </Text>
      )}
    </group>
  );
}

useGLTF.preload(BRIDGE_MODEL_URL);
useGLTF.preload(BRIDGE_ANIMATION_URL);
getAvailableProductionRigUrls().forEach((url) => useGLTF.preload(url));
