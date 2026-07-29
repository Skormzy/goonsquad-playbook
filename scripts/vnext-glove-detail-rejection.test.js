import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const audit = readJson('asset-inbox/players/vnext/cmu16-ik-glove-detail-audit.json');
const runtimeAudit = readJson(
  'asset-inbox/players/vnext/cmu16-ik-glove-detail-runtime-audit.json',
);
const closeRenders = readJson(
  'asset-inbox/players/vnext/cmu16-ik-glove-detail-close-render-report.json',
);
const actionRenders = readJson(
  'asset-inbox/players/vnext/cmu16-ik-glove-detail-action-render-report.json',
);
const review = readJson(
  'docs/vnext/evidence/athlete-glove-detail-review/runtime-cmu16-ik-glove-detail-review.json',
);

const runtimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-glove-detail-optimized-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-glove-detail.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-glove-detail-optimized-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-glove-detail.glb',
  ],
];

describe('vNext rejected generated glove review', () => {
  it('preserves complete rigging and measured shaft proximity without claiming realism', () => {
    expect(audit).toMatchObject({
      status: 'private-segmented-glove-audited',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      automatedContactPass: true,
      maximumMinimumShaftDistanceMm: 1.296,
      minimumVerticesWithin20Mm: 291,
    });
    for (const assembly of Object.values(audit.assemblies)) {
      for (const hand of Object.values(assembly)) expect(hand.partCount).toBe(9);
    }
    for (const action of Object.values(audit.actions)) {
      expect(action).toMatchObject({
        fingerFcurveCount: 120,
        fingerKeyCount: 240,
        gripRevision: 'segmented-closed-flex-v2',
      });
    }
    for (const object of Object.values(audit.objects)) {
      expect(object.gloveDetailRevision).toBe('segmented-closed-grip-v2');
      expect(object.unweightedVertices).toBe(0);
      expect(object.uvLayers).toEqual(['UVMap']);
      expect(object.armatureModifiers).toEqual(['GS_FieldPlayer_Rig']);
    }
  });

  it('keeps the private exports complete, byte-identical, and inside budget', () => {
    expect(runtimeAudit).toMatchObject({
      assetTag: 'cmu16-ik-glove-detail',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      fourAssetBudgetPass: true,
    });
    expect(runtimeAudit.fourAssetBytes).toBeLessThan(10_000_000);
    for (const variant of Object.values(runtimeAudit.variants)) {
      expect(variant.missingActions).toEqual([]);
      expect(variant.actions).toHaveLength(9);
      expect(variant.cageNodeCount).toBe(0);
    }
    for (const [source, runtime] of runtimePairs) {
      expect(sha256(readBytes(runtime))).toBe(sha256(readBytes(source)));
    }
  });

  it('retains complete visual evidence but records a hard human rejection', () => {
    expect(closeRenders.outputs).toHaveLength(18);
    expect(actionRenders.outputs).toHaveLength(27);
    for (const output of [...closeRenders.outputs, ...actionRenders.outputs]) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(10_000);
    }
    expect(review).toMatchObject({
      decision: 'reject-generated-glove-approach',
      gloveSubsystemApproved: false,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      generatedApproachExhausted: true,
      reviewedIterations: 3,
      evidence: {
        headless: true,
        visibleBrowserWindowOpened: false,
        runtimeCaptureSkipped: true,
      },
    });
    expect(review.rejectionReasons).toHaveLength(4);
    expect(review.nextConcreteStep).toContain('production hockey-glove mesh');
  });

  it('does not expose the rejected glove through any runtime selector', () => {
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    const acceptedMap = assetsModule.split('export const PRODUCTION_ATHLETE_ASSETS')[1]
      .split('export const PRIVATE_MOTION_REVIEW_ASSETS')[0];
    expect(acceptedMap).not.toContain('glove-detail');
    expect(assetsModule).not.toContain('cmu-jog16-ik-glove-detail');
    for (const file of [
      'src/components/vnext3d/ProductionReplayPreview.jsx',
      'src/vnext3d/runtimeMapping.js',
      'src/vnext3d/transitionTelemetry.js',
    ]) {
      expect(fs.readFileSync(path.join(root, file), 'utf8'))
        .not.toContain('cmu-jog16-ik-glove-detail');
    }
  });

  it('points the next pass at a production mesh instead of more primitive shaping', () => {
    const contract = fs.readFileSync(
      path.join(root, 'docs/vnext/assets/production-glove-replacement-contract.md'),
      'utf8',
    );
    expect(contract).toContain('The generated glove path is closed');
    expect(contract).toContain('production hockey-glove mesh');
    expect(contract).toContain('Human close review must approve');
    expect(fs.readFileSync(
      path.join(root, 'scripts/build-vnext-glove-detail-review.mjs'),
      'utf8',
    )).toContain('GOON_VNEXT_GLOVE_DETAIL_REVIEW_READY');
  });
});
