import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const assetDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-topology',
);
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/athlete-production-glove-topology-review',
);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const source = readJson(path.join(assetDirectory, 'production-glove-topology-source-report.json'));
const fit = readJson(path.join(assetDirectory, 'production-glove-topology-fit-report.json'));
const audit = readJson(path.join(assetDirectory, 'production-glove-topology-audit.json'));
const closeRenders = readJson(path.join(evidenceDirectory, 'close-render-report.json'));
const actionRenders = readJson(path.join(evidenceDirectory, 'action-render-report.json'));
const review = readJson(path.join(
  evidenceDirectory,
  'production-glove-topology-human-review.json',
));

describe('vNext private production glove source topology', () => {
  it('authors the source architecture without fused finger loops', () => {
    expect(source).toMatchObject({
      status: 'standalone-segmented-source-glove-authored',
      decision: 'human-review-required',
      topologyRevision: 'segmented-source-finger-shell-v2',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
      sourceObjectCount: 30,
    });
    expect(source.construction).toMatchObject({
      integratedHandBoundFingerLoops: 0,
      independentlySkinnedFingerBodies: 4,
      integratedPalmStalls: 4,
      boneMatchedDorsalArmorZones: 12,
      shaftCompressionChannelComponents: 4,
      legacySweepFingerPads: 0,
      legacyRoundedKnuckleCaps: 0,
      sourceLevelArchitectureChange: true,
    });
    expect(Object.keys(source.fingerBodies)).toHaveLength(4);
    expect(Object.keys(source.dorsalArmor)).toHaveLength(12);
    expect(source.palmChannel.connectedComponents).toBe(4);
  });

  it('fits independent source fingers and passes the private nine-action audit', () => {
    expect(fit).toMatchObject({
      status: 'private-production-glove-topology-fit-authored',
      fitRevision: 'production-segmented-source-fit-v3',
      sourceTopologyRevision: 'segmented-source-finger-shell-v2',
      publicRuntimeAllowed: false,
      glbExported: false,
    });
    expect(audit).toMatchObject({
      status: 'private-production-glove-topology-audited',
      automatedPass: true,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      unweightedVertices: 0,
      maximumWeightSumError: 0,
    });
    expect(audit.checks).toMatchObject({
      fourCompleteSegmentedSourceFits: true,
      legacyHandBoundFingerLoopsRemoved: true,
      independentFingerBodiesUseSegmentChains: true,
      dorsalArmorAndPalmStallsPresent: true,
      legacySweepPadsAbsent: true,
      allSourceObjectsUvReady: true,
      closedGripOnAllActions: true,
      shaftProximityAcrossActions: true,
      shaftPenetrationBounded: true,
    });
    for (const inventory of Object.values(audit.topologyInventories)) {
      expect(inventory).toMatchObject({
        objectCount: 30,
        fingerBodyCount: 4,
        dorsalArmorCount: 12,
        palmChannelCount: 1,
        legacySweepPadObjects: [],
        uvReadyObjects: 30,
      });
    }
  });

  it('provides hidden close and all-action evidence', () => {
    expect(closeRenders).toMatchObject({
      status: 'rendered-for-private-production-glove-topology-review',
      fitRevision: 'production-segmented-source-fit-v3',
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

  it('records honest human review and keeps the candidate fail-closed', () => {
    expect(review).toMatchObject({
      topologyRevision: 'segmented-source-finger-shell-v2',
      handBoundFingerLoopsRemoved: true,
      independentFingerDeformationApproved: true,
      productionGloveApproved: false,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
    });
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(assetsModule).not.toContain('production-glove-topology');
    expect(assetsModule).not.toContain('segmented-source-finger-shell-v2');
  });
});
