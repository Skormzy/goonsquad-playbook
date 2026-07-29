import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cameraInteractionPolicy } from '../src/vnext3d/cameraSystem';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson(
  'asset-inbox/players/vnext/cmu16-ik-tailored-uniform-refinement-report.json',
);
const materialAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-tailored-uniform-material-audit.json',
);
const runtimeAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-tailored-uniform-runtime-audit.json',
);
const runtimeCapture = readJson(
  'docs/vnext/evidence/athlete-tailored-uniform-review/runtime-capture.json',
);
const review = readJson(
  'docs/vnext/evidence/athlete-tailored-uniform-review/runtime-cmu16-ik-tailored-uniform-review.json',
);

const runtimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-tailored-uniform-optimized-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-tailored-uniform.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-tailored-uniform-optimized-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-tailored-uniform.glb',
  ],
];

describe('vNext private tailored uniform review', () => {
  it('replaces the inherited fitted shell without changing authored actions', () => {
    expect(refinement).toMatchObject({
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      construction: {
        torsoRings: 7,
        torsoSegments: 48,
        sleeveRings: 6,
        sleeveSegments: 32,
      },
    });
    for (const counts of Object.values(refinement.actionKeyCounts)) {
      expect(counts.after).toBe(counts.before);
      expect(counts.after).toBeGreaterThan(0);
    }
    for (const variant of Object.values(refinement.variants)) {
      expect(variant.before.vertices).toBe(3595);
      expect(variant.torso).toMatchObject({
        vertices: 336,
        connectedComponents: 1,
        unweightedVertices: 0,
      });
      for (const sleeve of [variant.leftSleeve, variant.rightSleeve]) {
        expect(sleeve).toMatchObject({
          vertices: 192,
          connectedComponents: 1,
          unweightedVertices: 0,
        });
        expect(sleeve.bounds.dimensionsCm[0]).toBeGreaterThan(46);
      }
    }
  });

  it('keeps all authored garment meshes UV-ready and PBR-backed', () => {
    expect(materialAudit.meshCount).toBe(60);
    expect(materialAudit.uvReadyMeshCount).toBe(materialAudit.meshCount);
    expect(materialAudit.materialCount).toBeGreaterThanOrEqual(24);
    expect(materialAudit.imageTextureNodeCount).toBeGreaterThanOrEqual(67);
  });

  it('keeps the optimized private runtime inside budget with every action', () => {
    expect(runtimeAudit).toMatchObject({
      assetTag: 'cmu16-ik-tailored-uniform',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      fourAssetBudgetPass: true,
    });
    expect(runtimeAudit.fourAssetBytes).toBeLessThan(10_000_000);
    for (const variant of Object.values(runtimeAudit.variants)) {
      expect(variant.missingActions).toEqual([]);
      expect(variant.actions).toHaveLength(9);
      expect(variant.bytes).toBeLessThan(2_200_000);
      expect(variant.pbrMaterialCount).toBeGreaterThanOrEqual(21);
      expect(variant.webpTextureCount).toBeGreaterThanOrEqual(44);
      expect(variant.cageNodeCount).toBe(0);
    }
    for (const [source, runtime] of runtimePairs) {
      expect(sha256(readBytes(runtime))).toBe(sha256(readBytes(source)));
    }
  });

  it('keeps the tailored candidate private and the accepted map unchanged', () => {
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    const acceptedMap = assetsModule.split('export const PRODUCTION_ATHLETE_ASSETS')[1]
      .split('export const PRIVATE_MOTION_REVIEW_ASSETS')[0];
    expect(acceptedMap).not.toContain('tailored');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-tailored-uniform'");
    for (const file of [
      'src/components/vnext3d/ProductionReplayPreview.jsx',
      'src/vnext3d/runtimeMapping.js',
      'src/vnext3d/transitionTelemetry.js',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8'))
        .toContain('cmu-jog16-ik-tailored-uniform');
    }
  });

  it('retains 27 close renders and clean 12-player cross-device runtime evidence', () => {
    const renderReport = readJson(
      'asset-inbox/players/vnext/cmu16-ik-tailored-uniform-action-render-report.json',
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
    expect(runtimeCapture.results.desktop.closeReview.cameraInteractionCount).toBe(8);
    expect(fs.statSync(path.join(
      root,
      'docs/vnext/evidence/athlete-tailored-uniform-review',
      runtimeCapture.results.desktop.closeReview.screenshot,
    )).size).toBeGreaterThan(100_000);
  });

  it('records the failed human gate and exposes a useful bounded inspection distance', () => {
    expect(review).toMatchObject({
      decision: 'reject-for-promotion',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      humanVisualApproval: false,
    });
    expect(review.remainingDefects).toHaveLength(5);
    expect(cameraInteractionPolicy('player').minDistance).toBe(3.2);
    expect(cameraInteractionPolicy('bench').minDistance).toBe(3.2);
    expect(cameraInteractionPolicy('player', { portrait: true }).minDistance).toBe(3.8);
  });
});
