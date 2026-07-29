import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const assetDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-surface',
);
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/athlete-production-glove-surface-review',
);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const author = readJson(path.join(assetDirectory, 'production-glove-surface-author-report.json'));
const probe = readJson(path.join(assetDirectory, 'production-glove-surface-probe-after.json'));
const closeRenders = readJson(path.join(evidenceDirectory, 'close-render-report.json'));
const actionRenders = readJson(path.join(evidenceDirectory, 'action-render-report.json'));
const review = readJson(path.join(
  evidenceDirectory,
  'production-glove-surface-human-review.json',
));

describe('vNext private production glove surface refinement', () => {
  it('authors four private surface variants without runtime exposure', () => {
    expect(fs.existsSync(path.join(
      assetDirectory,
      'goon-field-player-cmu16-ik-production-glove-surface-audition.blend',
    ))).toBe(true);
    expect(author).toMatchObject({
      status: 'private-production-glove-surface-authored',
      decision: 'human-review-required',
      surfaceRevision: 'closed-palm-cuff-transition-v7',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
      generatedSegmentedGeometryReused: false,
    });
    for (const variant of Object.values(author.variants)) {
      for (const side of Object.values(variant)) {
        expect(side.removedOversizedCuffObjects).toHaveLength(2);
        expect(Object.keys(side.createdObjects)).toHaveLength(3);
        expect(side.cuffProfile.skinningMode).toBe('linear');
      }
    }
  });

  it('keeps the corrected cuff dimensions bounded in evaluated geometry', () => {
    expect(probe).toMatchObject({
      status: 'private-glove-surface-probed',
      publicRuntimeAllowed: false,
      visibleBrowserWindowOpened: false,
      visibleBlenderWindowOpened: false,
    });
    for (const variant of ['Home', 'Away']) {
      for (const side of ['Left', 'Right']) {
        const prefix = `GS_${variant}_Glove_${side}_`;
        expect(probe.objects.filter((object) => object.name.startsWith(prefix))).toHaveLength(33);
        const shell = probe.objects.find((object) => object.name === `${prefix}ProductionShell`);
        const forearm = Object.values(shell.groupProfiles)[0].wristProfile;
        expect(forearm.radialP95Cm).toBeLessThan(7);
        expect(forearm.radialMaximumCm).toBeLessThan(7.5);
        const liner = probe.objects.find(
          (object) => object.name === `${prefix}Production_Cuff_Transition`,
        );
        expect(liner.vertices).toBe(128);
        expect(liner.wristProfile.radialP95Cm).toBeLessThan(4.8);
        expect(liner.wristProfile.radialMaximumCm).toBeLessThanOrEqual(4.85);
        expect(liner.boundaryComponents).toHaveLength(2);
      }
    }
  });

  it('provides hidden close and all-action evidence', () => {
    expect(closeRenders).toMatchObject({
      surfaceRevision: 'closed-palm-cuff-transition-v7',
      publicRuntimeAllowed: false,
      visibleBrowserWindowOpened: false,
      visibleBlenderWindowOpened: false,
      resolution: [512, 512],
    });
    expect(actionRenders).toMatchObject({
      publicRuntimeAllowed: false,
      visibleBrowserWindowOpened: false,
      visibleBlenderWindowOpened: false,
    });
    expect(closeRenders.outputs).toHaveLength(22);
    expect(actionRenders.outputs).toHaveLength(27);
    for (const output of [...closeRenders.outputs, ...actionRenders.outputs]) {
      expect(fs.existsSync(output.path)).toBe(true);
      expect(fs.statSync(output.path).size).toBeGreaterThan(100_000);
    }
    for (const relativePath of review.reviewedContactSheets) {
      const filePath = path.join(evidenceDirectory, relativePath);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.statSync(filePath).size).toBeGreaterThan(500_000);
    }
  });

  it('records the failed macro review and keeps the candidate private', () => {
    expect(review).toMatchObject({
      decision: 'approve-stability-direction-reject-production-runtime',
      stableLinearSkinningApproved: true,
      detachedCuffHoopRemoved: true,
      allActionStabilityApproved: true,
      closedPalmApproved: false,
      cuffProductFormApproved: false,
      productionGloveApproved: false,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
    });
    expect(review.rejectedQualities.length).toBeGreaterThanOrEqual(5);

    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(assetsModule).not.toContain('production-glove-surface');
    expect(assetsModule).not.toContain('closed-palm-cuff-transition-v7');
  });
});
