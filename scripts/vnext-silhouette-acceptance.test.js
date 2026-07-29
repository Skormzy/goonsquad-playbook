import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson('asset-inbox/players/vnext/cmu16-ik-silhouette-refinement-report.json');
const sourceAudit = readJson('asset-inbox/players/vnext/cmu16-ik-pbr-silhouette-audit.json');
const audit = readJson('asset-inbox/players/vnext/cmu16-ik-silhouette-audit.json');
const materialAudit = readJson('asset-inbox/players/vnext/cmu16-ik-silhouette-material-audit.json');
const runtimeAudit = readJson('asset-inbox/players/vnext/cmu16-ik-silhouette-runtime-audit.json');
const runtimeReview = readJson(
  'docs/vnext/evidence/athlete-silhouette-review/runtime-cmu16-ik-silhouette-review.json',
);

const runtimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-silhouette-optimized-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-silhouette.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-silhouette-optimized-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-silhouette.glb',
  ],
];

describe('vNext private silhouette athlete review', () => {
  it('rebuilds the high-impact equipment forms without changing motion keys', () => {
    expect(refinement).toMatchObject({
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
    });
    for (const counts of Object.values(refinement.actionKeyCounts)) {
      expect(counts.after).toBe(counts.before);
      expect(counts.after).toBeGreaterThan(0);
    }
    expect(audit.helmetCageObjects).toEqual([]);
    expect(audit.objectCount).toBeGreaterThan(sourceAudit.objectCount);
    const records = Object.values(audit.objects);
    expect(records.reduce((total, record) => total + record.unweightedVertices, 0)).toBe(0);

    for (const side of ['Home', 'Away']) {
      for (const foot of ['Left', 'Right']) {
        const upper = audit.objects[`GS_${side}_Shoe_${foot}_Upper`];
        const sole = audit.objects[`GS_${side}_Shoe_${foot}_Sole`];
        const laces = audit.objects[`GS_${side}_Shoe_${foot}_Laces`];
        expect(upper.vertices).toBeGreaterThanOrEqual(112);
        expect(sole.vertices).toBeGreaterThanOrEqual(56);
        expect(laces.vertices).toBeGreaterThanOrEqual(40);
        expect(upper.bounds.dimensionsCm[1]).toBeGreaterThanOrEqual(25);
        expect(upper.silhouetteRevision).toBe('production-form-v1');
      }
      for (const hand of ['Left', 'Right']) {
        const source = sourceAudit.objects[`GS_${side}_Glove_${hand}`];
        const glove = audit.objects[`GS_${side}_Glove_${hand}`];
        const guards = audit.objects[`GS_${side}_Glove_${hand}_Backhand_Guards`];
        expect(glove.bounds.dimensionsCm[0]).toBeLessThan(source.bounds.dimensionsCm[0]);
        expect(glove.bounds.dimensionsCm[1]).toBeLessThan(source.bounds.dimensionsCm[1]);
        expect(guards.vertices).toBe(24);
      }
      expect(audit.objects[`GS_${side}_Helmet_Center_Stripe`].bounds.dimensionsCm[0])
        .toBeLessThan(sourceAudit.objects[`GS_${side}_Helmet_Center_Stripe`].bounds.dimensionsCm[0]);
      expect(audit.objects[`GS_${side}_Jersey_Front_Mark`].materials)
        .toContain('GS_PBR_GoonSquad_Wordmark');
    }
  });

  it('keeps every rebuilt mesh UV-ready and image-backed', () => {
    expect(materialAudit.meshCount).toBe(56);
    expect(materialAudit.uvReadyMeshCount).toBe(materialAudit.meshCount);
    expect(materialAudit.materialCount).toBeGreaterThanOrEqual(24);
    expect(materialAudit.imageTextureNodeCount).toBeGreaterThanOrEqual(67);
  });

  it('keeps the private four-asset runtime inside budget with all authored actions', () => {
    expect(runtimeAudit).toMatchObject({
      assetTag: 'cmu16-ik-silhouette',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      fourAssetBudgetPass: true,
    });
    expect(runtimeAudit.fourAssetBytes).toBeLessThan(10_000_000);
    for (const variant of Object.values(runtimeAudit.variants)) {
      expect(variant.missingActions).toEqual([]);
      expect(variant.actions).toHaveLength(9);
      expect(variant.bytes).toBeLessThan(2_400_000);
      expect(variant.pbrMaterialCount).toBeGreaterThanOrEqual(21);
      expect(variant.webpTextureCount).toBeGreaterThanOrEqual(44);
      expect(variant.cageNodeCount).toBe(0);
    }
    for (const [source, runtime] of runtimePairs) {
      expect(sha256(readBytes(runtime))).toBe(sha256(readBytes(source)));
    }
  });

  it('keeps the candidate private and leaves the accepted asset map unchanged', () => {
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    const acceptedMap = assetsModule.split('export const PRODUCTION_ATHLETE_ASSETS')[1]
      .split('export const PRIVATE_MOTION_REVIEW_ASSETS')[0];
    expect(acceptedMap).not.toContain('silhouette');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-silhouette'");
    for (const file of [
      'src/components/vnext3d/ProductionReplayPreview.jsx',
      'src/vnext3d/runtimeMapping.js',
      'src/vnext3d/transitionTelemetry.js',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8'))
        .toContain('cmu-jog16-ik-silhouette');
    }
  });

  it('retains all-action close renders and measured desktop and mobile replay evidence', () => {
    const renderReport = readJson(
      'asset-inbox/players/vnext/cmu16-ik-silhouette-action-render-report.json',
    );
    expect(renderReport.outputs).toHaveLength(27);
    for (const output of renderReport.outputs) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(10_000);
    }
    for (const device of ['desktop', 'mobile']) {
      const measurement = runtimeReview[device];
      expect(measurement).toMatchObject({
        canvasCount: 1,
        playerCount: 12,
        assetsReady: 4,
        horizontalOverflow: false,
        selectedAthleteAnimationWeight: 1,
        selectedAthleteHandSpanMm: 183.5,
        browserErrors: 0,
      });
      expect(measurement.frameP95Ms).toBeLessThan(34);
      expect(measurement.groundMaximumCorrectionMm).toBeLessThanOrEqual(20);
      expect(fs.statSync(path.join(
        root,
        'docs/vnext/evidence/athlete-silhouette-review',
        measurement.screenshot,
      )).size).toBeGreaterThan(30_000);
    }
    expect(runtimeReview.humanReview.approved).toBe(false);
    expect(runtimeReview.desktop.closeCameraInteractionCount).toBe(8);
    expect(runtimeReview.humanReview.remainingDefects).toHaveLength(5);
  });
});
