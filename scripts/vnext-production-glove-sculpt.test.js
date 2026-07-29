import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const assetDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-sculpt',
);
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/athlete-production-glove-sculpt-review',
);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const source = readJson(path.join(assetDirectory, 'production-glove-sculpt-source-report.json'));
const fit = readJson(path.join(assetDirectory, 'production-glove-sculpt-fit-report.json'));
const audit = readJson(path.join(assetDirectory, 'production-glove-sculpt-audit.json'));
const closeRenders = readJson(path.join(evidenceDirectory, 'close-render-report.json'));
const actionRenders = readJson(path.join(evidenceDirectory, 'action-render-report.json'));
const review = readJson(path.join(
  evidenceDirectory,
  'production-glove-sculpt-human-review.json',
));

describe('vNext private integrated sewn-volume glove', () => {
  it('authors sculpt-dense continuous product-form components', () => {
    expect(source).toMatchObject({
      status: 'standalone-integrated-sewn-volume-glove-authored',
      decision: 'human-review-required',
      sculptRevision: 'integrated-sewn-volume-glove-v4',
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
      jointSpecificFoamArmorPanels: 12,
      continuousFormedPalmHeelWebComponents: 1,
      continuousFourLaneMetacarpalYokeComponents: 1,
      layeredThumbHingeGuardComponents: 1,
      subdivisionSafeShellNormals: true,
      legacyFlatPalmSaddleComponents: 0,
      legacyUniformArmorProfiles: 0,
      sourceLevelSculptChange: true,
    });
    for (const surface of [source.palmSaddle, source.fingerRootYoke, source.thumbSaddle]) {
      expect(surface.connectedComponents).toBe(1);
      expect(surface.nonManifoldEdges).toBe(0);
      expect(surface.uvReady).toBe(true);
    }
  });

  it('fits the sculpted source and passes the private mechanical audit', () => {
    expect(fit).toMatchObject({
      status: 'private-production-glove-sculpt-fit-authored',
      fitRevision: 'production-integrated-sewn-volume-fit-v5',
      sculptRevision: 'integrated-sewn-volume-glove-v4',
      publicRuntimeAllowed: false,
      glbExported: false,
    });
    expect(audit).toMatchObject({
      status: 'private-production-glove-sculpt-audited',
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
      allSourceObjectsUvReady: true,
      sculptRevisionRecorded: true,
      jointSpecificArmorHasSculptDensity: true,
      formedPalmMetacarpalAndThumbRemainContinuous: true,
      formedPalmUsesMultiBoneBlend: true,
      thumbGuardUsesThumbChainBlend: true,
      closedGripOnAllActions: true,
      shaftProximityAcrossActions: true,
      shaftPenetrationBounded: true,
    });
    expect(audit.jointSpecificArmor).toMatchObject({
      objectCountAcrossFits: 48,
      minimumVertices: 358,
      minimumPolygons: 360,
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
        uvReadyObjects: 32,
      });
    }
  });

  it('provides hidden close and all-action evidence', () => {
    expect(closeRenders).toMatchObject({
      status: 'rendered-for-private-production-glove-sculpt-review',
      fitRevision: 'production-integrated-sewn-volume-fit-v5',
      sculptRevision: 'integrated-sewn-volume-glove-v4',
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

  it('records the visible failure and keeps the candidate fail-closed', () => {
    expect(review).toMatchObject({
      decision: 'approve-structural-direction-reject-production-and-runtime',
      sculptRevision: 'integrated-sewn-volume-glove-v4',
      sourceArchitectureApproved: true,
      jointSpecificFoamDirectionApproved: true,
      formedPalmTopologyApproved: true,
      formedPalmAppearanceApproved: false,
      fingerSilhouetteApproved: false,
      cuffAndBackhandTransitionApproved: false,
      thumbConstructionApproved: false,
      productionGloveApproved: false,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
    });
    expect(review.rejectedIterations).toHaveLength(4);
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(assetsModule).not.toContain('production-glove-sculpt');
    expect(assetsModule).not.toContain('integrated-sewn-volume-glove-v4');
  });
});
