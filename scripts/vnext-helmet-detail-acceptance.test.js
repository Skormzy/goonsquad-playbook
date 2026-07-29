import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson(
  'asset-inbox/players/vnext/cmu16-ik-helmet-detail-refinement-report.json',
);
const headAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-helmet-detail-head-audit.json',
);
const materialAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-helmet-detail-material-audit.json',
);
const runtimeAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-helmet-detail-runtime-audit.json',
);
const runtimeCapture = readJson(
  'docs/vnext/evidence/athlete-helmet-detail-review/runtime-capture.json',
);
const review = readJson(
  'docs/vnext/evidence/athlete-helmet-detail-review/runtime-cmu16-ik-helmet-detail-review.json',
);

const runtimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-helmet-detail-optimized-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-helmet-detail.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-helmet-detail-optimized-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-helmet-detail.glb',
  ],
];

describe('vNext private open-face helmet detail review', () => {
  it('rebuilds the shell and keeps every authored action unchanged', () => {
    expect(refinement).toMatchObject({
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      construction: {
        configuration: 'open-face-no-cage-no-visor',
        detailObjectsPerVariant: 11,
        cageObjectCount: 0,
      },
      shellConstruction: {
        longitudeSegments: 64,
        latitudeSegments: 32,
      },
    });
    for (const counts of Object.values(refinement.actionKeyCounts)) {
      expect(counts.after).toBe(counts.before);
      expect(counts.after).toBeGreaterThan(0);
    }
    for (const variant of Object.values(headAudit.variants)) {
      expect(variant.detailObjectCount).toBe(11);
      expect(variant.shell).toMatchObject({
        vertices: 2049,
        faces: 1856,
        uvLayers: 1,
        unweightedVertices: 0,
        headDetailRevision: 'open-face-manufacturing-detail-v1',
      });
      expect(variant.stripe).toMatchObject({
        vertices: 56,
        faces: 27,
        uvLayers: 1,
        unweightedVertices: 0,
      });
    }
    expect(headAudit.cageObjectCount).toBe(0);
  });

  it('keeps every visible mesh UV-ready and PBR-backed', () => {
    expect(materialAudit.meshCount).toBe(82);
    expect(materialAudit.uvReadyMeshCount).toBe(materialAudit.meshCount);
    expect(materialAudit.materialCount).toBeGreaterThanOrEqual(24);
    expect(materialAudit.imageTextureNodeCount).toBeGreaterThanOrEqual(67);
  });

  it('keeps private runtime assets complete, byte-identical, and inside budget', () => {
    expect(runtimeAudit).toMatchObject({
      assetTag: 'cmu16-ik-helmet-detail',
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
    expect(acceptedMap).not.toContain('helmet-detail');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-helmet-detail'");
    for (const file of [
      'src/components/vnext3d/ProductionReplayPreview.jsx',
      'src/vnext3d/runtimeMapping.js',
      'src/vnext3d/transitionTelemetry.js',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8'))
        .toContain('cmu-jog16-ik-helmet-detail');
    }
  });

  it('retains close and all-action renders plus clean cross-device evidence', () => {
    const headRenders = readJson(
      'asset-inbox/players/vnext/cmu16-ik-helmet-detail-head-render-report.json',
    );
    const actionRenders = readJson(
      'asset-inbox/players/vnext/cmu16-ik-helmet-detail-action-render-report.json',
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

  it('approves the direction without promoting the complete athlete', () => {
    expect(review).toMatchObject({
      decision: 'approve-open-face-helmet-direction-reject-athlete-promotion',
      helmetDirectionApproved: true,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
    });
    expect(review.helmetImprovements).toHaveLength(5);
    expect(review.remainingDefects).toHaveLength(4);
    expect(review.assetBudget.pass).toBe(true);
    expect(fs.readFileSync(
      path.join(root, 'scripts/build-vnext-helmet-detail-review.mjs'),
      'utf8',
    )).toContain('GOON_VNEXT_HELMET_DETAIL_REVIEW_READY');
  });
});
