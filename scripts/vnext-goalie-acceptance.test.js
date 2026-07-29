import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const requiredActions = ['goalie-ready', 'goalie-save-blocker', 'goalie-save-glove', 'goalie-set', 'goalie-shuffle'];
const requiredGroups = ['blocker', 'catch-glove', 'goalie-stick', 'jersey', 'leg-pad', 'mask', 'padded-pants', 'shoe'];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function exists(relativePath, minimumBytes = 1) {
  const stat = fs.statSync(path.join(root, relativePath));
  return stat.isFile() && stat.size >= minimumBytes;
}

function readGlbDocument(filePath) {
  const buffer = fs.readFileSync(filePath);
  expect(buffer.readUInt32LE(0)).toBe(0x46546c67);
  expect(buffer.readUInt32LE(4)).toBe(2);
  expect(buffer.readUInt32LE(8)).toBe(buffer.length);
  expect(buffer.readUInt32LE(16)).toBe(0x4e4f534a);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
}

const acceptance = readJson('docs/vnext/assets/production-athlete-acceptance.json');
const authoring = readJson('asset-inbox/players/vnext/goalie-authoring-report.json');
const quality = readJson('asset-inbox/players/vnext/goalie-quality-report.json');
const exported = readJson('asset-inbox/players/vnext/goalie-export-report.json');

describe('vNext goalie acceptance', () => {
  it('authors complete goalie equipment for two visually distinct variants', () => {
    expect(authoring.status).toBe('authored-for-human-review');
    expect(authoring.rig).toBe('GS_Goalie_Rig');
    expect(authoring.missingEquipmentGroups).toEqual([]);
    expect(authoring.equipmentGroups).toEqual(expect.arrayContaining(requiredGroups));
    expect(authoring.equipmentObjectCount).toBeGreaterThanOrEqual(90);
    expect(authoring.variants).toEqual(['GS_Goalie_Home', 'GS_Goalie_Away']);
  });

  it('passes grounded motion, continuity, and goalie silhouette policies', () => {
    expect(quality.status).toBe('passed');
    expect(quality.failures).toEqual([]);
    expect(quality.homeEquipmentObjectCount).toBeGreaterThanOrEqual(40);
    expect(quality.awayEquipmentObjectCount).toBeGreaterThanOrEqual(40);
    expect(quality.silhouette.widthMeters).toBeGreaterThanOrEqual(quality.policy.minimumGoalieSilhouetteWidthMeters);
    const shuffle = quality.clips.find((clip) => clip.clipName === 'goalie-shuffle');
    expect(shuffle.lateralTravelCm).toBeGreaterThanOrEqual(quality.policy.minimumShuffleTravelCm);
    for (const clip of quality.clips) {
      expect(clip.maxFrameRotationDeltaDegrees).toBeLessThanOrEqual(quality.policy.maximumFrameRotationDeltaDegrees);
      expect(clip.rootEndpointOffsetCm).toBeLessThanOrEqual(quality.policy.maximumRootEndpointOffsetCm);
      expect(clip.minimumWorldZ).toBeGreaterThanOrEqual(-quality.policy.maximumGroundPenetrationMeters);
      expect(clip.transitionOutToReadyMaxRotationDegrees).toBeLessThanOrEqual(quality.policy.maximumTransitionOutDegrees);
    }
  });

  it('exports both goalie variants with every authored action and equipment family', () => {
    expect(exported.status).toBe('goalie-candidates-exported');
    expect(exported.actionNames).toEqual(requiredActions);
    for (const variant of ['home', 'away']) {
      const candidate = exported.variants[variant];
      expect(candidate.bytes).toBeGreaterThan(2_000_000);
      expect(candidate.goalieEquipmentObjects.length).toBeGreaterThanOrEqual(40);
      expect(fs.statSync(candidate.file).size).toBe(candidate.bytes);
      const document = readGlbDocument(candidate.file);
      expect((document.animations ?? []).map((animation) => animation.name).sort()).toEqual(requiredActions);
      const names = (document.nodes ?? []).map((node) => node.name ?? '');
      expect(names.some((name) => name.includes('Leg_Pad'))).toBe(true);
      expect(names.some((name) => name.includes('Catch_Glove'))).toBe(true);
      expect(names.some((name) => name.includes('Blocker'))).toBe(true);
      expect(names.some((name) => name.includes('Mask_Cage'))).toBe(true);
      expect(names.some((name) => name.includes('Goalie_Stick'))).toBe(true);
    }
  });

  it('records human visual acceptance without opening the public 3D gate', () => {
    const goalie = acceptance.replacementGoalie;
    expect(goalie.status).toBe('accepted-as-authored-goalie-base');
    expect(goalie.goalieAssetAccepted).toBe(true);
    expect(goalie.publicRuntimeAllowed).toBe(false);
    expect(acceptance.acceptedForPublicRuntime).toBe(false);
    expect(exists(goalie.workfile, 4_000_000)).toBe(true);
    expect(exists(goalie.equipmentReview, 100_000)).toBe(true);
    expect(exists(goalie.motionFrontReview, 100_000)).toBe(true);
    expect(exists(goalie.motionThreeQuarterReview, 100_000)).toBe(true);
    expect(exists(goalie.humanReview, 1_000)).toBe(true);
  });
});
