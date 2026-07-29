import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson(
  'asset-inbox/players/vnext/cmu16-ik-cloth-drape-refinement-report.json',
);
const materialAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-cloth-drape-material-audit.json',
);
const runtimeAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-cloth-drape-runtime-audit.json',
);
const runtimeCapture = readJson(
  'docs/vnext/evidence/athlete-cloth-drape-review/runtime-capture.json',
);
const review = readJson(
  'docs/vnext/evidence/athlete-cloth-drape-review/runtime-cmu16-ik-cloth-drape-review.json',
);

const runtimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-cloth-drape-optimized-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-cloth-drape.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-cloth-drape-optimized-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-cloth-drape.glb',
  ],
];

describe('vNext private cloth drape review', () => {
  it('adds shaped torso, elbow, and cuff topology without changing authored actions', () => {
    expect(refinement).toMatchObject({
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      construction: {
        torsoRings: 11,
        torsoSegments: 64,
        sleeveRings: 13,
        sleeveSegments: 40,
        elbowCompressionRings: [5, 6, 7],
        cuffRings: [11, 12],
      },
    });
    for (const counts of Object.values(refinement.actionKeyCounts)) {
      expect(counts.after).toBe(counts.before);
      expect(counts.after).toBeGreaterThan(0);
    }
    for (const variant of Object.values(refinement.variants)) {
      expect(variant.before.vertices).toBe(336);
      expect(variant.torso).toMatchObject({
        vertices: 704,
        connectedComponents: 1,
        unweightedVertices: 0,
      });
      expect(variant.torso.bounds.dimensionsCm[0]).toBeLessThan(
        variant.before.bounds.dimensionsCm[0],
      );
      expect(variant.torso.bounds.dimensionsCm[1]).toBeLessThan(
        variant.before.bounds.dimensionsCm[1],
      );
      for (const sleeve of [variant.leftSleeve, variant.rightSleeve]) {
        expect(sleeve).toMatchObject({
          vertices: 520,
          connectedComponents: 1,
          unweightedVertices: 0,
        });
        expect(sleeve.materials).toHaveLength(2);
      }
    }
  });

  it('keeps every visible mesh UV-ready and PBR-backed', () => {
    expect(materialAudit.meshCount).toBe(60);
    expect(materialAudit.uvReadyMeshCount).toBe(materialAudit.meshCount);
    expect(materialAudit.materialCount).toBeGreaterThanOrEqual(24);
    expect(materialAudit.imageTextureNodeCount).toBeGreaterThanOrEqual(67);
  });

  it('keeps private runtime assets complete, byte-identical, and inside budget', () => {
    expect(runtimeAudit).toMatchObject({
      assetTag: 'cmu16-ik-cloth-drape',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      fourAssetBudgetPass: true,
    });
    expect(runtimeAudit.fourAssetBytes).toBeLessThan(10_000_000);
    for (const variant of Object.values(runtimeAudit.variants)) {
      expect(variant.missingActions).toEqual([]);
      expect(variant.actions).toHaveLength(9);
      expect(variant.bytes).toBeLessThan(2_250_000);
      expect(variant.pbrMaterialCount).toBeGreaterThanOrEqual(21);
      expect(variant.webpTextureCount).toBeGreaterThanOrEqual(44);
      expect(variant.cageNodeCount).toBe(0);
    }
    for (const [source, runtime] of runtimePairs) {
      expect(sha256(readBytes(runtime))).toBe(sha256(readBytes(source)));
    }
  });

  it('keeps the candidate private and the accepted asset map unchanged', () => {
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    const acceptedMap = assetsModule.split('export const PRODUCTION_ATHLETE_ASSETS')[1]
      .split('export const PRIVATE_MOTION_REVIEW_ASSETS')[0];
    expect(acceptedMap).not.toContain('cloth-drape');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-cloth-drape'");
    for (const file of [
      'src/components/vnext3d/ProductionReplayPreview.jsx',
      'src/vnext3d/runtimeMapping.js',
      'src/vnext3d/transitionTelemetry.js',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8'))
        .toContain('cmu-jog16-ik-cloth-drape');
    }
  });

  it('retains 27 action renders and clean 12-player cross-device evidence', () => {
    const renderReport = readJson(
      'asset-inbox/players/vnext/cmu16-ik-cloth-drape-action-render-report.json',
    );
    expect(renderReport.outputs).toHaveLength(27);
    for (const output of renderReport.outputs) {
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
      expect(measurement.browserProblems).toEqual([]);
      expect(measurement.frameP95Ms).toBeLessThan(34);
      expect(measurement.groundMaximumCorrectionMm).toBeLessThanOrEqual(20);
    }
    expect(runtimeCapture.results.desktop.closeReview).toMatchObject({
      cameraControl: 'free-look',
      cameraInteractionCount: 8,
      playerCount: 12,
    });
  });

  it('records a garment-direction approval without promoting the athlete', () => {
    expect(review).toMatchObject({
      decision: 'approve-garment-direction-reject-athlete-promotion',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      humanVisualApproval: false,
    });
    expect(review.materialImprovements).toHaveLength(5);
    expect(review.remainingDefects).toHaveLength(4);
    expect(review.assetBudget.pass).toBe(true);
    expect(fs.readFileSync(
      path.join(root, 'scripts/build-vnext-cloth-drape-review.mjs'),
      'utf8',
    )).toContain('GOON_VNEXT_CLOTH_DRAPE_REVIEW_READY');
  });
});
