import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const assetDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-manufactured',
);
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/athlete-production-glove-manufactured-review',
);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const source = readJson(path.join(assetDirectory, 'production-glove-manufactured-source-report.json'));
const fit = readJson(path.join(assetDirectory, 'production-glove-manufactured-fit-report.json'));
const audit = readJson(path.join(assetDirectory, 'production-glove-manufactured-audit.json'));
const closeRenders = readJson(path.join(evidenceDirectory, 'close-render-report.json'));
const actionRenders = readJson(path.join(evidenceDirectory, 'action-render-report.json'));
const review = readJson(path.join(
  evidenceDirectory,
  'production-glove-manufactured-human-review.json',
));

describe('vNext private anatomical sewn production glove', () => {
  it('authors continuous palm, root, and thumb surfaces over the independent finger architecture', () => {
    expect(source).toMatchObject({
      status: 'standalone-anatomical-sewn-glove-authored',
      decision: 'human-review-required',
      manufacturedRevision: 'anatomical-sewn-glove-shell-v3',
      sourceTopologyRevision: 'segmented-source-finger-shell-v2',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
      sourceObjectCount: 32,
    });
    expect(source.construction).toMatchObject({
      independentlySkinnedFingerBodies: 4,
      integratedFingerSidewalls: 4,
      variedContouredArmorPanels: 12,
      continuousPalmSaddleComponents: 1,
      continuousFingerRootYokeComponents: 1,
      anatomicalThumbSaddleComponents: 1,
      edgeBindingPaths: 6,
      legacyPalmChannelComponents: 0,
      legacyHandBoundFingerLoops: 0,
      sourceLevelArchitectureRetained: true,
    });
    for (const surface of [source.palmSaddle, source.fingerRootYoke, source.thumbSaddle]) {
      expect(surface.connectedComponents).toBe(1);
      expect(surface.nonManifoldEdges).toBe(0);
      expect(surface.uvReady).toBe(true);
    }
  });

  it('fits the manufactured surfaces and passes the private nine-action audit', () => {
    expect(fit).toMatchObject({
      status: 'private-production-glove-manufactured-fit-authored',
      fitRevision: 'production-anatomical-sewn-fit-v4',
      manufacturedRevision: 'anatomical-sewn-glove-shell-v3',
      publicRuntimeAllowed: false,
      glbExported: false,
    });
    expect(audit).toMatchObject({
      status: 'private-production-glove-manufactured-audited',
      automatedPass: true,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      unweightedVertices: 0,
      maximumWeightSumError: 0,
    });
    expect(audit.checks).toMatchObject({
      fourCompleteManufacturedFits: true,
      legacyHandBoundFingerLoopsRemoved: true,
      independentFingerBodiesUseSegmentChains: true,
      manufacturedSurfacesAreContinuous: true,
      palmRootAndThumbUseArticulatedWeights: true,
      legacyChannelAndSweepPadsAbsent: true,
      allSourceObjectsUvReady: true,
      closedGripOnAllActions: true,
      shaftProximityAcrossActions: true,
      shaftPenetrationBounded: true,
    });
    for (const inventory of Object.values(audit.manufacturedInventories)) {
      expect(inventory).toMatchObject({
        objectCount: 32,
        fingerBodyCount: 4,
        dorsalArmorCount: 12,
        palmSaddleCount: 1,
        fingerRootYokeCount: 1,
        thumbSaddleCount: 1,
        edgeBindingCount: 6,
        legacyPalmChannelCount: 0,
        uvReadyObjects: 32,
      });
    }
  });

  it('provides hidden close and all-action evidence', () => {
    expect(closeRenders).toMatchObject({
      status: 'rendered-for-private-production-glove-manufactured-review',
      fitRevision: 'production-anatomical-sewn-fit-v4',
      publicRuntimeAllowed: false,
      visibleBrowserWindowOpened: false,
      visibleBlenderWindowOpened: false,
      resolution: [512, 512],
    });
    expect(actionRenders).toMatchObject({
      publicRuntimeAllowed: false,
      visibleBrowserWindowOpened: false,
      visibleBlenderWindowOpened: false,
    });
    expect(closeRenders.outputs).toHaveLength(22);
    expect(actionRenders.outputs).toHaveLength(27);
    for (const output of [...closeRenders.outputs, ...actionRenders.outputs]) {
      expect(fs.existsSync(output.path)).toBe(true);
      expect(fs.statSync(output.path).size).toBeGreaterThan(100_000);
    }
  });

  it('records the rejected finish honestly and keeps the candidate fail-closed', () => {
    expect(review).toMatchObject({
      manufacturedRevision: 'anatomical-sewn-glove-shell-v3',
      sourceArchitectureApproved: true,
      continuousPalmSaddleTopologyApproved: true,
      palmClosureAppearanceApproved: false,
      manufacturedSurfaceFinishApproved: false,
      productionGloveApproved: false,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
    });
    expect(review.rejectedIterations).toHaveLength(2);
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(assetsModule).not.toContain('production-glove-manufactured');
    expect(assetsModule).not.toContain('anatomical-sewn-glove-shell-v3');
  });
});
