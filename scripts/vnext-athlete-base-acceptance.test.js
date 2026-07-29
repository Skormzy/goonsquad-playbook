import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const acceptance = JSON.parse(fs.readFileSync(
  path.join(root, 'docs', 'vnext', 'assets', 'production-athlete-acceptance.json'),
  'utf8',
));

function exists(relativePath, minimumBytes = 1) {
  const stat = fs.statSync(path.join(root, relativePath));
  return stat.isFile() && stat.size >= minimumBytes;
}

describe('vNext production athlete base acceptance', () => {
  it('accepts the clean source only as the production base', () => {
    expect(acceptance.replacementSource.status).toBe('accepted-as-production-base');
    expect(acceptance.replacementSource.baseAssetAccepted).toBe(true);
    expect(acceptance.replacementSource.publicRuntimeAllowed).toBe(false);
    expect(acceptance.acceptedForPublicRuntime).toBe(false);
    expect(exists(acceptance.replacementSource.workfile, 10_000_000)).toBe(true);
  });

  it('keeps human and license reviews as explicit evidence', () => {
    expect(exists(acceptance.replacementSource.humanReview, 500)).toBe(true);
    expect(exists(acceptance.replacementSource.licenseReview, 500)).toBe(true);
    expect(exists(acceptance.replacementSource.multiAngleReview, 100_000)).toBe(true);
    expect(acceptance.replacementSource.passedReview).toEqual(expect.arrayContaining([
      'front',
      'side',
      'rear',
      'three-quarter',
      'broadcast',
      'shoulder deformation',
      'elbow deformation',
      'wrist deformation',
      'hip deformation',
      'knee deformation',
      'ankle deformation',
    ]));
  });
});
