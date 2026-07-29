import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson(
  'asset-inbox/players/vnext/cmu16-ik-neck-boundary-refinement-report.json',
);
const restoration = readJson(
  'asset-inbox/players/vnext/cmu16-ik-neck-boundary-restoration-audit.json',
);
const faceAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-neck-boundary-face-audit.json',
);
const runtimeAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-neck-boundary-runtime-audit.json',
);
const runtimeCapture = readJson(
  'docs/vnext/evidence/athlete-neck-boundary-review/runtime-capture.json',
);
const review = readJson(
  'docs/vnext/evidence/athlete-neck-boundary-review/runtime-cmu16-ik-neck-boundary-review.json',
);

const runtimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-neck-boundary-optimized-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-neck-boundary.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-neck-boundary-optimized-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-neck-boundary.glb',
  ],
];

describe('vNext private licensed neck-boundary review', () => {
  it('restores and welds the exact licensed neck boundary without changing animation', () => {
    expect(refinement).toMatchObject({
      revision: 'licensed-neck-boundary-restoration-v1',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      licensedBodyBoundaryVertices: 64,
      licensedBodyBoundaryEdges: 64,
      matchedReferenceEdges: 64,
      referencePatchPolygons: 294,
      referencePatchVertices: 353,
      removedReferenceActions: ['jog-to-sprint-ik.001'],
      patchTopology: {
        matchedLicensedBodyEdges: 64,
        expectedLicensedBodyEdges: 64,
        unweightedVertices: 0,
      },
      bodyWeld: {
        after: {
          vertices: 7641,
          polygons: 7462,
          mergedVertices: 64,
          remainingNeckBoundaryComponents: [],
          shapeKeyCount: 149,
        },
      },
    });
    for (const counts of Object.values(refinement.actionKeyCounts)) {
      expect(counts.after).toBe(counts.before);
      expect(counts.after).toBeGreaterThan(0);
    }
  });

  it('preserves licensed skin UVs, weights, smooth shading, and all shape keys', () => {
    expect(restoration).toMatchObject({
      revision: 'licensed-neck-boundary-restoration-v1',
      expectedPatchPolygons: 294,
      matchedPatchPolygons: 294,
      matchedPatchVertices: 353,
      patchMaterials: { GS_PBR_Skin_Head: 294 },
      patchSmoothPolygons: { true: 294 },
      unweightedPatchVertices: 0,
      missingVertexGroups: 0,
      bodyVertices: 7641,
      bodyPolygons: 7462,
      shapeKeyCount: 149,
    });
    expect(restoration.uvLayers).toEqual([expect.objectContaining({
      name: 'Channel0',
      active: true,
      activeRender: true,
    })]);
    expect(restoration.uvLayers[0].uniqueRoundedCoordinates).toBeGreaterThan(300);
    expect(Object.values(restoration.shapeKeyVertexCounts).every((count) => count === 7641))
      .toBe(true);
    expect(Object.keys(restoration.actionKeyCounts).sort()).toEqual([
      'jog', 'jog-to-sprint-ik', 'pass', 'ready', 'receive', 'shot', 'sprint', 'stop', 'turn',
    ]);
  });

  it('retains the previously approved licensed eye and cornea surfaces', () => {
    expect(faceAudit.eyeObject.materials.map((material) => material.name))
      .toEqual(['GS_PBR_Eye', 'GS_PBR_Cornea']);
    expect(faceAudit.eyeObject.components).toHaveLength(4);
    for (const component of faceAudit.eyeObject.components) {
      expect(component.evaluatedUvDirection[1]).toBeLessThan(-0.99);
    }
  });

  it('keeps private runtime assets complete, byte-identical, and inside budget', () => {
    expect(runtimeAudit).toMatchObject({
      assetTag: 'cmu16-ik-neck-boundary',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      fourAssetBudgetPass: true,
    });
    expect(runtimeAudit.fourAssetBytes).toBeLessThan(10_000_000);
    for (const variant of Object.values(runtimeAudit.variants)) {
      expect(variant.missingActions).toEqual([]);
      expect(variant.actions).toHaveLength(9);
      expect(variant.bytes).toBeLessThan(2_250_000);
      expect(variant.materials).toContain('GS_PBR_Cornea');
      expect(variant.cageNodeCount).toBe(0);
    }
    for (const [source, runtime] of runtimePairs) {
      expect(sha256(readBytes(runtime))).toBe(sha256(readBytes(source)));
    }
  });

  it('keeps the candidate private and selectable only by explicit review id', () => {
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    const acceptedMap = assetsModule.split('export const PRODUCTION_ATHLETE_ASSETS')[1]
      .split('export const PRIVATE_MOTION_REVIEW_ASSETS')[0];
    expect(acceptedMap).not.toContain('neck-boundary');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-neck-boundary'");
    for (const file of [
      'src/components/vnext3d/ProductionReplayPreview.jsx',
      'src/vnext3d/runtimeMapping.js',
      'src/vnext3d/transitionTelemetry.js',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8'))
        .toContain('cmu-jog16-ik-neck-boundary');
    }
  });

  it('retains close, all-action, and clean cross-device evidence', () => {
    const headRenders = readJson(
      'asset-inbox/players/vnext/cmu16-ik-neck-boundary-head-render-report.json',
    );
    const actionRenders = readJson(
      'asset-inbox/players/vnext/cmu16-ik-neck-boundary-action-render-report.json',
    );
    expect(headRenders.outputs).toHaveLength(16);
    expect(actionRenders.outputs).toHaveLength(27);
    for (const output of [...headRenders.outputs, ...actionRenders.outputs]) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(10_000);
    }
    for (const device of ['desktop', 'mobile']) {
      const measurement = runtimeCapture.results[device];
      expect(measurement).toMatchObject({
        canvasCount: 1,
        playerCount: 12,
        assetsReady: 4,
        horizontalOverflow: false,
        selectedAthleteAnimationWeight: 1,
        selectedAthleteHandSpanMm: 183.5,
      });
      expect(measurement.motionReview).toBe('cmu-jog16-ik-neck-boundary');
      expect(measurement.browserProblems).toEqual([]);
      expect(measurement.frameP95Ms).toBeLessThan(30);
      expect(measurement.groundMaximumCorrectionMm).toBeLessThanOrEqual(20);
    }
    expect(runtimeCapture.results.desktop.closeReview).toMatchObject({
      cameraControl: 'free-look',
      cameraInteractionCount: 8,
      playerCount: 12,
    });
  });

  it('approves the neck subsystem without promoting the complete athlete', () => {
    expect(review).toMatchObject({
      decision: 'approve-licensed-neck-restoration-reject-athlete-promotion',
      neckBoundaryApproved: true,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      sourceDerived: true,
    });
    expect(review.neckImprovements).toHaveLength(5);
    expect(review.remainingDefects).toHaveLength(4);
    expect(review.assetBudget.pass).toBe(true);
    expect(fs.readFileSync(
      path.join(root, 'scripts/build-vnext-neck-boundary-review.mjs'),
      'utf8',
    )).toContain('GOON_VNEXT_NECK_BOUNDARY_REVIEW_READY');
  });
});
