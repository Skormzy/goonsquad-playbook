import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProductionImportPlan, getCandidateSourceNames } from './player-rig-import-plan.mjs';

const productionTargets = {
  runnerHome: '/models/players/goon-runner-home.glb',
  runnerAway: '/models/players/goon-runner-away.glb',
  goalieHome: '/models/players/goon-goalie-home.glb',
  goalieAway: '/models/players/goon-goalie-away.glb',
};

function toDiskPath(assetUrl) {
  return path.join('public', assetUrl.replace(/^\//, ''));
}

describe('player rig import plan', () => {
  it('prefers exact production source files when present', () => {
    const { plan, missing } = createProductionImportPlan({
      productionTargets,
      sourceDir: 'asset-inbox/players',
      availableFileNames: new Set(Object.values(productionTargets).map((assetUrl) => path.basename(assetUrl))),
      toDiskPath,
    });

    expect(missing).toHaveLength(0);
    expect(plan).toHaveLength(4);
    expect(plan.every((item) => item.usesNeutralSource === false)).toBe(true);
  });

  it('uses a neutral runner and goalie source pack for all home and away targets', () => {
    const { plan, missing } = createProductionImportPlan({
      productionTargets,
      sourceDir: 'asset-inbox/players',
      availableFileNames: new Set(['goon-runner-production.glb', 'goon-goalie-production.glb']),
      toDiskPath,
    });

    expect(missing).toHaveLength(0);
    expect(plan).toHaveLength(4);
    expect(plan.map((item) => item.sourceName)).toEqual([
      'goon-runner-production.glb',
      'goon-runner-production.glb',
      'goon-goalie-production.glb',
      'goon-goalie-production.glb',
    ]);
    expect(plan.every((item) => item.usesNeutralSource)).toBe(true);
  });

  it('reports candidate source names for missing targets', () => {
    const { missing } = createProductionImportPlan({
      productionTargets,
      sourceDir: 'asset-inbox/players',
      availableFileNames: new Set(['goon-runner-production.glb']),
      toDiskPath,
    });

    expect(missing.map((item) => item.key)).toEqual(['goalieHome', 'goalieAway']);
    expect(missing[0].candidates).toContain('goon-goalie-production.glb');
  });

  it('can plan a runner-only import without treating missing goalie files as blockers', () => {
    const { plan, missing } = createProductionImportPlan({
      productionTargets,
      sourceDir: 'asset-inbox/players',
      availableFileNames: new Set(['goon-runner-production.glb']),
      toDiskPath,
      roles: ['runner'],
    });

    expect(missing).toHaveLength(0);
    expect(plan.map((item) => item.key)).toEqual(['runnerHome', 'runnerAway']);
    expect(plan.every((item) => item.sourceName === 'goon-runner-production.glb')).toBe(true);
  });

  it('lists exact and neutral candidates in priority order', () => {
    expect(getCandidateSourceNames('runnerHome', productionTargets.runnerHome)).toEqual([
      'goon-runner-home.glb',
      'goon-runner-production.glb',
      'goon-runner-base.glb',
      'goon-runner.glb',
    ]);
  });
});
