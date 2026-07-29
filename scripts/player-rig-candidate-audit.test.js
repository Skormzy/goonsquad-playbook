import { describe, expect, it } from 'vitest';
import { auditCandidateRig, scoreCandidateAgainstProfile, summarizeCandidateAudits } from './player-rig-candidate-audit.mjs';

const runnerCandidate = {
  fileName: 'runner.glb',
  filePath: 'asset-inbox/players/candidates/runner.glb',
  previewUrl: '/models/players/candidates/runner.glb',
  bytes: 2500000,
  uploadedVertices: 18000,
  clips: ['idle-ready', 'jog-forward', 'sprint-forward', 'stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'],
  namedParts: ['jersey_top', 'shorts', 'running_shoe_left', 'helmet_shell', 'glove_left'],
};

describe('player rig candidate audit', () => {
  it('scores a complete runner candidate as ready', () => {
    const result = scoreCandidateAgainstProfile(runnerCandidate, 'runner');

    expect(result.status).toBe('ready');
    expect(result.score).toBe(100);
    expect(result.issues).toEqual([]);
  });

  it('recommends the better-fitting profile for a candidate', () => {
    const audit = auditCandidateRig(runnerCandidate);

    expect(audit.recommendedProfile).toBe('runner');
    expect(audit.score).toBe(100);
    expect(audit.profiles[0].profile).toBe('runner');
    expect(audit.previewUrl).toBe('/models/players/candidates/runner.glb');
    expect(audit.bytes).toBe(2500000);
  });

  it('surfaces missing animation and equipment requirements', () => {
    const result = scoreCandidateAgainstProfile({
      ...runnerCandidate,
      clips: ['idle-ready'],
      namedParts: ['jersey_top', 'shorts', 'running_shoe_left'],
    }, 'runner');

    expect(result.status).toBe('needs-work');
    expect(result.score).toBeLessThan(100);
    expect(result.missingClips).toContain('forehand-pass');
    expect(result.missingPartGroups).toEqual([
      ['helmet', 'cage', 'visor'],
      ['glove', 'mitt'],
    ]);
  });

  it('surfaces candidates that exceed the browser file-size budget', () => {
    const result = scoreCandidateAgainstProfile({
      ...runnerCandidate,
      bytes: 3500000,
    }, 'runner');

    expect(result.status).toBe('needs-work');
    expect(result.score).toBeLessThan(100);
    expect(result.issues).toContain('File-size budget exceeded: 3500000 / 2500000');
  });

  it('flags unusable zero-duration clips and oversized runner bounds', () => {
    const result = scoreCandidateAgainstProfile({
      ...runnerCandidate,
      clipDurations: {
        'idle-ready': 0,
        'jog-forward': 0.42,
        'sprint-forward': 0.7,
        'stick-handle': 0.8,
        'forehand-pass': 0.5,
        'receive-pass': 0.5,
        'wrist-shot': 0.5,
      },
      dimensions: {
        width: 0.9,
        height: 3.9,
        depth: 1.2,
      },
    }, 'runner');

    expect(result.status).toBe('needs-work');
    expect(result.unusableClips).toContain('idle-ready');
    expect(result.recommendedScale).toBeCloseTo(0.47, 2);
    expect(result.issues.some((issue) => issue.includes('Unusable clips'))).toBe(true);
    expect(result.issues.some((issue) => issue.includes('Scene bounds outside runner range'))).toBe(true);
  });

  it('allows realistic equipped runner width while still checking height and depth', () => {
    const result = scoreCandidateAgainstProfile({
      ...runnerCandidate,
      dimensions: {
        width: 1.45,
        height: 1.82,
        depth: 1.36,
      },
    }, 'runner');

    expect(result.issues.some((issue) => issue.includes('Scene bounds outside runner range'))).toBe(false);
  });

  it('summarizes an empty candidate folder without failing', () => {
    const report = summarizeCandidateAudits([]);

    expect(report.status).toBe('empty');
    expect(report.totalCount).toBe(0);
    expect(report.bestCandidate).toBeNull();
  });
});
