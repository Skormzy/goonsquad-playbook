import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const assetDirectory = path.join(
  root,
  'asset-inbox/players/vnext/production-glove-finish',
);
const evidenceDirectory = path.join(
  root,
  'docs/vnext/evidence/athlete-production-glove-finish-review',
);
const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const author = readJson(path.join(assetDirectory, 'production-glove-finish-author-report.json'));
const audit = readJson(path.join(assetDirectory, 'production-glove-finish-audit.json'));
const closeRenders = readJson(path.join(evidenceDirectory, 'close-render-report.json'));
const actionRenders = readJson(path.join(evidenceDirectory, 'action-render-report.json'));
const review = readJson(path.join(
  evidenceDirectory,
  'production-glove-finish-human-review.json',
));

describe('vNext private production glove finish', () => {
  it('authors the fail-closed finish without changing runtime assets', () => {
    expect(fs.existsSync(path.join(
      assetDirectory,
      'goon-field-player-cmu16-ik-production-glove-finish-audition.blend',
    ))).toBe(true);
    expect(author).toMatchObject({
      status: 'private-production-glove-finish-authored',
      decision: 'human-review-required',
      finishRevision: 'tucked-sleeve-manufactured-finish-v1',
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
      generatedSegmentedAthleteReused: false,
    });
  });

  it('keeps all four sleeve cuffs inside the gloves through nine actions', () => {
    expect(audit).toMatchObject({
      status: 'private-production-glove-finish-audited',
      automatedPass: true,
      publicRuntimeAllowed: false,
      unweightedVertices: 0,
      maximumWeightSumError: 0,
    });
    expect(audit.summary.minimumSleeveCuffDistanceCm).toBeGreaterThanOrEqual(6.99);
    expect(audit.summary.maximumSleeveCuffRadiusCm).toBeLessThanOrEqual(4.2);
    expect(Object.keys(audit.overlapByAction)).toHaveLength(9);
    expect(audit.checks).toMatchObject({
      fourCompleteFinishedFits: true,
      allFinishedObjectsHaveUvs: true,
      allVerticesWeighted: true,
      fourManufacturedMaterials: true,
      integratedCuffSegmentation: true,
      sleeveCuffTuckedAcrossActions: true,
      allNineActionsAudited: true,
      privateFailClosed: true,
    });
    for (const variant of Object.values(audit.inventories)) {
      for (const side of Object.values(variant)) {
        expect(side).toMatchObject({
          objectCount: 32,
          fittedObjectCount: 32,
          floatingCuffPanelCount: 0,
          uvReadyObjects: 32,
        });
      }
    }
  });

  it('adds manufactured material nodes and integrated cuff regions only', () => {
    expect(Object.keys(audit.materials)).toHaveLength(4);
    for (const material of Object.values(audit.materials)) {
      expect(material).toMatchObject({
        hasMicroNormal: true,
        hasLeatherGrain: true,
        hasRoughnessVariation: true,
      });
    }
    for (const topology of Object.values(audit.topology)) {
      expect(topology.integratedRedCuffPolygons).toBeGreaterThanOrEqual(50);
      expect(topology.floatingCuffDetailGeometry).toBe(false);
      expect(topology.cuffPanelVertices).toBe(0);
      expect(topology.cuffPanelPolygons).toBe(0);
    }
    const authorScript = fs.readFileSync(
      path.join(root, 'scripts/blender/refine_vnext_production_glove_finish.py'),
      'utf8',
    );
    expect(authorScript).not.toContain('Finish_Cuff_Pad');
    expect(authorScript).not.toContain("'segmented-cuff-protection'");
  });

  it('provides hidden close and all-action evidence', () => {
    expect(closeRenders).toMatchObject({
      status: 'rendered-for-private-production-glove-finish-review',
      finishRevision: 'tucked-sleeve-manufactured-finish-v1',
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

  it('records the visual rejection and keeps the candidate private', () => {
    expect(review).toMatchObject({
      decision: 'approve-overlap-and-material-direction-reject-production-runtime',
      sleeveOverlapApproved: true,
      allActionOverlapApproved: true,
      manufacturedMaterialDirectionApproved: true,
      integratedCuffSegmentationApproved: true,
      floatingCuffGeometryRemoved: true,
      fingerArmorApproved: false,
      palmConstructionApproved: false,
      productionGloveApproved: false,
      humanVisualApproval: false,
      publicRuntimeAllowed: false,
      acceptedRuntimeAssetsChanged: false,
      runtimeSelectorAdded: false,
      glbExported: false,
    });
    expect(review.rejectedQualities.length).toBeGreaterThanOrEqual(4);

    const assetsModule = fs.readFileSync(
      path.join(root, 'src/components/vnext3d/productionAssets.js'),
      'utf8',
    );
    expect(assetsModule).not.toContain('production-glove-finish');
    expect(assetsModule).not.toContain('tucked-sleeve-manufactured-finish-v1');
  });
});
