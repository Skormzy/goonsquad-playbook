import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const assetDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-fit',
);
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/athlete-production-glove-fit-review',
);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const fit = readJson(path.join(assetDirectory, 'production-glove-fit-report.json'));
const audit = readJson(path.join(assetDirectory, 'production-glove-fit-audit.json'));
const closeRenders = readJson(path.join(
  assetDirectory,
  'production-glove-fit-close-render-report.json',
));
const actionRenders = readJson(path.join(
  assetDirectory,
  'production-glove-fit-action-render-report.json',
));
const review = readJson(path.join(
  evidenceDirectory,
  'production-glove-fit-human-review.json',
));

describe('vNext private production glove athlete fit', () => {
  it('fits four complete articulated variants to the accepted athlete', () => {
    expect(fs.existsSync(path.join(
      assetDirectory,
      'goon-field-player-cmu16-ik-production-glove-fit-audition.blend',
    ))).toBe(true);
    expect(fit).toMatchObject({
      status: 'private-production-glove-fit-authored',
      decision: 'human-review-required',
      fitRevision: 'production-integrated-source-fit-v2',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
      generatedSegmentedGeometryReused: false,
      handTargetRefinement: {
        revision: 'opposed-shaft-wrist-offset-v1',
        targetOffsetXcm: 5.5,
      },
      weighting: {
        linearSkinning: true,
        continuousWristBlend: true,
      },
    });
    expect(fit.fits.left.scale).toBeGreaterThanOrEqual(0.9);
    expect(fit.fits.right.scale).toBeGreaterThanOrEqual(0.9);
    expect(fit.fits.left.anchorCount).toBe(29);
    expect(fit.fits.right.anchorCount).toBe(29);
    for (const variant of Object.values(fit.variants)) {
      expect(variant.left.createdObjectCount).toBe(32);
      expect(variant.right.createdObjectCount).toBe(32);
      for (const side of [variant.left, variant.right]) {
        for (const object of Object.values(side.objects)) {
          expect(object.armaturePreserveVolume).toBe(false);
        }
        const productionShell = Object.entries(side.objects)
          .find(([name]) => name.endsWith('ProductionShell'))?.[1];
        expect(productionShell.materials).toEqual([
          'GS_PBR_Leather_Black',
          'GS_PBR_Graphite',
        ]);
      }
    }
  });

  it('authors a stable closed grip on every accepted field-player action', () => {
    expect(Object.keys(fit.actions)).toHaveLength(9);
    for (const action of Object.values(fit.actions)) {
      expect(action.fingerFcurves).toBe(120);
      expect(action.fingerKeys).toBe(240);
    }
    expect(fit.weighting).toMatchObject({
      fingerChainsPerHand: 12,
      thumbChainBonesPerHand: 3,
      inverseBoundAtFitPose: true,
    });
  });

  it('passes topology, skin-weight, coverage, and shaft-contact audits', () => {
    expect(audit).toMatchObject({
      status: 'private-production-glove-fit-audited',
      automatedPass: true,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
      unweightedVertices: 0,
      maximumWeightSumError: 0,
    });
    expect(Object.values(audit.checks).every(Boolean)).toBe(true);
    for (const variant of Object.values(audit.inventories)) {
      for (const side of Object.values(variant)) {
        expect(side.objectCount).toBe(32);
        for (const object of Object.values(side.objects)) {
          expect(object.unweightedVertices).toBe(0);
          expect(object.maximumWeightSumError).toBe(0);
        }
      }
    }
    expect(audit.summary.minimumVerticesWithin20Mm).toBeGreaterThanOrEqual(2_900);
    expect(audit.summary.maximumPenetratingPercent).toBeLessThan(2.5);
  });

  it('provides substantial hidden close and all-action evidence', () => {
    expect(closeRenders).toMatchObject({
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

    const contactSheets = [
      'close/production-glove-fit-home-left-contact-sheet.png',
      'close/production-glove-fit-home-right-contact-sheet.png',
      'close/production-glove-fit-away-contact-sheet.png',
      'actions/upper-body-front-contact-sheet.png',
      'actions/upper-body-rear-contact-sheet.png',
      'actions/upper-body-side-contact-sheet.png',
    ];
    for (const relativePath of contactSheets) {
      const filePath = path.join(evidenceDirectory, relativePath);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.statSync(filePath).size).toBeGreaterThan(500_000);
    }
  });

  it('records the honest split verdict and keeps the candidate private', () => {
    expect(review).toMatchObject({
      decision: 'approve-source-topology-and-fit-map-reject-production-runtime',
      privateFitDirectionApproved: true,
      integratedSourceTopologyApproved: true,
      continuousWristBlendApproved: true,
      linearSkinningApproved: true,
      closedGripMechanicsApproved: true,
      shaftAlignmentDirectionApproved: true,
      productionGloveApproved: false,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
      evidence: {
        headlessBlender: true,
        visibleBlenderWindowOpened: false,
        visibleBrowserWindowOpened: false,
        privateWorkfileOnly: true,
      },
    });
    expect(review.reviewedContactSheets).toHaveLength(6);
    expect(review.rejectedQualities.length).toBeGreaterThanOrEqual(6);

    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(assetsModule).not.toContain('production-glove-fit');
    expect(assetsModule).not.toContain('production-integrated-source-fit-v2');
  });
});
