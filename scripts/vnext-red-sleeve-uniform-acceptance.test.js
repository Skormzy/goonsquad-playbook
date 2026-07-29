import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

describe('vNext private red-sleeve uniform revision', () => {
  it('authors long team-accent sleeves and one weighted surface number per uniform', () => {
    const report = readJson('asset-inbox/players/vnext/cmu16-ik-red-sleeve-refinement-report.json');
    expect(report).toMatchObject({
      status: 'refined-for-private-human-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
    });
    for (const side of ['home', 'away']) {
      const variant = report.variants[side];
      expect(variant.jerseyBoundsAfter.dimensions[0]).toBe(44.9513);
      expect(variant.sleeveObjects).toHaveLength(2);
      expect(variant.sleeveMaterials).toHaveLength(2);
      expect(variant.sleeveMaterials.every((name) => name.endsWith('Accent_Red'))).toBe(true);
      expect(variant.stripeObjects).toEqual([]);
      expect(variant.backNumberMethod).toBe('weighted-jersey-surface-text-v2');
      expect(variant.backOffsetFromClothCm).toBe(0.5);
    }
  });

  it('exports complete private GLBs with no detached number objects', () => {
    const report = readJson('asset-inbox/players/vnext/cmu16-ik-red-sleeve-private-export-report.json');
    expect(report).toMatchObject({
      status: 'private-uniform-runtime-review-exported',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
    });
    expect(report.actionNames).toEqual(report.requiredActions);
    expect(report.actionNames).toHaveLength(9);
    for (const side of ['home', 'away']) {
      const variant = report.variants[side];
      const runtime = path.join(root, `src/assets/vnext3d-review/field-${side}-cmu16-ik-red-sleeve.glb`);
      expect(variant.bytes).toBeGreaterThan(2_700_000);
      expect(variant.bytes).toBeLessThan(2_800_000);
      expect(variant.sleeveObjects).toHaveLength(2);
      expect(variant.detachedBackNumberObjects).toEqual([]);
      expect(variant.backNumber.armatureModifiers).toEqual(['GS_FieldPlayer_Rig']);
      expect(digest(runtime)).toBe(digest(variant.file));
    }
  });

  it('records fresh multi-angle and cross-device visual evidence', () => {
    const render = readJson('asset-inbox/players/vnext/cmu16-ik-red-sleeve-render-report.json');
    const evidence = readJson(
      'docs/vnext/evidence/athlete-uniform-red-sleeve-review/runtime-cmu16-ik-red-sleeve-review.json',
    );
    expect(render.outputs).toHaveLength(8);
    for (const output of render.outputs) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(200_000);
    }
    for (const runtime of [evidence.desktopRuntime, evidence.mobileRuntime]) {
      expect(runtime).toMatchObject({
        motionReview: 'cmu-jog16-ik-red-sleeve',
        scenePlayerCount: 12,
        canvasCount: 1,
        selectedAction: 'sprint',
        horizontalOverflow: false,
      });
      expect(fs.statSync(path.join(root, runtime.screenshot)).size).toBeGreaterThan(30_000);
    }
  });

  it('keeps promotion closed for the visible shoulder edge and failed timing gate', () => {
    const evidence = readJson(
      'docs/vnext/evidence/athlete-uniform-red-sleeve-review/runtime-cmu16-ik-red-sleeve-review.json',
    );
    expect(evidence).toMatchObject({
      humanVisualDecision: 'not-approved',
      promotionDecision: 'keep-private',
      publicRuntimeAllowed: false,
      browserErrors: [],
    });
    expect(evidence.blenderReview).toMatchObject({
      redLongSleevesReadAsUniformElements: true,
      floatingCuffBandsRemoved: true,
      backNumberReadableAndClothBound: true,
      torsoToSleeveJunctionStillVisiblyUnfinished: true,
      productionHumanApproval: false,
    });
    for (const transition of [evidence.desktopTransition, evidence.mobileTransition]) {
      expect(transition).toMatchObject({
        passesSlidingTarget: true,
        passesClearanceTarget: true,
        passesPenetrationTolerance: true,
        passesTransitionFrameTarget: false,
      });
    }
  });

  it('exposes the revision only through a private selector', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(source).toContain("reviewId === 'cmu-jog16-ik-red-sleeve'");
    expect(source).toContain('PRIVATE_CMU16_IK_RED_SLEEVE_REVIEW_ASSETS');
    expect(source).not.toContain(
      'PRODUCTION_ATHLETE_ASSETS = PRIVATE_CMU16_IK_RED_SLEEVE_REVIEW_ASSETS',
    );
  });
});
