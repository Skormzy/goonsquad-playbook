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
const authoring = readJson('asset-inbox/players/vnext/contact-authoring-report.json');
const quality = readJson('asset-inbox/players/vnext/contact-quality-report.json');
const exported = readJson('asset-inbox/players/vnext/contact-export-report.json');

describe('vNext field-player contact acceptance', () => {
  it('authors one two-hand contact rig across every required action', () => {
    expect(authoring.status).toBe('authored-for-contact-review');
    expect(authoring.armature).toBe('GS_FieldPlayer_Rig');
    expect(authoring.controlBones).toEqual(expect.arrayContaining([
      'GS_Stick_Control',
      'GS_L_Hand_Target',
      'GS_R_Hand_Target',
      'GS_Ball_Control',
    ]));
    expect(authoring.handConstraints).toHaveLength(2);
    expect(authoring.actions.map((action) => action.name).sort()).toEqual(requiredActions);
  });

  it('passes hand, shaft, ball, and floor contact policy on every frame', () => {
    expect(quality.status).toBe('passed');
    expect(quality.failures).toEqual([]);
    for (const action of quality.actions) {
      expect(action.maxLeftHandTargetDistanceCm).toBeLessThanOrEqual(quality.policy.maximumHandTargetDistanceCm);
      expect(action.maxRightHandTargetDistanceCm).toBeLessThanOrEqual(quality.policy.maximumHandTargetDistanceCm);
      expect(action.maxLeftHandShaftDistanceCm).toBeLessThanOrEqual(quality.policy.maximumHandShaftDistanceCm);
      expect(action.maxRightHandShaftDistanceCm).toBeLessThanOrEqual(quality.policy.maximumHandShaftDistanceCm);
      expect(action.minimumBladeWorldZ).toBeGreaterThanOrEqual(quality.policy.minimumBladeWorldZ);
      if (action.ballContactErrorCm !== null) {
        expect(action.ballContactErrorCm).toBeLessThanOrEqual(quality.policy.maximumBallContactErrorCm);
      }
    }
  });

  it('exports the stick, orange ball, and all eight actions for both uniforms', () => {
    expect(exported.status).toBe('contact-candidates-exported');
    expect(exported.actionNames).toEqual(requiredActions);
    for (const variant of ['home', 'away']) {
      const candidate = exported.variants[variant];
      expect(candidate.bytes).toBeGreaterThan(2_500_000);
      expect(candidate.stickObjects).toHaveLength(3);
      expect(candidate.includesBall).toBe(true);
      expect(fs.statSync(candidate.file).size).toBe(candidate.bytes);
      const document = readGlbDocument(candidate.file);
      expect((document.animations ?? []).map((animation) => animation.name).sort()).toEqual(requiredActions);
      const nodes = document.nodes ?? [];
      const nodeNames = nodes.map((node) => node.name);
      expect(nodeNames).toContain('GS_Contact_Ball');
      expect(nodes.filter((node) => node.mesh !== undefined && node.name?.includes('_Stick_'))).toHaveLength(3);
      const ballMaterial = (document.materials ?? []).find((material) => material.name === 'GS_Contact_Ball_Orange');
      const ballColor = ballMaterial?.pbrMetallicRoughness?.baseColorFactor;
      expect(ballColor).toHaveLength(4);
      expect(ballColor[0]).toBeCloseTo(1, 5);
      expect(ballColor[1]).toBeCloseTo(0.075, 5);
      expect(ballColor[2]).toBeCloseTo(0.006, 5);
      expect(ballColor[3]).toBeCloseTo(1, 5);
    }
  });

  it('records close visual acceptance while keeping public 3D locked', () => {
    const contact = acceptance.replacementContact;
    expect(contact.status).toBe('accepted-as-authored-contact-base');
    expect(contact.publicRuntimeAllowed).toBe(false);
    expect(acceptance.acceptedForPublicRuntime).toBe(false);
    expect(exists(contact.workfile, 5_000_000)).toBe(true);
    expect(exists(contact.handsThreeQuarterReview, 500_000)).toBe(true);
    expect(exists(contact.handsSideReview, 500_000)).toBe(true);
    expect(exists(contact.bladeBallReview, 100_000)).toBe(true);
    expect(exists(contact.humanReview, 1_000)).toBe(true);
  });
});
