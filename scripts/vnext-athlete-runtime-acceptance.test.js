import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { VNEXT_3D_GATES, VNEXT_3D_RELEASE } from '../src/vnext3d/productionReadiness';

const root = path.resolve(import.meta.dirname, '..');
const assets = [
  ['asset-inbox/players/vnext/candidates/goon-field-player-home-contact-v1.glb', 'src/assets/vnext3d/field-home.glb'],
  ['asset-inbox/players/vnext/candidates/goon-field-player-away-contact-v1.glb', 'src/assets/vnext3d/field-away.glb'],
  ['asset-inbox/players/vnext/candidates/goon-goalie-home-v1.glb', 'src/assets/vnext3d/goalie-home.glb'],
  ['asset-inbox/players/vnext/candidates/goon-goalie-away-v1.glb', 'src/assets/vnext3d/goalie-away.glb'],
];

function bytes(relativePath) {
  return fs.readFileSync(path.join(root, relativePath));
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

describe('vNext production athlete runtime', () => {
  it('uses byte-identical accepted field-player and goalie sources', () => {
    for (const [candidate, runtime] of assets) {
      expect(sha256(bytes(runtime))).toBe(sha256(bytes(candidate)));
    }
    const uniqueRuntimeBytes = assets.reduce((total, [, runtime]) => total + bytes(runtime).length, 0);
    expect(uniqueRuntimeBytes).toBeLessThan(10_000_000);
  });

  it('contains no legacy player, primitive equipment, or fallback import', () => {
    const preview = fs.readFileSync(path.join(root, 'src/components/vnext3d/ProductionReplayPreview.jsx'), 'utf8');
    const athlete = fs.readFileSync(path.join(root, 'src/components/vnext3d/ProductionAthlete.jsx'), 'utf8');
    const combined = `${preview}\n${athlete}`;
    expect(combined).not.toContain('ReplayPlayer');
    expect(combined).not.toContain('goon-runner');
    expect(combined).not.toContain('goon-player.glb');
    expect(combined).not.toContain('primitive equipment');
    expect(athlete).toContain("object.name === 'GS_Contact_Ball'");
    expect(athlete).toContain("model.getObjectByName('GS_Contact_Ball')");
    expect(athlete).toContain('contactBounds.makeEmpty().setFromObject(contactBallRef.current).getCenter(contactWorld)');
    expect(athlete).toContain('contactBallRef.current.visible = false');
    expect(athlete).toContain('/shoe|sole/i');
    expect(athlete).toContain('shoe.computeBoundingBox?.()');
    expect(athlete).toContain('groundCorrectionForMinimum');
    expect(athlete).toContain('actionPhase * duration');
    expect(preview).toContain('createProductionRuntimePlayers(frame, motionReview, motionTuning)');
    expect(athlete).toContain('worldMotionRef.current.cyclesPerSecond * worldMotionRef.current.sampleElapsed');
    expect(athlete.indexOf('mixer.update(0);')).toBeLessThan(
      athlete.indexOf('athleteGroup?.updateMatrixWorld(true);'),
    );
    expect(athlete.indexOf('activeClipRef.current = null;')).toBeLessThan(
      athlete.indexOf('mixer.stopAllAction();'),
    );
    expect(athlete).toContain("kind: 'authored'");
    expect(athlete).toContain('authoredTransitionClip');
    expect(athlete).toContain('AUTHORED_TRANSITION_MAX_STEP_SECONDS');
    expect(athlete).toContain('transition.worldVelocity');
    expect(preview).toContain("'cmu-jog16-ik-continuous-jersey',");
    expect(preview).toContain("'cmu-jog16-ik-upper-body',");
    expect(preview).toContain("'cmu-jog16-ik-open-face',");
    expect(preview).toContain("'cmu-jog16-ik-natural-grip',");
    expect(preview).toContain("'cmu-jog16-ik-diagonal-stick',");
    expect(preview).toContain('data-transition-authored-clip');
    expect(preview).toContain('data-transition-authored-foot-slide-p95-mm');
    expect(preview).toContain('data-transition-authored-clearance-p95-mm');
    expect(preview).toContain('motionPhaseCycles={player.motionPhaseCycles}');
    expect(preview).toContain('segments={renderProfile.ballSegments}');
    expect(preview).toContain('data-goalie-home-action');
    expect(preview).toContain('data-goalie-away-action');
    expect(preview).toContain('data-camera-tracking');
    expect(preview).toContain('data-render-profile');
    expect(preview).toContain('data-frame-p95-ms');
    expect(preview).toContain('data-ground-min-mm');
    expect(preview).toContain('data-grounded-player-count');
    expect(preview).toContain('data-selected-athlete-action');
    expect(preview).toContain('data-selected-athlete-cadence-hz');
    expect(preview).toContain('data-foot-slide-p95-mm');
    expect(preview).toContain('gl={{ antialias: renderProfile.antialias');
  });

  it('keeps the runtime in review until visual and performance gates finish', () => {
    expect(VNEXT_3D_RELEASE.acceptedForPublicRuntime).toBe(false);
    expect(VNEXT_3D_GATES.at(-1)).toMatchObject({ status: 'review', statusLabel: 'RUNTIME REVIEW' });
  });

  it('records nonblank desktop, tablet, mobile, and paired close-camera evidence', () => {
    const evidence = [
      'docs/vnext/evidence/athlete-runtime/runtime-desktop-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-tablet-768x1024.png',
      'docs/vnext/evidence/athlete-runtime/runtime-mobile-390x844.png',
      'docs/vnext/evidence/athlete-runtime/runtime-broadcast-action-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-broadcast-action-mobile-390x844.png',
      'docs/vnext/evidence/athlete-runtime/runtime-grounding-role-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-grounding-pass-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-grounding-mobile-390x844.png',
      'docs/vnext/evidence/athlete-runtime/runtime-cadence-carrier-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-cadence-wing-mobile-390x844.png',
      'docs/vnext/evidence/athlete-runtime/runtime-cadence-goalie-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-foot-slide-live-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-foot-slide-live-mobile-390x844.png',
      'docs/vnext/evidence/athlete-runtime/runtime-role-close-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-stride-phase-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-contact-release-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-contact-receive-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-goalie-shuffle-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-goalie-set-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-cmu-sprint-role-desktop-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-cmu-sprint-role-mobile-390x844.png',
      'docs/vnext/evidence/athlete-runtime/runtime-cmu-run-jog-desktop-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-cmu-run-jog-mobile-390x844.png',
      'docs/vnext/evidence/athlete-runtime/runtime-cmu16-jog-desktop-1280x720.png',
      'docs/vnext/evidence/athlete-runtime/runtime-cmu16-jog-mobile-390x844.png',
    ];
    for (const relativePath of evidence) {
      const stat = fs.statSync(path.join(root, relativePath));
      expect(stat.isFile()).toBe(true);
      expect(stat.size).toBeGreaterThan(30_000);
    }
  });

  it('records responsive profiles and measured frame-time evidence for all target layouts', () => {
    const evidence = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/vnext/evidence/athlete-runtime/runtime-performance.json'), 'utf8'),
    );
    const expectedProfiles = {
      desktop: 'desktop-high',
      tablet: 'tablet-balanced',
      mobile: 'mobile-efficient',
    };

    for (const [layout, profile] of Object.entries(expectedProfiles)) {
      const measurement = evidence[layout];
      expect(measurement.renderProfile).toBe(profile);
      expect(measurement.playerCount).toBe(12);
      expect(measurement.canvasCount).toBe(1);
      expect(measurement.bodyWidth).toBe(measurement.viewport.width);
      expect(measurement.sampleCount).toBeGreaterThanOrEqual(119);
      expect(measurement.p95Ms).toBeLessThanOrEqual(34);
      expect(measurement.under30FpsFrames).toBeLessThanOrEqual(2);
    }
  });

  it('records an action-tracking broadcast view and a materially closer role camera', () => {
    const evidence = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/vnext/evidence/athlete-runtime/runtime-camera-review.json'), 'utf8'),
    );

    for (const layout of ['desktopBroadcast', 'mobileBroadcast']) {
      const review = evidence[layout];
      expect(review.tracking).toBe('action');
      expect(review.scenePlayerCount).toBe(12);
      expect(review.canvasCount).toBe(1);
      expect(review.bodyWidth).toBe(review.viewport.width);
      expect(review.fullRoundedCourtVisible).toBe(true);
      expect(review.bothGoaliesVisible).toBe(true);
    }

    expect(evidence.roleCamera).toMatchObject({
      tracking: 'role',
      selectedRole: 'C',
      scenePlayerCount: 12,
    });
    expect(evidence.roleCamera.projectedAthleteScaleGain).toBeGreaterThanOrEqual(1.5);
    expect(evidence.browserErrors).toEqual([]);
  });

  it('records shoe-derived grounding without suppressing natural running flight', () => {
    const evidence = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/vnext/evidence/athlete-runtime/runtime-grounding-review.json'), 'utf8'),
    );

    expect(evidence.policy).toMatchObject({
      floorPenetrationToleranceMm: 4,
      naturalFlightClips: ['jog', 'sprint'],
      largeDramaticShadowsAdded: false,
    });

    for (const key of ['desktopRoleAt4_6Seconds', 'mobileBroadcastAt4_6Seconds', 'boardPassAt2_45Seconds']) {
      const review = evidence[key];
      expect(review.scenePlayerCount).toBe(12);
      expect(review.groundSampleCount).toBe(12);
      expect(review.groundMinimumMm).toBeGreaterThanOrEqual(-4);
      expect(review.groundMaximumMm).toBeLessThanOrEqual(25);
      expect(review.groundMaximumCorrectionMm).toBeLessThanOrEqual(40);
      expect(review.groundedPlayerCount).toBeGreaterThanOrEqual(10);
      expect(review.bodyWidth).toBe(review.viewport.width);
    }

    expect(evidence.boardPassAt2_45Seconds).toMatchObject({
      ballContact: 'release',
      ballContactTarget: 'US_LD',
      groundedPlayerCount: 11,
    });
    expect(evidence.boardPassAt2_45Seconds.frameP95Ms).toBeLessThanOrEqual(34);
    expect(evidence.browserErrors).toEqual([]);
  });

  it('records source-calibrated cadence for carriers and goalies', () => {
    const evidence = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/vnext/evidence/athlete-runtime/runtime-cadence-review.json'), 'utf8'),
    );

    expect(evidence.sourceCalibration.jog.currentCycleDurationSeconds).toBe(1.067);
    expect(evidence.sourceCalibration.sprint.currentCycleDurationSeconds).toBe(0.933);
    expect(evidence.sourceCalibration.goalieShuffle.currentCycleDistanceMeters).toBe(0.14);

    for (const key of ['ldCarrierAt2Seconds', 'lwCarrierAt4_9Seconds', 'goalieAt1_5Seconds']) {
      const review = evidence[key];
      expect(review.scenePlayerCount).toBe(12);
      expect(review.bodyWidth).toBe(review.viewport.width);
      expect(review.groundMinimumMm).toBeGreaterThanOrEqual(-4);
      expect(review.frameP95Ms).toBeLessThanOrEqual(34);
    }

    expect(evidence.ldCarrierAt2Seconds).toMatchObject({
      ballContact: 'carry',
      ballContactTarget: 'US_LD',
      selectedAction: 'sprint',
    });
    expect(evidence.ldCarrierAt2Seconds.selectedCycleSeconds).toBeGreaterThan(0.75);
    expect(evidence.ldCarrierAt2Seconds.selectedCycleSeconds).toBeLessThan(0.9);
    expect(evidence.lwCarrierAt4_9Seconds).toMatchObject({
      ballContact: 'carry',
      ballContactTarget: 'US_LW',
      selectedAction: 'sprint',
    });
    expect(evidence.lwCarrierAt4_9Seconds.selectedCycleSeconds).toBeGreaterThan(0.9);
    expect(evidence.lwCarrierAt4_9Seconds.selectedCycleSeconds).toBeLessThan(1.1);
    expect(evidence.goalieAt1_5Seconds.selectedAction).toBe('goalie-shuffle');
    expect(evidence.goalieAt1_5Seconds.selectedCycleSeconds).toBeLessThan(1.4);
    expect(evidence.browserErrors).toEqual([]);
  });

  it('fails continuous-play approval when planted feet still slide', () => {
    const evidence = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/vnext/evidence/athlete-runtime/runtime-foot-slide-review.json'), 'utf8'),
    );

    expect(evidence.automatedDecision).toBe('fail');
    expect(evidence.policy).toMatchObject({
      plantedClearanceMm: 15,
      slidingTargetP95MmPerFrame: 35,
      sustainedFrameTargetP95Ms: 34,
      largeDramaticShadowsAdded: false,
    });

    for (const key of ['desktopRoleContinuous', 'mobileRoleContinuous']) {
      const review = evidence[key];
      expect(review.scenePlayerCount).toBe(12);
      expect(review.sampleCount).toBeGreaterThanOrEqual(1000);
      expect(review.bodyWidth).toBe(review.viewport.width);
      expect(review.groundMinimumMm).toBeGreaterThanOrEqual(-4);
      expect(review.p95MmPerFrame).toBeGreaterThan(evidence.policy.slidingTargetP95MmPerFrame);
      expect(review.frameP95Ms).toBeGreaterThan(evidence.policy.sustainedFrameTargetP95Ms);
      expect(review.passesSlidingTarget).toBe(false);
      expect(review.passesFrameTarget).toBe(false);
    }
  });

  it('records a passing private captured-sprint window without promoting it', () => {
    const evidence = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/vnext/evidence/athlete-runtime/runtime-cmu-sprint-review.json'), 'utf8'),
    );

    expect(evidence).toMatchObject({
      candidate: 'cmu-sprint',
      automatedDecision: 'private-sprint-window-pass',
      promotionDecision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      browserErrors: [],
    });
    expect(evidence.visualReview).toMatchObject({
      frontCrestsTrackTorso: true,
      detachedBackNumbersVisible: false,
    });

    for (const key of ['desktopRoleSprint', 'mobileRoleSprint']) {
      const review = evidence[key];
      expect(review).toMatchObject({
        scenePlayerCount: 12,
        canvasCount: 1,
        motionReview: 'cmu-sprint',
        selectedAction: 'sprint',
        sampleCount: 120,
        groundSampleCount: 12,
        horizontalOverflow: false,
      });
      expect(review.plantedSampleCount).toBeGreaterThanOrEqual(1_000);
      expect(review.p95MmPerFrame).toBeLessThanOrEqual(evidence.policy.slidingTargetP95MmPerFrame);
      expect(review.frameP95Ms).toBeLessThanOrEqual(evidence.policy.sustainedFrameTargetP95Ms);
      expect(review.groundMinimumMm).toBeGreaterThanOrEqual(-evidence.policy.floorPenetrationToleranceMm);
      expect(review.bodyWidth).toBe(review.viewport.width);
      expect(fs.statSync(path.join(root, review.screenshot)).size).toBeGreaterThan(30_000);
    }

    expect(evidence.desktopRoleSprint.p95MmPerFrame)
      .toBeLessThan(evidence.acceptedBaseline.desktopRoleContinuous.p95MmPerFrame * 0.25);
    expect(evidence.mobileRoleSprint.p95MmPerFrame)
      .toBeLessThan(evidence.acceptedBaseline.mobileRoleContinuous.p95MmPerFrame * 0.3);
    expect(evidence.remainingGates).toHaveLength(5);
  });

  it('rejects the sprint-derived jog when cross-device motion does not pass consistently', () => {
    const evidence = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/vnext/evidence/athlete-runtime/runtime-cmu-jog-review.json'), 'utf8'),
    );

    expect(evidence).toMatchObject({
      candidate: 'cmu-run',
      automatedDecision: 'fail',
      promotionDecision: 'do-not-promote-jog',
      publicRuntimeAllowed: false,
      crossDeviceApproval: false,
      browserErrors: [],
    });
    expect(evidence.sourceCalibration.relativeCycleError).toBeGreaterThan(0.35);

    for (const key of ['desktopRoleContinuous', 'mobileRoleContinuous']) {
      const review = evidence[key];
      expect(review).toMatchObject({
        scenePlayerCount: 12,
        canvasCount: 1,
        motionReview: 'cmu-run',
        selectedAction: 'jog',
        sampleCount: 120,
        groundSampleCount: 12,
        horizontalOverflow: false,
        passesFrameTarget: true,
      });
      expect(review.frameP95Ms).toBeLessThanOrEqual(evidence.policy.sustainedFrameTargetP95Ms);
      expect(review.groundMinimumMm).toBeGreaterThanOrEqual(-evidence.policy.floorPenetrationToleranceMm);
      expect(review.bodyWidth).toBe(review.viewport.width);
      expect(fs.statSync(path.join(root, review.screenshot)).size).toBeGreaterThan(30_000);
    }

    expect(evidence.desktopRoleContinuous.passesSlidingTarget).toBe(false);
    expect(evidence.desktopRoleContinuous.p95MmPerFrame)
      .toBeGreaterThan(evidence.policy.slidingTargetP95MmPerFrame);
    expect(evidence.mobileRoleContinuous.passesSlidingTarget).toBe(true);
    expect(evidence.tuningHistory).toHaveLength(3);
    expect(evidence.replacementSource).toMatchObject({
      subject: 16,
      trial: 35,
      status: 'downloaded-and-integrity-checked',
    });
  });

  it('records a passing private Subject 16 jog window while transitions remain open', () => {
    const evidence = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/vnext/evidence/athlete-runtime/runtime-cmu16-jog-review.json'), 'utf8'),
    );
    expect(evidence).toMatchObject({
      candidate: 'cmu-jog16',
      automatedDecision: 'private-jog-window-pass',
      promotionDecision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      crossDeviceJogApproval: true,
      completePlayTransitionApproval: false,
      browserErrors: [],
    });
    expect(evidence.source.selectedLoopSeamMaximumAngleDegrees).toBeLessThan(5);
    expect(evidence.retarget.measuredCycleDistanceMeters)
      .toBe(evidence.retarget.runtimeReviewCycleDistanceMeters);
    expect(evidence.retarget.leftStanceSampleCount).toBe(8);
    expect(evidence.retarget.rightStanceSampleCount).toBe(8);

    for (const key of ['desktopRoleContinuous', 'mobileRoleContinuous']) {
      const review = evidence[key];
      expect(review).toMatchObject({
        scenePlayerCount: 12,
        canvasCount: 1,
        motionReview: 'cmu-jog16',
        selectedAction: 'jog',
        sampleCount: 120,
        groundSampleCount: 12,
        horizontalOverflow: false,
        passesSlidingTarget: true,
        passesFrameTarget: true,
      });
      expect(review.p95MmPerFrame).toBeLessThanOrEqual(evidence.policy.slidingTargetP95MmPerFrame);
      expect(review.frameP95Ms).toBeLessThanOrEqual(evidence.policy.sustainedFrameTargetP95Ms);
      expect(review.groundMinimumMm).toBeGreaterThanOrEqual(-evidence.policy.floorPenetrationToleranceMm);
      expect(review.bodyWidth).toBe(review.viewport.width);
      expect(fs.statSync(path.join(root, review.screenshot)).size).toBeGreaterThan(30_000);
    }

    expect(evidence.transitionReview.status).toBe('open');
    expect(evidence.transitionReview.zeroOffsetDesktopP95MmPerFrame)
      .toBeGreaterThan(evidence.policy.slidingTargetP95MmPerFrame);
    expect(evidence.remainingGates).toHaveLength(5);
  });

  it('gates the planted-shoe transition on offline contact and honest cross-device evidence', () => {
    const evidence = JSON.parse(
      fs.readFileSync(path.join(root, 'docs/vnext/evidence/athlete-runtime/runtime-cmu16-ik-transition-review.json'), 'utf8'),
    );
    expect(evidence).toMatchObject({
      candidate: 'cmu-jog16-ik-transition',
      automatedDecision: 'offline-and-cross-device-transition-contact-pass',
      promotionDecision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      browserErrors: [],
    });
    expect(evidence.offlineContactAudit.combinedP95MmPerFrame)
      .toBeLessThanOrEqual(evidence.policy.offlineShoeTargetP95MmPerFrame);
    expect(evidence.exportedGlbContactAudit).toMatchObject({
      passesHorizontalExportTarget: true,
      requiresRuntimeHeightNormalization: true,
    });
    for (const review of [evidence.desktopRoleTransition, evidence.mobileRoleTransition]) {
      expect(review).toMatchObject({
        scenePlayerCount: 12,
        canvasCount: 1,
        transitionCount: 1,
        authoredClip: 'jog-to-sprint-ik',
        horizontalOverflow: false,
        passesFrameTarget: true,
        passesAuthoredSlideTarget: true,
        passesAuthoredClearanceTarget: true,
        passesPenetrationTolerance: true,
      });
      expect(review.authoredContactSampleCount).toBeGreaterThan(0);
      expect(review.authoredPlantedSampleCount).toBe(review.authoredContactSampleCount);
      expect(review.authoredSlideP95MmPerFrame)
        .toBeLessThanOrEqual(evidence.policy.slidingTargetP95MmPerFrame);
      expect(review.authoredClearanceP95Mm)
        .toBeLessThanOrEqual(evidence.policy.plantedClearanceMm);
      expect(review.oppositeShoeClearanceMinimumMm)
        .toBeGreaterThanOrEqual(-evidence.policy.penetrationToleranceMm);
      expect(review.frameP95Ms).toBeLessThanOrEqual(evidence.policy.sustainedFrameTargetP95Ms);
      expect(review.transitionFrameP95Ms).toBeLessThanOrEqual(evidence.policy.sustainedFrameTargetP95Ms);
      expect(fs.statSync(path.join(root, review.screenshot)).size).toBeGreaterThan(30_000);
    }
  });
});
