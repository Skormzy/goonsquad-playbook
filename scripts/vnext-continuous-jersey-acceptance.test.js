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

describe('vNext private continuous-jersey revision', () => {
  it('builds one connected and fully weighted garment per uniform', () => {
    const report = readJson('asset-inbox/players/vnext/cmu16-ik-continuous-jersey-report.json');
    expect(report).toMatchObject({
      status: 'continuous-garment-built-for-private-human-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
    });
    for (const side of ['home', 'away']) {
      const variant = report.variants[side];
      expect(variant).toMatchObject({
        continuousGarment: true,
        separateSleeveObjects: [],
        garmentMethod: 'continuous-body-derived-garment-v1',
        frontMarkMethod: 'cloth-projected-front-text-v1',
        backNumberMethod: 'cloth-projected-back-text-v1',
      });
      expect(variant.topology.connectedComponents).toBe(1);
      expect(variant.topology.unweightedVertices).toBe(0);
      expect(Object.keys(variant.topology.materialFaces)).toHaveLength(2);
      expect(Object.values(variant.topology.materialFaces).every((faces) => faces > 0)).toBe(true);
    }
  });

  it('exports all required actions with no detached sleeve or number objects', () => {
    const report = readJson(
      'asset-inbox/players/vnext/cmu16-ik-continuous-jersey-private-export-report.json',
    );
    expect(report).toMatchObject({
      status: 'private-uniform-runtime-review-exported',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
    });
    expect(report.actionNames).toEqual(report.requiredActions);
    expect(report.actionNames).toHaveLength(9);
    for (const side of ['home', 'away']) {
      const variant = report.variants[side];
      const runtime = path.join(
        root,
        `src/assets/vnext3d-review/field-${side}-cmu16-ik-continuous-jersey.glb`,
      );
      expect(variant.continuousGarment).toBe(true);
      expect(variant.sleeveObjects).toEqual([]);
      expect(variant.detachedBackNumberObjects).toEqual([]);
      expect(variant.jersey.armatureModifiers).toEqual(['GS_FieldPlayer_Rig']);
      expect(variant.frontMark.armatureModifiers).toEqual(['GS_FieldPlayer_Rig']);
      expect(variant.backNumber.armatureModifiers).toEqual(['GS_FieldPlayer_Rig']);
      expect(digest(runtime)).toBe(digest(variant.file));
    }
  });

  it('records close and cross-device evidence with exactly 12 players', () => {
    const render = readJson('asset-inbox/players/vnext/cmu16-ik-continuous-jersey-render-report.json');
    const evidence = readJson(
      'docs/vnext/evidence/athlete-continuous-jersey-review/runtime-cmu16-ik-continuous-jersey-review.json',
    );
    expect(render.outputs).toHaveLength(8);
    for (const output of render.outputs) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(200_000);
    }
    for (const runtime of [evidence.desktopRuntime, evidence.mobileRuntime]) {
      expect(runtime).toMatchObject({
        motionReview: 'cmu-jog16-ik-continuous-jersey',
        scenePlayerCount: 12,
        canvasCount: 1,
        selectedAction: 'sprint',
        horizontalOverflow: false,
      });
      expect(fs.statSync(path.join(root, runtime.screenshot)).size).toBeGreaterThan(30_000);
    }
  });

  it('keeps promotion closed for the visible deformation and failed motion gates', () => {
    const evidence = readJson(
      'docs/vnext/evidence/athlete-continuous-jersey-review/runtime-cmu16-ik-continuous-jersey-review.json',
    );
    expect(evidence).toMatchObject({
      humanVisualDecision: 'not-approved',
      promotionDecision: 'keep-private',
      publicRuntimeAllowed: false,
      browserErrors: [],
    });
    expect(evidence.blenderReview).toMatchObject({
      jaggedDetachedShoulderOpeningRemoved: true,
      oneContinuousGarmentVisible: true,
      shoulderSilhouetteStillTooSpherical: true,
      sleeveTorsoSelfIntersectionVisible: true,
      productionHumanApproval: false,
    });
    expect(evidence.desktopTransition).toMatchObject({
      passesSlidingTarget: false,
      passesPenetrationTolerance: false,
      passesTransitionFrameTarget: false,
    });
    expect(evidence.mobileTransition).toMatchObject({
      passesSlidingTarget: true,
      passesPenetrationTolerance: false,
      passesTransitionFrameTarget: false,
    });
  });

  it('exposes the garment only through a private selector', () => {
    const source = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(source).toContain("reviewId === 'cmu-jog16-ik-continuous-jersey'");
    expect(source).toContain('PRIVATE_CMU16_IK_CONTINUOUS_JERSEY_REVIEW_ASSETS');
    expect(source).not.toContain(
      'PRODUCTION_ATHLETE_ASSETS = PRIVATE_CMU16_IK_CONTINUOUS_JERSEY_REVIEW_ASSETS',
    );
  });
});
