import { describe, expect, it } from 'vitest';
import { getPlayerRigAsset, getProductionRigKey, isUsingProductionRunnerRigs, isUsingProductionRigs } from './playerRigSelection';

describe('player rig selection', () => {
  it('maps teams and roles to production rig keys', () => {
    expect(getProductionRigKey({ team: 'us', role: 'LW' })).toBe('runnerHome');
    expect(getProductionRigKey({ team: 'opponent', role: 'D' })).toBe('runnerAway');
    expect(getProductionRigKey({ team: 'us', role: 'G' })).toBe('goalieHome');
    expect(getProductionRigKey({ team: 'opponent', role: 'G' })).toBe('goalieAway');
  });

  it('uses production runner GLBs when the runner pack is available', () => {
    const asset = getPlayerRigAsset({ team: 'us', role: 'C' });

    expect(asset.mode).toBe('production');
    expect(asset.url).toBe('/models/players/goon-runner-home.glb');
    expect(asset.clips).toContain('jog-forward');
    expect(asset.clips).toContain('stick-handle');
    expect(asset.retargetMotionQuality).toBe('final-grade-motion');
    expect(asset.isFinalGradeMotion).toBe(true);
    expect(asset.requiresPoseCorrection).toBe(false);
    expect(asset.finalGradeClips).toEqual([
      'idle-ready',
      'jog-forward',
      'sprint-forward',
      'stick-handle',
      'forehand-pass',
      'receive-pass',
      'wrist-shot',
    ]);
    expect(asset.missingFinalGradeClips).toEqual([]);
  });

  it('keeps goalies on the bridge rig independently from runner progress', () => {
    const asset = getPlayerRigAsset({ team: 'us', role: 'G' });

    expect(asset.mode).toBe('bridge');
    expect(asset.url).toBe('/models/players/animated-runner.glb');
    expect(asset.overlay).toBe('goalie');
    expect(asset.positionY).toBe(0.02);
  });

  it('reports that the production rig set is not complete yet', () => {
    expect(isUsingProductionRigs()).toBe(false);
    expect(isUsingProductionRunnerRigs()).toBe(true);
  });
});
