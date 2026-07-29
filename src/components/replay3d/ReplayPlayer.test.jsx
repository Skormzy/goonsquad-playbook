import { describe, expect, it } from 'vitest';
import {
  ATHLETE_SCALE,
  CLOSE_CAMERA_UNIFORM_DETAIL_PROFILE,
  CONTROLLED_STICK_GEAR_PROFILE,
  getHiddenProductionRunnerParts,
  HIDDEN_PRODUCTION_RUNNER_PARTS,
  PRODUCTION_RUNNER_GROUND_Y,
  PLAYER_GROUNDING_PROFILE,
  PLAYER_SHADOW_PROFILE,
  PLAYER_VERTICAL_MOTION_PROFILE,
  RUNTIME_UNIFORM_TEXT_PROFILE,
  shouldRenderClosePlayerDetail,
  shouldRenderRunnerStickBodySleeves,
  shouldApplyProductionRunnerPoseLayer,
  resolveRunnerStickBodySleeveMode,
  RUNNER_CLOSE_GEAR_PROFILE,
  STICK_CONTACT_PROFILE,
  resolveControlledStickGearColors,
  resolveRunnerBladeContactGuides,
  resolveRunnerCloseContactRig,
  resolveRunnerStickContactPads,
  resolveRunnerStickGripSeats,
  resolveRunnerVisibleStickShaftSegments,
  resolveRunnerStickArmSegments,
  resolveRunnerStickContactTargets,
  resolveRunnerStickMount,
  resolveRunnerStickPose,
  resolveRunnerUpperBodyStickPose,
} from './ReplayPlayer';

