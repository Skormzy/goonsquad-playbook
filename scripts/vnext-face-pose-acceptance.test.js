import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson(
  'asset-inbox/players/vnext/cmu16-ik-face-pose-refinement-report.json',
);
const faceAudit = readJson('asset-inbox/players/vnext/cmu16-ik-face-pose-audit.json');
const materialAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-face-pose-material-audit.json',
);
const runtimeAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-face-pose-runtime-audit.json',
);
const runtimeCapture = readJson(
  'docs/vnext/evidence/athlete-face-pose-review/runtime-capture.json',
);
const review = readJson(
  'docs/vnext/evidence/athlete-face-pose-review/runtime-cmu16-ik-face-pose-review.json',
);

const runtimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-face-pose-optimized-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-face-pose.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-face-pose-optimized-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-face-pose.glb',
  ],
];

describe('vNext private licensed face-pose review', () => {
  it('restores the licensed eye and cornea topology without changing animation', () => {
    expect(refinement).toMatchObject({
      revision: 'licensed-eye-cornea-restoration-v1',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      eyeAssignments: {
        innerEyePolygons: 320,
        corneaPolygons: 320,
        materialSlots: ['GS_PBR_Eye', 'GS_PBR_Cornea'],
      },
      eyelidPose: {
        Eye_Wide_L: 0.02,
        Eye_Wide_R: 0.02,
      },
    });
    expect(refinement.eyeAssignments.components).toHaveLength(4);
    expect(refinement.eyeAssignments.components.filter((item) => item.surface === 'inner-eye'))
      .toHaveLength(2);
    expect(refinement.eyeAssignments.components.filter((item) => item.surface === 'cornea'))
      .toHaveLength(2);
    for (const visibility of Object.values(refinement.restoredRenderVisibility)) {
      expect(visibility).toEqual({ before: true, after: false });
    }
    for (const counts of Object.values(refinement.actionKeyCounts)) {
      expect(counts.after).toBe(counts.before);
      expect(counts.after).toBeGreaterThan(0);
    }
  });

  it('keeps both eye surfaces UV-forward, visible, and PBR-backed', () => {
    expect(faceAudit.eyeObject.materials.map((material) => material.name))
      .toEqual(['GS_PBR_Eye', 'GS_PBR_Cornea']);
    expect(faceAudit.eyeObject.components).toHaveLength(4);
    expect(faceAudit.eyeObject.components.flatMap((component) => (
      Object.values(component.materialPolygonCounts)
    ))).toEqual([160, 160, 160, 160]);
    for (const component of faceAudit.eyeObject.components) {
      expect(component.evaluatedUvDirection[1]).toBeLessThan(-0.99);
    }
    expect(materialAudit.meshCount).toBe(82);
    expect(materialAudit.uvReadyMeshCount).toBe(materialAudit.meshCount);
    expect(materialAudit.materialCount).toBeGreaterThanOrEqual(25);
    expect(materialAudit.imageTextureNodeCount).toBeGreaterThanOrEqual(67);
  });

  it('keeps private runtime assets complete, byte-identical, and inside budget', () => {
    expect(runtimeAudit).toMatchObject({
      assetTag: 'cmu16-ik-face-pose',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      fourAssetBudgetPass: true,
    });
    expect(runtimeAudit.fourAssetBytes).toBeLessThan(10_000_000);
    for (const variant of Object.values(runtimeAudit.variants)) {
      expect(variant.missingActions).toEqual([]);
      expect(variant.actions).toHaveLength(9);
      expect(variant.bytes).toBeLessThan(2_250_000);
      expect(variant.pbrMaterialCount).toBeGreaterThanOrEqual(22);
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
    expect(acceptedMap).not.toContain('face-pose');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-face-pose'");
    for (const file of [
      'src/components/vnext3d/ProductionReplayPreview.jsx',
      'src/vnext3d/runtimeMapping.js',
      'src/vnext3d/transitionTelemetry.js',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8'))
        .toContain('cmu-jog16-ik-face-pose');
    }
  });

  it('retains close, all-action, and clean cross-device evidence', () => {
    const headRenders = readJson(
      'asset-inbox/players/vnext/cmu16-ik-face-pose-head-render-report.json',
    );
    const actionRenders = readJson(
      'asset-inbox/players/vnext/cmu16-ik-face-pose-action-render-report.json',
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

  it('approves the eye subsystem without promoting the complete athlete', () => {
    expect(review).toMatchObject({
      decision: 'approve-licensed-eye-restoration-reject-athlete-promotion',
      eyeDirectionApproved: true,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
    });
    expect(review.eyeImprovements).toHaveLength(5);
    expect(review.remainingDefects).toHaveLength(4);
    expect(review.assetBudget.pass).toBe(true);
    expect(fs.readFileSync(
      path.join(root, 'scripts/build-vnext-face-pose-review.mjs'),
      'utf8',
    )).toContain('GOON_VNEXT_FACE_POSE_REVIEW_READY');
  });
});
