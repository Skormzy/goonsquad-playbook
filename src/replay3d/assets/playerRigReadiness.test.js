import { describe, expect, it } from 'vitest';
import { getProductionRigReadiness, getProductionRigReadinessReport } from './playerRigReadiness';

describe('player rig readiness', () => {
  it('marks an absent production rig as missing with a zero score', () => {
    const readiness = getProductionRigReadiness('runnerHome', {
      available: false,
      url: '/models/players/goon-runner-home.glb',
      clips: [],
      bytes: 0,
      uploadedVertices: 0,
    });

    expect(readiness.status).toBe('missing');
    expect(readiness.readinessScore).toBe(0);
    expect(readiness.issues).toContain('Missing file: goon-runner-home.glb');
  });

  it('reports missing clips and equipment groups for imported rigs that need work', () => {
    const readiness = getProductionRigReadiness('runnerAway', {
      available: false,
      url: '/models/players/goon-runner-away.glb',
      clips: ['idle-ready', 'jog-forward'],
      bytes: 900000,
      uploadedVertices: 12000,
      missingPartGroups: [['glove', 'mitt']],
    });

    expect(readiness.status).toBe('needs-work');
    expect(readiness.readinessScore).toBeGreaterThan(0);
    expect(readiness.readinessScore).toBeLessThan(100);
    expect(readiness.missingClips).toContain('forehand-pass');
    expect(readiness.missingPartGroups).toEqual([['glove', 'mitt']]);
  });

  it('summarizes the full production rig set', () => {
    const report = getProductionRigReadinessReport({
      production: {
        runnerHome: {
          available: true,
          url: '/models/players/goon-runner-home.glb',
          clips: ['idle-ready', 'jog-forward', 'sprint-forward', 'stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'],
          bytes: 1000000,
          uploadedVertices: 18000,
          missingPartGroups: [],
        },
        runnerAway: {
          available: false,
          url: '/models/players/goon-runner-away.glb',
          clips: [],
          bytes: 0,
          uploadedVertices: 0,
        },
        goalieHome: {
          available: false,
          url: '/models/players/goon-goalie-home.glb',
          clips: ['goalie-ready'],
          bytes: 2000000,
          uploadedVertices: 24000,
          missingPartGroups: [['blocker']],
        },
        goalieAway: {
          available: false,
          url: '/models/players/goon-goalie-away.glb',
          clips: [],
          bytes: 0,
          uploadedVertices: 0,
        },
      },
    });

    expect(report.status).toBe('blocked');
    expect(report.readyCount).toBe(1);
    expect(report.missingCount).toBe(2);
    expect(report.needsWorkCount).toBe(1);
    expect(report.score).toBeGreaterThan(0);
    expect(report.score).toBeLessThan(100);
  });

  it('reports production rigs that exceed the file-size budget', () => {
    const readiness = getProductionRigReadiness('runnerHome', {
      available: false,
      url: '/models/players/goon-runner-home.glb',
      clips: ['idle-ready', 'jog-forward', 'sprint-forward', 'stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'],
      bytes: 3000000,
      uploadedVertices: 18000,
      missingPartGroups: [],
    });

    expect(readiness.status).toBe('needs-work');
    expect(readiness.issues).toContain('File-size budget exceeded: 3000000 / 2500000');
    expect(readiness.readinessScore).toBeLessThan(100);
  });

  it('carries retarget motion quality into readiness evidence', () => {
    const readiness = getProductionRigReadiness('runnerHome', {
      available: true,
      url: '/models/players/goon-runner-home.glb',
      clips: ['idle-ready', 'jog-forward', 'sprint-forward', 'stick-handle', 'forehand-pass', 'receive-pass', 'wrist-shot'],
      bytes: 1000000,
      uploadedVertices: 18000,
      missingPartGroups: [],
      retargetMotionQuality: 'source-driven-seed',
      isFinalGradeMotion: false,
      finalGradeClips: [],
      missingFinalGradeClips: ['idle-ready', 'jog-forward'],
    });

    expect(readiness.retargetMotionQuality).toBe('source-driven-seed');
    expect(readiness.isFinalGradeMotion).toBe(false);
    expect(readiness.finalGradeClips).toEqual([]);
    expect(readiness.missingFinalGradeClips).toEqual(['idle-ready', 'jog-forward']);
  });
});
