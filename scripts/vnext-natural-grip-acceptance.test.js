import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson('asset-inbox/players/vnext/cmu16-ik-natural-grip-refinement-report.json');
const audit = readJson('asset-inbox/players/vnext/cmu16-ik-natural-grip-audit.json');
const actionReview = readJson('asset-inbox/players/vnext/cmu16-ik-natural-grip-action-render-report.json');
const privateExport = readJson('asset-inbox/players/vnext/cmu16-ik-natural-grip-private-export-report.json');

const sourceRuntimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-natural-grip-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-natural-grip.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-natural-grip-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-natural-grip.glb',
  ],
];

describe('vNext private natural-grip athlete review', () => {
  it('widens and lowers the grip while stabilizing the shoulder cap', () => {
    expect(refinement.publicRuntimeAllowed).toBe(false);
    expect(refinement.decision).toBe('not-runtime-approved');
    expect(refinement.handControls.beforeGripSeparationCm).toBe(20);
    expect(refinement.handControls.afterGripSeparationCm).toBe(32);
    expect(refinement.handControls.targetMidpointLoweringCm).toBe(9);
    expect(refinement.bodyHandMask.facesRemoved).toBeGreaterThan(3_000);
    for (const shoulder of Object.values(refinement.shoulders)) {
      expect(shoulder.adjustedVertexCount).toBeGreaterThan(450);
      expect(shoulder.meanUpperarmWeightAfter).toBeLessThan(shoulder.meanUpperarmWeightBefore);
    }
    expect(refinement.motionActionsChanged).toEqual([]);
    expect(refinement.stickControlKeyframesChanged).toBe(false);
  });

  it('rigidly binds tailored gloves and removes exposed hand geometry', () => {
    expect(Object.keys(refinement.gloves)).toHaveLength(4);
    for (const [name, pair] of Object.entries(refinement.gloves)) {
      const expectedBone = name.includes('_Left') ? 'CC_Base_L_Hand' : 'CC_Base_R_Hand';
      expect(pair.glove.method).toBe('scaled-rigid-existing-glove-v1');
      expect(pair.glove.rigidBone).toBe(expectedBone);
      expect(pair.cuff.rigidBone).toBe(expectedBone);
      expect(pair.glove.after.dimensionsCm[0]).toBeLessThan(pair.glove.before.dimensionsCm[0]);
      expect(pair.glove.after.dimensionsCm[1]).toBeLessThan(pair.glove.before.dimensionsCm[1]);
    }
  });

  it('reduces the most visible locomotion and contact shoulder elevations', () => {
    expect(audit.actionReports.jog.maximumShoulderElevationFromDownDegrees).toBeLessThan(60);
    expect(audit.actionReports.sprint.maximumShoulderElevationFromDownDegrees).toBeLessThan(60);
    expect(audit.actionReports.pass.maximumShoulderElevationFromDownDegrees).toBeLessThan(45);
    expect(audit.actionReports.shot.maximumShoulderElevationFromDownDegrees).toBeLessThan(50);
  });

  it('renders all nine actions from three close views', () => {
    expect(actionReview.views).toEqual(['front', 'rear', 'side']);
    expect(actionReview.outputs).toHaveLength(27);
    for (const output of actionReview.outputs) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(10_000);
    }
  });

  it('exports the private candidate byte-identically without a cage', () => {
    expect(privateExport.publicRuntimeAllowed).toBe(false);
    expect(privateExport.actionNames).toHaveLength(9);
    for (const variant of Object.values(privateExport.variants)) {
      expect(variant.objects.some((name) => name.includes('_Helmet_Cage_'))).toBe(false);
    }
    for (const [source, runtime] of sourceRuntimePairs) {
      expect(sha256(readBytes(runtime))).toBe(sha256(readBytes(source)));
      expect(readBytes(runtime).length).toBeLessThan(2_500_000);
    }

    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    const acceptedMap = assetsModule.split('export const PRODUCTION_ATHLETE_ASSETS')[1]
      .split('export const PRIVATE_MOTION_REVIEW_ASSETS')[0];
    expect(acceptedMap).not.toContain('natural-grip');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-natural-grip'");
  });
});
