import { describe, expect, it } from 'vitest';
import {
  allowedFinalGradeRunnerCaptureMethods,
  classifyRunnerMotionQuality,
  hasFinalGradeRunnerProvenance,
  isAcceptedRunnerSourceQuality,
  invalidFinalGradeRunnerCaptureMethod,
  invalidFinalGradeRunnerRetargetFrameCount,
  invalidFinalGradeRunnerRetargetQualityMetrics,
  invalidFinalGradeRunnerUsageRights,
} from './player-motion-quality-policy.mjs';

describe('player motion quality policy', () => {
  const requiredRunnerClips = [
    'idle-ready',
    'jog-forward',
    'sprint-forward',
    'stick-handle',
    'forehand-pass',
    'receive-pass',
    'wrist-shot',
  ];
  const finalGradeDurationEvidence = {
    sourceFrameCount: 36,
    retargetedFrameCount: 36,
    sourceDurationSeconds: 1.2,
    retargetedDurationSeconds: 1.2,
    usageRights: 'Licensed for Goon Squad replay retargeting and runtime use',
  };

  it('allows internal authored retarget seeds but does not classify them as final-grade motion', () => {
    const summary = classifyRunnerMotionQuality([
      { clipName: 'idle-ready', sourceQuality: 'internal-authored-action-clip' },
      { clipName: 'jog-forward', sourceQuality: 'internal-authored-action-clip' },
    ], { requiredClipNames: requiredRunnerClips });

    expect(summary.status).toBe('source-driven-seed');
    expect(summary.isAcceptedForStrictProduction).toBe(true);
    expect(summary.isFinalGrade).toBe(false);
    expect(summary.seedClipNames).toEqual(['idle-ready', 'jog-forward']);
    expect(summary.finalGradeClipNames).toEqual([]);
    expect(summary.missingFinalGradeClipNames).toEqual(requiredRunnerClips);
  });

  it('does not classify a partial final-grade action set as final grade', () => {
    const summary = classifyRunnerMotionQuality([
      { clipName: 'idle-ready', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/idle.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'jog-forward', sourceQuality: 'internally-authored-motion-capture-action-clip', sourceRightsPath: 'licenses/jog.md', sourceProvider: 'Goon Squad internal', captureMethod: 'markerless-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'sprint-forward', sourceQuality: 'licensed-authored-action-clip', sourceRightsPath: 'licenses/sprint.md', sourceProvider: 'Example Animation Vendor', captureMethod: 'hand-authored-reference-animation', ...finalGradeDurationEvidence },
    ], { requiredClipNames: requiredRunnerClips });

    expect(summary.status).toBe('partial-final-grade-motion');
    expect(summary.isAcceptedForStrictProduction).toBe(true);
    expect(summary.isFinalGrade).toBe(false);
    expect(summary.seedClipNames).toEqual([]);
    expect(summary.finalGradeClipNames).toEqual(['idle-ready', 'jog-forward', 'sprint-forward']);
    expect(summary.missingFinalGradeClipNames).toEqual([
      'stick-handle',
      'forehand-pass',
      'receive-pass',
      'wrist-shot',
    ]);
  });

  it('classifies licensed or internally captured coverage for every required action as final grade', () => {
    const summary = classifyRunnerMotionQuality([
      { clipName: 'idle-ready', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/idle.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'jog-forward', sourceQuality: 'internally-authored-motion-capture-action-clip', sourceRightsPath: 'licenses/jog.md', sourceProvider: 'Goon Squad internal', captureMethod: 'markerless-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'sprint-forward', sourceQuality: 'licensed-authored-action-clip', sourceRightsPath: 'licenses/sprint.md', sourceProvider: 'Example Animation Vendor', captureMethod: 'hand-authored-reference-animation', ...finalGradeDurationEvidence },
      { clipName: 'stick-handle', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/carry.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'forehand-pass', sourceQuality: 'licensed-authored-action-clip', sourceRightsPath: 'licenses/pass.md', sourceProvider: 'Example Animation Vendor', captureMethod: 'hand-authored-reference-animation', ...finalGradeDurationEvidence },
      { clipName: 'receive-pass', sourceQuality: 'internally-authored-performance-capture-action-clip', sourceRightsPath: 'licenses/receive.md', sourceProvider: 'Goon Squad internal', captureMethod: 'performance-capture', ...finalGradeDurationEvidence },
      { clipName: 'wrist-shot', sourceQuality: 'internally-authored-motion-capture-action-clip', sourceRightsPath: 'licenses/shot.md', sourceProvider: 'Goon Squad internal', captureMethod: 'markerless-motion-capture', ...finalGradeDurationEvidence },
    ], { requiredClipNames: requiredRunnerClips });

    expect(summary.status).toBe('final-grade-motion');
    expect(summary.isAcceptedForStrictProduction).toBe(true);
    expect(summary.isFinalGrade).toBe(true);
    expect(summary.seedClipNames).toEqual([]);
    expect(summary.finalGradeClipNames).toEqual(requiredRunnerClips);
    expect(summary.missingFinalGradeClipNames).toEqual([]);
  });

  it('classifies internally authored high-quality action clips as final grade when provenance and retarget coverage are complete', () => {
    const summary = classifyRunnerMotionQuality(requiredRunnerClips.map((clipName) => ({
      clipName,
      sourceQuality: 'internally-authored-high-quality-action-clip',
      sourceRightsPath: 'licenses/internal-high-quality.md',
      sourceProvider: 'Goon Squad internal',
      captureMethod: 'professional-keyframe-animation',
      ...finalGradeDurationEvidence,
    })), { requiredClipNames: requiredRunnerClips });

    expect(summary.status).toBe('final-grade-motion');
    expect(summary.isAcceptedForStrictProduction).toBe(true);
    expect(summary.isFinalGrade).toBe(true);
    expect(summary.seedClipNames).toEqual([]);
    expect(summary.finalGradeClipNames).toEqual(requiredRunnerClips);
    expect(summary.missingFinalGradeClipNames).toEqual([]);
  });

  it('rejects final-grade motion when retargeted runner export compresses source clip duration', () => {
    const summary = classifyRunnerMotionQuality([
      { clipName: 'idle-ready', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/idle.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'jog-forward', sourceQuality: 'internally-authored-motion-capture-action-clip', sourceRightsPath: 'licenses/jog.md', sourceProvider: 'Goon Squad internal', captureMethod: 'markerless-motion-capture', ...finalGradeDurationEvidence, retargetedDurationSeconds: 0.72 },
      { clipName: 'sprint-forward', sourceQuality: 'licensed-authored-action-clip', sourceRightsPath: 'licenses/sprint.md', sourceProvider: 'Example Animation Vendor', captureMethod: 'hand-authored-reference-animation', ...finalGradeDurationEvidence },
      { clipName: 'stick-handle', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/carry.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'forehand-pass', sourceQuality: 'licensed-authored-action-clip', sourceRightsPath: 'licenses/pass.md', sourceProvider: 'Example Animation Vendor', captureMethod: 'hand-authored-reference-animation', ...finalGradeDurationEvidence },
      { clipName: 'receive-pass', sourceQuality: 'internally-authored-performance-capture-action-clip', sourceRightsPath: 'licenses/receive.md', sourceProvider: 'Goon Squad internal', captureMethod: 'performance-capture', ...finalGradeDurationEvidence },
      { clipName: 'wrist-shot', sourceQuality: 'internally-authored-motion-capture-action-clip', sourceRightsPath: 'licenses/shot.md', sourceProvider: 'Goon Squad internal', captureMethod: 'markerless-motion-capture', ...finalGradeDurationEvidence },
    ], { requiredClipNames: requiredRunnerClips });

    expect(summary.status).toBe('invalid-final-grade-retarget-duration');
    expect(summary.isAcceptedForStrictProduction).toBe(false);
    expect(summary.isFinalGrade).toBe(false);
    expect(summary.finalGradeClipNames).not.toContain('jog-forward');
    expect(summary.invalidFinalGradeRetargetDurationClipNames).toEqual(['jog-forward']);
    expect(summary.finalGradeRetargetDurationFailures).toEqual([
      {
        clipName: 'jog-forward',
        sourceDurationSeconds: 1.2,
        retargetedDurationSeconds: 0.72,
        minimumRetargetedDurationSeconds: 1.14,
      },
    ]);
  });

  it('rejects final-grade motion when retargeted runner export drops source frames', () => {
    const badClip = {
      clipName: 'jog-forward',
      sourceQuality: 'licensed-motion-capture-action-clip',
      sourceRightsPath: 'licenses/jog.md',
      sourceProvider: 'Example Mocap',
      captureMethod: 'optical-motion-capture',
      usageRights: 'Licensed for Goon Squad replay retargeting and runtime use',
      sourceFrameCount: 120,
      retargetedFrameCount: 90,
      sourceDurationSeconds: 2,
      retargetedDurationSeconds: 2,
    };
    const summary = classifyRunnerMotionQuality([
      { clipName: 'idle-ready', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/idle.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      badClip,
      { clipName: 'sprint-forward', sourceQuality: 'licensed-authored-action-clip', sourceRightsPath: 'licenses/sprint.md', sourceProvider: 'Example Animation Vendor', captureMethod: 'hand-authored-reference-animation', ...finalGradeDurationEvidence },
      { clipName: 'stick-handle', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/carry.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'forehand-pass', sourceQuality: 'licensed-authored-action-clip', sourceRightsPath: 'licenses/pass.md', sourceProvider: 'Example Animation Vendor', captureMethod: 'hand-authored-reference-animation', ...finalGradeDurationEvidence },
      { clipName: 'receive-pass', sourceQuality: 'internally-authored-performance-capture-action-clip', sourceRightsPath: 'licenses/receive.md', sourceProvider: 'Goon Squad internal', captureMethod: 'performance-capture', ...finalGradeDurationEvidence },
      { clipName: 'wrist-shot', sourceQuality: 'internally-authored-motion-capture-action-clip', sourceRightsPath: 'licenses/shot.md', sourceProvider: 'Goon Squad internal', captureMethod: 'markerless-motion-capture', ...finalGradeDurationEvidence },
    ], { requiredClipNames: requiredRunnerClips });

    expect(invalidFinalGradeRunnerRetargetFrameCount(badClip)).toEqual({
      clipName: 'jog-forward',
      sourceFrameCount: 120,
      retargetedFrameCount: 90,
      minimumRetargetedFrameCount: 114,
    });
    expect(summary.status).toBe('invalid-final-grade-retarget-frame-count');
    expect(summary.isAcceptedForStrictProduction).toBe(false);
    expect(summary.isFinalGrade).toBe(false);
    expect(summary.finalGradeClipNames).not.toContain('jog-forward');
    expect(summary.invalidFinalGradeRetargetFrameCountClipNames).toEqual(['jog-forward']);
    expect(summary.finalGradeRetargetFrameCountFailures).toEqual([
      {
        clipName: 'jog-forward',
        sourceFrameCount: 120,
        retargetedFrameCount: 90,
        minimumRetargetedFrameCount: 114,
      },
    ]);
  });

  it('rejects final-grade motion when exported retarget quality metrics miss their guardrails', () => {
    const badClip = {
      clipName: 'forehand-pass',
      sourceQuality: 'licensed-authored-action-clip',
      sourceRightsPath: 'licenses/pass.md',
      sourceProvider: 'Example Animation Vendor',
      captureMethod: 'vendor-authored-animation',
      ...finalGradeDurationEvidence,
      retargetedStickActionTwoHandContactRatio: 0.62,
      minimumRetargetedStickActionTwoHandContactRatio: 0.75,
      retargetedStickActionUpperArmExposureDegrees: 34,
      maximumRetargetedStickActionUpperArmExposureDegrees: 26,
    };
    const summary = classifyRunnerMotionQuality([
      { clipName: 'idle-ready', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/idle.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'jog-forward', sourceQuality: 'internally-authored-motion-capture-action-clip', sourceRightsPath: 'licenses/jog.md', sourceProvider: 'Goon Squad internal', captureMethod: 'markerless-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'sprint-forward', sourceQuality: 'licensed-authored-action-clip', sourceRightsPath: 'licenses/sprint.md', sourceProvider: 'Example Animation Vendor', captureMethod: 'hand-authored-reference-animation', ...finalGradeDurationEvidence },
      { clipName: 'stick-handle', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/carry.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      badClip,
      { clipName: 'receive-pass', sourceQuality: 'internally-authored-performance-capture-action-clip', sourceRightsPath: 'licenses/receive.md', sourceProvider: 'Goon Squad internal', captureMethod: 'performance-capture', ...finalGradeDurationEvidence },
      { clipName: 'wrist-shot', sourceQuality: 'internally-authored-motion-capture-action-clip', sourceRightsPath: 'licenses/shot.md', sourceProvider: 'Goon Squad internal', captureMethod: 'markerless-motion-capture', ...finalGradeDurationEvidence },
    ], { requiredClipNames: requiredRunnerClips });

    expect(invalidFinalGradeRunnerRetargetQualityMetrics(badClip)).toEqual({
      clipName: 'forehand-pass',
      metricFailures: [
        {
          actual: 0.62,
          metricKey: 'retargetedStickActionTwoHandContactRatio',
          minimum: 0.75,
          thresholdKey: 'minimumRetargetedStickActionTwoHandContactRatio',
          type: 'minimum',
        },
        {
          actual: 34,
          maximum: 26,
          metricKey: 'retargetedStickActionUpperArmExposureDegrees',
          thresholdKey: 'maximumRetargetedStickActionUpperArmExposureDegrees',
          type: 'maximum',
        },
      ],
    });
    expect(summary.status).toBe('invalid-final-grade-retarget-quality-metrics');
    expect(summary.isAcceptedForStrictProduction).toBe(false);
    expect(summary.isFinalGrade).toBe(false);
    expect(summary.finalGradeClipNames).not.toContain('forehand-pass');
    expect(summary.invalidFinalGradeRetargetQualityMetricClipNames).toEqual(['forehand-pass']);
  });

  it('rejects final-grade labels that do not carry source-rights and capture provenance', () => {
    const summary = classifyRunnerMotionQuality([
      { clipName: 'idle-ready', sourceQuality: 'licensed-motion-capture-action-clip', sourceRightsPath: 'licenses/idle.md', sourceProvider: 'Example Mocap', captureMethod: 'optical-motion-capture', ...finalGradeDurationEvidence },
      { clipName: 'jog-forward', sourceQuality: 'internally-authored-motion-capture-action-clip', sourceRightsPath: 'licenses/jog.md' },
    ], { requiredClipNames: requiredRunnerClips });

    expect(hasFinalGradeRunnerProvenance({ sourceRightsPath: 'licenses/idle.md' })).toBe(false);
    expect(summary.status).toBe('missing-final-grade-provenance');
    expect(summary.isAcceptedForStrictProduction).toBe(false);
    expect(summary.isFinalGrade).toBe(false);
    expect(summary.finalGradeClipNames).toEqual(['idle-ready']);
    expect(summary.missingFinalGradeProvenanceClipNames).toEqual(['jog-forward']);
    expect(summary.finalGradeProvenanceFailures).toEqual([
      { clipName: 'jog-forward', missingFields: ['sourceProvider', 'captureMethod', 'usageRights'] },
    ]);
  });

  it('rejects final-grade motion that lacks explicit usage-rights provenance', () => {
    const summary = classifyRunnerMotionQuality([
      {
        clipName: 'idle-ready',
        sourceQuality: 'licensed-motion-capture-action-clip',
        sourceRightsPath: 'licenses/idle.md',
        sourceProvider: 'Example Mocap',
        captureMethod: 'optical-motion-capture',
        ...finalGradeDurationEvidence,
        usageRights: undefined,
      },
    ], { requiredClipNames: ['idle-ready'] });

    expect(hasFinalGradeRunnerProvenance({
      sourceRightsPath: 'licenses/idle.md',
      sourceProvider: 'Example Mocap',
      captureMethod: 'optical-motion-capture',
    })).toBe(false);
    expect(summary.status).toBe('missing-final-grade-provenance');
    expect(summary.isAcceptedForStrictProduction).toBe(false);
    expect(summary.isFinalGrade).toBe(false);
    expect(summary.missingFinalGradeProvenanceClipNames).toEqual(['idle-ready']);
    expect(summary.finalGradeProvenanceFailures).toEqual([
      { clipName: 'idle-ready', missingFields: ['usageRights'] },
    ]);
  });

  it('rejects final-grade usage-rights fragments that do not cover retargeting and runtime or shipping use', () => {
    const badClip = {
      clipName: 'idle-ready',
      sourceQuality: 'internally-authored-high-quality-action-clip',
      sourceRightsPath: 'licenses/internal-high-quality.md',
      sourceProvider: 'Goon Squad internal',
      captureMethod: 'professional-keyframe-animation',
      ...finalGradeDurationEvidence,
      usageRights: 'Authored for this project. These files may be modified, retargeted,',
    };
    const summary = classifyRunnerMotionQuality([badClip], { requiredClipNames: ['idle-ready'] });

    expect(invalidFinalGradeRunnerUsageRights(badClip)).toEqual({
      clipName: 'idle-ready',
      usageRights: 'Authored for this project. These files may be modified, retargeted,',
      missingTerms: ['runtime-or-shipping-use'],
    });
    expect(summary.status).toBe('invalid-final-grade-usage-rights');
    expect(summary.isAcceptedForStrictProduction).toBe(false);
    expect(summary.isFinalGrade).toBe(false);
    expect(summary.invalidFinalGradeUsageRightsClipNames).toEqual(['idle-ready']);
  });

  it('rejects final-grade capture methods that do not match the source-quality tier', () => {
    const badClip = {
      clipName: 'jog-forward',
      sourceQuality: 'licensed-motion-capture-action-clip',
      sourceRightsPath: 'licenses/jog.md',
      sourceProvider: 'Example Mocap',
      captureMethod: 'hand-keyed-internal-bvh',
      usageRights: 'Licensed for Goon Squad replay retargeting and runtime use',
    };
    const summary = classifyRunnerMotionQuality([badClip], { requiredClipNames: requiredRunnerClips });

    expect(allowedFinalGradeRunnerCaptureMethods('licensed-motion-capture-action-clip')).toContain('optical-motion-capture');
    expect(invalidFinalGradeRunnerCaptureMethod(badClip)).toEqual({
      clipName: 'jog-forward',
      sourceQuality: 'licensed-motion-capture-action-clip',
      captureMethod: 'hand-keyed-internal-bvh',
      allowedMethods: [
        'optical-motion-capture',
        'inertial-motion-capture',
        'markerless-motion-capture',
        'performance-capture',
      ],
    });
    expect(summary.status).toBe('invalid-final-grade-capture-method');
    expect(summary.isAcceptedForStrictProduction).toBe(false);
    expect(summary.invalidFinalGradeCaptureMethodClipNames).toEqual(['jog-forward']);
    expect(summary.finalGradeClipNames).toEqual([]);
  });

  it('flags unsupported source-quality values before they can pass production validation', () => {
    const summary = classifyRunnerMotionQuality([
      { clipName: 'idle-ready', sourceQuality: 'internal-authored-action-clip' },
      { clipName: 'jog-forward', sourceQuality: 'downloaded-animation-unknown-license' },
    ]);

    expect(isAcceptedRunnerSourceQuality('downloaded-animation-unknown-license')).toBe(false);
    expect(summary.status).toBe('unsupported-source-quality');
    expect(summary.isAcceptedForStrictProduction).toBe(false);
    expect(summary.isFinalGrade).toBe(false);
    expect(summary.unsupportedClipNames).toEqual(['jog-forward']);
  });
});
