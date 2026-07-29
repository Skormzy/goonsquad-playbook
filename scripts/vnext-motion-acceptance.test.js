import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const requiredActions = ['jog', 'pass', 'ready', 'receive', 'shot', 'sprint', 'stop', 'turn'];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function exists(relativePath, minimumBytes = 1) {
  const stat = fs.statSync(path.join(root, relativePath));
  return stat.isFile() && stat.size >= minimumBytes;
}

function readGlbAnimationNames(filePath) {
  const buffer = fs.readFileSync(filePath);
  expect(buffer.readUInt32LE(0)).toBe(0x46546c67);
  expect(buffer.readUInt32LE(4)).toBe(2);
  expect(buffer.readUInt32LE(8)).toBe(buffer.length);
  expect(buffer.readUInt32LE(16)).toBe(0x4e4f534a);

  const jsonLength = buffer.readUInt32LE(12);
  const document = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8'));
  return (document.animations ?? []).map((animation) => animation.name).sort();
}

const acceptance = readJson('docs/vnext/assets/production-athlete-acceptance.json');
const authoringReport = readJson('asset-inbox/players/vnext/motion-authoring-report.json');
const qualityReport = readJson('asset-inbox/players/vnext/motion-quality-report.json');
const exportReport = readJson('asset-inbox/players/vnext/motion-export-report.json');

describe('vNext field-player motion acceptance', () => {
  it('authors every required action on one accepted rig', () => {
    expect(authoringReport.status).toBe('authored-for-human-review');
    expect(authoringReport.missingClipNames).toEqual([]);
    expect([...authoringReport.requiredClipNames].sort()).toEqual(requiredActions);
    expect(authoringReport.clips).toHaveLength(8);
    expect(authoringReport.clips.every((clip) => clip.startsGrounded && clip.endsGrounded)).toBe(true);
  });

  it('passes motion continuity and grounding policy', () => {
    expect(qualityReport.status).toBe('passed');
    expect(qualityReport.failures).toEqual([]);
    expect(qualityReport.sprintToStopEntryMaxRotationDegrees)
      .toBeLessThanOrEqual(qualityReport.policy.maximumSprintToStopEntryDegrees);

    for (const clip of qualityReport.clips) {
      expect(clip.maxFrameRotationDeltaDegrees)
        .toBeLessThanOrEqual(qualityReport.policy.maximumFrameRotationDeltaDegrees);
      expect(clip.minimumWorldZ)
        .toBeGreaterThanOrEqual(-qualityReport.policy.maximumGroundPenetrationMeters);
      expect(clip.rootEndpointOffsetCm)
        .toBeLessThanOrEqual(qualityReport.policy.maximumRootEndpointOffsetCm);
    }
  });

  it('exports all eight actions in both GLB candidates', () => {
    expect(exportReport.status).toBe('motion-candidates-exported');
    expect(exportReport.actionNames).toEqual(requiredActions);
    expect(exportReport.stickExcludedUntilContactGate).toBe(true);

    for (const variant of ['home', 'away']) {
      const candidate = exportReport.variants[variant];
      expect(candidate.bytes).toBeGreaterThan(2_000_000);
      expect(candidate.objects).toContain('GS_FieldPlayer_Rig');
      expect(fs.statSync(candidate.file).size).toBe(candidate.bytes);
      expect(readGlbAnimationNames(candidate.file)).toEqual(requiredActions);
    }
  });

  it('records visual acceptance while keeping public 3D locked', () => {
    const motion = acceptance.replacementMotion;
    expect(motion.status).toBe('accepted-as-authored-motion-base');
    expect(motion.publicRuntimeAllowed).toBe(false);
    expect(acceptance.acceptedForPublicRuntime).toBe(false);
    expect(exists(motion.workfile, 5_000_000)).toBe(true);
    expect(exists(motion.threeQuarterReview, 500_000)).toBe(true);
    expect(exists(motion.sideReview, 500_000)).toBe(true);
    expect(exists(motion.rejectedAuditionReview, 500_000)).toBe(true);
    expect(exists(motion.humanReview, 1_000)).toBe(true);
  });
});
