import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const readBytes = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');

const refinement = readJson('asset-inbox/players/vnext/cmu16-ik-upper-body-refinement-report.json');
const baselineAudit = readJson('asset-inbox/players/vnext/cmu16-ik-continuous-upper-body-audit.json');
const audit = readJson('asset-inbox/players/vnext/cmu16-ik-upper-body-audit.json');
const actionReview = readJson('asset-inbox/players/vnext/cmu16-ik-upper-body-action-render-report.json');
const privateExport = readJson('asset-inbox/players/vnext/cmu16-ik-upper-body-private-export-report.json');

const sourceRuntimePairs = [
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-home-cmu16-ik-upper-body-review.glb',
    'src/assets/vnext3d-review/field-home-cmu16-ik-upper-body.glb',
  ],
  [
    'asset-inbox/players/vnext/private-runtime-review/goon-field-player-away-cmu16-ik-upper-body-review.glb',
    'src/assets/vnext3d-review/field-away-cmu16-ik-upper-body.glb',
  ],
];

describe('vNext private upper-body athlete review', () => {
  it('keeps the revision private while improving the fitted garment and cage', () => {
    expect(refinement.publicRuntimeAllowed).toBe(false);
    expect(refinement.decision).toBe('not-runtime-approved');
    expect(refinement.bodyMask.facesRemoved).toBeGreaterThan(3_000);
    expect(refinement.motionActionsChanged).toEqual([]);
    expect(refinement.handOrStickTransformsChanged).toBe(false);

    for (const variant of Object.values(refinement.variants)) {
      expect(variant.jersey.topology.connectedComponents).toBe(1);
      expect(variant.jersey.topology.unweightedVertices).toBe(0);
      expect(variant.jersey.materialBoundary.method).toBe('shoulder-yoke-with-fitted-sleeve-v1');
      expect(variant.helmetCage).toHaveLength(6);
      expect(variant.helmetCage.every((segment) => segment.localForwardShiftCm === 13)).toBe(true);
    }
  });

  it('bounds measured rear sleeve intrusion and fits the cage closer to the head', () => {
    const candidate = audit.reviewFrame.rearSleeveIntrusion;
    expect(candidate.candidateCount).toBe(14);
    expect(candidate.furthestRearY).toBeLessThan(0.05);

    const baselineCageDistances = Object.entries(baselineAudit.reviewFrame.headAttachments)
      .filter(([name]) => name.includes('Helmet_Cage_'))
      .map(([, attachment]) => attachment.distanceFromHeadCenter);
    const cageDistances = Object.entries(audit.reviewFrame.headAttachments)
      .filter(([name]) => name.includes('Helmet_Cage_'))
      .map(([, attachment]) => attachment.distanceFromHeadCenter);
    expect(cageDistances).toHaveLength(12);
    expect(Math.max(...cageDistances)).toBeLessThan(0.15);
    expect(Math.max(...cageDistances)).toBeLessThan(Math.max(...baselineCageDistances));
  });

  it('renders every runtime action from front, rear, and side for human review', () => {
    const actionNames = Object.keys(actionReview.actionFrames);
    expect(actionNames).toEqual([
      'ready', 'jog', 'sprint', 'turn', 'stop', 'receive', 'pass', 'shot', 'jog-to-sprint-ik',
    ]);
    expect(actionReview.views).toEqual(['front', 'rear', 'side']);
    expect(actionReview.outputs).toHaveLength(27);
    for (const output of actionReview.outputs) {
      expect(fs.statSync(output.path).size).toBeGreaterThan(10_000);
    }
    expect(actionReview.publicRuntimeAllowed).toBe(false);
  });

  it('exports byte-identical private GLBs without promoting the asset map', () => {
    expect(privateExport.requiredActions).toEqual([
      'jog', 'jog-to-sprint-ik', 'pass', 'ready', 'receive', 'shot', 'sprint', 'stop', 'turn',
    ]);
    expect(privateExport.publicRuntimeAllowed).toBe(false);
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
    expect(acceptedMap).not.toContain('upper-body');
    expect(assetsModule).toContain("reviewId === 'cmu-jog16-ik-upper-body'");
  });
});
