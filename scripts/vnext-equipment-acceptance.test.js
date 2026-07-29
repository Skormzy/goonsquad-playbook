import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const acceptance = JSON.parse(fs.readFileSync(
  path.join(root, 'docs', 'vnext', 'assets', 'production-athlete-acceptance.json'),
  'utf8',
));
const authoringReport = JSON.parse(fs.readFileSync(
  path.join(root, 'asset-inbox', 'players', 'vnext', 'equipment-authoring-report.json'),
  'utf8',
));
const exportReport = JSON.parse(fs.readFileSync(
  path.join(root, 'asset-inbox', 'players', 'vnext', 'equipment-export-report.json'),
  'utf8',
));

function exists(relativePath, minimumBytes = 1) {
  const stat = fs.statSync(path.join(root, relativePath));
  return stat.isFile() && stat.size >= minimumBytes;
}

describe('vNext field-player equipment acceptance', () => {
  it('contains every required field-player equipment group', () => {
    expect(authoringReport.status).toBe('authored-for-human-review');
    expect(authoringReport.missingGroups).toEqual([]);
    expect(authoringReport.equipmentGroups).toEqual(expect.arrayContaining([
      'jersey',
      'shorts',
      'shoe',
      'glove',
      'helmet',
      'stick',
      'uniform-mark',
    ]));
    expect(authoringReport.equipmentObjectCount).toBeGreaterThanOrEqual(50);
  });

  it('exports distinct home and away GLB candidates', () => {
    expect(exportReport.status).toBe('equipment-candidates-exported');
    for (const variant of ['home', 'away']) {
      const candidate = exportReport.variants[variant];
      expect(candidate.objectCount).toBeGreaterThanOrEqual(30);
      expect(candidate.bytes).toBeGreaterThan(1_000_000);
      expect(fs.statSync(candidate.file).size).toBe(candidate.bytes);
    }
  });

  it('keeps visual acceptance evidence and the public runtime gate explicit', () => {
    expect(acceptance.replacementEquipment.status).toBe('accepted-as-authored-equipment-base');
    expect(acceptance.replacementEquipment.publicRuntimeAllowed).toBe(false);
    expect(exists(acceptance.replacementEquipment.workfile, 5_000_000)).toBe(true);
    expect(exists(acceptance.replacementEquipment.multiAngleReview, 100_000)).toBe(true);
    expect(exists(acceptance.replacementEquipment.humanReview, 500)).toBe(true);
    expect(acceptance.acceptedForPublicRuntime).toBe(false);
  });
});
