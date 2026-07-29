import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LOCOMOTION_CYCLE_DISTANCE_METERS } from '../src/vnext3d/runtimeMapping';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const sha256 = (relativePath) => crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(root, relativePath)))
  .digest('hex')
  .toUpperCase();

describe('vNext locomotion source audit', () => {
  it('proves the accepted in-place clips cannot support current runtime travel', () => {
    const report = readJson('asset-inbox/players/vnext/locomotion-stride-report.json');
    const clips = Object.fromEntries(report.clips.map((clip) => [clip.clipName, clip]));

    expect(report.status).toBe('measured');
    expect(clips.jog.sourceCycleDistanceMeters).toBeCloseTo(0.2826, 4);
    expect(clips.sprint.sourceCycleDistanceMeters).toBeCloseTo(0.306, 4);
    expect(LOCOMOTION_CYCLE_DISTANCE_METERS.jog).toBeGreaterThan(clips.jog.sourceCycleDistanceMeters * 6);
    expect(LOCOMOTION_CYCLE_DISTANCE_METERS.sprint).toBeGreaterThan(clips.sprint.sourceCycleDistanceMeters * 7);
  });

  it('keeps the exaggerated hand-authored audition rejected and outside runtime assets', () => {
    const review = readJson('asset-inbox/players/vnext/locomotion-v2-audition-review.json');
    expect(review).toMatchObject({
      status: 'rejected',
      decision: 'do-not-promote',
      publicRuntimeAllowed: false,
    });
    expect(review.reasons).toHaveLength(3);
    for (const contactSheet of [
      review.audition.threeQuarterContactSheet,
      review.audition.sideContactSheet,
    ]) {
      expect(fs.statSync(path.join(root, contactSheet)).size).toBeGreaterThan(50_000);
    }
    const runtimeAssets = fs.readFileSync(path.join(root, 'src/components/vnext3d/productionAssets.js'), 'utf8');
    expect(runtimeAssets).not.toContain('locomotion-v2');
  });

  it('records an integrity-checked captured replacement source', () => {
    expect(sha256('asset-inbox/players/mocap/cmu-35/35.asf'))
      .toBe('2A8E2EDA3C0D7D828566B2A9A8AB36B2B8B3864110574E8B73C8F069FDED416C');
    expect(sha256('asset-inbox/players/mocap/cmu-35/35_24.amc'))
      .toBe('29059FB2C15493983E4DCCDF45453A495FB567DD28FF36CC1A0DBC02AD409445');
    const notes = fs.readFileSync(path.join(root, 'asset-inbox/players/mocap/cmu-35/SOURCE_NOTES.md'), 'utf8');
    expect(notes).toContain('free for all uses');
    expect(notes).toContain('subjectnumber=35&trinum=24');
  });

  it('converts the captured source into a bounded lower-body retarget input', () => {
    const conversion = readJson('asset-inbox/players/mocap/cmu-35/conversion-report.json');
    expect(conversion).toMatchObject({
      status: 'converted-for-retargeting',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      armature: 'CMU35_Source_Rig',
      action: 'cmu-run-jog-35-24',
      boneCount: 31,
      rootTravelMeters: 4.4171,
      rootVerticalRangeMeters: 0.1046,
      maximumHierarchyGapMeters: 0.000001,
    });
    expect(conversion.source).toMatchObject({
      fps: 120,
      frameCount: 150,
      durationSeconds: 1.2417,
      metersPerAsfUnit: 0.05644444,
    });
    expect(fs.statSync(path.join(root, 'asset-inbox/players/mocap/cmu-35/cmu-35-24-source.blend')).size)
      .toBeGreaterThan(500_000);

    const render = readJson('asset-inbox/players/mocap/cmu-35/source-render-report.json');
    expect(render).toMatchObject({
      status: 'rendered-for-source-review',
      decision: 'not-retarget-approved',
      publicRuntimeAllowed: false,
      sampleFrames: [15, 45, 75, 105, 135],
    });
    expect(fs.statSync(path.join(
      root,
      'docs/vnext/evidence/cmu-35-source-review/contact-sheet-source-progression-2026-07-12.png',
    )).size).toBeGreaterThan(50_000);

    const notes = fs.readFileSync(path.join(root, 'asset-inbox/players/mocap/cmu-35/SOURCE_NOTES.md'), 'utf8');
    expect(notes).toContain('root and lower-body channels only');
    expect(notes).toContain('authored two-hand stick control remains authoritative');
  });

  it('retargets a captured sprint loop without promoting it into the runtime', () => {
    const retarget = readJson('asset-inbox/players/vnext/cmu-sprint-retarget-report.json');
    expect(retarget).toMatchObject({
      status: 'retargeted-for-human-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      sourceAction: 'cmu-run-jog-35-24',
      authoredUpperBodySource: 'sprint',
      outputAction: 'sprint-cmu-lower-body-audition',
      sourceLoopFrames: [15, 105],
      sourceLoopDurationSeconds: 0.75,
      sourceLoopTravelMeters: 2.6401,
      retargetBoneCount: 8,
      groundedFrameCount: 8,
      rigidTorsoAttachmentCount: 2,
      quarantinedCosmeticCount: 6,
    });
    expect(retarget.loopSeamMaximumAngleDegrees).toBeLessThan(10);
    expect(retarget.retargetBoundary).toContain('authored upper body');
    expect(fs.statSync(path.join(
      root,
      'asset-inbox/players/vnext/goon-field-player-cmu-sprint-audition.blend',
    )).size).toBeGreaterThan(7_000_000);

    const stride = readJson('asset-inbox/players/vnext/cmu-sprint-stride-report.json');
    const clip = stride.clips[0];
    expect(clip).toMatchObject({
      clipName: 'sprint-cmu-lower-body-audition',
      status: 'measured',
      sourceCycleDistanceMeters: 2.4982,
    });
    expect(clip.leftStance.sampleCount).toBeGreaterThanOrEqual(4);
    expect(clip.rightStance.sampleCount).toBeGreaterThanOrEqual(4);
    expect(Math.abs(
      clip.sourceCycleDistanceMeters - LOCOMOTION_CYCLE_DISTANCE_METERS.sprint,
    ) / LOCOMOTION_CYCLE_DISTANCE_METERS.sprint).toBeLessThan(0.05);

    const render = readJson('asset-inbox/players/vnext/cmu-sprint-retarget-render-report.json');
    expect(render).toMatchObject({
      status: 'rendered-for-human-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      sampleFrames: [1, 7, 13, 19],
      views: ['front', 'side', 'three-quarter'],
    });
    expect(render.outputs).toHaveLength(12);
    expect(fs.statSync(path.join(
      root,
      'docs/vnext/evidence/cmu-sprint-retarget-review/contact-sheet-cmu-sprint-retarget-2026-07-12.png',
    )).size).toBeGreaterThan(500_000);

    const runtimeAssets = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    const acceptedMap = runtimeAssets.match(
      /PRODUCTION_ATHLETE_ASSETS = Object\.freeze\(\{([\s\S]*?)\}\);/,
    )?.[1];
    expect(acceptedMap).not.toContain('cmuSprint');
    expect(runtimeAssets).toContain('PRIVATE_MOTION_REVIEW_ASSETS');
    expect(runtimeAssets).toContain("reviewId === 'cmu-sprint'");

    const privateExport = readJson('asset-inbox/players/vnext/cmu-sprint-private-export-report.json');
    expect(privateExport).toMatchObject({
      status: 'private-runtime-review-exported',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      runtimeSprintAction: 'sprint',
      runtimeSprintFrameRange: [1, 24],
      runtimeSprintDurationSeconds: 0.7667,
      removedConversionActions: ['cmu-run-jog-35-24'],
    });
    expect(privateExport.actionNames).not.toContain('cmu-run-jog-35-24');
    for (const side of ['home', 'away']) {
      expect(privateExport.variants[side].detachedBackNumberObjects).toEqual([]);
      const sync = privateExport.runtimeReviewSync[side];
      expect(sha256(path.relative(root, sync.source))).toBe(
        sha256(path.relative(root, sync.destination)),
      );
    }
  });

  it('rejects sprint-pose scaling for jog and records a distinct captured replacement', () => {
    const retarget = readJson('asset-inbox/players/vnext/cmu-jog-retarget-report.json');
    expect(retarget).toMatchObject({
      status: 'retargeted-for-human-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      authoredUpperBodySource: 'jog',
      outputAction: 'jog-cmu-lower-body-audition',
      outputFrameRange: [1, 33],
      outputDurationSeconds: 1.0667,
      rootMotionScale: 0,
      retargetBlend: 0.49,
      loopSeamMaximumAngleDegrees: 9.061,
    });

    const stride = readJson('asset-inbox/players/vnext/cmu-jog-stride-report.json');
    const jog = stride.clips[0];
    expect(jog).toMatchObject({
      clipName: 'jog-cmu-lower-body-audition',
      status: 'measured',
      sourceCycleDistanceMeters: 1.142,
    });
    expect(Math.abs(
      jog.sourceCycleDistanceMeters - LOCOMOTION_CYCLE_DISTANCE_METERS.jog,
    ) / LOCOMOTION_CYCLE_DISTANCE_METERS.jog).toBeGreaterThan(0.35);

    const render = readJson('asset-inbox/players/vnext/cmu-jog-retarget-render-report.json');
    expect(render).toMatchObject({
      status: 'rendered-for-human-review',
      decision: 'not-runtime-approved',
      action: 'jog-cmu-lower-body-audition',
      sampleFrames: [1, 9, 17, 25],
      views: ['front', 'side', 'three-quarter'],
    });
    expect(fs.statSync(path.join(
      root,
      'docs/vnext/evidence/cmu-jog-retarget-review/contact-sheet-cmu-jog-retarget-2026-07-12.png',
    )).size).toBeGreaterThan(500_000);

    const privateExport = readJson('asset-inbox/players/vnext/cmu-run-private-export-report.json');
    expect(privateExport).toMatchObject({
      status: 'private-runtime-review-exported',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      runtimeActions: {
        jog: { name: 'jog', frameRange: [1, 33], durationSeconds: 1.0667 },
        sprint: { name: 'sprint', frameRange: [1, 24], durationSeconds: 0.7667 },
      },
    });
    expect(privateExport.actionNames).not.toContain('cmu-run-jog-35-24');
    for (const side of ['home', 'away']) {
      expect(privateExport.variants[side].detachedBackNumberObjects).toEqual([]);
      const sync = privateExport.runtimeReviewSync[side];
      expect(sha256(path.relative(root, sync.source))).toBe(
        sha256(path.relative(root, sync.destination)),
      );
    }

    expect(sha256('asset-inbox/players/mocap/cmu-16/16.asf'))
      .toBe('2323F876564610F84BFBEC9B90B8EBFFB57515673B7F4A45B0FB0849AF465BDB');
    expect(sha256('asset-inbox/players/mocap/cmu-16/16_35.amc'))
      .toBe('28E83B8EE8FF46E15CB7D41D5E77FAAEFE3E06CF165F05FB18DD348457BDF387');
    const notes = fs.readFileSync(
      path.join(root, 'asset-inbox/players/mocap/cmu-16/SOURCE_NOTES.md'),
      'utf8',
    );
    expect(notes).toContain('Subject 16, trial 35');
    expect(notes).toContain('Selected loop: frames 38 through 134');
  });

  it('converts and retargets the distinct Subject 16 jog source without promotion', () => {
    const conversion = readJson('asset-inbox/players/mocap/cmu-16/conversion-report.json');
    expect(conversion).toMatchObject({
      status: 'converted-for-retargeting',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      armature: 'CMU16_Source_Rig',
      action: 'cmu-run-jog-16-35',
      boneCount: 31,
      maximumHierarchyGapMeters: 0,
      rootTravelMeters: 3.7971,
    });
    expect(conversion.source).toMatchObject({
      fps: 120,
      frameCount: 162,
      durationSeconds: 1.3417,
    });

    const loops = readJson('asset-inbox/players/mocap/cmu-16/loop-analysis-report.json');
    expect(loops).toMatchObject({
      status: 'analyzed-for-loop-selection',
      decision: 'not-retarget-approved',
      publicRuntimeAllowed: false,
      targetCycleDistanceMeters: 1.8139,
    });
    expect(loops.candidates[0]).toMatchObject({
      frames: [38, 134],
      sourceDurationSeconds: 0.8,
      sourceRootTravelMeters: 2.2576,
      loopSeamMeanAngleDegrees: 2.1704,
      loopSeamMaximumAngleDegrees: 4.191,
    });

    const retarget = readJson('asset-inbox/players/vnext/cmu16-jog-retarget-report.json');
    expect(retarget).toMatchObject({
      status: 'retargeted-for-human-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      sourceRig: 'CMU16_Source_Rig',
      sourceAction: 'cmu-run-jog-16-35',
      outputAction: 'jog-cmu16-lower-body-audition',
      sourceLoopFrames: [38, 134],
      outputFrameRange: [1, 41],
      outputDurationSeconds: 1.3333,
      retargetBlend: 1,
      rootMotionScale: 0,
      loopSeamMaximumAngleDegrees: 4.191,
    });

    const stride = readJson('asset-inbox/players/vnext/cmu16-jog-stride-report.json').clips[0];
    expect(stride).toMatchObject({
      clipName: 'jog-cmu16-lower-body-audition',
      status: 'measured',
      sourceCycleDistanceMeters: 2.2321,
      sourceNominalSpeedMps: 1.6741,
    });
    expect(stride.leftStance.sampleCount).toBe(8);
    expect(stride.rightStance.sampleCount).toBe(8);
    expect(Math.abs(stride.sourceCycleDistanceMeters - retarget.sourceLoopTravelMeters)
      / retarget.sourceLoopTravelMeters).toBeLessThan(0.02);

    for (const relativePath of [
      'docs/vnext/evidence/cmu-16-source-review/contact-sheet-source-progression-2026-07-12.png',
      'docs/vnext/evidence/cmu16-jog-retarget-review/contact-sheet-cmu16-jog-retarget-2026-07-12.png',
      'docs/vnext/evidence/cmu16-jog-sprint-transition-review/contact-sheet-cmu16-jog-sprint-transition-2026-07-12.png',
      'docs/vnext/evidence/cmu16-ik-transition-review/contact-sheet-cmu16-ik-transition-2026-07-12.png',
    ]) {
      expect(fs.statSync(path.join(root, relativePath)).size).toBeGreaterThan(200_000);
    }

    const transition = readJson('asset-inbox/players/vnext/cmu16-jog-sprint-transition-report.json');
    expect(transition).toMatchObject({
      status: 'authored-for-private-transition-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      outputAction: 'jog-to-sprint',
      outputFrameRange: [1, 11],
      durationSeconds: 0.3333,
      keyedBoneCount: 105,
    });

    const bridgeExport = readJson('asset-inbox/players/vnext/cmu16-transition-private-export-report.json');
    expect(bridgeExport).toMatchObject({
      status: 'private-runtime-review-exported',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      runtimeActions: {
        jog: { name: 'jog', frameRange: [1, 41], durationSeconds: 1.3333 },
        sprint: { name: 'sprint', frameRange: [1, 24], durationSeconds: 0.7667 },
      },
    });
    expect(bridgeExport.actionNames).toContain('jog-to-sprint');
    expect(bridgeExport.transitionAction).toBe('jog-to-sprint');
    expect(bridgeExport.removedConversionObjects).toEqual([
      'CMU16_Source_Rig',
      'CMU35_Source_Rig',
    ]);
    for (const side of ['home', 'away']) {
      expect(bridgeExport.variants[side].detachedBackNumberObjects).toEqual([]);
    }

    const ikTransition = readJson('asset-inbox/players/vnext/cmu16-ik-transition-report.json');
    const ikShoeAudit = readJson('asset-inbox/players/vnext/cmu16-ik-transition-shoe-audit.json');
    const ikExport = readJson('asset-inbox/players/vnext/cmu16-ik-transition-private-export-report.json');
    expect(ikTransition).toMatchObject({
      status: 'authored-for-private-transition-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      outputAction: 'jog-to-sprint-ik',
      outputFrameRange: [1, 11],
      durationSeconds: 0.3333,
      footLock: {
        side: 'Right',
        releaseProgress: 0.7,
        targetHeightMeters: 0.004,
      },
      footTransfer: {
        side: 'Left',
        startProgress: 0.8,
        endProgress: 0.9,
      },
    });
    expect(ikShoeAudit.exactRuntime.sides.right).toMatchObject({
      plantedSampleCount: 8,
      p95MmPerFrame: 0.0002,
    });
    expect(ikShoeAudit.exactRuntime.sides.left).toMatchObject({
      plantedSampleCount: 1,
      p95MmPerFrame: 0.0009,
    });
    expect(ikExport).toMatchObject({
      status: 'private-runtime-review-exported',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      transitionAction: 'jog-to-sprint-ik',
      shoeAudit: {
        lockedSide: 'right-to-left-transfer',
        p95MmPerFrame: 0.0009,
        thresholdMmPerFrame: 10,
      },
    });
    expect(ikExport.actionNames).toContain('jog-to-sprint-ik');
    for (const side of ['home', 'away']) {
      const sync = ikExport.runtimeReviewSync[side];
      expect(sha256(path.relative(root, sync.source))).toBe(
        sha256(path.relative(root, sync.destination)),
      );
    }

    const currentPrivateExport = readJson('asset-inbox/players/vnext/cmu16-run-private-export-report.json');
    for (const side of ['home', 'away']) {
      expect(currentPrivateExport.variants[side].detachedBackNumberObjects).toEqual([]);
      const sync = currentPrivateExport.runtimeReviewSync[side];
      expect(sha256(path.relative(root, sync.source))).toBe(
        sha256(path.relative(root, sync.destination)),
      );
    }
  });
});
