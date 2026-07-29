import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson('asset-inbox/players/vnext/cmu16-ik-open-face-refinement-report.json');
const actionReview = readJson('asset-inbox/players/vnext/cmu16-ik-open-face-action-render-report.json');
const privateExport = readJson('asset-inbox/players/vnext/cmu16-ik-open-face-private-export-report.json');

const sourceRuntimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-open-face-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-open-face.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-open-face-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-open-face.glb',
  ],
];

describe('vNext private open-face helmet review', () => {
  it('removes every field-player cage while preserving both helmet shells', () => {
    expect(refinement.publicRuntimeAllowed).toBe(false);
    expect(refinement.decision).toBe('not-runtime-approved');
    expect(refinement.removedCageObjectCount).toBe(12);
    expect(refinement.removedCageObjects.every((name) => name.includes('_Helmet_Cage_'))).toBe(true);
    expect(refinement.remainingCageObjects).toEqual([]);
    expect(refinement.retainedHelmetShells).toEqual([
      'GS_Away_Helmet_Shell',
      'GS_Home_Helmet_Shell',
    ]);
    expect(refinement.retainedHelmetCenterStripes).toHaveLength(2);
    expect(refinement.motionActionsChanged).toEqual([]);
    expect(refinement.handOrStickTransformsChanged).toBe(false);
  });

  it('renders all nine actions from three close views', () => {
    expect(Object.keys(actionReview.actionFrames)).toEqual([
      'ready', 'jog', 'sprint', 'turn', 'stop', 'receive', 'pass', 'shot', 'jog-to-sprint-ik',
    ]);
    expect(actionReview.views).toEqual(['front', 'rear', 'side']);
    expect(actionReview.outputs).toHaveLength(27);
    for (const output of actionReview.outputs) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(10_000);
    }
  });

  it('exports no cage object and keeps the GLBs private', () => {
    expect(privateExport.publicRuntimeAllowed).toBe(false);
    for (const variant of Object.values(privateExport.variants)) {
      expect(variant.objects.some((name) => name.includes('_Helmet_Cage_'))).toBe(false);
      expect(variant.objects.some((name) => name.endsWith('_Helmet_Shell'))).toBe(true);
    }
    for (const [source, runtime] of sourceRuntimePairs) {
      expect(sha256(readBytes(runtime))).toBe(sha256(readBytes(source)));
      expect(readBytes(runtime).length).toBeLessThan(3_000_000);
    }

    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    const acceptedMap = assetsModule.split('export const PRODUCTION_ATHLETE_ASSETS')[1]
      .split('export const PRIVATE_MOTION_REVIEW_ASSETS')[0];
    expect(acceptedMap).not.toContain('open-face');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-open-face'");
  });
});
