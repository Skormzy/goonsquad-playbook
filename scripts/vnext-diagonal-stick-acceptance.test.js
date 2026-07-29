import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson('asset-inbox/players/vnext/cmu16-ik-diagonal-stick-refinement-report.json');
const audit = readJson('asset-inbox/players/vnext/cmu16-ik-diagonal-stick-audit.json');
const actionReview = readJson('asset-inbox/players/vnext/cmu16-ik-diagonal-stick-action-render-report.json');
const privateExport = readJson('asset-inbox/players/vnext/cmu16-ik-diagonal-stick-private-export-report.json');

const sourceRuntimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-diagonal-stick-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-diagonal-stick.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-diagonal-stick-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-diagonal-stick.glb',
  ],
];

describe('vNext private diagonal-stick athlete review', () => {
  it('authors a compact two-hand grip with torso-following elbow controls', () => {
    expect(refinement.publicRuntimeAllowed).toBe(false);
    expect(refinement.decision).toBe('not-runtime-approved');
    expect(refinement.handControls.beforeGripSeparationCm).toBe(32);
    expect(refinement.handControls.afterGripSeparationCm).toBeGreaterThan(18);
    expect(refinement.handControls.afterGripSeparationCm).toBeLessThan(19);
    expect(Object.keys(refinement.handControls.poles)).toEqual([
      'GS_L_Elbow_Pole',
      'GS_R_Elbow_Pole',
    ]);
    for (const pole of Object.values(refinement.handControls.poles)) {
      expect(pole.parent).toBe('CC_Base_Spine02');
    }
    expect(refinement.handControls.constraints.every((constraint) => constraint.chainCount === 3))
      .toBe(true);
  });

  it('replaces straight-arm poses with measured athletic elbow bend', () => {
    const reports = Object.fromEntries(refinement.actions.map((action) => [action.name, action]));
    for (const name of ['ready', 'jog', 'sprint', 'jog-to-sprint-ik']) {
      expect(reports[name].rightElbowBendRangeDegrees[1]).toBeLessThan(120);
      expect(reports[name].leftElbowBendRangeDegrees[0]).toBeGreaterThan(60);
    }
    expect(reports.receive.rightElbowBendRangeDegrees[1]).toBeLessThan(125);
    expect(reports.pass.rightElbowBendRangeDegrees[1]).toBeLessThan(140);
    expect(reports.shot.rightElbowBendRangeDegrees[1]).toBeLessThan(155);
    expect(audit.actionReports.ready.minimumElbowBendDegrees).toBeGreaterThan(70);
  });

  it('keeps a visible diagonal shaft, planted blade, and exact contact frames', () => {
    const reports = Object.fromEntries(refinement.actions.map((action) => [action.name, action]));
    expect(reports.ready.shaftTiltRangeDegrees[0]).toBeGreaterThan(20);
    expect(reports.sprint.shaftTiltRangeDegrees[1]).toBeGreaterThan(27);
    expect(reports.shot.shaftTiltRangeDegrees[1]).toBeGreaterThan(34);
    for (const name of ['receive', 'pass', 'shot']) {
      expect(reports[name].contactErrorCm).toBe(0);
      expect(reports[name].maximumFloorCorrectionMm).toBeLessThan(60);
    }
    expect(refinement.ballContactReauthored).toBe(true);
    expect(refinement.acceptedRuntimeAssetsChanged).toBe(false);
    for (const counts of Object.values(refinement.nonControlKeyframeCounts)) {
      expect(counts.after).toBe(counts.before);
    }
  });

  it('renders all nine actions from three close views', () => {
    expect(actionReview.views).toEqual(['front', 'rear', 'side']);
    expect(actionReview.outputs).toHaveLength(27);
    for (const output of actionReview.outputs) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(10_000);
    }
  });

  it('exports byte-identical private GLBs without changing the accepted map', () => {
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
    expect(acceptedMap).not.toContain('diagonal-stick');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-diagonal-stick'");
  });
});
