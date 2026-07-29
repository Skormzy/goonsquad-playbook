import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const assetRoot = path.join(root, 'asset-inbox/players/vnext');
const evidenceRoot = path.join(root, 'docs/vnext/evidence/athlete-uniform-refinement-review');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function digest(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

describe('vNext private field-player uniform refinement', () => {
  it('replaces the oversized inherited shoulder shell with bounded weighted components', () => {
    const report = readJson('asset-inbox/players/vnext/cmu16-ik-uniform-refinement-report.json');
    expect(report).toMatchObject({
      status: 'refined-for-private-human-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      armature: 'GS_FieldPlayer_Rig',
      chestBone: 'CC_Base_Spine02',
    });
    for (const side of ['home', 'away']) {
      const variant = report.variants[side];
      expect(variant.jerseyBoundsBefore.dimensions[0]).toBeGreaterThan(130);
      expect(variant.jerseyBoundsAfter.dimensions[0]).toBeLessThan(50);
      expect(variant.sleeveObjects).toHaveLength(2);
      expect(variant.stripeObjects).toHaveLength(2);
      expect(variant.frontOffsetFromClothCm).toBe(0.35);
      expect(variant.backOffsetFromClothCm).toBe(0.35);
      expect(variant.backNumber).toBe(`GS_${side === 'home' ? 'Home' : 'Away'}_Jersey_Back_Number_17`);
    }
  });

  it('records armature-bound crests and back numbers on the saved workfile', () => {
    const audit = readJson('asset-inbox/players/vnext/cmu16-ik-uniform-after-report.json');
    for (const side of ['home', 'away']) {
      const variant = audit.variants[side];
      expect(variant.frontMark).toMatchObject({
        parent: 'GS_FieldPlayer_Rig',
        parentType: 'OBJECT',
        armatureModifiers: ['GS_FieldPlayer_Rig'],
        vertexGroups: ['CC_Base_Spine02'],
      });
      expect(variant.backNumbers).toHaveLength(1);
      expect(variant.backNumbers[0]).toMatchObject({
        name: `GS_${side === 'home' ? 'Home' : 'Away'}_Jersey_Back_Number_17`,
        parent: 'GS_FieldPlayer_Rig',
        armatureModifiers: ['GS_FieldPlayer_Rig'],
        vertexGroups: ['CC_Base_Spine02'],
      });
    }
  });

  it('keeps the new GLBs private, complete, and byte-identical to their runtime review copies', () => {
    const report = readJson('asset-inbox/players/vnext/cmu16-ik-uniform-private-export-report.json');
    expect(report).toMatchObject({
      status: 'private-uniform-runtime-review-exported',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
    });
    expect(report.actionNames).toEqual(report.requiredActions);
    for (const side of ['home', 'away']) {
      const variant = report.variants[side];
      const runtime = path.join(root, `src/assets/vnext3d-review/field-${side}-cmu16-ik-uniform.glb`);
      expect(variant.bytes).toBeGreaterThan(2_000_000);
      expect(variant.sleeveObjects).toHaveLength(2);
      expect(variant.detachedBackNumberObjects).toEqual([]);
      expect(variant.frontMark).toMatchObject({
        armatureModifiers: ['GS_FieldPlayer_Rig'],
        vertexGroups: ['CC_Base_Spine02'],
      });
      expect(variant.backNumber).toMatchObject({
        armatureModifiers: ['GS_FieldPlayer_Rig'],
        vertexGroups: ['CC_Base_Spine02'],
      });
      expect(digest(runtime)).toBe(digest(variant.file));
    }
  });

  it('records close home and away review angles without approving the candidate', () => {
    const closeReport = readJson('asset-inbox/players/vnext/cmu16-ik-uniform-close-render-report.json');
    const motionReport = readJson('asset-inbox/players/vnext/cmu16-ik-uniform-render-report.json');
    expect(closeReport).toMatchObject({
      status: 'rendered-for-private-human-review',
      decision: 'not-runtime-approved',
      publicRuntimeAllowed: false,
      views: ['front', 'rear', 'side', 'three-quarter'],
      variants: ['home', 'away'],
    });
    expect(closeReport.outputs).toHaveLength(8);
    expect(motionReport.outputs).toHaveLength(12);
    for (const output of [...closeReport.outputs, ...motionReport.outputs]) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(200_000);
      expect(path.dirname(output.path)).toBe(evidenceRoot);
    }
  });

  it('exposes the candidate only through the private motion-review selector', () => {
    const source = fs.readFileSync(path.join(root, 'src/components/vnext3d/productionAssets.js'), 'utf8');
    expect(source).toContain("reviewId === 'cmu-jog16-ik-uniform'");
    expect(source).toContain('PRIVATE_CMU16_IK_UNIFORM_REVIEW_ASSETS');
    expect(source).not.toContain('PRODUCTION_ATHLETE_ASSETS = PRIVATE_CMU16_IK_UNIFORM_REVIEW_ASSETS');
    expect(fs.statSync(path.join(assetRoot, 'goon-field-player-cmu16-ik-uniform-audition.blend')).size)
      .toBeGreaterThan(8_000_000);
  });

  it('keeps promotion closed while recording the visual improvement and failed sub-gates', () => {
    const evidence = readJson(
      'docs/vnext/evidence/athlete-uniform-refinement-review/runtime-cmu16-ik-uniform-review.json',
    );
    expect(evidence).toMatchObject({
      candidate: 'cmu16-ik-uniform-refinement',
      humanVisualDecision: 'not-approved',
      promotionDecision: 'keep-private',
      publicRuntimeAllowed: false,
      browserErrors: [],
    });
    expect(evidence.blenderReview).toMatchObject({
      oversizedInheritedShoulderCapsRemoved: true,
      frontMarkFollowsChest: true,
      backNumberPresentAndArmatureBound: true,
      sleeveOpeningStillTooExposed: true,
    });
    for (const review of [evidence.desktopRuntime, evidence.mobileRuntime]) {
      expect(review).toMatchObject({
        scenePlayerCount: 12,
        canvasCount: 1,
        selectedAction: 'sprint',
        horizontalOverflow: false,
      });
      expect(fs.statSync(path.join(root, review.screenshot)).size).toBeGreaterThan(30_000);
    }
    expect(evidence.desktopTransition).toMatchObject({
      passesSlidingTarget: true,
      passesClearanceTarget: true,
      passesPenetrationTolerance: true,
      passesTransitionFrameTarget: false,
    });
    expect(evidence.mobileTransition).toMatchObject({
      passesSlidingTarget: true,
      passesClearanceTarget: true,
      passesPenetrationTolerance: false,
      passesTransitionFrameTarget: true,
    });
  });
});
