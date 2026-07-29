import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ACTION_QUALITY_PROFILES,
  REQUIRED_MOTION_GROUPS,
  classifyMotionSource,
  readSourceRightsMetadata,
  summarizeMotionSources,
} from './audit-player-motion-sources.mjs';

describe('player motion source audit', () => {
  it('tracks every motion family needed before retargeting can replace synthetic runner clips', () => {
    expect(REQUIRED_MOTION_GROUPS.map((group) => group.key)).toEqual([
      'ready',
      'jog',
      'sprint',
      'carry',
      'receive',
      'pass',
      'shot',
    ]);
  });

  it('classifies local source filenames into required motion groups', () => {
    expect(classifyMotionSource('field-player-ready-stance.fbx')).toEqual(['ready']);
    expect(classifyMotionSource('runner-jog-forward.bvh')).toEqual(['jog']);
    expect(classifyMotionSource('ball-hockey-sprint.fbx')).toEqual(['sprint']);
    expect(classifyMotionSource('stick-carry-control.glb')).toEqual(['carry']);
    expect(classifyMotionSource('receive-pass-settle.fbx')).toEqual(['receive']);
    expect(classifyMotionSource('wrist-shot-release.bvh')).toEqual(['shot']);
  });

  it('reads wrapped usage-rights metadata as one complete provenance field', () => {
    const dir = mkdtempSync(join(tmpdir(), 'goonsquad-motion-source-'));
    const notesPath = join(dir, 'SOURCE_NOTES.md');
    writeFileSync(notesPath, [
      'Source quality: internally-authored-high-quality-action-clip',
      'Source provider: Goon Squad internal',
      'Capture method: professional-keyframe-animation',
      'Usage rights: Authored for this project. These files may be modified, retargeted,',
      'and shipped with the Goon Squad playbook. No attribution is required.',
      '',
      'Quality caveat: Not external motion-capture data.',
    ].join('\n'));

    expect(readSourceRightsMetadata(notesPath).usageRights).toBe(
      'Authored for this project. These files may be modified, retargeted, and shipped with the Goon Squad playbook. No attribution is required.',
    );
  });

  it('blocks final-grade source coverage when usage rights are only a truncated fragment', () => {
    const incompleteUsageMetadata = {
      sourceRightsPath: 'SOURCE_NOTES.md',
      sourceQuality: 'internally-authored-high-quality-action-clip',
      sourceProvider: 'Goon Squad internal',
      captureMethod: 'professional-keyframe-animation',
      usageRights: 'Authored for this project. These files may be modified, retargeted,',
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx', ...incompleteUsageMetadata },
      { fileName: 'jog-forward.fbx', filePath: 'asset-inbox/players/motion-sources/jog-forward.fbx', ...incompleteUsageMetadata },
      { fileName: 'sprint-forward.fbx', filePath: 'asset-inbox/players/motion-sources/sprint-forward.fbx', ...incompleteUsageMetadata },
      { fileName: 'stick-carry-control.fbx', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.fbx', ...incompleteUsageMetadata },
      { fileName: 'receive-pass-settle.fbx', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.fbx', ...incompleteUsageMetadata },
      { fileName: 'forehand-pass-release.fbx', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.fbx', ...incompleteUsageMetadata },
      { fileName: 'wrist-shot-release.fbx', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.fbx', ...incompleteUsageMetadata },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.motionQualityStatus).toBe('invalid-final-grade-usage-rights');
    expect(report.finalGradeUsageRightsFailures.map((source) => source.relativePath)).toEqual([
      'ready-stance.fbx',
      'jog-forward.fbx',
      'sprint-forward.fbx',
      'stick-carry-control.fbx',
      'receive-pass-settle.fbx',
      'forehand-pass-release.fbx',
      'wrist-shot-release.fbx',
    ]);
  });

  it('does not let one receive-settle source stand in for pass-release coverage', () => {
    const highQualityMetadata = {
      sourceRightsPath: 'SOURCE_NOTES.md',
      sourceQuality: 'internally-authored-high-quality-action-clip',
      sourceProvider: 'Goon Squad internal',
      captureMethod: 'professional-keyframe-animation',
      usageRights: 'Authored for this project; retargeting and runtime use permitted',
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx', ...highQualityMetadata },
      { fileName: 'jog-forward.fbx', filePath: 'asset-inbox/players/motion-sources/jog-forward.fbx', ...highQualityMetadata },
      { fileName: 'sprint-forward.fbx', filePath: 'asset-inbox/players/motion-sources/sprint-forward.fbx', ...highQualityMetadata },
      { fileName: 'stick-carry-control.fbx', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.fbx', ...highQualityMetadata },
      { fileName: 'receive-pass-settle.fbx', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.fbx', ...highQualityMetadata },
      { fileName: 'wrist-shot-release.fbx', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.fbx', ...highQualityMetadata },
    ]);

    expect(classifyMotionSource('receive-pass-settle.fbx')).toEqual(['receive']);
    expect(report.status).toBe('blocked');
    expect(report.missingGroups).toEqual(['pass']);
    expect(report.motionQualityStatus).toBe('partial-final-grade-motion');
    expect(report.finalGradeGroups).toEqual(['ready', 'jog', 'sprint', 'carry', 'receive', 'shot']);
    expect(report.missingFinalGradeGroups).toEqual(['pass']);
    expect(report.nextAction).toContain('pass');
  });

  it('does not treat a generic pass release as a shot source', () => {
    expect(classifyMotionSource('field-player-forehand-pass-release.bvh')).toEqual(['pass']);
  });

  it('reports missing groups until all motion families are present', () => {
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx' },
      { fileName: 'runner-jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/runner-jog-forward.bvh' },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh' },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.coveredGroups).toEqual(['ready', 'jog', 'shot']);
    expect(report.missingGroups).toEqual(['sprint', 'carry', 'receive', 'pass']);
    expect(report.nextAction).toContain('asset-inbox/players/motion-sources');
  });

  it('marks a complete motion source set as ready for Blender retargeting', () => {
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx', sourceRightsPath: 'SOURCE_NOTES.md' },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', sourceRightsPath: 'SOURCE_NOTES.md' },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', sourceRightsPath: 'SOURCE_NOTES.md' },
      { fileName: 'stick-carry-control.fbx', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.fbx', sourceRightsPath: 'SOURCE_NOTES.md' },
      { fileName: 'receive-pass-settle.fbx', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.fbx', sourceRightsPath: 'SOURCE_NOTES.md' },
      { fileName: 'forehand-pass-release.fbx', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.fbx', sourceRightsPath: 'SOURCE_NOTES.md' },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', sourceRightsPath: 'SOURCE_NOTES.md' },
    ]);

    expect(report.status).toBe('ready-for-retarget');
    expect(report.missingGroups).toEqual([]);
    expect(report.missingSourceRights).toEqual([]);
  });

  it('surfaces seed-quality motion as ready for retargeting but not final-grade coverage', () => {
    const seedMetadata = {
      sourceRightsPath: 'SOURCE_NOTES.md',
      sourceQuality: 'internal-authored-action-clip',
      sourceProvider: 'Goon Squad internal',
      captureMethod: 'hand-keyed-internal-bvh',
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx', ...seedMetadata },
      { fileName: 'jog-forward.fbx', filePath: 'asset-inbox/players/motion-sources/jog-forward.fbx', ...seedMetadata },
      { fileName: 'sprint-forward.fbx', filePath: 'asset-inbox/players/motion-sources/sprint-forward.fbx', ...seedMetadata },
      { fileName: 'stick-carry-control.fbx', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.fbx', ...seedMetadata },
      { fileName: 'receive-pass-settle.fbx', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.fbx', ...seedMetadata },
      { fileName: 'forehand-pass-release.fbx', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.fbx', ...seedMetadata },
      { fileName: 'wrist-shot-release.fbx', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.fbx', ...seedMetadata },
    ]);

    expect(report.status).toBe('ready-for-retarget');
    expect(report.motionQualityStatus).toBe('source-driven-seed');
    expect(report.finalGradeGroups).toEqual([]);
    expect(report.missingFinalGradeGroups).toEqual(['ready', 'jog', 'sprint', 'carry', 'receive', 'pass', 'shot']);
    expect(report.nextAction).toContain('final-grade motion');
  });

  it('classifies complete internally authored high-quality action sources as final-grade coverage', () => {
    const highQualityMetadata = {
      sourceRightsPath: 'SOURCE_NOTES.md',
      sourceQuality: 'internally-authored-high-quality-action-clip',
      sourceProvider: 'Goon Squad internal',
      captureMethod: 'professional-keyframe-animation',
      usageRights: 'Authored for this project; retargeting and runtime use permitted',
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx', ...highQualityMetadata },
      { fileName: 'jog-forward.fbx', filePath: 'asset-inbox/players/motion-sources/jog-forward.fbx', ...highQualityMetadata },
      { fileName: 'sprint-forward.fbx', filePath: 'asset-inbox/players/motion-sources/sprint-forward.fbx', ...highQualityMetadata },
      { fileName: 'stick-carry-control.fbx', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.fbx', ...highQualityMetadata },
      { fileName: 'receive-pass-settle.fbx', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.fbx', ...highQualityMetadata },
      { fileName: 'forehand-pass-release.fbx', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.fbx', ...highQualityMetadata },
      { fileName: 'wrist-shot-release.fbx', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.fbx', ...highQualityMetadata },
    ]);

    expect(report.status).toBe('ready-for-retarget');
    expect(report.motionQualityStatus).toBe('final-grade-motion');
    expect(report.finalGradeGroups).toEqual(['ready', 'jog', 'sprint', 'carry', 'receive', 'pass', 'shot']);
    expect(report.missingFinalGradeGroups).toEqual([]);
  });

  it('blocks unsupported source-quality labels before Blender retargeting', () => {
    const seedMetadata = {
      sourceRightsPath: 'SOURCE_NOTES.md',
      sourceQuality: 'internal-authored-action-clip',
      sourceProvider: 'Goon Squad internal',
      captureMethod: 'hand-keyed-internal-bvh',
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx', ...seedMetadata },
      { fileName: 'jog-forward.fbx', filePath: 'asset-inbox/players/motion-sources/jog-forward.fbx', ...seedMetadata },
      { fileName: 'sprint-forward.fbx', filePath: 'asset-inbox/players/motion-sources/sprint-forward.fbx', ...seedMetadata },
      { fileName: 'stick-carry-control.fbx', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.fbx', ...seedMetadata },
      { fileName: 'receive-pass-settle.fbx', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.fbx', ...seedMetadata },
      {
        fileName: 'forehand-pass-release.fbx',
        filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.fbx',
        ...seedMetadata,
        sourceQuality: 'downloaded-animation-unknown-license',
      },
      { fileName: 'wrist-shot-release.fbx', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.fbx', ...seedMetadata },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.motionQualityStatus).toBe('unsupported-source-quality');
    expect(report.unsupportedSourceQuality).toEqual([
      {
        relativePath: 'forehand-pass-release.fbx',
        sourceQuality: 'downloaded-animation-unknown-license',
      },
    ]);
  });

  it('blocks final-grade labels that lack provider or capture method provenance', () => {
    const seedMetadata = {
      sourceRightsPath: 'SOURCE_NOTES.md',
      sourceQuality: 'internal-authored-action-clip',
      sourceProvider: 'Goon Squad internal',
      captureMethod: 'hand-keyed-internal-bvh',
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx', ...seedMetadata },
      { fileName: 'jog-forward.fbx', filePath: 'asset-inbox/players/motion-sources/jog-forward.fbx', ...seedMetadata },
      { fileName: 'sprint-forward.fbx', filePath: 'asset-inbox/players/motion-sources/sprint-forward.fbx', ...seedMetadata },
      { fileName: 'stick-carry-control.fbx', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.fbx', ...seedMetadata },
      { fileName: 'receive-pass-settle.fbx', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.fbx', ...seedMetadata },
      {
        fileName: 'forehand-pass-release.fbx',
        filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.fbx',
        sourceRightsPath: 'SOURCE_NOTES.md',
        sourceQuality: 'licensed-motion-capture-action-clip',
      },
      { fileName: 'wrist-shot-release.fbx', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.fbx', ...seedMetadata },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.motionQualityStatus).toBe('missing-final-grade-provenance');
    expect(report.finalGradeProvenanceFailures).toEqual([
      {
        relativePath: 'forehand-pass-release.fbx',
        groups: ['pass'],
        sourceQuality: 'licensed-motion-capture-action-clip',
        missingFields: ['sourceProvider', 'captureMethod', 'usageRights'],
      },
    ]);
  });

  it('blocks final-grade labels with seed-quality capture methods before Blender retargeting', () => {
    const seedMetadata = {
      sourceRightsPath: 'SOURCE_NOTES.md',
      sourceQuality: 'internal-authored-action-clip',
      sourceProvider: 'Goon Squad internal',
      captureMethod: 'hand-keyed-internal-bvh',
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx', ...seedMetadata },
      { fileName: 'jog-forward.fbx', filePath: 'asset-inbox/players/motion-sources/jog-forward.fbx', ...seedMetadata },
      { fileName: 'sprint-forward.fbx', filePath: 'asset-inbox/players/motion-sources/sprint-forward.fbx', ...seedMetadata },
      { fileName: 'stick-carry-control.fbx', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.fbx', ...seedMetadata },
      { fileName: 'receive-pass-settle.fbx', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.fbx', ...seedMetadata },
      {
        fileName: 'forehand-pass-release.fbx',
        filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.fbx',
        sourceRightsPath: 'SOURCE_NOTES.md',
        sourceQuality: 'licensed-motion-capture-action-clip',
        sourceProvider: 'Example Mocap',
        captureMethod: 'hand-keyed-internal-bvh',
        usageRights: 'Licensed for Goon Squad replay retargeting and runtime use',
      },
      { fileName: 'wrist-shot-release.fbx', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.fbx', ...seedMetadata },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.motionQualityStatus).toBe('invalid-final-grade-capture-method');
    expect(report.finalGradeGroups).toEqual([]);
    expect(report.finalGradeCaptureMethodFailures).toEqual([
      {
        relativePath: 'forehand-pass-release.fbx',
        groups: ['pass'],
        sourceQuality: 'licensed-motion-capture-action-clip',
        captureMethod: 'hand-keyed-internal-bvh',
        allowedMethods: [
          'optical-motion-capture',
          'inertial-motion-capture',
          'markerless-motion-capture',
          'performance-capture',
        ],
      },
    ]);
    expect(report.nextAction).toContain('unsupported final-grade capture methods');
  });

  it('blocks complete source coverage when files do not include nearby source-rights notes', () => {
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.fbx', filePath: 'asset-inbox/players/motion-sources/ready-stance.fbx' },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh' },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh' },
      { fileName: 'stick-carry-control.fbx', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.fbx' },
      { fileName: 'receive-pass-settle.fbx', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.fbx' },
      { fileName: 'forehand-pass-release.fbx', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.fbx' },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh' },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.missingGroups).toEqual([]);
    expect(report.missingSourceRights).toEqual([
      'ready-stance.fbx',
      'jog-forward.bvh',
      'sprint-forward.bvh',
      'stick-carry-control.fbx',
      'receive-pass-settle.fbx',
      'forehand-pass-release.fbx',
      'wrist-shot-release.bvh',
    ]);
    expect(report.nextAction).toContain('source-rights notes');
  });

  it('blocks nominally covered BVH files that do not contain enough retargetable motion frames', () => {
    const viableSeed = {
      format: 'bvh',
      frameCount: 24,
      durationSeconds: 0.8,
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 130,
      stickActionPhaseChanges: 2,
      sourceRightsPath: 'SOURCE_NOTES.md',
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableSeed },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableSeed },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableSeed },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableSeed },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableSeed },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableSeed, frameCount: 2, durationSeconds: 0.067 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableSeed },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.missingGroups).toEqual([]);
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-source-too-short',
        frameCount: 2,
        durationSeconds: 0.067,
      },
    ]);
    expect(report.nextAction).toContain('retargetable motion data');
  });

  it('blocks placeholder-length BVH seeds even when every required motion family is nominally covered', () => {
    const placeholderSeed = {
      format: 'bvh',
      frameCount: 6,
      durationSeconds: 0.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...placeholderSeed },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...placeholderSeed },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...placeholderSeed },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...placeholderSeed },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...placeholderSeed },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...placeholderSeed },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...placeholderSeed },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.missingGroups).toEqual([]);
    expect(report.invalidMotionSources).toHaveLength(7);
    expect(report.invalidMotionSources[0]).toMatchObject({
      reason: 'bvh-action-clip-too-short',
      minimumFrameCount: 12,
      minimumDurationSeconds: 0.38,
    });
  });

  it('blocks long-enough BVH clips when the action channels barely move', () => {
    const viableSeed = {
      format: 'bvh',
      frameCount: 18,
      durationSeconds: 0.6,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 1.2,
      activeRotationChannelCount: 0,
      rootTravelUnits: 0.1,
      rootLateralShiftUnits: 30,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableSeed },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableSeed },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableSeed },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableSeed },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableSeed },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableSeed },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableSeed },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.missingGroups).toEqual([]);
    expect(report.invalidMotionSources).toHaveLength(7);
    expect(report.invalidMotionSources[0]).toMatchObject({
      reason: 'bvh-action-motion-too-static',
      minimumMaxRotationRangeDegrees: 4,
      minimumActiveRotationChannelCount: 3,
    });
    expect(report.nextAction).toContain('retargetable motion data');
  });

  it('tracks action-specific quality profiles for authored retarget sources', () => {
    expect(ACTION_QUALITY_PROFILES.jog).toMatchObject({
      minimumFrameCount: 22,
      minimumDurationSeconds: 0.72,
      minimumRootTravelUnits: 30,
      minimumTotalRotationRangeDegrees: 260,
      minimumStridePhaseChanges: 2,
    });
    expect(ACTION_QUALITY_PROFILES.sprint.minimumRootTravelUnits).toBeGreaterThan(
      ACTION_QUALITY_PROFILES.jog.minimumRootTravelUnits,
    );
    expect(ACTION_QUALITY_PROFILES.sprint.minimumStridePhaseChanges).toBe(2);
    expect(ACTION_QUALITY_PROFILES.pass.minimumTotalRotationRangeDegrees).toBeGreaterThanOrEqual(150);
    expect(ACTION_QUALITY_PROFILES.ready.minimumReadyStanceLegLoadDegrees).toBeGreaterThanOrEqual(24);
    expect(ACTION_QUALITY_PROFILES.jog.minimumRootForwardTravelUnits).toBeGreaterThanOrEqual(30);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumRootForwardTravelUnits).toBeGreaterThanOrEqual(40);
    expect(ACTION_QUALITY_PROFILES.pass.maximumFrameRotationAccelerationDegrees).toBeLessThanOrEqual(20);
    expect(ACTION_QUALITY_PROFILES.pass.minimumFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.56);
    expect(ACTION_QUALITY_PROFILES.shot.maximumFrameRotationAccelerationDegrees).toBeLessThanOrEqual(22);
    expect(ACTION_QUALITY_PROFILES.carry.minimumStickActionArmRangeDegrees).toBeGreaterThanOrEqual(90);
    expect(ACTION_QUALITY_PROFILES.shot.minimumStickActionArmRangeDegrees).toBeGreaterThanOrEqual(120);
    expect(ACTION_QUALITY_PROFILES.receive.minimumStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(6);
    expect(ACTION_QUALITY_PROFILES.pass.minimumStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(2);
    expect(ACTION_QUALITY_PROFILES.shot.minimumStickActionLowerBodyLeadFrames).toBeGreaterThanOrEqual(2);
  });

  it('requires longer stick-action clips before Blender retargeting', () => {
    for (const group of ['carry', 'receive', 'pass', 'shot']) {
      expect(ACTION_QUALITY_PROFILES[group].minimumFrameCount).toBeGreaterThanOrEqual(24);
      expect(ACTION_QUALITY_PROFILES[group].minimumDurationSeconds).toBeGreaterThanOrEqual(0.8);
    }
  });

  it('requires stick-action clips to include distinct action phase changes', () => {
    expect(ACTION_QUALITY_PROFILES.carry.minimumStickActionPhaseChanges).toBeGreaterThanOrEqual(2);
    expect(ACTION_QUALITY_PROFILES.receive.minimumStickActionPhaseChanges).toBeGreaterThanOrEqual(2);
    expect(ACTION_QUALITY_PROFILES.pass.minimumStickActionPhaseChanges).toBeGreaterThanOrEqual(2);
    expect(ACTION_QUALITY_PROFILES.shot.minimumStickActionPhaseChanges).toBeGreaterThanOrEqual(2);
  });

  it('requires stick-action beats to be spread across the clip instead of compressed into a pose snap', () => {
    expect(ACTION_QUALITY_PROFILES.carry.minimumStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.4);
    expect(ACTION_QUALITY_PROFILES.receive.minimumStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.35);
    expect(ACTION_QUALITY_PROFILES.pass.minimumStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.35);
    expect(ACTION_QUALITY_PROFILES.shot.minimumStickActionBeatSpanRatio).toBeGreaterThanOrEqual(0.35);
  });

  it('requires locomotion clips to have a clean loop seam for repeated runner playback', () => {
    expect(ACTION_QUALITY_PROFILES.jog.maximumLoopClosureErrorDegrees).toBeLessThanOrEqual(16);
    expect(ACTION_QUALITY_PROFILES.sprint.maximumLoopClosureErrorDegrees).toBeLessThanOrEqual(16);
    expect(ACTION_QUALITY_PROFILES.jog.maximumLoopVerticalOffsetUnits).toBeLessThanOrEqual(0.75);
    expect(ACTION_QUALITY_PROFILES.sprint.maximumLoopVerticalOffsetUnits).toBeLessThanOrEqual(0.75);
  });

  it('requires locomotion clips to include vertical root bounce so retargeted runs do not float', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumRootVerticalBounceUnits).toBeGreaterThanOrEqual(0.3);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumRootVerticalBounceUnits).toBeGreaterThanOrEqual(0.5);
  });

  it('requires jog and sprint sources to include enough leg drive for athletic lower-body mechanics', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumLegDriveRangeDegrees).toBeGreaterThanOrEqual(95);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumLegDriveRangeDegrees).toBeGreaterThanOrEqual(125);
  });

  it('requires jog and sprint sources to separate the legs into a visible alternating stride', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumAlternatingLegSeparationDegrees).toBeGreaterThanOrEqual(50);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumAlternatingLegSeparationDegrees).toBeGreaterThanOrEqual(70);
  });

  it('requires jog and sprint sources to balance leg drive across both stride sides', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumLocomotionStrideBalanceRatio).toBeGreaterThanOrEqual(0.72);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumLocomotionStrideBalanceRatio).toBeGreaterThanOrEqual(0.72);
  });

  it('requires jog and sprint sources to include hip and shoulder counter-rotation', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(8);
  });

  it('blocks jog and sprint sources whose leg-drive range is one-sided', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionStrideBalanceRatio: 0.85,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionTwoHandSyncRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionLowerBodyLeadFrames: 6,
      stickActionRecoveryRatio: 1,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 10, alternatingLegSeparationDegrees: 0, locomotionStrideBalanceRatio: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0, stickActionTwoHandSyncRatio: 0, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, locomotionStrideBalanceRatio: 0.34 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380, locomotionStrideBalanceRatio: 0.42 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        locomotionStrideBalanceRatio: 0.34,
        minimumLocomotionStrideBalanceRatio: ACTION_QUALITY_PROFILES.jog.minimumLocomotionStrideBalanceRatio,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        locomotionStrideBalanceRatio: 0.42,
        minimumLocomotionStrideBalanceRatio: ACTION_QUALITY_PROFILES.sprint.minimumLocomotionStrideBalanceRatio,
      },
    ]);
  });

  it('blocks jog and sprint sources whose upper body stays flat through the stride', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionStrideBalanceRatio: 0.85,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionTwoHandSyncRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionLowerBodyLeadFrames: 6,
      stickActionRecoveryRatio: 1,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 10, alternatingLegSeparationDegrees: 0, locomotionStrideBalanceRatio: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0, stickActionTwoHandSyncRatio: 0, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, hipShoulderSeparationDegrees: 2.5 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380, hipShoulderSeparationDegrees: 3.5 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, strideCycleSpanRatio: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        hipShoulderSeparationDegrees: 2.5,
        minimumHipShoulderSeparationDegrees: ACTION_QUALITY_PROFILES.jog.minimumHipShoulderSeparationDegrees,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        hipShoulderSeparationDegrees: 3.5,
        minimumHipShoulderSeparationDegrees: ACTION_QUALITY_PROFILES.sprint.minimumHipShoulderSeparationDegrees,
      },
    ]);
  });

  it('requires jog and sprint sources to include athletic arm counter-swing', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumLocomotionArmSwingRangeDegrees).toBeGreaterThanOrEqual(80);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumLocomotionArmSwingRangeDegrees).toBeGreaterThanOrEqual(105);
  });

  it('requires run and stick-action sources to include athletic forward torso lean', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(10);
    expect(ACTION_QUALITY_PROFILES.carry.minimumAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(5);
    expect(ACTION_QUALITY_PROFILES.shot.minimumAthleticTorsoLeanDegrees).toBeGreaterThanOrEqual(5);
  });

  it('requires ready-stance sources to show planted lower-body contact before retargeting', () => {
    expect(ACTION_QUALITY_PROFILES.ready.minimumFootPlantContactFrames).toBeGreaterThanOrEqual(4);
    expect(ACTION_QUALITY_PROFILES.ready.minimumFootPlantSideCount).toBe(2);
    expect(ACTION_QUALITY_PROFILES.ready.minimumFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.5);
    expect(ACTION_QUALITY_PROFILES.ready.maximumFootPlantRootDriftUnits).toBeLessThanOrEqual(1);
  });

  it('requires jog and sprint sources to coordinate opposite arm and leg drive', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumLocomotionContralateralSyncRatio).toBeGreaterThanOrEqual(0.65);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumLocomotionContralateralSyncRatio).toBeGreaterThanOrEqual(0.65);
  });

  it('requires stick-action sources to include lower-body weight transfer', () => {
    expect(ACTION_QUALITY_PROFILES.carry.minimumLegDriveRangeDegrees).toBeGreaterThanOrEqual(60);
    expect(ACTION_QUALITY_PROFILES.receive.minimumLegDriveRangeDegrees).toBeGreaterThanOrEqual(26);
    expect(ACTION_QUALITY_PROFILES.pass.minimumLegDriveRangeDegrees).toBeGreaterThanOrEqual(28);
    expect(ACTION_QUALITY_PROFILES.shot.minimumLegDriveRangeDegrees).toBeGreaterThanOrEqual(30);
  });

  it('requires stick-action sources to include lateral root weight transfer', () => {
    expect(ACTION_QUALITY_PROFILES.carry.minimumRootLateralShiftUnits).toBeGreaterThanOrEqual(4);
    expect(ACTION_QUALITY_PROFILES.receive.minimumRootLateralShiftUnits).toBeGreaterThanOrEqual(2.5);
    expect(ACTION_QUALITY_PROFILES.pass.minimumRootLateralShiftUnits).toBeGreaterThanOrEqual(3);
    expect(ACTION_QUALITY_PROFILES.shot.minimumRootLateralShiftUnits).toBeGreaterThanOrEqual(3.5);
  });

  it('requires action sources to include forward root travel instead of only side-to-side drift', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumRootForwardTravelUnits).toBeGreaterThanOrEqual(30);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumRootForwardTravelUnits).toBeGreaterThanOrEqual(40);
    expect(ACTION_QUALITY_PROFILES.carry.minimumRootForwardTravelUnits).toBeGreaterThanOrEqual(18);
    expect(ACTION_QUALITY_PROFILES.receive.minimumRootForwardTravelUnits).toBeGreaterThanOrEqual(5);
    expect(ACTION_QUALITY_PROFILES.pass.minimumRootForwardTravelUnits).toBeGreaterThanOrEqual(4);
    expect(ACTION_QUALITY_PROFILES.shot.minimumRootForwardTravelUnits).toBeGreaterThanOrEqual(6);
  });

  it('requires stick-action sources to stay grounded through planted-foot contact windows', () => {
    expect(ACTION_QUALITY_PROFILES.carry.minimumFootPlantContactFrames).toBeGreaterThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.receive.minimumFootPlantContactFrames).toBeGreaterThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.pass.minimumFootPlantContactFrames).toBeGreaterThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.shot.minimumFootPlantContactFrames).toBeGreaterThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.carry.minimumFootPlantSideCount).toBe(2);
    expect(ACTION_QUALITY_PROFILES.receive.minimumFootPlantSideCount).toBe(2);
    expect(ACTION_QUALITY_PROFILES.pass.minimumFootPlantSideCount).toBe(2);
    expect(ACTION_QUALITY_PROFILES.shot.minimumFootPlantSideCount).toBe(2);
    expect(ACTION_QUALITY_PROFILES.carry.minimumFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.5);
    expect(ACTION_QUALITY_PROFILES.receive.minimumFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.5);
    expect(ACTION_QUALITY_PROFILES.pass.minimumFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.5);
    expect(ACTION_QUALITY_PROFILES.shot.minimumFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.5);
  });

  it('limits root drift during grounded planted-foot contact windows', () => {
    expect(ACTION_QUALITY_PROFILES.jog.maximumFootPlantRootDriftUnits).toBeLessThanOrEqual(10);
    expect(ACTION_QUALITY_PROFILES.sprint.maximumFootPlantRootDriftUnits).toBeLessThanOrEqual(12);
    expect(ACTION_QUALITY_PROFILES.carry.maximumFootPlantRootDriftUnits).toBeLessThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.receive.maximumFootPlantRootDriftUnits).toBeLessThanOrEqual(6);
    expect(ACTION_QUALITY_PROFILES.pass.maximumFootPlantRootDriftUnits).toBeLessThanOrEqual(6);
    expect(ACTION_QUALITY_PROFILES.shot.maximumFootPlantRootDriftUnits).toBeLessThanOrEqual(7);
  });

  it('requires stick-action sources to include torso follow-through instead of arm-only motion', () => {
    expect(ACTION_QUALITY_PROFILES.carry.minimumStickActionTorsoRangeDegrees).toBeGreaterThanOrEqual(18);
    expect(ACTION_QUALITY_PROFILES.receive.minimumStickActionTorsoRangeDegrees).toBeGreaterThanOrEqual(20);
    expect(ACTION_QUALITY_PROFILES.pass.minimumStickActionTorsoRangeDegrees).toBeGreaterThanOrEqual(24);
    expect(ACTION_QUALITY_PROFILES.shot.minimumStickActionTorsoRangeDegrees).toBeGreaterThanOrEqual(32);
  });

  it('requires stick-action sources to include hip and shoulder separation', () => {
    expect(ACTION_QUALITY_PROFILES.carry.minimumHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.receive.minimumHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(6);
    expect(ACTION_QUALITY_PROFILES.pass.minimumHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(6);
    expect(ACTION_QUALITY_PROFILES.shot.minimumHipShoulderSeparationDegrees).toBeGreaterThanOrEqual(7);
  });

  it('requires stick-action sources to recover from peak action poses before clip end', () => {
    expect(ACTION_QUALITY_PROFILES.carry.minimumStickActionRecoveryRatio).toBeGreaterThanOrEqual(0.6);
    expect(ACTION_QUALITY_PROFILES.receive.minimumStickActionRecoveryRatio).toBeGreaterThanOrEqual(0.75);
    expect(ACTION_QUALITY_PROFILES.pass.minimumStickActionRecoveryRatio).toBeGreaterThanOrEqual(0.75);
    expect(ACTION_QUALITY_PROFILES.shot.minimumStickActionRecoveryRatio).toBeGreaterThanOrEqual(0.75);
  });

  it('requires stick-action sources to keep both hands active through a meaningful action window', () => {
    expect(ACTION_QUALITY_PROFILES.carry.minimumStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.35);
    expect(ACTION_QUALITY_PROFILES.receive.minimumStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);
    expect(ACTION_QUALITY_PROFILES.pass.minimumStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);
    expect(ACTION_QUALITY_PROFILES.shot.minimumStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);

    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      locomotionStrideBalanceRatio: 1,
      locomotionFootPlantDriveRatio: 0.8,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionTwoHandSyncRatio: 0.8,
      stickActionTwoHandContactRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionReleasePeakRatio: 0.55,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      stickActionLowerBodyLeadFrames: 6,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, locomotionFootPlantDriveRatio: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0, stickActionTwoHandSyncRatio: 0, stickActionTwoHandContactRatio: 0, stickActionLowerBodyLeadFrames: 0, stickActionReleasePeakRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34, stickActionTwoHandContactRatio: 0.14 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38, stickActionTwoHandContactRatio: 0.8 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        stickActionTwoHandContactRatio: 0.14,
        minimumStickActionTwoHandContactRatio: ACTION_QUALITY_PROFILES.pass.minimumStickActionTwoHandContactRatio,
      },
    ]);
  });

  it('requires stick-action release peaks to happen after setup and before recovery', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      locomotionStrideBalanceRatio: 1,
      locomotionFootPlantDriveRatio: 0.8,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionTwoHandSyncRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionReleasePeakRatio: 0.55,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      stickActionLowerBodyLeadFrames: 6,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, locomotionFootPlantDriveRatio: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0, stickActionTwoHandSyncRatio: 0, stickActionLowerBodyLeadFrames: 0, stickActionReleasePeakRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34, stickActionReleasePeakRatio: 0.12 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(ACTION_QUALITY_PROFILES.receive.minimumStickActionReleasePeakRatio).toBeGreaterThanOrEqual(0.3);
    expect(ACTION_QUALITY_PROFILES.pass.minimumStickActionReleasePeakRatio).toBeGreaterThanOrEqual(0.3);
    expect(ACTION_QUALITY_PROFILES.shot.maximumStickActionReleasePeakRatio).toBeLessThanOrEqual(0.82);
    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        stickActionReleasePeakRatio: 0.12,
        minimumStickActionReleasePeakRatio: ACTION_QUALITY_PROFILES.pass.minimumStickActionReleasePeakRatio,
      },
    ]);
  });

  it('blocks ready stance sources whose lower body stays too upright for athletic posture', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
    };
    const report = summarizeMotionSources([
      {
        fileName: 'ready-stance.bvh',
        filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh',
        ...viableBase,
        frameCount: 14,
        durationSeconds: 0.467,
        rootTravelUnits: 1,
        totalRotationRangeDegrees: 60,
        readyStanceLegLoadDegrees: 8,
        stickActionArmRangeDegrees: 24,
        stickActionBeatSpanRatio: 0,
      },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'ready-stance.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['ready'],
        readyStanceLegLoadDegrees: 8,
        minimumReadyStanceLegLoadDegrees: ACTION_QUALITY_PROFILES.ready.minimumReadyStanceLegLoadDegrees,
      },
    ]);
  });

  it('requires jog and sprint sources to include grounded foot-contact windows on both sides', () => {
    expect(ACTION_QUALITY_PROFILES.jog.minimumFootPlantContactFrames).toBeGreaterThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumFootPlantContactFrames).toBeGreaterThanOrEqual(8);
    expect(ACTION_QUALITY_PROFILES.jog.minimumFootPlantSideCount).toBe(2);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumFootPlantSideCount).toBe(2);
    expect(ACTION_QUALITY_PROFILES.jog.minimumFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.6);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumFootPlantBalanceRatio).toBeGreaterThanOrEqual(0.6);
  });

  it('blocks locomotion sources whose arms do not counter-swing through the stride', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 60, readyStanceLegLoadDegrees: 28, stickActionArmRangeDegrees: 24, stickActionBeatSpanRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, locomotionArmSwingRangeDegrees: 18 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        locomotionArmSwingRangeDegrees: 18,
        minimumLocomotionArmSwingRangeDegrees: ACTION_QUALITY_PROFILES.jog.minimumLocomotionArmSwingRangeDegrees,
      },
    ]);
  });

  it('blocks locomotion sources whose total leg range does not create visible alternating stride separation', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 12,
      rootTravelUnits: 48,
      rootForwardTravelUnits: 48,
      rootForwardSpeedChangeUnits: 0.6,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 1,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.75,
      maxFootPlantRootDriftUnits: 4,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 9,
      stickActionRecoveryRatio: 1,
      athleticTorsoLeanDegrees: 14,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 60, readyStanceLegLoadDegrees: 28, alternatingLegSeparationDegrees: 0, maxFootPlantRootDriftUnits: 0.15, stickActionArmRangeDegrees: 24, stickActionBeatSpanRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, alternatingLegSeparationDegrees: 12 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        alternatingLegSeparationDegrees: 12,
        minimumAlternatingLegSeparationDegrees: ACTION_QUALITY_PROFILES.jog.minimumAlternatingLegSeparationDegrees,
      },
    ]);
  });

  it('blocks complete source coverage when an action family lacks enough root travel or body rotation', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 24,
      durationSeconds: 0.8,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 28,
      activeRotationChannelCount: 10,
      rootTravelUnits: 32,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 260,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 130,
      stickActionPhaseChanges: 2,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 50 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 12 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 190 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 170 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 230 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        rootTravelUnits: 12,
        rootForwardTravelUnits: 12,
        totalRotationRangeDegrees: 260,
        minimumRootTravelUnits: ACTION_QUALITY_PROFILES.sprint.minimumRootTravelUnits,
        minimumRootForwardTravelUnits: ACTION_QUALITY_PROFILES.sprint.minimumRootForwardTravelUnits,
        minimumTotalRotationRangeDegrees: ACTION_QUALITY_PROFILES.sprint.minimumTotalRotationRangeDegrees,
      },
    ]);
  });

  it('blocks jog and sprint sources that do not contain a full two-contact stride cycle', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 1,
      stickActionArmRangeDegrees: 130,
      stickActionPhaseChanges: 2,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 190, stridePhaseChanges: 0 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 170, stridePhaseChanges: 0 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 230, stridePhaseChanges: 0 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        stridePhaseChanges: 1,
        minimumStridePhaseChanges: ACTION_QUALITY_PROFILES.jog.minimumStridePhaseChanges,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        stridePhaseChanges: 1,
        minimumStridePhaseChanges: ACTION_QUALITY_PROFILES.sprint.minimumStridePhaseChanges,
      },
    ]);
  });

  it('blocks jog and sprint sources whose stride changes are compressed into a short burst', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 44,
      rootForwardSpeedChangeUnits: 0.8,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      maxFootPlantRootDriftUnits: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.18,
      stickActionArmRangeDegrees: 130,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.8,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 10,
      stickActionRecoveryRatio: 0.8,
      athleticTorsoLeanDegrees: 14,
      maxFrameRotationDeltaDegrees: 8,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380, strideCycleSpanRatio: 0.2 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        strideCycleSpanRatio: 0.18,
        minimumStrideCycleSpanRatio: ACTION_QUALITY_PROFILES.jog.minimumStrideCycleSpanRatio,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        strideCycleSpanRatio: 0.2,
        minimumStrideCycleSpanRatio: ACTION_QUALITY_PROFILES.sprint.minimumStrideCycleSpanRatio,
      },
    ]);
  });

  it('blocks stick-action sources that lack enough arm travel for a believable hand/stick mechanic', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 120,
      stickActionPhaseChanges: 2,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stickActionArmRangeDegrees: 24, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220, stickActionArmRangeDegrees: 42, stridePhaseChanges: 0 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180, stickActionArmRangeDegrees: 105, stridePhaseChanges: 0 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180, stickActionArmRangeDegrees: 105, stridePhaseChanges: 0 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240, stickActionArmRangeDegrees: 130, stridePhaseChanges: 0 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        stickActionArmRangeDegrees: 42,
        minimumStickActionArmRangeDegrees: ACTION_QUALITY_PROFILES.carry.minimumStickActionArmRangeDegrees,
      },
    ]);
  });

  it('blocks stick-action sources that have arm travel but no load-release-follow-through phases', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stickActionArmRangeDegrees: 24 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        stickActionPhaseChanges: 0,
        minimumStickActionPhaseChanges: ACTION_QUALITY_PROFILES.carry.minimumStickActionPhaseChanges,
      },
      {
        relativePath: 'receive-pass-settle.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['receive'],
        stickActionPhaseChanges: 0,
        minimumStickActionPhaseChanges: ACTION_QUALITY_PROFILES.receive.minimumStickActionPhaseChanges,
      },
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        stickActionPhaseChanges: 0,
        minimumStickActionPhaseChanges: ACTION_QUALITY_PROFILES.pass.minimumStickActionPhaseChanges,
      },
      {
        relativePath: 'wrist-shot-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['shot'],
        stickActionPhaseChanges: 0,
        minimumStickActionPhaseChanges: ACTION_QUALITY_PROFILES.shot.minimumStickActionPhaseChanges,
      },
    ]);
  });

  it('blocks stick-action sources whose action beats are too compressed to retarget cleanly', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stickActionArmRangeDegrees: 24, stickActionBeatSpanRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180 },
      {
        fileName: 'forehand-pass-release.bvh',
        filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh',
        ...viableBase,
        frameCount: 24,
        durationSeconds: 0.8,
        rootTravelUnits: 6,
        totalRotationRangeDegrees: 180,
        stickActionBeatSpanRatio: 0.08,
      },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        stickActionBeatSpanRatio: 0.08,
        minimumStickActionBeatSpanRatio: ACTION_QUALITY_PROFILES.pass.minimumStickActionBeatSpanRatio,
      },
    ]);
  });

  it('blocks stick-action sources whose arms move without torso follow-through', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stickActionArmRangeDegrees: 24, stickActionBeatSpanRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      {
        fileName: 'stick-carry-control.bvh',
        filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh',
        ...viableBase,
        frameCount: 24,
        durationSeconds: 0.8,
        rootTravelUnits: 20,
        totalRotationRangeDegrees: 220,
        stickActionTorsoRangeDegrees: 4,
      },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        stickActionTorsoRangeDegrees: 4,
        minimumStickActionTorsoRangeDegrees: ACTION_QUALITY_PROFILES.carry.minimumStickActionTorsoRangeDegrees,
      },
    ]);
  });

  it('blocks stick-action sources whose hips and shoulders rotate as one flat block', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 10,
      stickActionRecoveryRatio: 1,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, hipShoulderSeparationDegrees: 2 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32, hipShoulderSeparationDegrees: 1 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34, hipShoulderSeparationDegrees: 1 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38, hipShoulderSeparationDegrees: 2 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        hipShoulderSeparationDegrees: 2,
        minimumHipShoulderSeparationDegrees: ACTION_QUALITY_PROFILES.carry.minimumHipShoulderSeparationDegrees,
      },
      {
        relativePath: 'receive-pass-settle.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['receive'],
        hipShoulderSeparationDegrees: 1,
        minimumHipShoulderSeparationDegrees: ACTION_QUALITY_PROFILES.receive.minimumHipShoulderSeparationDegrees,
      },
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        hipShoulderSeparationDegrees: 1,
        minimumHipShoulderSeparationDegrees: ACTION_QUALITY_PROFILES.pass.minimumHipShoulderSeparationDegrees,
      },
      {
        relativePath: 'wrist-shot-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['shot'],
        hipShoulderSeparationDegrees: 2,
        minimumHipShoulderSeparationDegrees: ACTION_QUALITY_PROFILES.shot.minimumHipShoulderSeparationDegrees,
      },
    ]);
  });

  it('blocks stick-action sources that end frozen near the peak action pose', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      stickActionRecoveryRatio: 1,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stickActionArmRangeDegrees: 24, stickActionBeatSpanRatio: 0, stickActionRecoveryRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180 },
      {
        fileName: 'forehand-pass-release.bvh',
        filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh',
        ...viableBase,
        frameCount: 24,
        durationSeconds: 0.8,
        rootTravelUnits: 6,
        totalRotationRangeDegrees: 180,
        stickActionRecoveryRatio: 0.2,
      },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        stickActionRecoveryRatio: 0.2,
        minimumStickActionRecoveryRatio: ACTION_QUALITY_PROFILES.pass.minimumStickActionRecoveryRatio,
      },
    ]);
  });

  it('blocks stick-action sources that lack lateral root weight transfer', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 30,
      durationSeconds: 1,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 2,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stickActionArmRangeDegrees: 24, stickActionBeatSpanRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase },
      {
        fileName: 'forehand-pass-release.bvh',
        filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh',
        ...viableBase,
        frameCount: 24,
        durationSeconds: 0.8,
        rootTravelUnits: 6,
        rootLateralShiftUnits: 0,
        totalRotationRangeDegrees: 180,
      },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        rootLateralShiftUnits: 0,
        minimumRootLateralShiftUnits: ACTION_QUALITY_PROFILES.pass.minimumRootLateralShiftUnits,
      },
    ]);
  });

  it('blocks jog and sprint sources whose first and last poses cannot loop cleanly', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, footPlantContactFrameCount: 4, footPlantSideCount: 2 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, locomotionLoopClosureErrorDegrees: 28 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, totalRotationRangeDegrees: 380, rootVerticalLoopOffsetUnits: 2.4 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        locomotionLoopClosureErrorDegrees: 28,
        maximumLoopClosureErrorDegrees: ACTION_QUALITY_PROFILES.jog.maximumLoopClosureErrorDegrees,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        rootVerticalLoopOffsetUnits: 2.4,
        maximumLoopVerticalOffsetUnits: ACTION_QUALITY_PROFILES.sprint.maximumLoopVerticalOffsetUnits,
      },
    ]);
  });

  it('blocks jog and sprint sources without lateral root weight shift', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
      rootLateralShiftUnits: 30,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, footPlantContactFrameCount: 4, footPlantSideCount: 2 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, rootLateralShiftUnits: 0 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootLateralShiftUnits: 0, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        rootLateralShiftUnits: 0,
        minimumRootLateralShiftUnits: ACTION_QUALITY_PROFILES.jog.minimumRootLateralShiftUnits,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        rootLateralShiftUnits: 0,
        minimumRootLateralShiftUnits: ACTION_QUALITY_PROFILES.sprint.minimumRootLateralShiftUnits,
      },
    ]);
  });

  it('blocks jog and sprint sources whose root motion is mostly sideways instead of forward', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      stickActionRecoveryRatio: 1,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, rootForwardTravelUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, rootForwardTravelUnits: 0 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 0, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        rootForwardTravelUnits: 0,
        minimumRootForwardTravelUnits: ACTION_QUALITY_PROFILES.jog.minimumRootForwardTravelUnits,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        rootForwardTravelUnits: 0,
        minimumRootForwardTravelUnits: ACTION_QUALITY_PROFILES.sprint.minimumRootForwardTravelUnits,
      },
    ]);
  });

  it('blocks jog and sprint sources whose forward root motion has no acceleration profile', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      stickActionRecoveryRatio: 1,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, rootForwardSpeedChangeUnits: 0.04 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, rootForwardSpeedChangeUnits: 0.05, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        rootForwardSpeedChangeUnits: 0.04,
        minimumRootForwardSpeedChangeUnits: ACTION_QUALITY_PROFILES.jog.minimumRootForwardSpeedChangeUnits,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        rootForwardSpeedChangeUnits: 0.05,
        minimumRootForwardSpeedChangeUnits: ACTION_QUALITY_PROFILES.sprint.minimumRootForwardSpeedChangeUnits,
      },
    ]);
  });

  it('blocks jog and sprint sources whose stride phase changes but root height stays floaty', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0,
      readyStanceLegLoadDegrees: 30,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        rootVerticalBounceUnits: 0,
        minimumRootVerticalBounceUnits: ACTION_QUALITY_PROFILES.jog.minimumRootVerticalBounceUnits,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        rootVerticalBounceUnits: 0,
        minimumRootVerticalBounceUnits: ACTION_QUALITY_PROFILES.sprint.minimumRootVerticalBounceUnits,
      },
    ]);
  });

  it('blocks jog and sprint sources whose roots move but legs do not drive through a full stride', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      legDriveRangeDegrees: 0,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        legDriveRangeDegrees: 0,
        minimumLegDriveRangeDegrees: ACTION_QUALITY_PROFILES.jog.minimumLegDriveRangeDegrees,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        legDriveRangeDegrees: 0,
        minimumLegDriveRangeDegrees: ACTION_QUALITY_PROFILES.sprint.minimumLegDriveRangeDegrees,
      },
    ]);
  });

  it('blocks jog and sprint sources whose roots bounce without grounded foot-contact evidence', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 0,
      footPlantSideCount: 0,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, footPlantContactFrameCount: 4, footPlantSideCount: 2 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, footPlantContactFrameCount: 12, footPlantSideCount: 2 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, footPlantContactFrameCount: 12, footPlantSideCount: 2 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, footPlantContactFrameCount: 12, footPlantSideCount: 2 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, footPlantContactFrameCount: 12, footPlantSideCount: 2 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        footPlantContactFrameCount: 0,
        minimumFootPlantContactFrames: ACTION_QUALITY_PROFILES.jog.minimumFootPlantContactFrames,
        footPlantSideCount: 0,
        minimumFootPlantSideCount: ACTION_QUALITY_PROFILES.jog.minimumFootPlantSideCount,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        footPlantContactFrameCount: 0,
        minimumFootPlantContactFrames: ACTION_QUALITY_PROFILES.sprint.minimumFootPlantContactFrames,
        footPlantSideCount: 0,
        minimumFootPlantSideCount: ACTION_QUALITY_PROFILES.sprint.minimumFootPlantSideCount,
      },
    ]);
  });

  it('blocks jog and sprint sources whose arm swing is not synchronized with opposite leg drive', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      stickActionRecoveryRatio: 1,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, locomotionContralateralSyncRatio: 0.12 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, totalRotationRangeDegrees: 380, locomotionContralateralSyncRatio: 0.2 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        locomotionContralateralSyncRatio: 0.12,
        minimumLocomotionContralateralSyncRatio: ACTION_QUALITY_PROFILES.jog.minimumLocomotionContralateralSyncRatio,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        locomotionContralateralSyncRatio: 0.2,
        minimumLocomotionContralateralSyncRatio: ACTION_QUALITY_PROFILES.sprint.minimumLocomotionContralateralSyncRatio,
      },
    ]);
  });

  it('blocks grounded clips whose foot-plant contact is too one-sided', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 36,
      activeRotationChannelCount: 12,
      rootTravelUnits: 44,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      stickActionRecoveryRatio: 1,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, rootTravelUnits: 1, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, footPlantBalanceRatio: 0.25 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, totalRotationRangeDegrees: 380, footPlantBalanceRatio: 0.25 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, footPlantBalanceRatio: 0.25 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        footPlantBalanceRatio: 0.25,
        minimumFootPlantBalanceRatio: ACTION_QUALITY_PROFILES.jog.minimumFootPlantBalanceRatio,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        footPlantBalanceRatio: 0.25,
        minimumFootPlantBalanceRatio: ACTION_QUALITY_PROFILES.sprint.minimumFootPlantBalanceRatio,
      },
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        footPlantBalanceRatio: 0.25,
        minimumFootPlantBalanceRatio: ACTION_QUALITY_PROFILES.carry.minimumFootPlantBalanceRatio,
      },
    ]);
  });

  it('blocks grounded clips whose foot-plant windows are only momentary taps', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 4,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      athleticTorsoLeanDegrees: 14,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, footPlantMinSideHoldFrames: 2, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, footPlantMinSideHoldFrames: 1 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380, footPlantMinSideHoldFrames: 1 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        footPlantMinSideHoldFrames: 1,
        minimumFootPlantHoldFramesPerSide: ACTION_QUALITY_PROFILES.jog.minimumFootPlantHoldFramesPerSide,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        footPlantMinSideHoldFrames: 1,
        minimumFootPlantHoldFramesPerSide: ACTION_QUALITY_PROFILES.sprint.minimumFootPlantHoldFramesPerSide,
      },
    ]);
  });

  it('blocks grounded clips whose planted-contact windows drift too far', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      stickActionRecoveryRatio: 1,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, maxFootPlantRootDriftUnits: 18 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380, maxFootPlantRootDriftUnits: 20 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, maxFootPlantRootDriftUnits: 12 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        maxFootPlantRootDriftUnits: 18,
        maximumFootPlantRootDriftUnits: ACTION_QUALITY_PROFILES.jog.maximumFootPlantRootDriftUnits,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        maxFootPlantRootDriftUnits: 20,
        maximumFootPlantRootDriftUnits: ACTION_QUALITY_PROFILES.sprint.maximumFootPlantRootDriftUnits,
      },
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        maxFootPlantRootDriftUnits: 12,
        maximumFootPlantRootDriftUnits: ACTION_QUALITY_PROFILES.carry.maximumFootPlantRootDriftUnits,
      },
    ]);
  });

  it('blocks BVH action sources with abrupt frame-to-frame joint snaps', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      stickActionRecoveryRatio: 1,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, maxFrameRotationDeltaDegrees: 65 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38, maxFrameRotationDeltaDegrees: 70 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        maxFrameRotationDeltaDegrees: 65,
        maximumFrameRotationDeltaDegrees: ACTION_QUALITY_PROFILES.jog.maximumFrameRotationDeltaDegrees,
      },
      {
        relativePath: 'wrist-shot-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['shot'],
        maxFrameRotationDeltaDegrees: 70,
        maximumFrameRotationDeltaDegrees: ACTION_QUALITY_PROFILES.shot.maximumFrameRotationDeltaDegrees,
      },
    ]);
  });

  it('blocks BVH action sources with abrupt frame-to-frame acceleration spikes', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 2, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34, maxFrameRotationAccelerationDegrees: 31 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        maxFrameRotationAccelerationDegrees: 31,
        maximumFrameRotationAccelerationDegrees: ACTION_QUALITY_PROFILES.pass.maximumFrameRotationAccelerationDegrees,
      },
    ]);
  });

  it('blocks run and stick-action sources whose upper body stays too upright', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      legDriveRangeDegrees: 160,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      stickActionRecoveryRatio: 1,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, athleticTorsoLeanDegrees: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, athleticTorsoLeanDegrees: 2 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380, athleticTorsoLeanDegrees: 3 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, athleticTorsoLeanDegrees: 2 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        athleticTorsoLeanDegrees: 2,
        minimumAthleticTorsoLeanDegrees: ACTION_QUALITY_PROFILES.jog.minimumAthleticTorsoLeanDegrees,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        athleticTorsoLeanDegrees: 3,
        minimumAthleticTorsoLeanDegrees: ACTION_QUALITY_PROFILES.sprint.minimumAthleticTorsoLeanDegrees,
      },
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        athleticTorsoLeanDegrees: 2,
        minimumAthleticTorsoLeanDegrees: ACTION_QUALITY_PROFILES.carry.minimumAthleticTorsoLeanDegrees,
      },
    ]);
  });

  it('blocks stick-action sources whose arm travel is not balanced across both hands', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 140,
      stickActionPhaseChanges: 2,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      stickActionTwoHandBalanceRatio: 0.8,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, stickActionTwoHandBalanceRatio: 0.2 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        stickActionTwoHandBalanceRatio: 0.2,
        minimumStickActionTwoHandBalanceRatio: ACTION_QUALITY_PROFILES.carry.minimumStickActionTwoHandBalanceRatio,
      },
    ]);
  });

  it('blocks pass receive and shot sources whose lower-body load does not lead the stick action', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      stickActionLowerBodyLeadFrames: 6,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32, stickActionLowerBodyLeadFrames: -1 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34, stickActionLowerBodyLeadFrames: 1 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38, stickActionLowerBodyLeadFrames: -2 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'receive-pass-settle.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['receive'],
        stickActionLowerBodyLeadFrames: -1,
        minimumStickActionLowerBodyLeadFrames: ACTION_QUALITY_PROFILES.receive.minimumStickActionLowerBodyLeadFrames,
      },
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        stickActionLowerBodyLeadFrames: 1,
        minimumStickActionLowerBodyLeadFrames: ACTION_QUALITY_PROFILES.pass.minimumStickActionLowerBodyLeadFrames,
      },
      {
        relativePath: 'wrist-shot-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['shot'],
        stickActionLowerBodyLeadFrames: -2,
        minimumStickActionLowerBodyLeadFrames: ACTION_QUALITY_PROFILES.shot.minimumStickActionLowerBodyLeadFrames,
      },
    ]);
  });

  it('blocks stick-action sources whose release or catch beat is not supported by a planted-foot window', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionTwoHandSyncRatio: 0.8,
      stickActionTwoHandContactRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionReleasePeakRatio: 0.55,
      stickActionSupportedReleaseRatio: 0.8,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      stickActionLowerBodyLeadFrames: 6,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0, stickActionSupportedReleaseRatio: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, stickActionSupportedReleaseRatio: 0.1 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34, stickActionSupportedReleaseRatio: 0.2 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        stickActionSupportedReleaseRatio: 0.1,
        minimumStickActionSupportedReleaseRatio: ACTION_QUALITY_PROFILES.carry.minimumStickActionSupportedReleaseRatio,
      },
      {
        relativePath: 'forehand-pass-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['pass'],
        stickActionSupportedReleaseRatio: 0.2,
        minimumStickActionSupportedReleaseRatio: ACTION_QUALITY_PROFILES.pass.minimumStickActionSupportedReleaseRatio,
      },
    ]);
  });

  it('blocks stick-action sources whose two hands do not work through the same active window', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionTwoHandSyncRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      stickActionLowerBodyLeadFrames: 6,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0, stickActionTwoHandSyncRatio: 0, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, stickActionTwoHandSyncRatio: 0.22, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(ACTION_QUALITY_PROFILES.carry.minimumStickActionTwoHandSyncRatio).toBeGreaterThanOrEqual(0.65);
    expect(ACTION_QUALITY_PROFILES.receive.minimumStickActionTwoHandSyncRatio).toBeGreaterThanOrEqual(0.65);
    expect(ACTION_QUALITY_PROFILES.pass.minimumStickActionTwoHandSyncRatio).toBeGreaterThanOrEqual(0.65);
    expect(ACTION_QUALITY_PROFILES.shot.minimumStickActionTwoHandSyncRatio).toBeGreaterThanOrEqual(0.65);
    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'stick-carry-control.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['carry'],
        stickActionTwoHandSyncRatio: 0.22,
        minimumStickActionTwoHandSyncRatio: ACTION_QUALITY_PROFILES.carry.minimumStickActionTwoHandSyncRatio,
      },
    ]);
  });

  it('requires receive sources to carry a sustained two-hand catch contact floor before retargeting', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionTwoHandSyncRatio: 0.8,
      stickActionTwoHandContactRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionReleasePeakRatio: 0.55,
      stickActionSupportedReleaseRatio: 0.8,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      stickActionLowerBodyLeadFrames: 6,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0, stickActionTwoHandSyncRatio: 0, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32, stickActionTwoHandContactRatio: 0.67 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(ACTION_QUALITY_PROFILES.receive.minimumStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);
    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'receive-pass-settle.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['receive'],
        stickActionTwoHandContactRatio: 0.67,
        minimumStickActionTwoHandContactRatio: ACTION_QUALITY_PROFILES.receive.minimumStickActionTwoHandContactRatio,
      },
    ]);
  });

  it('requires shot sources to carry the same two-hand release contact floor as the retarget export', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionTwoHandSyncRatio: 0.8,
      stickActionTwoHandContactRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionReleasePeakRatio: 0.55,
      stickActionSupportedReleaseRatio: 0.8,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      stickActionLowerBodyLeadFrames: 6,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0, stickActionTwoHandSyncRatio: 0, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38, stickActionTwoHandContactRatio: 0.67 },
    ]);

    expect(ACTION_QUALITY_PROFILES.shot.minimumStickActionTwoHandContactRatio).toBeGreaterThanOrEqual(0.75);
    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'wrist-shot-release.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['shot'],
        stickActionTwoHandContactRatio: 0.67,
        minimumStickActionTwoHandContactRatio: ACTION_QUALITY_PROFILES.shot.minimumStickActionTwoHandContactRatio,
      },
    ]);
  });

  it('blocks locomotion sources whose planted contacts do not carry forward drive', () => {
    const viableBase = {
      format: 'bvh',
      frameCount: 36,
      durationSeconds: 1.2,
      sourceRightsPath: 'SOURCE_NOTES.md',
      maxRotationRangeDegrees: 80,
      activeRotationChannelCount: 14,
      maxFrameRotationDeltaDegrees: 12,
      maxFrameRotationAccelerationDegrees: 8,
      rootTravelUnits: 44,
      rootForwardTravelUnits: 36,
      rootForwardSpeedChangeUnits: 0.75,
      rootLateralShiftUnits: 30,
      rootVerticalBounceUnits: 0.6,
      readyStanceLegLoadDegrees: 30,
      totalRotationRangeDegrees: 360,
      stridePhaseChanges: 3,
      strideCycleSpanRatio: 0.6,
      legDriveRangeDegrees: 160,
      locomotionStrideBalanceRatio: 1,
      alternatingLegSeparationDegrees: 80,
      locomotionArmSwingRangeDegrees: 120,
      locomotionContralateralSyncRatio: 0.9,
      locomotionFootPlantDriveRatio: 0.8,
      footPlantContactFrameCount: 12,
      footPlantSideCount: 2,
      footPlantBalanceRatio: 0.8,
      footPlantMinSideHoldFrames: 4,
      maxFootPlantRootDriftUnits: 4,
      stickActionArmRangeDegrees: 180,
      stickActionTwoHandBalanceRatio: 0.8,
      stickActionTwoHandSyncRatio: 0.8,
      stickActionPhaseChanges: 3,
      stickActionBeatSpanRatio: 0.5,
      stickActionTorsoRangeDegrees: 40,
      hipShoulderSeparationDegrees: 8,
      stickActionRecoveryRatio: 1,
      stickActionLowerBodyLeadFrames: 6,
      athleticTorsoLeanDegrees: 12,
      locomotionLoopClosureErrorDegrees: 0,
      rootVerticalLoopOffsetUnits: 0,
    };
    const report = summarizeMotionSources([
      { fileName: 'ready-stance.bvh', filePath: 'asset-inbox/players/motion-sources/ready-stance.bvh', ...viableBase, frameCount: 14, durationSeconds: 0.467, maxFrameRotationDeltaDegrees: 3, maxFrameRotationAccelerationDegrees: 4, rootTravelUnits: 1, rootForwardTravelUnits: 0, rootForwardSpeedChangeUnits: 0, locomotionFootPlantDriveRatio: 0, maxFootPlantRootDriftUnits: 0, totalRotationRangeDegrees: 60, stridePhaseChanges: 0, hipShoulderSeparationDegrees: 0, stickActionTwoHandBalanceRatio: 0, stickActionTwoHandSyncRatio: 0, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'jog-forward.bvh', filePath: 'asset-inbox/players/motion-sources/jog-forward.bvh', ...viableBase, locomotionFootPlantDriveRatio: 0.31 },
      { fileName: 'sprint-forward.bvh', filePath: 'asset-inbox/players/motion-sources/sprint-forward.bvh', ...viableBase, rootTravelUnits: 48, rootForwardTravelUnits: 48, totalRotationRangeDegrees: 380, locomotionFootPlantDriveRatio: 0.42 },
      { fileName: 'stick-carry-control.bvh', filePath: 'asset-inbox/players/motion-sources/stick-carry-control.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 20, rootForwardTravelUnits: 20, totalRotationRangeDegrees: 220, stridePhaseChanges: 0, legDriveRangeDegrees: 70, stickActionLowerBodyLeadFrames: 0 },
      { fileName: 'receive-pass-settle.bvh', filePath: 'asset-inbox/players/motion-sources/receive-pass-settle.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 7, rootForwardTravelUnits: 7, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 32 },
      { fileName: 'forehand-pass-release.bvh', filePath: 'asset-inbox/players/motion-sources/forehand-pass-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 6, rootForwardTravelUnits: 6, totalRotationRangeDegrees: 180, stridePhaseChanges: 0, legDriveRangeDegrees: 34 },
      { fileName: 'wrist-shot-release.bvh', filePath: 'asset-inbox/players/motion-sources/wrist-shot-release.bvh', ...viableBase, frameCount: 24, durationSeconds: 0.8, rootTravelUnits: 8, rootForwardTravelUnits: 8, totalRotationRangeDegrees: 240, stridePhaseChanges: 0, legDriveRangeDegrees: 38 },
    ]);

    expect(ACTION_QUALITY_PROFILES.jog.minimumLocomotionFootPlantDriveRatio).toBeGreaterThanOrEqual(0.55);
    expect(ACTION_QUALITY_PROFILES.sprint.minimumLocomotionFootPlantDriveRatio).toBeGreaterThanOrEqual(0.55);
    expect(report.status).toBe('blocked');
    expect(report.invalidMotionSources).toEqual([
      {
        relativePath: 'jog-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['jog'],
        locomotionFootPlantDriveRatio: 0.31,
        minimumLocomotionFootPlantDriveRatio: ACTION_QUALITY_PROFILES.jog.minimumLocomotionFootPlantDriveRatio,
      },
      {
        relativePath: 'sprint-forward.bvh',
        reason: 'bvh-action-quality-floor',
        groups: ['sprint'],
        locomotionFootPlantDriveRatio: 0.42,
        minimumLocomotionFootPlantDriveRatio: ACTION_QUALITY_PROFILES.sprint.minimumLocomotionFootPlantDriveRatio,
      },
    ]);
  });

  it('requires receive sources to plant the catch and settle drive before retargeting', () => {
    expect(ACTION_QUALITY_PROFILES.receive.minimumLocomotionFootPlantDriveRatio).toBeGreaterThanOrEqual(0.6);
  });
});
