import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const assetDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-base',
);
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/production-glove-base-review',
);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const author = readJson(path.join(assetDirectory, 'production-glove-base-author-report.json'));
const audit = readJson(path.join(assetDirectory, 'production-glove-base-audit.json'));
const renders = readJson(path.join(assetDirectory, 'production-glove-base-render-report.json'));
const review = readJson(path.join(evidenceDirectory, 'production-glove-base-human-review.json'));

describe('vNext standalone production glove base', () => {
  it('authors one continuous fail-closed structural scaffold', () => {
    expect(author).toMatchObject({
      status: 'standalone-continuous-glove-base-authored',
      baseRevision: 'integrated-palm-wrist-shell-v5',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      athleteFitAttempted: false,
      runtimeSelectorAdded: false,
      generatedSegmentedApproachReused: false,
      construction: {
        continuousAnatomicalShell: true,
        taperedWristOpening: true,
        integratedPalmVolume: true,
        integratedThumbWeb: true,
        separatePalmInsert: false,
        detachedCuffBinding: false,
        curledFingerChannels: 4,
        fittedThumbPath: true,
        fingerPadSections: 12,
        fingerRootGussets: 3,
        individualKnuckleCaps: 4,
        articulatedFingerJointConstrictions: 12,
        anatomicalPalmOutline: true,
        segmentedCuffPads: 2,
      },
    });
    expect(author.detailObjects).not.toContain('GS_Glove_Palm_Leather');
    expect(author.detailObjects).not.toContain('GS_Glove_Palm_Heel_Reinforcement');
    expect(author.detailObjects).not.toContain('GS_Glove_Cuff_Roll');
    expect(author.detailObjects).not.toContain('GS_Glove_Cuff_Binding');
  });

  it('passes the topology, scale, contact, and penetration audit', () => {
    expect(audit).toMatchObject({
      automatedPass: true,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      connectedComponents: 1,
      nonManifoldEdges: 0,
    });
    expect(audit.vertices).toBeGreaterThanOrEqual(12_000);
    expect(audit.manufacturedDetailObjects).toBeGreaterThanOrEqual(28);
    expect(audit.shaftContact.angularCoverageDegrees).toBeGreaterThanOrEqual(210);
    expect(audit.shaftContact.penetratingVertices).toBeLessThanOrEqual(40);
    expect(Object.values(audit.checks).every(Boolean)).toBe(true);
  });

  it('provides five substantial headless close-review renders', () => {
    expect(renders).toMatchObject({
      publicRuntimeAllowed: false,
      visibleBrowserWindowOpened: false,
      visibleBlenderWindowOpened: false,
      resolution: [768, 768],
    });
    expect(renders.outputs).toHaveLength(5);
    for (const output of renders.outputs) {
      expect(fs.existsSync(output.path)).toBe(true);
      expect(fs.statSync(output.path).size).toBeGreaterThan(100_000);
    }
  });

  it('records an honest human split decision before athlete fitting', () => {
    expect(review).toMatchObject({
      decision: 'approve-integrated-source-fit-direction-reject-runtime',
      baseRevision: 'integrated-palm-wrist-shell-v5',
      structuralScaffoldApproved: true,
      sourceTopologyRebuildApproved: true,
      standaloneProductionBaseApproved: false,
      standaloneFitCandidateApproved: true,
      athleteFitApproved: true,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      evidence: {
        headlessBlender: true,
        visibleBlenderWindowOpened: false,
        visibleBrowserWindowOpened: false,
      },
    });
    expect(review.reviewedViews).toHaveLength(5);
    expect(review.rejectedQualities.length).toBeGreaterThanOrEqual(4);
  });

  it('does not expose the private standalone workfile through the runtime map', () => {
    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(assetsModule).not.toContain('production-glove-base');
    expect(assetsModule).not.toContain('integrated-palm-wrist-shell-v5');
  });
});