describe('ReplayPlayer shadow profile', () => {
  it('keeps runtime runner pose stabilization on for broadcast until imported clips carry posture cleanly', () => {
    expect(shouldApplyProductionRunnerPoseLayer({ role: 'LW', action: 'idle-ready' })).toBe(true);
    expect(shouldApplyProductionRunnerPoseLayer({ role: 'C', action: 'jog-forward' })).toBe(true);
    expect(shouldApplyProductionRunnerPoseLayer({ role: 'RW', action: 'sprint-forward' })).toBe(true);
    expect(shouldApplyProductionRunnerPoseLayer({ role: 'G', action: 'goalie-ready' })).toBe(false);
  });

  it('stabilizes broadcast stick-action clips instead of letting wide-arm imports dominate the read', () => {
    for (const action of ['stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot']) {
      expect(shouldApplyProductionRunnerPoseLayer(
        { role: 'LW', action },
        { retargetMotionQuality: 'source-driven-seed' },
        { showCloseDetail: false },
      )).toBe(true);
    }
  });

  it('keeps runner pose stabilization available for close-detail stick-action review', () => {
    for (const action of ['stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot']) {
      expect(shouldApplyProductionRunnerPoseLayer(
        { role: 'LW', action },
        { retargetMotionQuality: 'source-driven-seed' },
        { showCloseDetail: true },
      )).toBe(true);
    }
  });

  it('lets final-grade runner motion bypass runtime posture stabilization by metadata', () => {
    for (const action of ['stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot']) {
      expect(shouldApplyProductionRunnerPoseLayer(
        { role: 'LW', action },
        { retargetMotionQuality: 'final-grade-motion' },
      )).toBe(false);
    }
  });

  it('keeps field athletes large enough to read from the default broadcast camera', () => {
    expect(ATHLETE_SCALE).toBeGreaterThanOrEqual(1.5);
    expect(ATHLETE_SCALE).toBeLessThanOrEqual(1.66);
  });

  it('plants production runner feet on the playing surface instead of offsetting the whole rig upward', () => {
    expect(PRODUCTION_RUNNER_GROUND_Y).toBeGreaterThanOrEqual(0.012);
    expect(PRODUCTION_RUNNER_GROUND_Y).toBeLessThanOrEqual(0.04);
  });

  it('disables fake player shadow blobs so athletes do not look like they are floating above them', () => {
    expect(PLAYER_SHADOW_PROFILE.field.opacity).toBe(0);
    expect(PLAYER_SHADOW_PROFILE.goalie.opacity).toBe(0);
    expect(PLAYER_SHADOW_PROFILE.field.enabled).toBe(false);
    expect(PLAYER_SHADOW_PROFILE.goalie.enabled).toBe(false);
  });

  it('keeps athlete vertical motion locked to the floor instead of bobbing the whole player', () => {
    expect(PLAYER_VERTICAL_MOTION_PROFILE.fieldBobAmplitude).toBe(0);
    expect(PLAYER_VERTICAL_MOTION_PROFILE.goalieBobAmplitude).toBe(0);
    expect(PLAYER_VERTICAL_MOTION_PROFILE.worldHeight).toBe(0);
  });

  it('does not draw detached floor sole cues that look like footprints or shadows', () => {
    expect(PLAYER_GROUNDING_PROFILE.field.enabled).toBe(false);
    expect(PLAYER_GROUNDING_PROFILE.goalie.enabled).toBe(false);
    expect(PLAYER_GROUNDING_PROFILE.field.soles).toHaveLength(2);
    expect(PLAYER_GROUNDING_PROFILE.field.floorY).toBeLessThanOrEqual(0.035);

    for (const sole of PLAYER_GROUNDING_PROFILE.field.soles) {
      expect([-1, 1]).toContain(sole.side);
      expect(sole.scale[0]).toBeLessThanOrEqual(0.18);
      expect(sole.scale[2]).toBeGreaterThanOrEqual(0.28);
      expect(sole.opacity).toBeGreaterThanOrEqual(0.7);
    }
  });

  it('keeps runtime jersey text decals off until real textured uniforms replace floating text meshes', () => {
    expect(RUNTIME_UNIFORM_TEXT_PROFILE.enabled).toBe(false);
  });

  it('keeps close-camera helper geometry out of the default broadcast player render', () => {
    expect(shouldRenderClosePlayerDetail('broadcast')).toBe(false);
    expect(shouldRenderClosePlayerDetail('overhead')).toBe(false);
    expect(shouldRenderClosePlayerDetail('bench')).toBe(true);
    expect(shouldRenderClosePlayerDetail('player')).toBe(true);
  });

  it('lets final-grade production runner gloves and sleeves lead close-camera review', () => {
    const finalGradeRig = { isFinalGradeMotion: true, requiresPoseCorrection: false };
    const sourceSeedRig = { retargetMotionQuality: 'source-driven-seed', requiresPoseCorrection: true };

    expect(getHiddenProductionRunnerParts(true, finalGradeRig)).toEqual(HIDDEN_PRODUCTION_RUNNER_PARTS);
    expect(getHiddenProductionRunnerParts(true, sourceSeedRig)).toEqual(
      expect.arrayContaining(['compressionSleeve', 'jerseySleeve', 'glove']),
    );
  });

  it('does not draw close-camera helper sleeves over final-grade production runner arms', () => {
    const finalGradeRig = { isFinalGradeMotion: true, requiresPoseCorrection: false };
    const sourceSeedRig = { retargetMotionQuality: 'source-driven-seed', requiresPoseCorrection: true };

    expect(shouldRenderRunnerStickBodySleeves(false, finalGradeRig)).toBe(false);
    expect(shouldRenderRunnerStickBodySleeves(true, finalGradeRig)).toBe(true);
    expect(shouldRenderRunnerStickBodySleeves(true, sourceSeedRig)).toBe(true);
    expect(resolveRunnerStickBodySleeveMode(false, finalGradeRig)).toBe('hidden');
    expect(resolveRunnerStickBodySleeveMode(true, finalGradeRig)).toBe('contact-only');
    expect(resolveRunnerStickBodySleeveMode(true, sourceSeedRig)).toBe('full');
  });

  it('keeps the controlled runner stick high enough to read as hand-held equipment', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripHeight).toBeGreaterThanOrEqual(0.58);
    expect(STICK_CONTACT_PROFILE.runner.shaftLength).toBeGreaterThanOrEqual(1.65);
    expect(STICK_CONTACT_PROFILE.runner.handGripMarkers).toBeGreaterThanOrEqual(2);
    expect(STICK_CONTACT_PROFILE.runner.mount.restLateral).toBeLessThanOrEqual(0.3);
    expect(STICK_CONTACT_PROFILE.runner.mount.activeLateral).toBeGreaterThan(STICK_CONTACT_PROFILE.runner.mount.restLateral);
  });

  it('defines close-camera hand contact pads for the controlled runner stick', () => {
    expect(STICK_CONTACT_PROFILE.runner.maxVisualHandGap).toBeLessThanOrEqual(0.08);
    expect(STICK_CONTACT_PROFILE.runner.contactPads).toHaveLength(2);

    for (const pad of STICK_CONTACT_PROFILE.runner.contactPads) {
      expect(pad.radius).toBeGreaterThanOrEqual(0.052);
      expect(pad.radius).toBeLessThanOrEqual(0.082);
      expect(Math.abs(pad.shaftY)).toBeLessThan(STICK_CONTACT_PROFILE.runner.shaftLength / 2);
    }
  });

  it('slides controlled-stick hand pads with pass and receive actions instead of using a fixed prop grip', () => {
    const restPads = resolveRunnerStickContactPads({ action: 'idle-ready', intensity: 0, stride: 0 });
    const passPads = resolveRunnerStickContactPads({ action: 'forehand-pass', intensity: 1, stride: 0.15 });
    const receivePads = resolveRunnerStickContactPads({ action: 'receive-pass', intensity: 1, stride: -0.25 });
    const byName = (pads) => Object.fromEntries(pads.map((pad) => [pad.name, pad]));
    const rest = byName(restPads);
    const pass = byName(passPads);
    const receive = byName(receivePads);
    const restSeparation = rest.topHand.shaftY - rest.bottomHand.shaftY;
    const passSeparation = pass.topHand.shaftY - pass.bottomHand.shaftY;
    const receiveSeparation = receive.topHand.shaftY - receive.bottomHand.shaftY;

    expect(passSeparation).toBeGreaterThan(restSeparation + 0.05);
    expect(receiveSeparation).toBeLessThan(restSeparation - 0.035);
    expect(pass.topHand.roll).toBeGreaterThan(rest.topHand.roll + 0.12);
    expect(pass.bottomHand.roll).toBeLessThan(rest.bottomHand.roll - 0.12);
    expect(Math.abs(pass.topHand.lateral - rest.topHand.lateral)).toBeLessThanOrEqual(0.035);
    expect(Math.abs(receive.bottomHand.lateral - rest.bottomHand.lateral)).toBeLessThanOrEqual(0.035);
  });

  it('defines forearm bridges so close cameras do not read the controlled stick as floating', () => {
    expect(STICK_CONTACT_PROFILE.runner.maxVisualHandGap).toBeLessThanOrEqual(0.06);
    expect(STICK_CONTACT_PROFILE.runner.forearmBridges).toHaveLength(2);

    for (const bridge of STICK_CONTACT_PROFILE.runner.forearmBridges) {
      expect(['topHand', 'bottomHand']).toContain(bridge.padName);
      expect(bridge.length).toBeGreaterThanOrEqual(0.18);
      expect(bridge.length).toBeLessThanOrEqual(0.36);
      expect(bridge.radius).toBeGreaterThanOrEqual(0.02);
      expect(bridge.radius).toBeLessThanOrEqual(0.045);
      expect(Math.abs(bridge.bodyAnchorX)).toBeGreaterThanOrEqual(0.1);
    }
  });

  it('adds close-camera palm wraps and sleeve anchors around the controlled runner stick', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripWraps).toHaveLength(2);
    expect(STICK_CONTACT_PROFILE.runner.upperArmBridges).toHaveLength(2);

    for (const wrap of STICK_CONTACT_PROFILE.runner.gripWraps) {
      expect(['topHand', 'bottomHand']).toContain(wrap.padName);
      expect(wrap.length).toBeGreaterThanOrEqual(0.14);
      expect(wrap.radius).toBeGreaterThanOrEqual(0.025);
      expect(wrap.radius).toBeLessThanOrEqual(0.05);
    }

    for (const bridge of STICK_CONTACT_PROFILE.runner.upperArmBridges) {
      expect(['topHand', 'bottomHand']).toContain(bridge.padName);
      expect(bridge.length).toBeGreaterThanOrEqual(0.38);
      expect(bridge.radius).toBeGreaterThanOrEqual(0.018);
      expect(bridge.radius).toBeLessThanOrEqual(0.036);
      expect(Math.abs(bridge.bodyAnchorY)).toBeGreaterThanOrEqual(0.12);
    }
  });

  it('wires configured forearm and upper-arm bridge layers into the close-camera contact rig', () => {
    const rig = resolveRunnerCloseContactRig({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });

    for (const assembly of rig.handAssemblies) {
      expect(assembly.forearmBridge).toBeTruthy();
      expect(assembly.upperArmBridge).toBeTruthy();

      expect(assembly.forearmBridge.from).toHaveLength(3);
      expect(assembly.forearmBridge.to).toHaveLength(3);
      expect(assembly.forearmBridge.radius).toBeGreaterThanOrEqual(0.026);
      expect(assembly.forearmBridge.radius).toBeLessThanOrEqual(0.045);
      expect(assembly.forearmBridge.opacity).toBeGreaterThanOrEqual(0.84);

      expect(assembly.upperArmBridge.from).toHaveLength(3);
      expect(assembly.upperArmBridge.to).toHaveLength(3);
      expect(assembly.upperArmBridge.radius).toBeGreaterThanOrEqual(0.02);
      expect(assembly.upperArmBridge.radius).toBeLessThanOrEqual(0.038);
      expect(assembly.upperArmBridge.opacity).toBeGreaterThanOrEqual(0.78);

      const forearmHandGap = Math.hypot(
        assembly.forearmBridge.to[0] - assembly.handTarget[0],
        assembly.forearmBridge.to[1] - assembly.handTarget[1],
        assembly.forearmBridge.to[2] - assembly.handTarget[2],
      );
      expect(forearmHandGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap + 0.04);
      expect(assembly.forearmBridge.from[2]).toBeGreaterThan(assembly.arm.elbow[2]);
      expect(assembly.upperArmBridge.to[2]).toBeGreaterThan(assembly.arm.elbow[2]);
    }
  });

  it('defines body-mounted close-camera sleeves that tie the controlled stick back to the runner', () => {
    expect(STICK_CONTACT_PROFILE.runner.bodyStickSleeves).toHaveLength(2);

    for (const sleeve of STICK_CONTACT_PROFILE.runner.bodyStickSleeves) {
      expect(['topHand', 'bottomHand']).toContain(sleeve.padName);
      expect(sleeve.bodyAnchor).toHaveLength(3);
      expect(sleeve.handAnchor).toHaveLength(3);
      expect(sleeve.length).toBeGreaterThanOrEqual(0.34);
      expect(sleeve.length).toBeLessThanOrEqual(0.58);
      expect(sleeve.radius).toBeGreaterThanOrEqual(0.025);
      expect(sleeve.radius).toBeLessThanOrEqual(0.05);
      expect(sleeve.opacity).toBeGreaterThanOrEqual(0.72);
    }
  });

  it('keeps active and resting controlled-stick mounts inside close-camera arm reach', () => {
    const rest = resolveRunnerStickMount({ action: 'idle-ready', intensity: 0, stride: 0 });
    const active = resolveRunnerStickMount({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(rest.lateral).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.bodyReach.maxRestLateral);
    expect(rest.depth).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.bodyReach.maxRestDepth);
    expect(active.lateral).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.bodyReach.maxActiveLateral);
    expect(active.depth).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.bodyReach.maxActiveDepth);
    expect(active.height).toBeGreaterThanOrEqual(STICK_CONTACT_PROFILE.runner.bodyReach.minActiveGripHeight);
  });

  it('tucks the controlled runner stick pocket close enough to read as held in close cameras', () => {
    const rest = resolveRunnerStickMount({ action: 'idle-ready', intensity: 0, stride: 0 });
    const active = resolveRunnerStickMount({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(STICK_CONTACT_PROFILE.runner.mount.restLateral).toBeLessThanOrEqual(0.24);
    expect(STICK_CONTACT_PROFILE.runner.mount.activeLateral).toBeLessThanOrEqual(0.38);
    expect(STICK_CONTACT_PROFILE.runner.mount.restDepth).toBeLessThanOrEqual(0.28);
    expect(STICK_CONTACT_PROFILE.runner.mount.activeDepth).toBeLessThanOrEqual(0.36);
    expect(active.lateral - rest.lateral).toBeLessThanOrEqual(0.16);
    expect(active.depth - rest.depth).toBeLessThanOrEqual(0.1);
  });

  it('keeps the controlled stick tucked into the close-camera jersey silhouette', () => {
    const rest = resolveRunnerStickMount({ action: 'idle-ready', intensity: 0, stride: 0 });
    const active = resolveRunnerStickMount({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(rest.lateral).toBeLessThanOrEqual(0.18);
    expect(rest.depth).toBeLessThanOrEqual(0.23);
    expect(active.lateral).toBeLessThanOrEqual(0.25);
    expect(active.depth).toBeLessThanOrEqual(0.25);
  });

  it('keeps active and receiving stick poses inside a compact hand-contact envelope', () => {
    const activePose = resolveRunnerStickPose({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const receivePose = resolveRunnerStickPose({ action: 'receive-pass', intensity: 1, stride: -0.25 });

    expect(activePose.position[0]).toBeLessThanOrEqual(0.36);
    expect(activePose.position[2]).toBeLessThanOrEqual(0.33);
    expect(receivePose.position[0]).toBeLessThanOrEqual(0.37);
    expect(receivePose.position[2]).toBeLessThanOrEqual(0.42);
  });

  it('keeps player-read palm and wrist detail tucked into the controlled-stick contact envelope', () => {
    const activePose = resolveRunnerStickPose({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const passPose = resolveRunnerStickPose({ action: 'forehand-pass', intensity: 1, stride: 0.15 });

    expect(STICK_CONTACT_PROFILE.runner.mount.activeLateral).toBeLessThanOrEqual(0.21);
    expect(STICK_CONTACT_PROFILE.runner.mount.activeDepth).toBeLessThanOrEqual(0.22);
    expect(activePose.position[0]).toBeLessThanOrEqual(0.23);
    expect(passPose.position[0]).toBeLessThanOrEqual(0.3);
    expect(passPose.position[2]).toBeLessThanOrEqual(0.4);

    for (const guard of STICK_CONTACT_PROFILE.runner.gripPalmGuards) {
      expect(Math.abs(guard.offsetX)).toBeLessThanOrEqual(0.016);
    }

    for (const strap of STICK_CONTACT_PROFILE.runner.gloveWristStraps) {
      expect(Math.abs(strap.offsetX)).toBeLessThanOrEqual(0.095);
    }
  });

  it('keeps active player-read stick work inside the hand shell instead of beside the runner', () => {
    const activePose = resolveRunnerStickPose({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(activePose.position[0]).toBeLessThanOrEqual(0.2);
    expect(activePose.position[2]).toBeLessThanOrEqual(0.21);
  });

  it('keeps close-camera controlled-stick helper arms subordinate to the imported athlete mesh', () => {
    for (const sleeve of STICK_CONTACT_PROFILE.runner.bodyStickSleeves) {
      expect(sleeve.radius).toBeLessThanOrEqual(0.034);
      expect(sleeve.opacity).toBeLessThanOrEqual(0.78);
    }

    for (const arm of STICK_CONTACT_PROFILE.runner.articulatedStickArms) {
      expect(arm.upperArmRadius).toBeLessThanOrEqual(0.034);
      expect(arm.forearmRadius).toBeLessThanOrEqual(0.03);
      expect(arm.opacity).toBeLessThanOrEqual(0.76);
    }

    for (const panel of STICK_CONTACT_PROFILE.runner.stickArmSilhouettePanels) {
      expect(panel.radius).toBeLessThanOrEqual(0.064);
      expect(panel.opacity).toBeLessThanOrEqual(0.48);
    }

    for (const profile of STICK_CONTACT_PROFILE.runner.stickArmStripeBands) {
      for (const band of profile.bands) {
        expect(band.radius).toBeLessThanOrEqual(0.052);
        expect(band.opacity).toBeLessThanOrEqual(0.58);
      }
    }

    for (const panel of STICK_CONTACT_PROFILE.runner.torsoArmOverlapPanels) {
      expect(panel.radius).toBeLessThanOrEqual(0.052);
      expect(panel.opacity).toBeLessThanOrEqual(0.58);
    }

    for (const cap of STICK_CONTACT_PROFILE.runner.bodyShoulderCaps) {
      expect(cap.radius).toBeLessThanOrEqual(0.046);
      expect(cap.opacity).toBeLessThanOrEqual(0.74);
    }
  });

  it('body-couples the active controlled-stick root to the runner pose in close cameras', () => {
    const staticPose = resolveRunnerStickPose({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 0,
      stride: 0.4,
    });
    const drivenPose = resolveRunnerStickPose({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });

    expect(drivenPose.bodyCoupling).toBeTruthy();
    expect(drivenPose.bodyCoupling.lateralTuck).toBeGreaterThanOrEqual(0.012);
    expect(drivenPose.bodyCoupling.depthTuck).toBeGreaterThanOrEqual(0.014);
    expect(staticPose.position[0] - drivenPose.position[0]).toBeGreaterThanOrEqual(0.012);
    expect(staticPose.position[2] - drivenPose.position[2]).toBeGreaterThanOrEqual(0.014);
  });

  it('buries active carry stick work tighter under the close-camera glove envelope', () => {
    const activePose = resolveRunnerStickPose({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const rig = resolveRunnerCloseContactRig({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(activePose.position[0]).toBeLessThanOrEqual(0.18);
    expect(activePose.position[2]).toBeLessThanOrEqual(0.195);

    for (const assembly of rig.handAssemblies) {
      expect(assembly.gripWristWeb.to[2] - activePose.position[2]).toBeGreaterThanOrEqual(0.03);
      expect(assembly.gripPinchPad.position[2] - activePose.position[2]).toBeGreaterThanOrEqual(0.06);
    }
  });

  it('derives close-camera body sleeve targets from the controlled stick pad transform', () => {
    const restPose = resolveRunnerStickPose({ action: 'idle-ready', intensity: 0, stride: 0 });
    const activePose = resolveRunnerStickPose({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const restTargets = resolveRunnerStickContactTargets({ action: 'idle-ready', intensity: 0, stride: 0 });
    const activeTargets = resolveRunnerStickContactTargets({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(Object.keys(activeTargets).sort()).toEqual(['bottomHand', 'topHand']);

    for (const pad of STICK_CONTACT_PROFILE.runner.contactPads) {
      const restTarget = restTargets[pad.name];
      const activeTarget = activeTargets[pad.name];
      expect(restTarget).toHaveLength(3);
      expect(activeTarget).toHaveLength(3);

      const activeTargetDistanceFromStickRoot = Math.hypot(
        activeTarget[0] - activePose.position[0],
        activeTarget[1] - activePose.position[1],
        activeTarget[2] - activePose.position[2],
      );
      const targetShift = Math.hypot(
        activeTarget[0] - restTarget[0],
        activeTarget[1] - restTarget[1],
        activeTarget[2] - restTarget[2],
      );
      const stickRootShift = Math.hypot(
        activePose.position[0] - restPose.position[0],
        activePose.position[1] - restPose.position[1],
        activePose.position[2] - restPose.position[2],
      );

      expect(activeTargetDistanceFromStickRoot).toBeLessThanOrEqual(0.54);
      expect(activeTarget[1]).toBeGreaterThanOrEqual(0.65);
      expect(activeTarget[2]).toBeGreaterThan(activePose.position[2]);
      expect(targetShift).toBeGreaterThanOrEqual(stickRootShift * 0.38);
    }
  });

  it('keeps action contact targets inside a close-camera body envelope', () => {
    const actions = [
      ['stick-handle', 0.4],
      ['forehand-pass', 0.15],
      ['receive-pass', -0.25],
      ['wrist-shot', 0.2],
    ];

    for (const [action, stride] of actions) {
      const targets = resolveRunnerStickContactTargets({
        action,
        intensity: 1,
        speedMps: 2.8,
        stride,
      });

      for (const target of Object.values(targets)) {
        const label = `${action} target ${target.map((value) => value.toFixed(3)).join(',')}`;
        expect(Math.abs(target[0]), label).toBeLessThanOrEqual(0.36);
        expect(target[2], label).toBeLessThanOrEqual(action === 'wrist-shot' ? 0.6 : 0.52);
        expect(target[1], label).toBeGreaterThanOrEqual(0.58);
      }
    }
  });

  it('defines rounded close-camera shoulder caps to reduce blocky placeholder gear reads', () => {
    expect(STICK_CONTACT_PROFILE.runner.bodyShoulderCaps).toHaveLength(2);

    for (const cap of STICK_CONTACT_PROFILE.runner.bodyShoulderCaps) {
      expect([-1, 1]).toContain(cap.side);
      expect(cap.position).toHaveLength(3);
      expect(cap.length).toBeGreaterThanOrEqual(0.22);
      expect(cap.length).toBeLessThanOrEqual(0.38);
      expect(cap.radius).toBeGreaterThanOrEqual(0.04);
      expect(cap.radius).toBeLessThanOrEqual(0.046);
      expect(cap.opacity).toBeGreaterThanOrEqual(0.64);
      expect(cap.opacity).toBeLessThanOrEqual(0.74);
    }
  });

  it('wraps each controlled-stick hand contact with a closed grip collar', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripCollars).toHaveLength(2);

    for (const collar of STICK_CONTACT_PROFILE.runner.gripCollars) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === collar.padName);
      expect(pad).toBeTruthy();
      expect(collar.radius).toBeGreaterThanOrEqual(pad.radius * 0.92);
      expect(collar.radius).toBeLessThanOrEqual(pad.radius * 1.35);
      expect(collar.tubeRadius).toBeGreaterThanOrEqual(0.006);
      expect(collar.tubeRadius).toBeLessThanOrEqual(0.018);
      expect(Math.abs(collar.zOffset)).toBeLessThanOrEqual(0.08);
      expect(collar.opacity).toBeGreaterThanOrEqual(0.82);
    }
  });

  it('adds finger ridges around both controlled-stick grips for close-camera reads', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripFingerRidges).toHaveLength(2);

    for (const ridgeSet of STICK_CONTACT_PROFILE.runner.gripFingerRidges) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === ridgeSet.padName);
      expect(pad).toBeTruthy();
      expect(ridgeSet.count).toBeGreaterThanOrEqual(3);
      expect(ridgeSet.spacing).toBeGreaterThanOrEqual(0.016);
      expect(ridgeSet.spacing).toBeLessThanOrEqual(0.032);
      expect(ridgeSet.length).toBeGreaterThanOrEqual(0.08);
      expect(ridgeSet.length).toBeLessThanOrEqual(0.14);
      expect(ridgeSet.radius).toBeGreaterThanOrEqual(0.006);
      expect(ridgeSet.radius).toBeLessThanOrEqual(0.014);
      expect(ridgeSet.zOffset).toBeGreaterThanOrEqual(0.055);
      expect(ridgeSet.opacity).toBeGreaterThanOrEqual(0.82);
    }
  });

  it('adds palm guards and wrist straps so close cameras read hands as closed around the stick', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripPalmGuards).toHaveLength(2);
    expect(STICK_CONTACT_PROFILE.runner.gloveWristStraps).toHaveLength(2);

    for (const guard of STICK_CONTACT_PROFILE.runner.gripPalmGuards) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === guard.padName);
      expect(pad).toBeTruthy();
      expect(guard.length).toBeGreaterThanOrEqual(0.1);
      expect(guard.length).toBeLessThanOrEqual(0.18);
      expect(guard.radius).toBeGreaterThanOrEqual(0.012);
      expect(guard.radius).toBeLessThanOrEqual(0.024);
      expect(guard.zOffset).toBeGreaterThanOrEqual(0.08);
      expect(guard.opacity).toBeGreaterThanOrEqual(0.88);
    }

    for (const strap of STICK_CONTACT_PROFILE.runner.gloveWristStraps) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === strap.padName);
      expect(pad).toBeTruthy();
      expect(strap.length).toBeGreaterThanOrEqual(0.1);
      expect(strap.length).toBeLessThanOrEqual(0.18);
      expect(strap.radius).toBeGreaterThanOrEqual(0.01);
      expect(strap.radius).toBeLessThanOrEqual(0.022);
      expect(Math.abs(strap.offsetX)).toBeGreaterThanOrEqual(0.07);
      expect(strap.opacity).toBeGreaterThanOrEqual(0.84);
    }
  });

  it('uses one compact closed-grip shell per controlled-stick hand in close cameras', () => {
    expect(STICK_CONTACT_PROFILE.runner.closedGripShells).toHaveLength(2);

    for (const shell of STICK_CONTACT_PROFILE.runner.closedGripShells) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === shell.padName);
      expect(pad).toBeTruthy();
      expect(shell.scale).toHaveLength(3);
      expect(shell.scale[0]).toBeGreaterThanOrEqual(pad.radius * 1.35);
      expect(shell.scale[0]).toBeLessThanOrEqual(pad.radius * 1.9);
      expect(shell.scale[1]).toBeGreaterThanOrEqual(pad.radius * 0.9);
      expect(shell.scale[1]).toBeLessThanOrEqual(pad.radius * 1.45);
      expect(shell.scale[2]).toBeGreaterThanOrEqual(pad.radius * 0.65);
      expect(shell.scale[2]).toBeLessThanOrEqual(pad.radius * 1.2);
      expect(Math.abs(shell.offset[0])).toBeLessThanOrEqual(0.035);
      expect(shell.offset[2]).toBeGreaterThanOrEqual(0.055);
      expect(shell.opacity).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('adds palm-heel bridges from each closed glove to the controlled stick shaft', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripHeelBridges).toHaveLength(2);

    for (const bridge of STICK_CONTACT_PROFILE.runner.gripHeelBridges) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === bridge.padName);
      expect(pad).toBeTruthy();
      expect(bridge.length).toBeGreaterThanOrEqual(0.12);
      expect(bridge.length).toBeLessThanOrEqual(0.2);
      expect(bridge.radius).toBeGreaterThanOrEqual(0.012);
      expect(bridge.radius).toBeLessThanOrEqual(0.024);
      expect(Math.abs(bridge.offsetX)).toBeLessThanOrEqual(0.045);
      expect(Math.abs(bridge.offsetY)).toBeLessThanOrEqual(0.032);
      expect(bridge.zOffset).toBeGreaterThanOrEqual(0.055);
      expect(bridge.zOffset).toBeLessThanOrEqual(0.105);
      expect(Math.abs(bridge.roll)).toBeGreaterThanOrEqual(0.28);
      expect(bridge.opacity).toBeGreaterThanOrEqual(0.86);
    }
  });

  it('buries the controlled stick shaft inside dark segmented glove channels', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripShaftChannels).toHaveLength(2);
    expect(STICK_CONTACT_PROFILE.runner.gripKnucklePads).toHaveLength(2);

    for (const channel of STICK_CONTACT_PROFILE.runner.gripShaftChannels) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === channel.padName);
      expect(pad).toBeTruthy();
      expect(channel.length).toBeGreaterThanOrEqual(0.18);
      expect(channel.length).toBeLessThanOrEqual(0.28);
      expect(channel.radius).toBeGreaterThanOrEqual(0.026);
      expect(channel.radius).toBeLessThanOrEqual(pad.radius * 0.72);
      expect(channel.zOffset).toBeGreaterThanOrEqual(0.025);
      expect(channel.zOffset).toBeLessThanOrEqual(0.07);
      expect(channel.opacity).toBeGreaterThanOrEqual(0.9);
    }

    for (const knuckles of STICK_CONTACT_PROFILE.runner.gripKnucklePads) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === knuckles.padName);
      expect(pad).toBeTruthy();
      expect(knuckles.count).toBeGreaterThanOrEqual(3);
      expect(knuckles.count).toBeLessThanOrEqual(4);
      expect(knuckles.length).toBeGreaterThanOrEqual(0.07);
      expect(knuckles.length).toBeLessThanOrEqual(0.12);
      expect(knuckles.radius).toBeGreaterThanOrEqual(0.012);
      expect(knuckles.radius).toBeLessThanOrEqual(0.02);
      expect(knuckles.zOffset).toBeGreaterThanOrEqual(0.105);
      expect(knuckles.opacity).toBeGreaterThanOrEqual(0.88);
    }
  });

  it('adds compact stick-side palm masks that hide the shaft entering each close-camera grip', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripContactMasks).toHaveLength(2);

    for (const mask of STICK_CONTACT_PROFILE.runner.gripContactMasks) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === mask.padName);
      expect(pad).toBeTruthy();
      expect(mask.scale).toHaveLength(3);
      expect(mask.scale[0]).toBeGreaterThanOrEqual(pad.radius * 1.15);
      expect(mask.scale[0]).toBeLessThanOrEqual(pad.radius * 1.75);
      expect(mask.scale[1]).toBeGreaterThanOrEqual(pad.radius * 0.7);
      expect(mask.scale[1]).toBeLessThanOrEqual(pad.radius * 1.2);
      expect(mask.scale[2]).toBeGreaterThanOrEqual(0.028);
      expect(mask.scale[2]).toBeLessThanOrEqual(0.058);
      expect(mask.zOffset).toBeGreaterThanOrEqual(0.035);
      expect(mask.zOffset).toBeLessThanOrEqual(0.082);
      expect(mask.opacity).toBeGreaterThanOrEqual(0.9);
      expect(mask.opacity).toBeLessThanOrEqual(0.98);
    }
  });

  it('breaks the controlled stick shaft under close-camera grip zones', () => {
    const activePads = resolveRunnerStickContactPads({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const segments = resolveRunnerVisibleStickShaftSegments({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(segments).toHaveLength(3);

    for (const pad of activePads) {
      for (const segment of segments) {
        const segmentStart = segment.centerY - segment.length / 2;
        const segmentEnd = segment.centerY + segment.length / 2;
        const gapStart = pad.shaftY - segment.gripClearance;
        const gapEnd = pad.shaftY + segment.gripClearance;

        expect(segmentEnd <= gapStart || segmentStart >= gapEnd).toBe(true);
      }
    }

    expect(segments[0].centerY).toBeLessThan(activePads[1].shaftY);
    expect(segments[2].centerY).toBeGreaterThan(activePads[0].shaftY);
  });

  it('wraps thumb hooks and palm seams across each controlled-stick grip', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripThumbHooks).toHaveLength(2);
    expect(STICK_CONTACT_PROFILE.runner.gripPalmSeams).toHaveLength(2);

    for (const hook of STICK_CONTACT_PROFILE.runner.gripThumbHooks) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === hook.padName);
      expect(pad).toBeTruthy();
      expect(hook.length).toBeGreaterThanOrEqual(0.1);
      expect(hook.length).toBeLessThanOrEqual(0.18);
      expect(hook.radius).toBeGreaterThanOrEqual(0.008);
      expect(hook.radius).toBeLessThanOrEqual(0.018);
      expect(Math.abs(hook.offsetX)).toBeLessThanOrEqual(0.07);
      expect(hook.zOffset).toBeGreaterThanOrEqual(0.09);
      expect(hook.zOffset).toBeLessThanOrEqual(0.15);
      expect(Math.abs(hook.roll)).toBeGreaterThanOrEqual(0.46);
      expect(hook.opacity).toBeGreaterThanOrEqual(0.88);
    }

    for (const seam of STICK_CONTACT_PROFILE.runner.gripPalmSeams) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === seam.padName);
      expect(pad).toBeTruthy();
      expect(seam.count).toBeGreaterThanOrEqual(2);
      expect(seam.count).toBeLessThanOrEqual(3);
      expect(seam.length).toBeGreaterThanOrEqual(0.07);
      expect(seam.length).toBeLessThanOrEqual(0.13);
      expect(seam.radius).toBeGreaterThanOrEqual(0.004);
      expect(seam.radius).toBeLessThanOrEqual(0.01);
      expect(seam.zOffset).toBeGreaterThanOrEqual(0.13);
      expect(seam.opacity).toBeGreaterThanOrEqual(0.76);
    }
  });

  it('adds close-camera grip keeper straps and blade-pocket rails to make the controlled stick read as held equipment', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripKeeperStraps).toHaveLength(2);
    expect(STICK_CONTACT_PROFILE.runner.bladePocketRails).toHaveLength(3);

    for (const strap of STICK_CONTACT_PROFILE.runner.gripKeeperStraps) {
      const pad = STICK_CONTACT_PROFILE.runner.contactPads.find((item) => item.name === strap.padName);
      expect(pad).toBeTruthy();
      expect(strap.count).toBeGreaterThanOrEqual(2);
      expect(strap.count).toBeLessThanOrEqual(3);
      expect(strap.length).toBeGreaterThanOrEqual(0.09);
      expect(strap.length).toBeLessThanOrEqual(0.16);
      expect(strap.radius).toBeGreaterThanOrEqual(0.006);
      expect(strap.radius).toBeLessThanOrEqual(0.012);
      expect(strap.zOffset).toBeGreaterThanOrEqual(0.08);
      expect(strap.opacity).toBeGreaterThanOrEqual(0.84);
    }

    const bladeRailByName = Object.fromEntries(
      STICK_CONTACT_PROFILE.runner.bladePocketRails.map((rail) => [rail.name, rail]),
    );
    expect(bladeRailByName.heel.position[1]).toBeGreaterThanOrEqual(-0.86);
    expect(bladeRailByName.toe.position[0]).toBeGreaterThan(bladeRailByName.heel.position[0]);
    expect(bladeRailByName.ballPocket.position[2]).toBeGreaterThanOrEqual(0.09);

    for (const rail of STICK_CONTACT_PROFILE.runner.bladePocketRails) {
      expect(rail.length).toBeGreaterThanOrEqual(0.12);
      expect(rail.length).toBeLessThanOrEqual(0.32);
      expect(rail.radius).toBeGreaterThanOrEqual(0.01);
      expect(rail.radius).toBeLessThanOrEqual(0.024);
      expect(rail.opacity).toBeGreaterThanOrEqual(0.82);
    }
  });

  it('adds active blade-contact guides so close cameras read the ball as meeting the controlled stick pocket', () => {
    expect(STICK_CONTACT_PROFILE.runner.bladeContactGuides).toHaveLength(2);

    const idleGuides = resolveRunnerBladeContactGuides({ action: 'idle-ready', intensity: 0, stride: 0 });
    const carryGuides = resolveRunnerBladeContactGuides({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const passGuides = resolveRunnerBladeContactGuides({ action: 'forehand-pass', intensity: 1, stride: 0.15 });
    const receiveGuides = resolveRunnerBladeContactGuides({ action: 'receive-pass', intensity: 1, stride: -0.25 });
    const carryByName = Object.fromEntries(carryGuides.map((guide) => [guide.name, guide]));
    const passByName = Object.fromEntries(passGuides.map((guide) => [guide.name, guide]));
    const receiveByName = Object.fromEntries(receiveGuides.map((guide) => [guide.name, guide]));
    const ballPocketRail = STICK_CONTACT_PROFILE.runner.bladePocketRails.find((rail) => rail.name === 'ballPocket');

    expect(idleGuides.every((guide) => guide.opacity <= 0.18)).toBe(true);

    for (const guide of [...carryGuides, ...passGuides, ...receiveGuides]) {
      expect(guide.position).toHaveLength(3);
      expect(guide.position[1]).toBeLessThanOrEqual(-0.84);
      expect(guide.position[2]).toBeGreaterThanOrEqual(0.105);
      expect(Math.abs(guide.position[0] - ballPocketRail.position[0])).toBeLessThanOrEqual(0.17);
      expect(guide.length).toBeGreaterThanOrEqual(0.13);
      expect(guide.radius).toBeGreaterThanOrEqual(0.008);
      expect(guide.opacity).toBeGreaterThanOrEqual(0.58);
    }

    expect(carryByName.ballSeat.position[0]).not.toBe(passByName.ballSeat.position[0]);
    expect(passByName.ballSeat.position[1]).toBeGreaterThan(carryByName.ballSeat.position[1]);
    expect(receiveByName.ballSeat.position[2]).toBeGreaterThanOrEqual(carryByName.ballSeat.position[2]);
  });

  it('adds stick-side forearm locks so hand contact reads connected from close cameras', () => {
    expect(STICK_CONTACT_PROFILE.runner.stickSideForearmLocks).toHaveLength(2);

    for (const lock of STICK_CONTACT_PROFILE.runner.stickSideForearmLocks) {
      expect(['topHand', 'bottomHand']).toContain(lock.padName);
      expect(lock.fromT).toBeGreaterThanOrEqual(0.54);
      expect(lock.fromT).toBeLessThan(lock.toT);
      expect(lock.toT).toBeLessThanOrEqual(0.98);
      expect(lock.radius).toBeGreaterThanOrEqual(0.014);
      expect(lock.radius).toBeLessThanOrEqual(0.03);
      expect(lock.offsetLateral).toBeGreaterThanOrEqual(0.01);
      expect(lock.opacity).toBeGreaterThanOrEqual(0.78);
    }
  });

  it('adds a taped butt-end and handle bands so the controlled runner stick reads as held equipment', () => {
    expect(STICK_CONTACT_PROFILE.runner.shaftButtEnd).toBeTruthy();
    expect(STICK_CONTACT_PROFILE.runner.shaftButtEnd.shaftY).toBeGreaterThanOrEqual(0.82);
    expect(STICK_CONTACT_PROFILE.runner.shaftButtEnd.radius).toBeGreaterThanOrEqual(0.026);
    expect(STICK_CONTACT_PROFILE.runner.shaftButtEnd.length).toBeGreaterThanOrEqual(0.1);
    expect(STICK_CONTACT_PROFILE.runner.handleTapeBands).toHaveLength(3);

    const topHand = STICK_CONTACT_PROFILE.runner.contactPads.find((pad) => pad.name === 'topHand');
    for (const band of STICK_CONTACT_PROFILE.runner.handleTapeBands) {
      expect(band.shaftY).toBeGreaterThan(topHand.shaftY);
      expect(band.shaftY).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.shaftLength / 2 + 0.03);
      expect(band.radius).toBeGreaterThanOrEqual(0.019);
      expect(band.radius).toBeLessThanOrEqual(0.035);
      expect(band.length).toBeGreaterThanOrEqual(0.055);
      expect(band.opacity).toBeGreaterThanOrEqual(0.86);
    }
  });

  it('adds broad body-root grip webs that visually bury the stick in each close-camera glove', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripWristWebs).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    for (const web of STICK_CONTACT_PROFILE.runner.gripWristWebs) {
      expect(['topHand', 'bottomHand']).toContain(web.padName);
      expect(web.fromT).toBeGreaterThanOrEqual(0.72);
      expect(web.toT).toBeLessThanOrEqual(1);
      expect(web.toT).toBeGreaterThanOrEqual(0.96);
      expect(web.radius).toBeGreaterThanOrEqual(0.045);
      expect(web.radius).toBeLessThanOrEqual(0.065);
      expect(web.offsetDepth).toBeGreaterThanOrEqual(0.032);
      expect(web.opacity).toBeGreaterThanOrEqual(0.9);
    }

    for (const assembly of rig.handAssemblies) {
      expect(assembly.gripWristWeb).toBeTruthy();
      expect(assembly.gripWristWeb.radius).toBeGreaterThan(assembly.forearmLock.radius);
      const webTargetGap = Math.hypot(
        assembly.gripWristWeb.to[0] - assembly.handTarget[0],
        assembly.gripWristWeb.to[1] - assembly.handTarget[1],
        assembly.gripWristWeb.to[2] - assembly.handTarget[2],
      );
      expect(webTargetGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap);
    }
  });

  it('derives articulated close-camera arms that terminate at the controlled-stick grips', () => {
    const activeTargets = resolveRunnerStickContactTargets({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const armSegments = resolveRunnerStickArmSegments({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(STICK_CONTACT_PROFILE.runner.articulatedStickArms).toHaveLength(2);
    expect(armSegments).toHaveLength(2);

    for (const segment of armSegments) {
      expect(['topHand', 'bottomHand']).toContain(segment.padName);
      expect(segment.shoulder).toHaveLength(3);
      expect(segment.elbow).toHaveLength(3);
      expect(segment.hand).toHaveLength(3);
      expect(segment.upperLength).toBeGreaterThanOrEqual(0.18);
      expect(segment.upperLength).toBeLessThanOrEqual(0.7);
      expect(segment.forearmLength).toBeGreaterThanOrEqual(0.18);
      expect(segment.forearmLength).toBeLessThanOrEqual(0.68);
      expect(segment.forearmRadius).toBeGreaterThanOrEqual(0.026);
      expect(segment.opacity).toBeGreaterThanOrEqual(0.68);
      expect(segment.opacity).toBeLessThanOrEqual(0.76);

      const target = activeTargets[segment.padName];
      const handGap = Math.hypot(
        segment.hand[0] - target[0],
        segment.hand[1] - target[1],
        segment.hand[2] - target[2],
      );
      expect(handGap).toBeLessThanOrEqual(0.001);
    }
  });

  it('body-couples articulated stick-arm shoulders to active runner posture', () => {
    const restSegments = resolveRunnerStickArmSegments({
      action: 'idle-ready',
      intensity: 0,
      speedMps: 1.2,
      stride: 0,
    });
    const activeSegments = resolveRunnerStickArmSegments({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });
    const restByPad = Object.fromEntries(restSegments.map((segment) => [segment.padName, segment]));

    for (const segment of activeSegments) {
      const rest = restByPad[segment.padName];
      const shoulderShift = Math.hypot(
        segment.shoulder[0] - rest.shoulder[0],
        segment.shoulder[1] - rest.shoulder[1],
        segment.shoulder[2] - rest.shoulder[2],
      );

      expect(rest).toBeTruthy();
      expect(shoulderShift).toBeGreaterThanOrEqual(0.018);
      expect(segment.shoulder[2]).toBeGreaterThan(rest.shoulder[2] + 0.012);
      expect(segment.upperLength).toBeGreaterThanOrEqual(0.18);
      expect(segment.upperLength).toBeLessThanOrEqual(0.7);
    }
  });

  it('adds rounded close-camera elbow and wrist sockets to the articulated stick arms', () => {
    const armSegments = resolveRunnerStickArmSegments({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(STICK_CONTACT_PROFILE.runner.stickArmJointCaps).toHaveLength(2);

    for (const cap of STICK_CONTACT_PROFILE.runner.stickArmJointCaps) {
      const segment = armSegments.find((item) => item.padName === cap.padName);
      expect(segment).toBeTruthy();
      expect(cap.elbowRadius).toBeGreaterThanOrEqual(segment.forearmRadius * 1.05);
      expect(cap.elbowRadius).toBeLessThanOrEqual(0.058);
      expect(cap.wristRadius).toBeGreaterThanOrEqual(segment.forearmRadius * 1.12);
      expect(cap.wristRadius).toBeLessThanOrEqual(0.062);
      expect(cap.wristOffset).toHaveLength(3);
      expect(Math.abs(cap.wristOffset[0])).toBeLessThanOrEqual(0.025);
      expect(cap.wristOffset[2]).toBeGreaterThanOrEqual(0.018);
      expect(cap.opacity).toBeGreaterThanOrEqual(0.68);
      expect(cap.opacity).toBeLessThanOrEqual(0.76);
    }
  });

  it('adds shoulder-to-forearm yoke panels that merge the close-camera stick arms into the jersey', () => {
    expect(STICK_CONTACT_PROFILE.runner.stickArmYokePanels).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });

    for (const panel of STICK_CONTACT_PROFILE.runner.stickArmYokePanels) {
      expect(['topHand', 'bottomHand']).toContain(panel.padName);
      expect(panel.fromT).toBeGreaterThanOrEqual(0.12);
      expect(panel.fromT).toBeLessThan(panel.toT);
      expect(panel.toT).toBeLessThanOrEqual(0.74);
      expect(panel.radius).toBeGreaterThanOrEqual(0.036);
      expect(panel.radius).toBeLessThanOrEqual(0.046);
      expect(panel.offsetDepth).toBeGreaterThanOrEqual(0.028);
      expect(panel.opacity).toBeGreaterThanOrEqual(0.42);
      expect(panel.opacity).toBeLessThanOrEqual(0.54);
    }

    for (const assembly of rig.handAssemblies) {
      expect(assembly.armYoke).toBeTruthy();
      expect(assembly.armYoke.radius).toBeGreaterThan(assembly.arm.upperArmRadius);
      expect(assembly.armYoke.from[2]).toBeGreaterThan(assembly.arm.shoulder[2]);
      expect(assembly.armYoke.to[2]).toBeGreaterThan(assembly.arm.elbow[2] - 0.02);
    }
  });

  it('uses restrained close-camera forearm sleeve weight so helper arms do not dominate players', () => {
    for (const arm of STICK_CONTACT_PROFILE.runner.articulatedStickArms) {
      expect(arm.upperArmRadius).toBeGreaterThanOrEqual(0.03);
      expect(arm.upperArmRadius).toBeLessThanOrEqual(0.034);
      expect(arm.forearmRadius).toBeGreaterThanOrEqual(0.026);
      expect(arm.forearmRadius).toBeLessThanOrEqual(0.03);
      expect(arm.opacity).toBeGreaterThanOrEqual(0.68);
      expect(arm.opacity).toBeLessThanOrEqual(0.76);
    }

    for (const sleeve of STICK_CONTACT_PROFILE.runner.bodyStickSleeves) {
      expect(sleeve.radius).toBeGreaterThanOrEqual(0.03);
      expect(sleeve.radius).toBeLessThanOrEqual(0.034);
      expect(sleeve.opacity).toBeGreaterThanOrEqual(0.7);
      expect(sleeve.opacity).toBeLessThanOrEqual(0.78);
    }

    for (const lock of STICK_CONTACT_PROFILE.runner.stickSideForearmLocks) {
      expect(lock.radius).toBeGreaterThanOrEqual(0.024);
      expect(lock.opacity).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('adds compact wrist gaskets at the controlled-stick hand targets', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripWristGaskets).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    for (const gasket of STICK_CONTACT_PROFILE.runner.gripWristGaskets) {
      expect(['topHand', 'bottomHand']).toContain(gasket.padName);
      expect(gasket.scale).toHaveLength(3);
      expect(gasket.scale[0]).toBeGreaterThanOrEqual(0.07);
      expect(gasket.scale[0]).toBeLessThanOrEqual(0.105);
      expect(gasket.scale[1]).toBeGreaterThanOrEqual(0.042);
      expect(gasket.scale[1]).toBeLessThanOrEqual(0.07);
      expect(gasket.scale[2]).toBeGreaterThanOrEqual(0.04);
      expect(gasket.scale[2]).toBeLessThanOrEqual(0.065);
      expect(gasket.opacity).toBeGreaterThanOrEqual(0.86);
    }

    for (const assembly of rig.handAssemblies) {
      expect(assembly.wristGasket).toBeTruthy();
      const targetGap = Math.hypot(
        assembly.wristGasket.position[0] - assembly.handTarget[0],
        assembly.wristGasket.position[1] - assembly.handTarget[1],
        assembly.wristGasket.position[2] - assembly.handTarget[2],
      );
      expect(targetGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap);
    }
  });

  it('uses close-camera wrist gaskets large enough to cover the stick-to-hand gap', () => {
    const rig = resolveRunnerCloseContactRig({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    for (const assembly of rig.handAssemblies) {
      expect(assembly.wristGasket).toBeTruthy();
      expect(assembly.wristGasket.scale[0]).toBeGreaterThanOrEqual(0.1);
      expect(assembly.wristGasket.scale[2]).toBeGreaterThanOrEqual(0.058);
      expect(assembly.wristGasket.opacity).toBeGreaterThanOrEqual(0.92);
      expect(assembly.wristGasket.position[2]).toBeGreaterThanOrEqual(assembly.handTarget[2] + 0.032);
    }
  });

  it('adds body-side grip pinch pads at the shared controlled-stick hand targets', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripPinchPads).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    for (const pinch of STICK_CONTACT_PROFILE.runner.gripPinchPads) {
      expect(['topHand', 'bottomHand']).toContain(pinch.padName);
      expect(pinch.scale).toHaveLength(3);
      expect(pinch.scale[0]).toBeGreaterThanOrEqual(0.068);
      expect(pinch.scale[0]).toBeLessThanOrEqual(0.105);
      expect(pinch.scale[1]).toBeGreaterThanOrEqual(0.036);
      expect(pinch.scale[1]).toBeLessThanOrEqual(0.062);
      expect(pinch.scale[2]).toBeGreaterThanOrEqual(0.052);
      expect(pinch.scale[2]).toBeLessThanOrEqual(0.082);
      expect(pinch.offset[2]).toBeGreaterThanOrEqual(0.036);
      expect(pinch.opacity).toBeGreaterThanOrEqual(0.9);
    }

    for (const assembly of rig.handAssemblies) {
      expect(assembly.gripPinchPad).toBeTruthy();
      const targetGap = Math.hypot(
        assembly.gripPinchPad.position[0] - assembly.handTarget[0],
        assembly.gripPinchPad.position[1] - assembly.handTarget[1],
        assembly.gripPinchPad.position[2] - assembly.handTarget[2],
      );
      expect(targetGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap);
      expect(assembly.gripPinchPad.position[2]).toBeGreaterThan(assembly.handTarget[2]);
    }
  });

  it('adds target-driven glove seams that clamp each hand across the controlled stick shaft', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripContactSeams).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });

    for (const assembly of rig.handAssemblies) {
      expect(assembly.gripContactSeam).toBeTruthy();
      expect(assembly.gripContactSeam.from).toHaveLength(3);
      expect(assembly.gripContactSeam.to).toHaveLength(3);
      expect(assembly.gripContactSeam.radius).toBeGreaterThanOrEqual(0.01);
      expect(assembly.gripContactSeam.radius).toBeLessThanOrEqual(0.026);
      expect(assembly.gripContactSeam.opacity).toBeGreaterThanOrEqual(0.88);

      const midpoint = [
        (assembly.gripContactSeam.from[0] + assembly.gripContactSeam.to[0]) / 2,
        (assembly.gripContactSeam.from[1] + assembly.gripContactSeam.to[1]) / 2,
        (assembly.gripContactSeam.from[2] + assembly.gripContactSeam.to[2]) / 2,
      ];
      const midpointGap = Math.hypot(
        midpoint[0] - assembly.handTarget[0],
        midpoint[1] - assembly.handTarget[1],
        midpoint[2] - assembly.handTarget[2],
      );
      const seamSpan = Math.hypot(
        assembly.gripContactSeam.from[0] - assembly.gripContactSeam.to[0],
        assembly.gripContactSeam.from[1] - assembly.gripContactSeam.to[1],
        assembly.gripContactSeam.from[2] - assembly.gripContactSeam.to[2],
      );

      expect(midpointGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap);
      expect(seamSpan).toBeGreaterThanOrEqual(0.11);
      expect(seamSpan).toBeLessThanOrEqual(0.2);
      expect(midpoint[2]).toBeGreaterThan(assembly.handTarget[2]);
    }
  });

  it('adds glove compression pockets around the exact controlled-stick hand targets', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripCompressionPockets).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });

    for (const assembly of rig.handAssemblies) {
      expect(assembly.gripCompressionPocket).toBeTruthy();
      expect(assembly.gripCompressionPocket.position).toHaveLength(3);
      expect(assembly.gripCompressionPocket.scale).toHaveLength(3);
      expect(assembly.gripCompressionPocket.opacity).toBeGreaterThanOrEqual(0.72);
      expect(assembly.gripCompressionPocket.opacity).toBeLessThanOrEqual(0.9);

      const pocketGap = Math.hypot(
        assembly.gripCompressionPocket.position[0] - assembly.handTarget[0],
        assembly.gripCompressionPocket.position[1] - assembly.handTarget[1],
        assembly.gripCompressionPocket.position[2] - assembly.handTarget[2],
      );

      expect(pocketGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap);
      expect(assembly.gripCompressionPocket.scale[0]).toBeGreaterThanOrEqual(0.075);
      expect(assembly.gripCompressionPocket.scale[1]).toBeGreaterThanOrEqual(0.034);
      expect(assembly.gripCompressionPocket.scale[2]).toBeGreaterThanOrEqual(0.03);
      expect(assembly.gripCompressionPocket.position[2]).toBeGreaterThan(assembly.handTarget[2]);
    }
  });

  it('derives one shared close-camera contact rig for sleeves, locks, and grip targets', () => {
    const rig = resolveRunnerCloseContactRig({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const targets = resolveRunnerStickContactTargets({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    expect(rig.inlineStickBodyBridgeCount).toBe(0);
    expect(rig.handAssemblies).toHaveLength(2);

    for (const assembly of rig.handAssemblies) {
      const target = targets[assembly.padName];
      expect(target).toBeTruthy();

      const handTargetGap = Math.hypot(
        assembly.handTarget[0] - target[0],
        assembly.handTarget[1] - target[1],
        assembly.handTarget[2] - target[2],
      );
      const sleeveGap = Math.hypot(
        assembly.bodySleeve.to[0] - target[0],
        assembly.bodySleeve.to[1] - target[1],
        assembly.bodySleeve.to[2] - target[2],
      );
      const lockGap = Math.hypot(
        assembly.forearmLock.to[0] - target[0],
        assembly.forearmLock.to[1] - target[1],
        assembly.forearmLock.to[2] - target[2],
      );

      expect(handTargetGap).toBeLessThanOrEqual(0.001);
      expect(sleeveGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap);
      expect(lockGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap + 0.035);
      expect(assembly.arm.upperLength).toBeGreaterThanOrEqual(0.18);
      expect(assembly.arm.forearmLength).toBeGreaterThanOrEqual(0.18);
      expect(assembly.gripShellOffset[2]).toBeGreaterThanOrEqual(0.055);
    }
  });

  it('adds torso-side stick anchors so runtime hand contact reads attached to the athlete', () => {
    expect(STICK_CONTACT_PROFILE.runner.torsoStickAnchors).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({ action: 'stick-handle', intensity: 1, stride: 0.4 });

    for (const assembly of rig.handAssemblies) {
      expect(assembly.torsoAnchor).toBeTruthy();
      expect(assembly.torsoAnchor.from).toHaveLength(3);
      expect(assembly.torsoAnchor.to).toHaveLength(3);
      expect(assembly.torsoAnchor.radius).toBeGreaterThanOrEqual(0.026);
      expect(assembly.torsoAnchor.radius).toBeLessThanOrEqual(0.046);
      expect(assembly.torsoAnchor.opacity).toBeGreaterThanOrEqual(0.84);

      const sleeveRootGap = Math.hypot(
        assembly.torsoAnchor.to[0] - assembly.bodySleeve.from[0],
        assembly.torsoAnchor.to[1] - assembly.bodySleeve.from[1],
        assembly.torsoAnchor.to[2] - assembly.bodySleeve.from[2],
      );
      expect(sleeveRootGap).toBeLessThanOrEqual(0.08);
      expect(assembly.torsoAnchor.from[2]).toBeGreaterThanOrEqual(0.3);
    }
  });

  it('adds torso overlap panels that merge stick-side arms back into the jersey mass', () => {
    expect(STICK_CONTACT_PROFILE.runner.torsoArmOverlapPanels).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });

    for (const assembly of rig.handAssemblies) {
      expect(assembly.torsoArmOverlap).toBeTruthy();
      expect(assembly.torsoArmOverlap.from).toHaveLength(3);
      expect(assembly.torsoArmOverlap.to).toHaveLength(3);
      expect(assembly.torsoArmOverlap.radius).toBeGreaterThanOrEqual(0.044);
      expect(assembly.torsoArmOverlap.radius).toBeLessThanOrEqual(0.052);
      expect(assembly.torsoArmOverlap.opacity).toBeGreaterThanOrEqual(0.42);
      expect(assembly.torsoArmOverlap.opacity).toBeLessThanOrEqual(0.58);

      const torsoGap = Math.hypot(
        assembly.torsoArmOverlap.from[0] - assembly.torsoAnchor.from[0],
        assembly.torsoArmOverlap.from[1] - assembly.torsoAnchor.from[1],
        assembly.torsoArmOverlap.from[2] - assembly.torsoAnchor.from[2],
      );
      const shoulderGap = Math.hypot(
        assembly.torsoArmOverlap.to[0] - assembly.arm.shoulder[0],
        assembly.torsoArmOverlap.to[1] - assembly.arm.shoulder[1],
        assembly.torsoArmOverlap.to[2] - assembly.arm.shoulder[2],
      );

      expect(torsoGap).toBeLessThanOrEqual(0.12);
      expect(shoulderGap).toBeLessThanOrEqual(0.24);
      expect(assembly.torsoArmOverlap.radius).toBeGreaterThan(assembly.arm.upperArmRadius);
    }
  });

  it('drives close-camera shoulder caps from the active stick-arm shoulder roots', () => {
    const restRig = resolveRunnerCloseContactRig({
      action: 'idle-ready',
      intensity: 0,
      speedMps: 1.2,
      stride: 0,
    });
    const activeRig = resolveRunnerCloseContactRig({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });
    const restByPad = Object.fromEntries(restRig.handAssemblies.map((assembly) => [assembly.padName, assembly]));

    for (const assembly of activeRig.handAssemblies) {
      const rest = restByPad[assembly.padName];

      expect(assembly.shoulderCap).toBeTruthy();
      expect(assembly.shoulderCap.position).toHaveLength(3);
      expect(assembly.shoulderCap.rotation).toHaveLength(3);
      expect(assembly.shoulderCap.radius).toBeGreaterThanOrEqual(assembly.arm.upperArmRadius);
      expect(assembly.shoulderCap.opacity).toBeGreaterThanOrEqual(0.64);
      expect(assembly.shoulderCap.opacity).toBeLessThanOrEqual(0.74);

      const shoulderGap = Math.hypot(
        assembly.shoulderCap.position[0] - assembly.arm.shoulder[0],
        assembly.shoulderCap.position[1] - assembly.arm.shoulder[1],
        assembly.shoulderCap.position[2] - assembly.arm.shoulder[2],
      );
      const capShift = Math.hypot(
        assembly.shoulderCap.position[0] - rest.shoulderCap.position[0],
        assembly.shoulderCap.position[1] - rest.shoulderCap.position[1],
        assembly.shoulderCap.position[2] - rest.shoulderCap.position[2],
      );

      expect(shoulderGap).toBeLessThanOrEqual(0.105);
      expect(capShift).toBeGreaterThanOrEqual(0.024);
      expect(assembly.shoulderCap.position[2]).toBeGreaterThan(rest.shoulderCap.position[2] + 0.018);
      expect(assembly.shoulderCap.position[2]).toBeGreaterThan(assembly.arm.shoulder[2] + 0.024);
    }
  });

  it('drives close-camera sleeve roots from the active upper-body pose', () => {
    const restRig = resolveRunnerCloseContactRig({
      action: 'idle-ready',
      intensity: 0,
      speedMps: 1.2,
      stride: 0,
    });
    const activeRig = resolveRunnerCloseContactRig({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });
    const restByPad = Object.fromEntries(restRig.handAssemblies.map((assembly) => [assembly.padName, assembly]));

    for (const assembly of activeRig.handAssemblies) {
      const rest = restByPad[assembly.padName];

      expect(assembly.poseDriver).toBeTruthy();
      expect(assembly.poseDriver.depth).toBeGreaterThanOrEqual(0.045);
      expect(assembly.bodySleeve.from[2] - rest.bodySleeve.from[2]).toBeGreaterThanOrEqual(0.045);
      expect(assembly.torsoAnchor.to[2] - rest.torsoAnchor.to[2]).toBeGreaterThanOrEqual(0.045);
    }
  });

  it('preserves cleaned production sleeves and gloves in broadcast while close review uses controlled stick gear', () => {
    expect(HIDDEN_PRODUCTION_RUNNER_PARTS).toEqual(expect.arrayContaining([
      'stick',
      'stickBlade',
      'pad',
    ]));
    expect(HIDDEN_PRODUCTION_RUNNER_PARTS).not.toContain('shoe');
    expect(HIDDEN_PRODUCTION_RUNNER_PARTS).not.toContain('compressionSleeve');
    expect(HIDDEN_PRODUCTION_RUNNER_PARTS).not.toContain('jerseySleeve');
    expect(HIDDEN_PRODUCTION_RUNNER_PARTS).not.toContain('glove');
    expect(getHiddenProductionRunnerParts(false)).not.toContain('compressionSleeve');
    expect(getHiddenProductionRunnerParts(false)).not.toContain('jerseySleeve');
    expect(getHiddenProductionRunnerParts(false)).not.toContain('glove');
    expect(getHiddenProductionRunnerParts(true)).toEqual(expect.arrayContaining(['compressionSleeve', 'jerseySleeve', 'glove']));
    expect(shouldRenderRunnerStickBodySleeves(false)).toBe(false);
    expect(STICK_CONTACT_PROFILE.runner.bodyElbowCaps).toHaveLength(2);

    for (const cap of STICK_CONTACT_PROFILE.runner.bodyElbowCaps) {
      expect([-1, 1]).toContain(cap.side);
      expect(cap.position).toHaveLength(3);
      expect(cap.length).toBeGreaterThanOrEqual(0.16);
      expect(cap.length).toBeLessThanOrEqual(0.32);
      expect(cap.radius).toBeGreaterThanOrEqual(0.033);
      expect(cap.radius).toBeLessThanOrEqual(0.06);
      expect(cap.opacity).toBeGreaterThanOrEqual(0.64);
      expect(cap.opacity).toBeLessThanOrEqual(0.74);
    }
  });

  it('keeps close-camera uniform accents rounded and secondary to the player body', () => {
    expect(CLOSE_CAMERA_UNIFORM_DETAIL_PROFILE.shoulderAccent.length).toBeLessThanOrEqual(0.15);
    expect(CLOSE_CAMERA_UNIFORM_DETAIL_PROFILE.shoulderAccent.radius).toBeLessThanOrEqual(0.012);
    expect(CLOSE_CAMERA_UNIFORM_DETAIL_PROFILE.shoulderAccent.opacity).toBeLessThanOrEqual(0.62);
    expect(CLOSE_CAMERA_UNIFORM_DETAIL_PROFILE.chestAccent.opacity).toBeLessThanOrEqual(0.72);
  });

  it('tightens runner arm and hand pose around active close-camera stick work', () => {
    const rest = resolveRunnerUpperBodyStickPose({ action: 'idle-ready', intensity: 0, speedMps: 1.2, stride: 0 });
    const active = resolveRunnerUpperBodyStickPose({ action: 'stick-handle', intensity: 1, speedMps: 2.8, stride: 0.4 });
    const receive = resolveRunnerUpperBodyStickPose({ action: 'receive-pass', intensity: 1, speedMps: 2.2, stride: -0.25 });

    expect(active.LeftForeArm.z).toBeGreaterThan(rest.LeftForeArm.z + 0.05);
    expect(active.RightForeArm.z).toBeLessThan(rest.RightForeArm.z - 0.05);
    expect(active.LeftHand.z).toBeGreaterThan(rest.LeftHand.z + 0.035);
    expect(active.RightHand.z).toBeLessThan(rest.RightHand.z - 0.035);
    expect(receive.LeftArm.y).toBeLessThan(rest.LeftArm.y);
    expect(receive.RightArm.y).toBeGreaterThan(rest.RightArm.y);
  });

  it('keeps default broadcast runner shoulders and upper arms compact enough to avoid a wide rest-pose silhouette', () => {
    const rest = resolveRunnerUpperBodyStickPose({ action: 'idle-ready', intensity: 0, speedMps: 1.2, stride: 0 });
    const active = resolveRunnerUpperBodyStickPose({ action: 'stick-handle', intensity: 1, speedMps: 2.8, stride: 0.4 });

    expect(rest.LeftShoulder.x).toBeLessThanOrEqual(0.78);
    expect(rest.RightShoulder.x).toBeLessThanOrEqual(0.78);
    expect(rest.LeftArm.x).toBeLessThanOrEqual(0.82);
    expect(rest.RightArm.x).toBeLessThanOrEqual(0.82);
    expect(active.LeftArm.x).toBeLessThanOrEqual(0.92);
    expect(active.RightArm.x).toBeLessThanOrEqual(0.92);
  });

  it('drives actual runner hand bones into the close-camera controlled-stick envelope', () => {
    const active = resolveRunnerUpperBodyStickPose({ action: 'stick-handle', intensity: 1, speedMps: 2.8, stride: 0.4 });
    const pass = resolveRunnerUpperBodyStickPose({ action: 'forehand-pass', intensity: 1, speedMps: 2.4, stride: 0.15 });

    expect(active.LeftHand.z).toBeGreaterThanOrEqual(0.17);
    expect(active.RightHand.z).toBeLessThanOrEqual(-0.17);
    expect(pass.LeftHand.z).toBeGreaterThanOrEqual(0.2);
    expect(pass.RightHand.z).toBeLessThanOrEqual(-0.24);
  });

  it('pushes active runner hand bones visibly into the controlled grip shell', () => {
    const active = resolveRunnerUpperBodyStickPose({ action: 'stick-handle', intensity: 1, speedMps: 2.8, stride: 0.4 });

    expect(active.LeftHand.z).toBeGreaterThanOrEqual(0.2);
    expect(active.RightHand.z).toBeLessThanOrEqual(-0.2);
    expect(Math.abs(active.LeftHand.z - active.RightHand.z)).toBeGreaterThanOrEqual(0.4);
  });

  it('closes active player-read hand bones deeply enough that the stick reads held, not side-mounted', () => {
    const active = resolveRunnerUpperBodyStickPose({ action: 'stick-handle', intensity: 1, speedMps: 2.8, stride: 0.4 });

    expect(active.LeftHand.z).toBeGreaterThanOrEqual(0.235);
    expect(active.RightHand.z).toBeLessThanOrEqual(-0.235);
    expect(Math.abs(active.LeftHand.z - active.RightHand.z)).toBeGreaterThanOrEqual(0.48);
  });

  it('moves actual hand bones with active stick-handle sweep so close-camera grips track the controlled stick', () => {
    const forwardSweep = resolveRunnerUpperBodyStickPose({ action: 'stick-handle', intensity: 1, speedMps: 2.8, stride: 0.4 });
    const backSweep = resolveRunnerUpperBodyStickPose({ action: 'stick-handle', intensity: 1, speedMps: 2.8, stride: -0.4 });

    expect(forwardSweep.LeftHand.z - backSweep.LeftHand.z).toBeGreaterThanOrEqual(0.07);
    expect(backSweep.RightHand.z - forwardSweep.RightHand.z).toBeGreaterThanOrEqual(0.07);
    expect(Math.abs(forwardSweep.LeftHand.y - backSweep.LeftHand.y)).toBeGreaterThanOrEqual(0.025);
    expect(Math.abs(forwardSweep.RightHand.y - backSweep.RightHand.y)).toBeGreaterThanOrEqual(0.025);
  });

  it('turns close-camera head, chest, and shoulders into active stick work', () => {
    const rest = resolveRunnerUpperBodyStickPose({ action: 'idle-ready', intensity: 0, speedMps: 1.2, stride: 0 });
    const active = resolveRunnerUpperBodyStickPose({ action: 'stick-handle', intensity: 1, speedMps: 2.8, stride: 0.4 });
    const pass = resolveRunnerUpperBodyStickPose({ action: 'forehand-pass', intensity: 1, speedMps: 2.4, stride: 0.15 });

    expect(active.Head).toBeTruthy();
    expect(active.Neck.y).toBeGreaterThan(rest.Neck.y + 0.035);
    expect(active.Head.y).toBeGreaterThan(rest.Head.y + 0.055);
    expect(active.Spine2.y).toBeGreaterThan(rest.Spine2.y + 0.025);
    expect(pass.Head.y).toBeGreaterThan(rest.Head.y + 0.08);
    expect(pass.LeftShoulder.z).toBeLessThan(rest.LeftShoulder.z - 0.03);
    expect(pass.RightShoulder.z).toBeGreaterThan(rest.RightShoulder.z + 0.03);
  });

  it('keeps the forehand-pass stick release inside the close-camera shoulder-to-hand envelope', () => {
    const active = resolveRunnerStickPose({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const pass = resolveRunnerStickPose({ action: 'forehand-pass', intensity: 1, stride: 0.15 });

    expect(pass.position[0]).toBeLessThanOrEqual(0.27);
    expect(pass.position[2]).toBeLessThanOrEqual(0.36);
    expect(pass.position[0] - active.position[0]).toBeLessThanOrEqual(0.055);
    expect(pass.position[2] - active.position[2]).toBeLessThanOrEqual(0.145);
  });

  it('keeps forehand-pass stick work tight enough to stay inside the close-camera hand envelope', () => {
    const active = resolveRunnerStickPose({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const pass = resolveRunnerStickPose({ action: 'forehand-pass', intensity: 1, stride: 0.15 });

    expect(pass.position[0] - active.position[0]).toBeLessThanOrEqual(0.035);
    expect(pass.position[2]).toBeLessThanOrEqual(0.325);
    expect(pass.position[2] - active.position[2]).toBeLessThanOrEqual(0.115);
  });

  it('uses dark controlled-stick glove palms with only restrained team accents in close cameras', () => {
    const home = resolveControlledStickGearColors('us', { jersey: '#f8fafc', stripe: '#1d4ed8' });
    const away = resolveControlledStickGearColors('opponent', { jersey: '#dc2626', stripe: '#fee2e2' });

    expect(CONTROLLED_STICK_GEAR_PROFILE.palm).toBe('#111827');
    expect(home.glove).toBe(CONTROLLED_STICK_GEAR_PROFILE.palm);
    expect(away.glove).toBe(CONTROLLED_STICK_GEAR_PROFILE.palm);
    expect(home.gloveHighlight).toBe('#334155');
    expect(away.gloveHighlight).toBe('#334155');
    expect(home.cuff).toBe('#1d4ed8');
    expect(away.cuff).toBe('#ef4444');
    expect(home.sleeve).toBe('#f8fafc');
    expect(away.sleeve).toBe('#dc2626');
  });

  it('adds moving shaft-seat shadows inside each controlled-stick glove grip', () => {
    expect(STICK_CONTACT_PROFILE.runner.gripShaftSeats).toHaveLength(2);

    const restSeats = resolveRunnerStickGripSeats({ action: 'idle-ready', intensity: 0, stride: 0 });
    const activeSeats = resolveRunnerStickGripSeats({ action: 'stick-handle', intensity: 1, stride: 0.4 });
    const activePads = Object.fromEntries(
      resolveRunnerStickContactPads({ action: 'stick-handle', intensity: 1, stride: 0.4 })
        .map((pad) => [pad.name, pad]),
    );
    const restByPad = Object.fromEntries(restSeats.map((seat) => [seat.padName, seat]));

    for (const seat of activeSeats) {
      const pad = activePads[seat.padName];
      const rest = restByPad[seat.padName];

      expect(pad).toBeTruthy();
      expect(seat.scale).toHaveLength(3);
      expect(seat.scale[0]).toBeGreaterThanOrEqual(0.07);
      expect(seat.scale[0]).toBeLessThanOrEqual(0.11);
      expect(seat.scale[2]).toBeGreaterThanOrEqual(0.04);
      expect(seat.opacity).toBeGreaterThanOrEqual(0.58);
      expect(seat.opacity).toBeLessThanOrEqual(0.82);

      const localGap = Math.hypot(
        seat.position[0] - pad.lateral,
        seat.position[1] - pad.shaftY,
        seat.position[2] - (pad.depth ?? 0.034),
      );
      const activeShift = Math.hypot(
        seat.position[0] - rest.position[0],
        seat.position[1] - rest.position[1],
        seat.position[2] - rest.position[2],
      );

      expect(localGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap + 0.02);
      expect(seat.position[2]).toBeGreaterThan((pad.depth ?? 0.034) + 0.034);
      expect(activeShift).toBeGreaterThanOrEqual(0.01);
    }
  });

  it('adds continuous close-camera sleeve silhouettes from shoulder to controlled-stick grips', () => {
    expect(STICK_CONTACT_PROFILE.runner.stickArmSilhouettePanels).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });

    for (const panel of STICK_CONTACT_PROFILE.runner.stickArmSilhouettePanels) {
      expect(['topHand', 'bottomHand']).toContain(panel.padName);
      expect(panel.fromT).toBeGreaterThanOrEqual(0);
      expect(panel.toT).toBeGreaterThan(panel.fromT);
      expect(panel.toT).toBeLessThanOrEqual(1);
      expect(panel.radius).toBeGreaterThanOrEqual(0.052);
      expect(panel.radius).toBeLessThanOrEqual(0.064);
      expect(panel.opacity).toBeGreaterThanOrEqual(0.32);
      expect(panel.opacity).toBeLessThanOrEqual(0.48);
    }

    for (const assembly of rig.handAssemblies) {
      expect(assembly.armSilhouette).toBeTruthy();
      expect(assembly.armSilhouette.from).toHaveLength(3);
      expect(assembly.armSilhouette.to).toHaveLength(3);
      expect(assembly.armSilhouette.radius).toBeGreaterThan(assembly.arm.upperArmRadius);
      expect(assembly.armSilhouette.radius).toBeGreaterThan(assembly.arm.forearmRadius);
      expect(assembly.armSilhouette.opacity).toBeLessThanOrEqual(0.48);

      const handGap = Math.hypot(
        assembly.armSilhouette.to[0] - assembly.handTarget[0],
        assembly.armSilhouette.to[1] - assembly.handTarget[1],
        assembly.armSilhouette.to[2] - assembly.handTarget[2],
      );
      expect(handGap).toBeLessThanOrEqual(STICK_CONTACT_PROFILE.runner.maxVisualHandGap + 0.035);
      expect(assembly.armSilhouette.from[2]).toBeGreaterThanOrEqual(assembly.arm.shoulder[2] + 0.02);
    }
  });

  it('adds uniform sleeve bands along the close-camera stick arms so they read as athlete gear', () => {
    expect(STICK_CONTACT_PROFILE.runner.stickArmStripeBands).toHaveLength(2);

    const rig = resolveRunnerCloseContactRig({
      action: 'stick-handle',
      intensity: 1,
      speedMps: 2.8,
      stride: 0.4,
    });

    for (const profile of STICK_CONTACT_PROFILE.runner.stickArmStripeBands) {
      expect(['topHand', 'bottomHand']).toContain(profile.padName);
      expect(profile.bands).toHaveLength(2);

      for (const band of profile.bands) {
        expect(band.fromT).toBeGreaterThanOrEqual(0.18);
        expect(band.toT).toBeGreaterThan(band.fromT);
        expect(band.toT).toBeLessThanOrEqual(0.86);
        expect(band.radius).toBeGreaterThanOrEqual(0.04);
        expect(band.radius).toBeLessThanOrEqual(0.052);
        expect(band.opacity).toBeGreaterThanOrEqual(0.42);
        expect(band.opacity).toBeLessThanOrEqual(0.58);
      }
    }

    for (const assembly of rig.handAssemblies) {
      expect(assembly.armStripeBands).toHaveLength(2);

      for (const band of assembly.armStripeBands) {
        expect(band.from).toHaveLength(3);
        expect(band.to).toHaveLength(3);
        expect(band.radius).toBeGreaterThan(assembly.arm.forearmRadius);
        expect(band.radius).toBeLessThanOrEqual(assembly.armSilhouette.radius);
        expect(band.opacity).toBeGreaterThanOrEqual(0.42);
        expect(band.opacity).toBeLessThanOrEqual(0.58);

        const startGap = Math.hypot(
          band.from[0] - assembly.arm.shoulder[0],
          band.from[1] - assembly.arm.shoulder[1],
          band.from[2] - assembly.arm.shoulder[2],
        );
        const handGap = Math.hypot(
          band.to[0] - assembly.handTarget[0],
          band.to[1] - assembly.handTarget[1],
          band.to[2] - assembly.handTarget[2],
        );

        expect(startGap).toBeGreaterThanOrEqual(0.06);
        expect(handGap).toBeGreaterThanOrEqual(0.05);
      }
    }
  });

  it('defines rounded close-camera runner shoe overlays that stay secondary to the athlete', () => {
    expect(RUNNER_CLOSE_GEAR_PROFILE.shoes).toHaveLength(2);

    for (const shoe of RUNNER_CLOSE_GEAR_PROFILE.shoes) {
      expect([-1, 1]).toContain(shoe.side);
      expect(shoe.basePosition).toHaveLength(3);
      expect(shoe.strideDepth).toBeGreaterThanOrEqual(0.035);
      expect(shoe.strideDepth).toBeLessThanOrEqual(0.075);
      expect(shoe.upperScale[0]).toBeLessThanOrEqual(0.13);
      expect(shoe.upperScale[2]).toBeGreaterThanOrEqual(0.13);
      expect(shoe.toeScale[2]).toBeLessThanOrEqual(0.09);
      expect(shoe.laceCount).toBeGreaterThanOrEqual(2);
      expect(shoe.laceCount).toBeLessThanOrEqual(3);
      expect(shoe.opacity).toBeLessThanOrEqual(0.94);
    }
  });

  it('adds rounded shin and knee gear so close cameras do not read blocky lower legs', () => {
    expect(RUNNER_CLOSE_GEAR_PROFILE.shinGuards).toHaveLength(2);
    expect(RUNNER_CLOSE_GEAR_PROFILE.kneeCaps).toHaveLength(2);

    for (const guard of RUNNER_CLOSE_GEAR_PROFILE.shinGuards) {
      expect([-1, 1]).toContain(guard.side);
      expect(guard.basePosition).toHaveLength(3);
      expect(guard.scale[0]).toBeLessThanOrEqual(0.095);
      expect(guard.scale[1]).toBeGreaterThanOrEqual(0.16);
      expect(guard.scale[2]).toBeLessThanOrEqual(0.06);
      expect(guard.strideDepth).toBeGreaterThanOrEqual(0.035);
      expect(guard.opacity).toBeGreaterThanOrEqual(0.78);
      expect(guard.opacity).toBeLessThanOrEqual(0.92);
    }

    for (const cap of RUNNER_CLOSE_GEAR_PROFILE.kneeCaps) {
      expect([-1, 1]).toContain(cap.side);
      expect(cap.basePosition).toHaveLength(3);
      expect(cap.scale[0]).toBeGreaterThanOrEqual(0.07);
      expect(cap.scale[1]).toBeGreaterThanOrEqual(0.045);
      expect(cap.scale[2]).toBeGreaterThanOrEqual(0.04);
      expect(cap.opacity).toBeGreaterThanOrEqual(0.78);
      expect(cap.opacity).toBeLessThanOrEqual(0.92);
    }
  });

  it('adds lightweight close-camera helmet cage and chin-strap gear', () => {
    expect(RUNNER_CLOSE_GEAR_PROFILE.headGear).toBeTruthy();
    expect(RUNNER_CLOSE_GEAR_PROFILE.headGear.cageBars).toHaveLength(4);
    expect(RUNNER_CLOSE_GEAR_PROFILE.headGear.earGuards).toHaveLength(2);

    for (const bar of RUNNER_CLOSE_GEAR_PROFILE.headGear.cageBars) {
      expect(bar.position).toHaveLength(3);
      expect(bar.length).toBeGreaterThanOrEqual(0.12);
      expect(bar.length).toBeLessThanOrEqual(0.34);
      expect(bar.radius).toBeGreaterThanOrEqual(0.004);
      expect(bar.radius).toBeLessThanOrEqual(0.012);
      expect(bar.opacity).toBeGreaterThanOrEqual(0.64);
      expect(bar.opacity).toBeLessThanOrEqual(0.9);
    }

    expect(RUNNER_CLOSE_GEAR_PROFILE.headGear.chinStrap.length).toBeGreaterThanOrEqual(0.18);
    expect(RUNNER_CLOSE_GEAR_PROFILE.headGear.chinStrap.radius).toBeLessThanOrEqual(0.012);
    expect(RUNNER_CLOSE_GEAR_PROFILE.headGear.chinStrap.opacity).toBeGreaterThanOrEqual(0.68);

    for (const guard of RUNNER_CLOSE_GEAR_PROFILE.headGear.earGuards) {
      expect([-1, 1]).toContain(guard.side);
      expect(guard.scale).toHaveLength(3);
      expect(guard.scale[0]).toBeGreaterThanOrEqual(0.028);
      expect(guard.scale[1]).toBeGreaterThanOrEqual(0.04);
      expect(guard.scale[2]).toBeLessThanOrEqual(0.024);
      expect(guard.opacity).toBeGreaterThanOrEqual(0.68);
    }
  });
});
