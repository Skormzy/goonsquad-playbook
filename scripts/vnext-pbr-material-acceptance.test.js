import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const authoring = readJson('asset-inbox/players/vnext/cmu16-ik-pbr-material-authoring-report.json');
const materialAudit = readJson('asset-inbox/players/vnext/cmu16-ik-pbr-material-audit.json');
const runtimeAudit = readJson('asset-inbox/players/vnext/cmu16-ik-pbr-runtime-audit.json');
const runtimeReview = readJson(
  'docs/vnext/evidence/athlete-pbr-material-review/runtime-cmu16-ik-pbr-review.json',
);
const license = fs.readFileSync(
  path.join(root, 'asset-inbox/players/downloads/cc-character-base/Read Me.txt'),
  'utf8',
);

const runtimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-pbr-optimized-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-pbr.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-pbr-optimized-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-pbr.glb',
  ],
];

describe('vNext private PBR athlete review', () => {
  it('uses the licensed Character Creator maps and authored equipment texture sets', () => {
    expect(license).toMatch(/personal and commercial purposes/i);
    expect(authoring.publicRuntimeAllowed).toBe(false);
    expect(authoring.acceptedRuntimeAssetsChanged).toBe(false);
    expect(authoring.licensedCharacterTextures).toEqual([
      'eye',
      'eye_occlusion',
      'skin_arm',
      'skin_body',
      'skin_head',
      'skin_leg',
      'teeth',
      'tongue',
    ]);
    expect(authoring.authoredEquipmentTextureSets).toHaveLength(16);
    expect(authoring.textureFileCount).toBe(72);
    expect(authoring.textureBytes).toBeGreaterThan(5_000_000);
  });

  it('provides full UV coverage and real image-backed PBR materials', () => {
    expect(materialAudit.meshCount).toBe(42);
    expect(materialAudit.uvReadyMeshCount).toBe(materialAudit.meshCount);
    expect(materialAudit.materialCount).toBe(25);
    expect(materialAudit.imageTextureNodeCount).toBe(72);
    expect(authoring.pbrMaterialCount).toBe(25);
    expect(authoring.imageTextureNodeCount).toBe(72);
    expect(Object.keys(authoring.equipmentAssignments)).toHaveLength(36);
    expect(authoring.sourceAssignments.bodyPolygonMaterialCounts.head).toBeGreaterThan(4_000);
  });

  it('does not alter any of the nine authored action key counts', () => {
    expect(Object.keys(authoring.actionKeyCounts)).toHaveLength(9);
    for (const counts of Object.values(authoring.actionKeyCounts)) {
      expect(counts.after).toBe(counts.before);
      expect(counts.after).toBeGreaterThan(0);
    }
  });

  it('keeps the optimized four-asset runtime inside the private web budget', () => {
    expect(runtimeAudit.publicRuntimeAllowed).toBe(false);
    expect(runtimeAudit.fourAssetBudgetPass).toBe(true);
    expect(runtimeAudit.fourAssetBytes).toBeLessThan(10_000_000);
    for (const variant of Object.values(runtimeAudit.variants)) {
      expect(variant.missingActions).toEqual([]);
      expect(variant.actions).toHaveLength(9);
      expect(variant.bytes).toBeLessThan(2_400_000);
      expect(variant.pbrMaterialCount).toBeGreaterThanOrEqual(21);
      expect(variant.webpTextureCount).toBeGreaterThanOrEqual(45);
      expect(variant.extensions).toEqual(['EXT_texture_webp', 'KHR_mesh_quantization']);
      expect(variant.cageNodeCount).toBe(0);
    }
  });

  it('keeps private runtime copies byte-identical and the accepted map unchanged', () => {
    for (const [source, runtime] of runtimePairs) {
      expect(sha256(readBytes(runtime))).toBe(sha256(readBytes(source)));
    }
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    const acceptedMap = assetsModule.split('export const PRODUCTION_ATHLETE_ASSETS')[1]
      .split('export const PRIVATE_MOTION_REVIEW_ASSETS')[0];
    expect(acceptedMap).not.toContain('cmu16-ik-pbr');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-pbr'");
    for (const file of [
      'src/components/vnext3d/ProductionReplayPreview.jsx',
      'src/vnext3d/runtimeMapping.js',
      'src/vnext3d/transitionTelemetry.js',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8')).toContain('cmu-jog16-ik-pbr');
    }
  });

  it('retains fresh close front and rear visual evidence', () => {
    for (const file of [
      'docs/vnext/evidence/athlete-pbr-material-review/actions/upper-body-ready-front-frame-001.png',
      'docs/vnext/evidence/athlete-pbr-material-review/actions/upper-body-ready-rear-frame-001.png',
    ]) {
      expect(fs.statSync(path.join(root, file)).size).toBeGreaterThan(10_000);
    }
  });

  it('retains a measured 12-player desktop and mobile runtime without promoting it', () => {
    expect(runtimeReview.status).toBe('measured-private-review');
    expect(runtimeReview.decision).toBe('reject-for-promotion');
    expect(runtimeReview.publicRuntimeAllowed).toBe(false);
    expect(runtimeReview.acceptedRuntimeAssetsChanged).toBe(false);
    for (const device of ['desktop', 'mobile']) {
      const measurement = runtimeReview[device];
      expect(measurement.canvasCount).toBe(1);
      expect(measurement.playerCount).toBe(12);
      expect(measurement.assetsReady).toBe(4);
      expect(measurement.horizontalOverflow).toBe(false);
      expect(measurement.browserErrors).toBe(0);
      expect(measurement.frameSampleCount).toBeGreaterThanOrEqual(120);
      expect(measurement.frameP95Ms).toBeLessThan(34);
      expect(measurement.selectedAthleteAnimationWeight).toBe(1);
      expect(measurement.selectedAthleteHandSpanMm).toBeGreaterThanOrEqual(160);
      expect(measurement.selectedAthleteHandSpanMm).toBeLessThanOrEqual(220);
      expect(measurement.groundMaximumCorrectionMm).toBeLessThanOrEqual(20);
      expect(fs.statSync(path.join(
        root,
        'docs/vnext/evidence/athlete-pbr-material-review',
        measurement.screenshot,
      )).size).toBeGreaterThan(30_000);
    }
    expect(runtimeReview.humanReview.approved).toBe(false);
    expect(runtimeReview.humanReview.remainingDefects).toHaveLength(4);
    const closeReview = readJson(
      'docs/vnext/evidence/athlete-pbr-material-review/runtime-capture.json',
    ).results.desktop.closeReview;
    expect(closeReview).toMatchObject({
      cameraControl: 'free-look',
      cameraInteractionCount: 2,
      playerCount: 12,
    });
    expect(fs.statSync(path.join(
      root,
      'docs/vnext/evidence/athlete-pbr-material-review',
      closeReview.screenshot,
    )).size).toBeGreaterThan(30_000);
  });
});
