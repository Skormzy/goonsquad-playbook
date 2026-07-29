import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const assetDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-articulation',
);
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/athlete-production-glove-articulation-review',
);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const author = readJson(path.join(
  assetDirectory,
  'production-glove-articulation-author-report.json',
));
const audit = readJson(path.join(
  assetDirectory,
  'production-glove-articulation-audit.json',
));
const closeRenders = readJson(path.join(evidenceDirectory, 'close-render-report.json'));
const actionRenders = readJson(path.join(evidenceDirectory, 'action-render-report.json'));
const review = readJson(path.join(
  evidenceDirectory,
  'production-glove-articulation-human-review.json',
));

describe('vNext private production glove articulation', () => {
  it('authors a fail-closed finger and palm candidate', () => {
    expect(fs.existsSync(path.join(
      assetDirectory,
      'goon-field-player-cmu16-ik-production-glove-articulation-audition.blend',
    ))).toBe(true);
    expect(author).toMatchObject({
      status: 'private-production-glove-articulation-authored',
      decision: 'human-review-required',
      articulationRevision: 'asymmetric-finger-layered-palm-v1',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
      generatedSegmentedAthleteReused: false,
    });
  });

  it('replaces inherited pad objects with compact articulated topology', () => {
    expect(audit).toMatchObject({
      status: 'private-production-glove-articulation-audited',
      automatedPass: true,
      publicRuntimeAllowed: false,
      unweightedVertices: 0,
      maximumWeightSumError: 0,
    });
    expect(audit.checks).toEqual({
      fourCompleteArticulatedFits: true,
      inheritedTubePadsRemoved: true,
      allObjectsUvReady: true,
      allVerticesWeighted: true,
      twelveAsymmetricArmorComponents: true,
      layeredPalmCompressionTopology: true,
      palmChannelTracksShaftAcrossNineActions: true,
      privateFailClosed: true,
    });
    for (const variant of Object.values(audit.inventories)) {
      for (const side of Object.values(variant)) {
        expect(side).toMatchObject({
          objectCount: 22,
          retainedFittedObjectCount: 20,
          articulatedObjectCount: 2,
          uvReadyObjects: 22,
          inheritedFingerPadObjects: [],
        });
      }
    }
    for (const topology of Object.values(audit.topology)) {
      expect(topology).toMatchObject({
        armorVertices: 204,
        armorPolygons: 204,
        armorComponents: 12,
        palmVertices: 153,
        palmPolygons: 153,
        palmComponents: 9,
      });
    }
  });

  it('keeps the layered palm channel close to the shaft in every action', () => {
    expect(Object.keys(audit.shaftContactByAction)).toHaveLength(9);
    expect(audit.summary.maximumMinimumAbsoluteShaftClearanceMm).toBeLessThanOrEqual(0.1);
    expect(audit.summary.minimumVerticesWithin20Mm).toBeGreaterThanOrEqual(500);
    expect(audit.summary.minimumSignedShaftClearanceMm).toBeGreaterThanOrEqual(0);
  });

  it('provides hidden close and all-action evidence', () => {
    expect(closeRenders).toMatchObject({
      status: 'rendered-for-private-production-glove-articulation-review',
      articulationRevision: 'asymmetric-finger-layered-palm-v1',
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
    for (const relativePath of review.reviewedContactSheets) {
      const filePath = path.join(evidenceDirectory, relativePath);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.statSync(filePath).size).toBeGreaterThan(500_000);
    }
  });

  it('records the source-shell rejection and blocks public promotion', () => {
    expect(review).toMatchObject({
      decision: 'approve-articulation-mechanics-reject-source-shell-and-runtime',
      inheritedFingerPadObjectsRemoved: true,
      articulatedPlateTopologyApproved: true,
      allActionAttachmentApproved: true,
      shaftCompressionTrackingApproved: true,
      sourceFingerShellApproved: false,
      palmClosureAppearanceApproved: false,
      productionGloveApproved: false,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
      approachChangeRequired: true,
    });
    expect(review.rejectedIterations).toHaveLength(3);
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(assetsModule).not.toContain('production-glove-articulation');
    expect(assetsModule).not.toContain('asymmetric-finger-layered-palm-v1');
  });
});
